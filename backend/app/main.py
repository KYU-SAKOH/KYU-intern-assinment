"""
サンプル CRUD API（バックエンドの入り口）

フロントエンド（Next.js）からの HTTP リクエストを受け取り、
データベース（MySQL）の問い合わせデータ（samples）を操作する。

役割のイメージ:
  ブラウザ → FastAPI（このファイル） → SQLAlchemy → MySQL

主なエンドポイントの見取り図:
  GET/POST /samples … 一覧・汎用作成
  POST /samples/draft|complete … 一時保存・本登録
  PATCH /samples/{id}/finalize … 下書き確定
  POST /triage … AI トリアージ（Gemini 必須）
  POST /reproduction-assist … 再現手順チェック（Gemini 必須）
  GET/POST /samples/{id}/messages … 対応履歴チャット
  PATCH /samples/{id}/notifications/read … スタッフ未読通知の解除

AI の実処理は triage.py / reproduction_assist.py / priority.py に委譲する。
スタッフ通知の送信口は notify.py（現状はデモ＝ログ）。
"""

import os
import re
import uuid
from datetime import date, datetime, time, timedelta
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from models import SampleMessageModel, SampleModel
from notify import notify_staff_update
from priority import score_from_sample_fields
from reproduction_assist import run_reproduction_assist
from schemas import (
    ReproductionAssistRequest,
    ReproductionAssistResponse,
    SampleAdminUpdate,
    SampleCreate,
    SampleDraftCreate,
    SampleFinalize,
    SampleMessageCreate,
    SampleMessageResponse,
    SamplePartialUpdate,
    SampleResponse,
    SampleTriageCompleteCreate,
    SampleUpdate,
    TriageRequest,
    TriageResponse,
    UploadScreenshotResponse,
    deserialize_reproduction_steps,
    serialize_reproduction_steps,
)
from text_utils import like_pattern
from triage import run_triage

# フロントの URL（CORS で「このオリジンからはアクセスOK」と許可する）
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

# スクショ保存先（デモ用・コンテナ内ローカル）
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_SCREENSHOT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024

# FastAPI アプリ本体。@app.get / @app.post などで「URL と処理」を結びつける
app = FastAPI(title="Sample API", version="1.0.0")

# CORS: ブラウザは別オリジン（例: :3000 → :8000）への通信を標準では拒否する。
# ここでフロントのオリジンを許可して、fetch が通るようにする。
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 画像配信は /media（POST /uploads/screenshot とパスを分ける）
app.mount("/media", StaticFiles(directory=str(UPLOAD_DIR)), name="media")

_STATUS_LABEL_JA = {
    "Pending": "未対応",
    "Temporarily Resolved": "一時対応済み",
    "Fully Resolved": "完全対応済み",
}


def _status_label_ja(status: str) -> str:
    return _STATUS_LABEL_JA.get(status, status)


def _mark_staff_notification(
    db_sample: SampleModel, *, kind: str, summary: str
) -> None:
    """
    スタッフ向け未読フラグを立て、通知送信口（notify.py）を呼ぶ。
    下書きやプレースホルダメールには送らない。
    """
    email = (db_sample.email or "").strip()
    if db_sample.is_draft or not email or email.endswith("@incomplete.local"):
        return

    db_sample.staff_notify_unread = True
    db_sample.staff_notify_kind = kind
    db_sample.staff_notify_at = datetime.utcnow()
    db_sample.staff_notify_summary = summary[:500]
    notify_staff_update(
        to_email=email,
        sample_id=db_sample.id,
        kind=kind,
        summary=summary,
    )


def _apply_detail_meta(
    db_sample: SampleModel,
    *,
    reproduction_steps: list[str],
    reproduction_rate: str | None,
    severity: str | None,
    screenshot_path: str | None,
    device_info: str | None,
) -> None:
    db_sample.reproduction_steps = serialize_reproduction_steps(reproduction_steps)
    db_sample.reproduction_rate = reproduction_rate
    db_sample.severity = severity
    db_sample.screenshot_path = (screenshot_path or "").strip() or None
    db_sample.device_info = (device_info or "").strip() or None


