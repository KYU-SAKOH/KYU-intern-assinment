"""
サンプル CRUD API（バックエンドの入り口）

フロントエンド（Next.js）からの HTTP リクエストを受け取り、
データベース（MySQL）の問い合わせデータ（samples）を操作する。

役割のイメージ:
  ブラウザ → FastAPI（このファイル） → SQLAlchemy → MySQL
"""

import os
import re
import uuid
from datetime import date, datetime, time

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from models import SampleModel
from schemas import (
    SampleAdminUpdate,
    SampleCreate,
    SampleDraftCreate,
    SampleFinalize,
    SamplePartialUpdate,
    SampleResponse,
    SampleTriageCompleteCreate,
    SampleUpdate,
    TriageRequest,
    TriageResponse,
)
from triage import run_triage

# フロントの URL（CORS で「このオリジンからはアクセスOK」と許可する）
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

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


@app.get("/")
def health_check():
    """動作確認用。ブラウザで http://localhost:8000/ を開くと healthy が返る。"""
    return {"status": "healthy"}


# ---------- Samples CRUD（問い合わせデータの作成・読取・更新・削除） ----------


def _like_pattern(keyword: str) -> str:
    """
    SQL の LIKE 用パターンを作る。
    ユーザーが入力した % や _ を「特殊文字」ではなく普通の文字として扱う。
    前後に % を付けて「部分一致」（含む検索）にする。
    """
    escaped = keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _normalize_email(email: str) -> str:
    """比較しやすくするため、前後空白を除去して小文字にそろえる。"""
    return email.strip().lower()


DRAFT_PLACEHOLDER_NAME = "（未入力）"
DRAFT_PLACEHOLDER_PLACE = "（未入力）"


def _draft_placeholder_email() -> str:
    return f"draft-{uuid.uuid4().hex}@incomplete.local"


def _verify_owner_email(db_sample: SampleModel, email: str) -> None:
    """
    登録時のメールと一致するか確認する。
    一致しなければ 403（Forbidden）を返す → 他人のデータを勝手に更新・削除できない。
    """
    if _normalize_email(email) != _normalize_email(db_sample.email):
        raise HTTPException(
            status_code=403,
            detail="メールアドレスが一致しません。登録時と同じメールアドレスが必要です。",
        )


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
    # Depends(get_db) … リクエストごとに DB セッションを用意し、終わったら閉じる
    db: Session = Depends(get_db),
):
    """
    問い合わせ一覧を取得する（GET /samples）。

    フロントの Customer 画面は trouble_type=customer を付けて呼び、
    Staff 画面は付けない（全件）か、絞り込み時だけ付ける。
    管理者画面は status でも絞り込める。
    """
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
            pattern = _like_pattern(keyword)
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

    # 新しい日時が上に来るように並べて返す
    # response_model=SampleResponse のため、email はレスポンスに含まれない
    return query.order_by(SampleModel.date.desc()).all()


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
        # OpenAI が返した順を保つ
        similar = [
            by_id[sid] for sid in result["similar_sample_ids"] if sid in by_id
        ]

    return TriageResponse(
        status=result["status"],
        reentry_reasons=result["reentry_reasons"],
        similar_samples=similar,
        initial_response=result["initial_response"],
    )


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
    db_sample = SampleModel(**payload)  # ORM の1行分のオブジェクトを作る
    db.add(db_sample)  # 「追加予定」としてセッションに載せる
    db.commit()  # 実際に DB へ書き込む
    db.refresh(db_sample)  # DB が採番した id などを読み直す
    return db_sample


@app.post("/samples/draft", response_model=SampleResponse, status_code=201)
def create_draft_sample(body: SampleDraftCreate, db: Session = Depends(get_db)):
    """トップページの一時保存。トリアージ内容と日時のみ確定し、詳細は後から入力する。"""
    now = datetime.utcnow()
    db_sample = SampleModel(
        name=DRAFT_PLACEHOLDER_NAME,
        date=now,
        place=DRAFT_PLACEHOLDER_PLACE,
        trouble_type="customer",
        trouble_detail="",
        email=_draft_placeholder_email(),
        expected_actions=body.expected_actions.strip(),
        actual_actions=body.actual_actions.strip(),
        error_code=(body.error_code or "").strip() or None,
        ai_initial_response=body.ai_initial_response,
        operation_log=None,
        status="Pending",
        admin_comment=None,
        is_draft=True,
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
        operation_log=None,
        status="Pending",
        admin_comment=None,
        is_draft=False,
    )
    db.add(db_sample)
    db.commit()
    db.refresh(db_sample)
    return db_sample


@app.patch("/samples/{sample_id}/finalize", response_model=SampleResponse)
def finalize_draft_sample(
    sample_id: int, body: SampleFinalize, db: Session = Depends(get_db)
):
    """一時保存サンプルに詳細を入力して本登録にする。"""
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

    db.commit()
    db.refresh(db_sample)
    return db_sample


@app.put("/samples/{sample_id}", response_model=SampleResponse)
def update_sample(
    sample_id: int, sample: SampleUpdate, db: Session = Depends(get_db)
):
    """
    問い合わせを全項目で上書きする（PUT /samples/{id}）。

    email は「本人確認」にだけ使い、DB 上のメールは変更しない。
    （data.pop("email") で更新対象から外している）
    """
    db_sample = db.query(SampleModel).filter(SampleModel.id == sample_id).first()
    if not db_sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    data = sample.model_dump()
    _verify_owner_email(db_sample, data.pop("email"))

    # 送られてきた各フィールドを ORM オブジェクトにセット
    for key, value in data.items():
        setattr(db_sample, key, value)

    db.commit()
    db.refresh(db_sample)
    return db_sample


@app.patch("/samples/{sample_id}", response_model=SampleResponse)
def partial_update_sample(
    sample_id: int, sample: SamplePartialUpdate, db: Session = Depends(get_db)
):
    """
    問い合わせの一部だけ更新する（PATCH /samples/{id}）。

    Terravie 再現画面の「トラブル発生を通知」はここを使い、
    operation_log だけ送る（他フィールドは触らない）。

    exclude_unset=True … 「送られなかったフィールド」は更新対象にしない。
    """
    db_sample = db.query(SampleModel).filter(SampleModel.id == sample_id).first()
    if not db_sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    data = sample.model_dump(exclude_unset=True)
    email = data.pop("email", None)
    if email is None:
        raise HTTPException(status_code=400, detail="email is required")
    _verify_owner_email(db_sample, email)

    for key, value in data.items():
        setattr(db_sample, key, value)

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

    db_sample.status = sample.status
    # 空白だけのコメントは「未記入」と同じ扱いにする
    comment = (sample.admin_comment or "").strip()
    db_sample.admin_comment = comment if comment else None

    db.commit()
    db.refresh(db_sample)
    return db_sample


@app.delete("/samples/{sample_id}", status_code=204)
def delete_sample(
    sample_id: int,
    # ボディではなくクエリ ?email=... で受け取る（フロントの DELETE 実装に合わせている）
    email: str = Query(..., description="登録時と同じメールアドレス"),
    db: Session = Depends(get_db),
):
    """
    問い合わせを削除する（DELETE /samples/{id}?email=...）。
    204 = No Content（成功したが返すボディは無い）。
    """
    sample = db.query(SampleModel).filter(SampleModel.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    _verify_owner_email(sample, email)
    db.delete(sample)
    db.commit()