def _refresh_priority_score(db_sample: SampleModel) -> None:
    """現在のフィールドから priority_score を再計算してセットする。"""
    steps = deserialize_reproduction_steps(db_sample.reproduction_steps)
    db_sample.priority_score = score_from_sample_fields(
        expected_actions=db_sample.expected_actions,
        actual_actions=db_sample.actual_actions,
        error_code=db_sample.error_code,
        reproduction_steps_raw=steps,
        reproduction_rate=db_sample.reproduction_rate,
        severity=db_sample.severity,
        status=db_sample.status,
    )


def _serialize_steps_in_payload(data: dict) -> dict:
    """list[str] の reproduction_steps を DB 用 JSON 文字列に変換する。"""
    steps = data.get("reproduction_steps")
    if isinstance(steps, list):
        data["reproduction_steps"] = serialize_reproduction_steps(steps)
    return data


@app.get("/")
def health_check():
    """動作確認用。ブラウザで http://localhost:8000/ を開くと healthy が返る。"""
    return {"status": "healthy"}


# ---------- Samples CRUD（問い合わせデータの作成・読取・更新・削除） ----------


def _normalize_email(email: str) -> str:
    """比較しやすくするため、前後空白を除去して小文字にそろえる。"""
    return email.strip().lower()


DRAFT_PLACEHOLDER_PLACE = "（未入力）"
DRAFT_TTL_DAYS = 14


def _draft_placeholder_email() -> str:
    return f"draft-{uuid.uuid4().hex}@incomplete.local"


def _purge_expired_drafts(db: Session) -> None:
    """初回入力（date）から DRAFT_TTL_DAYS を超えた一時保存を物理削除する。"""
    cutoff = datetime.utcnow() - timedelta(days=DRAFT_TTL_DAYS)
    db.query(SampleModel).filter(
        SampleModel.is_draft.is_(True),
        SampleModel.date < cutoff,
    ).delete(synchronize_session=False)
    db.commit()


@app.get("/samples", response_model=list[SampleResponse])
def get_samples(
    # Query(...) … URL の ?q=...&trouble_type=... のようなクエリパラメータ
    q: str | None = Query(None, description="空白区切りのキーワード。AND条件・部分一致"),
    trouble_type: str | None = Query(None, description="問題タイプ（customer / stuff）"),
    # 管理者画面のプルダウン検索用（Pending / Temporarily Resolved / Fully Resolved）
    status: str | None = Query(None, description="対応状況で絞り込み"),
    date_from: date | None = Query(None, description="この日以降（含む）"),
    date_to: date | None = Query(None, description="この日以前（含む）"),
    is_draft: bool | None = Query(
        None,
        description="true=一時保存のみ, false=本登録のみ, 省略=本登録のみ（Customer/Staff 既定）",
    ),
    email: str | None = Query(
        None,
        description="登録時メールで絞り込み（トップページの「自分のサンプル」検索用）",
    ),
    sort: str | None = Query(
        None,
        description="priority=対応優先度降順（同点は日時降順）。省略時は日時降順",
    ),
    # Depends(get_db) … リクエストごとに DB セッションを用意し、終わったら閉じる
    db: Session = Depends(get_db),
):
    """
    問い合わせ一覧を取得する（GET /samples）。

    フロントの Customer 画面は trouble_type=customer を付けて呼び、
    Staff 画面は付けない（全件）か、絞り込み時だけ付ける。
    管理者画面は status でも絞り込める。
    """
    _purge_expired_drafts(db)
    query = db.query(SampleModel)

    # --- 一時保存 / 本登録の切り分け ---
    if is_draft is True:
        query = query.filter(SampleModel.is_draft.is_(True))
    else:
        query = query.filter(SampleModel.is_draft.is_(False))

    # --- キーワード検索（名前・場所・詳細のいずれかに部分一致。複数語は AND） ---
    if q and q.strip():
        # 半角・全角スペースで分割し、空文字は捨てる
        keywords = [k for k in re.split(r"[\s\u3000]+", q.strip()) if k]
        for keyword in keywords:
            pattern = like_pattern(keyword)
            query = query.filter(
                or_(
                    SampleModel.name.like(pattern, escape="\\"),
                    SampleModel.place.like(pattern, escape="\\"),
                    SampleModel.trouble_detail.like(pattern, escape="\\"),
                    SampleModel.expected_actions.like(pattern, escape="\\"),
                    SampleModel.actual_actions.like(pattern, escape="\\"),
                    SampleModel.error_code.like(pattern, escape="\\"),
                )
            )

    # --- 登録者メールで絞り込み（レスポンスには email を含めない） ---
    if email and email.strip():
        query = query.filter(SampleModel.email == _normalize_email(email))

    # --- トラブル種別で絞り込み ---
    if trouble_type and trouble_type.strip():
        query = query.filter(SampleModel.trouble_type == trouble_type)

    # --- 対応状況で絞り込み（管理者のプルダウン検索） ---
    if status and status.strip():
        query = query.filter(SampleModel.status == status.strip())

    # --- 日付レンジ（開始日・終了日はどちらも任意） ---
    # date 型（日付だけ）を datetime の 0:00 / 23:59:59 に広げて比較する
    if date_from:
        query = query.filter(SampleModel.date >= datetime.combine(date_from, time.min))
    if date_to:
        query = query.filter(SampleModel.date <= datetime.combine(date_to, time.max))

    # response_model=SampleResponse のため、email はレスポンスに含まれない
    if (sort or "").strip().lower() == "priority":
        # 管理者一覧: 優先度が主。同点なら未読を上に
        return query.order_by(
            SampleModel.priority_score.desc(),
            SampleModel.staff_notify_unread.desc(),
            SampleModel.date.desc(),
        ).all()
    # スタッフ一覧など: 未読通知を最優先で上部へ
    return query.order_by(
        SampleModel.staff_notify_unread.desc(),
        SampleModel.date.desc(),
    ).all()


# ---------- AI トリアージ / 再現支援 / スクショ ----------


@app.post("/triage", response_model=TriageResponse)
def triage_report(body: TriageRequest, db: Session = Depends(get_db)):
    """
    トップページからの AI トリアージ（POST /triage）。

    - 情報不足・複数トラブル混在 → needs_reentry（再入力を促す）
    - 問題なし → 類似サンプルと一次回答を返す（まだ DB には保存しない）
    """
    result = run_triage(
        db,
        expected_actions=body.expected_actions,
        actual_actions=body.actual_actions,
        error_code=body.error_code,
    )

    similar: list[SampleModel] = []
    if result["similar_sample_ids"]:
        rows = (
            db.query(SampleModel)
            .filter(SampleModel.id.in_(result["similar_sample_ids"]))
            .all()
        )
        by_id = {row.id: row for row in rows}
        # AI が返した順を保つ
        similar = [
            by_id[sid] for sid in result["similar_sample_ids"] if sid in by_id
        ]

    return TriageResponse(
        status=result["status"],
        reentry_reasons=result["reentry_reasons"],
        similar_samples=similar,
        initial_response=result["initial_response"],
    )


@app.post("/reproduction-assist", response_model=ReproductionAssistResponse)
def reproduction_assist(body: ReproductionAssistRequest):
    """再現手順の飛躍・省略チェックと次操作サジェスト。"""
    result = run_reproduction_assist(
        steps=body.reproduction_steps,
        expected_actions=body.expected_actions,
        actual_actions=body.actual_actions,
        error_code=body.error_code,
    )
    return ReproductionAssistResponse(**result)


@app.post("/uploads/screenshot", response_model=UploadScreenshotResponse)
async def upload_screenshot(file: UploadFile = File(...)):
    """デモ用のスクショアップロード（JPEG/PNG/WebP・最大2MB）。"""
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_SCREENSHOT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="JPEG / PNG / WebP のみアップロードできます。",
        )
    data = await file.read()
    if len(data) > MAX_SCREENSHOT_BYTES:
        raise HTTPException(status_code=400, detail="ファイルサイズは 2MB 以下にしてください。")
    if not data:
        raise HTTPException(status_code=400, detail="空のファイルです。")

    ext = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }[content_type]
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / filename
    dest.write_bytes(data)
    path = f"/media/{filename}"
    return UploadScreenshotResponse(path=path, url=path)


# ---------- 作成（汎用 / 下書き / 本登録 / 下書き確定） ----------


@app.post("/samples", response_model=SampleResponse, status_code=201)
def create_sample(sample: SampleCreate, db: Session = Depends(get_db)):
    """
    問い合わせを新規追加する（POST /samples）。

    引数 sample は JSON ボディ。FastAPI が SampleCreate スキーマで形をチェックする。
    201 = Created（作成成功）のステータスコード。
    """
    payload = sample.model_dump()  # Pydantic → 普通の dict
    payload["email"] = _normalize_email(payload["email"])
    # 新規作成時の対応状況は必ず Pending（フロントから改ざんできないようサーバで固定）
    payload["status"] = "Pending"
    payload["admin_comment"] = None
    payload["is_draft"] = False
    if payload.get("trouble_detail") is None:
        payload["trouble_detail"] = ""
    payload = _serialize_steps_in_payload(payload)
    db_sample = SampleModel(**payload)  # ORM の1行分のオブジェクトを作る
    _refresh_priority_score(db_sample)
    db.add(db_sample)  # 「追加予定」としてセッションに載せる
    db.commit()  # 実際に DB へ書き込む
    db.refresh(db_sample)  # DB が採番した id などを読み直す
    return db_sample


@app.post("/samples/draft", response_model=SampleResponse, status_code=201)
def create_draft_sample(body: SampleDraftCreate, db: Session = Depends(get_db)):
    """トップページの一時保存。報告者名・トリアージ内容と日時を確定し、詳細は後から入力する。"""
    _purge_expired_drafts(db)
    now = datetime.utcnow()
    db_sample = SampleModel(
        name=body.name.strip(),
        date=now,
        place=DRAFT_PLACEHOLDER_PLACE,
        trouble_type="customer",
        trouble_detail="",
        email=_draft_placeholder_email(),
        expected_actions=body.expected_actions.strip(),
        actual_actions=body.actual_actions.strip(),
        error_code=(body.error_code or "").strip() or None,
        ai_initial_response=body.ai_initial_response,
        status="Pending",
        admin_comment=None,
        is_draft=True,
        priority_score=0,
    )
    db.add(db_sample)
    db.commit()
    db.refresh(db_sample)
    return db_sample


@app.post("/samples/complete", response_model=SampleResponse, status_code=201)
def create_complete_from_triage(
    body: SampleTriageCompleteCreate, db: Session = Depends(get_db)
):
    """トップページ「詳細を入力」からの本登録（日時はサーバが記録）。"""
    now = datetime.utcnow()
    db_sample = SampleModel(
        name=body.name.strip(),
        date=now,
        place=body.place.strip(),
        trouble_type=body.trouble_type.strip(),
        trouble_detail="",
        email=_normalize_email(body.email),
        expected_actions=body.expected_actions.strip(),
        actual_actions=body.actual_actions.strip(),
        error_code=(body.error_code or "").strip() or None,
        ai_initial_response=body.ai_initial_response,
        status="Pending",
        admin_comment=None,
        is_draft=False,
    )
    _apply_detail_meta(
        db_sample,
        reproduction_steps=body.reproduction_steps,
        reproduction_rate=body.reproduction_rate,
        severity=body.severity,
        screenshot_path=body.screenshot_path,
        device_info=body.device_info,
    )
    _refresh_priority_score(db_sample)
    db.add(db_sample)
    db.commit()
    db.refresh(db_sample)
    return db_sample


@app.patch("/samples/{sample_id}/finalize", response_model=SampleResponse)
def finalize_draft_sample(
    sample_id: int, body: SampleFinalize, db: Session = Depends(get_db)
):
    """一時保存サンプルに詳細を入力して本登録にする。"""
    _purge_expired_drafts(db)
    db_sample = db.query(SampleModel).filter(SampleModel.id == sample_id).first()
    if not db_sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    if not db_sample.is_draft:
        raise HTTPException(status_code=400, detail="このサンプルは既に本登録済みです。")

    db_sample.name = body.name.strip()
    db_sample.place = body.place.strip()
    db_sample.trouble_type = body.trouble_type.strip()
    db_sample.email = _normalize_email(body.email)
    db_sample.is_draft = False
    _apply_detail_meta(
        db_sample,
        reproduction_steps=body.reproduction_steps,
        reproduction_rate=body.reproduction_rate,
        severity=body.severity,
        screenshot_path=body.screenshot_path,
        device_info=body.device_info,
    )
    _refresh_priority_score(db_sample)

    db.commit()
    db.refresh(db_sample)
    return db_sample


# ---------- 更新・削除（スタッフ本人 / 管理者） ----------


@app.put("/samples/{sample_id}", response_model=SampleResponse)
def update_sample(
    sample_id: int, sample: SampleUpdate, db: Session = Depends(get_db)
):
    """
    問い合わせを全項目で上書きする（PUT /samples/{id}）。

    登録メールは変更しない（リクエストに email は含めない）。
    """
    db_sample = db.query(SampleModel).filter(SampleModel.id == sample_id).first()
    if not db_sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    data = sample.model_dump()
    data = _serialize_steps_in_payload(data)

    # 送られてきた各フィールドを ORM オブジェクトにセット
    for key, value in data.items():
        setattr(db_sample, key, value)

    _refresh_priority_score(db_sample)
    db.commit()
    db.refresh(db_sample)
    return db_sample


@app.patch("/samples/{sample_id}", response_model=SampleResponse)
def partial_update_sample(
    sample_id: int, sample: SamplePartialUpdate, db: Session = Depends(get_db)
):
    """
    問い合わせの一部だけ更新する（PATCH /samples/{id}）。
    exclude_unset=True … 「送られなかったフィールド」は更新対象にしない。
    """
    db_sample = db.query(SampleModel).filter(SampleModel.id == sample_id).first()
    if not db_sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    data = sample.model_dump(exclude_unset=True)
    data = _serialize_steps_in_payload(data)

    for key, value in data.items():
        setattr(db_sample, key, value)

    _refresh_priority_score(db_sample)
    db.commit()
    db.refresh(db_sample)
    return db_sample


@app.patch("/samples/{sample_id}/admin", response_model=SampleResponse)
def admin_update_sample(
    sample_id: int, sample: SampleAdminUpdate, db: Session = Depends(get_db)
):
    """
    管理者向けの部分更新（PATCH /samples/{id}/admin）。

    - status: Pending / Temporarily Resolved / Fully Resolved
    - admin_comment: 管理者コメント（空文字は「コメントなし」として NULL にする）

    デモ用のためメール照合やログイン認証は行わない。
    """
    db_sample = db.query(SampleModel).filter(SampleModel.id == sample_id).first()
    if not db_sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    previous_status = db_sample.status
    db_sample.status = sample.status
    # 空白だけのコメントは「未記入」と同じ扱いにする
    comment = (sample.admin_comment or "").strip()
    db_sample.admin_comment = comment if comment else None
    _refresh_priority_score(db_sample)

    # 管理者が保存するたびスタッフへ通知（デモで気づきやすいよう、同ステータス再保存も含む）
    label = _status_label_ja(sample.status)
    if previous_status != sample.status:
        summary = f"対応状況が「{label}」に更新されました"
    else:
        summary = f"管理者が対応状況「{label}」を確認・保存しました"
    _mark_staff_notification(
        db_sample,
        kind="status",
        summary=summary,
    )

    db.commit()
    db.refresh(db_sample)
    return db_sample


@app.delete("/samples/{sample_id}/admin", status_code=204)
def admin_delete_sample(sample_id: int, db: Session = Depends(get_db)):
    """
    管理者向け削除（DELETE /samples/{id}/admin）。
    メール照合・ステータス制限なし。デモ用のためログイン認証は行わない。
    """
    sample = db.query(SampleModel).filter(SampleModel.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    db.delete(sample)
    db.commit()


@app.delete("/samples/{sample_id}", status_code=204)
def delete_sample(sample_id: int, db: Session = Depends(get_db)):
    """
    問い合わせを削除する（DELETE /samples/{id}）。
    204 = No Content（成功したが返すボディは無い）。
    """
    sample = db.query(SampleModel).filter(SampleModel.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    db.delete(sample)
    db.commit()


# ---------- 対応履歴（チャット） ----------


@app.get("/samples/{sample_id}/messages", response_model=list[SampleMessageResponse])
def get_sample_messages(sample_id: int, db: Session = Depends(get_db)):
    """対応履歴（チャット）を時系列で取得する。"""
    sample = db.query(SampleModel).filter(SampleModel.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    if sample.is_draft:
        raise HTTPException(
            status_code=400, detail="一時保存のサンプルには対応履歴がありません。"
        )
    return (
        db.query(SampleMessageModel)
        .filter(SampleMessageModel.sample_id == sample_id)
        .order_by(SampleMessageModel.created_at.asc())
        .all()
    )


@app.post(
    "/samples/{sample_id}/messages",
    response_model=SampleMessageResponse,
    status_code=201,
)
def create_sample_message(
    sample_id: int, body: SampleMessageCreate, db: Session = Depends(get_db)
):
    """
    対応履歴にメッセージを追加する。
    staff / admin とも登録メールの照合はしない。
    """
    sample = db.query(SampleModel).filter(SampleModel.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    if sample.is_draft:
        raise HTTPException(
            status_code=400, detail="一時保存のサンプルにはメッセージを送れません。"
        )

    text = body.body.strip()
    if not text:
        raise HTTPException(status_code=400, detail="メッセージ本文が空です。")

    if body.author_role == "staff":
        if sample.status == "Fully Resolved":
            raise HTTPException(
                status_code=400,
                detail="完全対応済みの問い合わせにはスタッフからメッセージを送れません。",
            )
    msg = SampleMessageModel(
        sample_id=sample_id,
        author_role=body.author_role,
        body=text,
        created_at=datetime.utcnow(),
    )
    db.add(msg)

    if body.author_role == "admin":
        # 完全対応済みへの対応内容投稿は status 未読の上書き（comment）にしない。
        # スタッフは返信できないため、直前の status 通知のまま閲覧＋戻るで消せるようにする。
        if sample.status != "Fully Resolved":
            _mark_staff_notification(
                sample,
                kind="comment",
                summary="管理者から新しいコメントがあります",
            )

    db.commit()
    db.refresh(msg)
    return msg


@app.patch(
    "/samples/{sample_id}/notifications/read",
    response_model=SampleResponse,
)
def mark_staff_notification_read(
    sample_id: int,
    db: Session = Depends(get_db),
):
    """スタッフ未読通知を消す。登録メールの照合はしない。"""
    sample = db.query(SampleModel).filter(SampleModel.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    sample.staff_notify_unread = False
    sample.staff_notify_kind = None
    sample.staff_notify_at = None
    sample.staff_notify_summary = None
    db.commit()
    db.refresh(sample)
    return sample
