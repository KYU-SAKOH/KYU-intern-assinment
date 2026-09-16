"""
トリアージ（類似事例の提示・一次回答・再入力判定）

トップページから送られた「期待結果 / 実際の結果 / エラーコード」を解析し、
- 情報不足や複数トラブル混在なら needs_reentry
- 問題なければ類似サンプル ID と一次回答を返す

TRIAGE_MODE:
  - mock … OpenAI なし（ローカル検証用）
  - openai … OPENAI_API_KEY 必須
  - 未設定 … キーがあれば openai、なければ mock
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from models import SampleModel

# 既定モデル（環境変数 OPENAI_MODEL で上書き可）
DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# 複数トラブル混在の簡易判定用キーワード
_MULTI_ISSUE_MARKERS = ("また", "別件", "もう一つ", "もうひとつ", "および", "加えて")


def _like_pattern(keyword: str) -> str:
    escaped = keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _extract_keywords(text: str, limit: int = 8) -> list[str]:
    """簡易トークン分割（日本語・英数字）。短すぎる語は捨てる。"""
    tokens = re.findall(r"[A-Za-z0-9_\-]+|[\u3040-\u30ff\u4e00-\u9fff]{2,}", text)
    seen: set[str] = set()
    out: list[str] = []
    for t in tokens:
        key = t.lower()
        if key in seen or len(t) < 2:
            continue
        seen.add(key)
        out.append(t)
        if len(out) >= limit:
            break
    return out


def find_candidate_samples(
    db: Session,
    expected_actions: str,
    actual_actions: str,
    error_code: str | None,
    limit: int = 12,
) -> list[SampleModel]:
    """
    DB から類似候補をざっくり拾う（キーワード OR 検索）。
    一時保存（is_draft）は除外する。
    """
    blob = " ".join(
        part for part in [expected_actions, actual_actions, error_code or ""] if part
    )
    keywords = _extract_keywords(blob)
    query = db.query(SampleModel).filter(SampleModel.is_draft.is_(False))

    if keywords:
        conditions = []
        for keyword in keywords:
            pattern = _like_pattern(keyword)
            conditions.append(
                or_(
                    SampleModel.trouble_detail.like(pattern, escape="\\"),
                    SampleModel.expected_actions.like(pattern, escape="\\"),
                    SampleModel.actual_actions.like(pattern, escape="\\"),
                    SampleModel.error_code.like(pattern, escape="\\"),
                    SampleModel.name.like(pattern, escape="\\"),
                    SampleModel.place.like(pattern, escape="\\"),
                )
            )
        query = query.filter(or_(*conditions))

    return query.order_by(SampleModel.date.desc()).limit(limit).all()


def _sample_brief(sample: SampleModel) -> dict[str, Any]:
    return {
        "id": sample.id,
        "name": sample.name,
        "place": sample.place,
        "trouble_type": sample.trouble_type,
        "trouble_detail": sample.trouble_detail,
        "expected_actions": sample.expected_actions,
        "actual_actions": sample.actual_actions,
        "error_code": sample.error_code,
        "status": sample.status,
        "admin_comment": sample.admin_comment,
        "ai_initial_response": sample.ai_initial_response,
    }


def _looks_like_multiple_issues(expected: str, actual: str) -> bool:
    """
    複数の無関係なトラブルが1件に混在していそうか、簡易ルールで判定する。
    区切り語の出現、または長い本文に空行区切りのブロックが2つ以上ある場合。
    """
    combined = f"{expected}\n{actual}"
    marker_hits = sum(1 for m in _MULTI_ISSUE_MARKERS if m in combined)
    if marker_hits >= 2:
        return True
    # 空行で区切られた段落が2つ以上、かつ全体が長い
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", combined) if p.strip()]
    if len(paragraphs) >= 2 and len(combined) >= 80:
        return True
    return False


def _mock_initial_response(
    expected: str, actual: str, error_code: str | None
) -> str:
    """モック用の固定テンプレート一次回答（日本語）。"""
    expected_short = expected if len(expected) <= 120 else expected[:117] + "…"
    actual_short = actual if len(actual) <= 120 else actual[:117] + "…"
    code_line = f"エラーコード: {error_code}\n" if error_code else ""
    return (
        "【モック一次回答】OpenAI を使わずに生成したデモ用の回答です。\n\n"
        f"報告内容（期待）: {expected_short}\n"
        f"報告内容（実際）: {actual_short}\n"
        f"{code_line}\n"
        "想定原因: 端末・ネットワーク・チケット状態のいずれかで、"
        "期待どおりの動作に至っていない可能性があります。\n"
        "対応要否: 園館側で再試行・端末再起動を確認のうえ、"
        "再現する場合は Terravie 開発チームへのエスカレーションを推奨します。\n"
        "次に確認すべき点: 発生時刻、対象チケット種別、端末ID、"
        "他ゲストでも同様か。"
    )


def _run_mock_triage(
    db: Session,
    expected: str,
    actual: str,
    code: str | None,
) -> dict[str, Any]:
    """OpenAI なしのルールベース・トリアージ。"""
    if len(expected) < 10 or len(actual) < 10:
        return {
            "status": "needs_reentry",
            "reentry_reasons": [
                "記述が短すぎます。実施した操作と、期待結果・実際の結果を具体的に書いてください。"
            ],
            "similar_sample_ids": [],
            "initial_response": None,
        }

    if _looks_like_multiple_issues(expected, actual):
        return {
            "status": "needs_reentry",
            "reentry_reasons": [
                "複数のトラブルが1件に混在している可能性があります。"
                "「また」「別件」などでつながず、1件ずつ書き直してください。"
            ],
            "similar_sample_ids": [],
            "initial_response": None,
        }

    candidates = find_candidate_samples(db, expected, actual, code)
    similar_ids = [s.id for s in candidates[:5]]

    return {
        "status": "ok",
        "reentry_reasons": [],
        "similar_sample_ids": similar_ids,
        "initial_response": _mock_initial_response(expected, actual, code),
    }


def _run_openai_triage(
    db: Session,
    expected: str,
    actual: str,
    code: str | None,
    api_key: str,
) -> dict[str, Any]:
    """OpenAI API によるトリアージ。"""
    from openai import OpenAI

    if len(expected) < 10 or len(actual) < 10:
        return {
            "status": "needs_reentry",
            "reentry_reasons": [
                "記述が短すぎます。実施した操作と、期待結果・実際の結果を具体的に書いてください。"
            ],
            "similar_sample_ids": [],
            "initial_response": None,
        }

    candidates = find_candidate_samples(db, expected, actual, code)
    candidate_payload = [_sample_brief(s) for s in candidates]

    system_prompt = """あなたは Terravie（園館向けチケット・入場システム）の問い合わせ一次対応アシスタントです。
園館スタッフからのトラブル報告を解析し、次のいずれかを返してください。

1. needs_reentry … 次のいずれかに当てはまる場合
   - 情報不足（再現手順・期待と実際の差・発生条件などが不明瞭）
   - 複数の無関係なトラブルが1件に混在している
2. ok … 単一のトラブルとして把握でき、一次回答を出せる場合

必ず JSON のみを返し、キーは次のとおりです:
{
  "status": "ok" | "needs_reentry",
  "reentry_reasons": string[],  // needs_reentry のとき理由を日本語で。ok なら []
  "similar_sample_ids": number[],  // 候補から類似するものの id（最大5）。needs_reentry なら []
  "initial_response": string | null  // ok のとき: 想定原因・対応要否・次に確認すべき点を日本語で。needs_reentry なら null
}
"""

    user_prompt = {
        "new_report": {
            "expected_actions": expected,
            "actual_actions": actual,
            "error_code": code,
        },
        "candidate_samples": candidate_payload,
    }

    client = OpenAI(api_key=api_key)
    try:
        completion = client.chat.completions.create(
            model=DEFAULT_MODEL,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": json.dumps(user_prompt, ensure_ascii=False),
                },
            ],
        )
    except Exception as exc:  # noqa: BLE001 — API 障害をそのまま 502 にする
        raise HTTPException(
            status_code=502,
            detail=f"OpenAI API の呼び出しに失敗しました: {exc}",
        ) from exc

    raw = completion.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail="OpenAI の応答を JSON として解釈できませんでした。",
        ) from exc

    status = parsed.get("status")
    if status not in ("ok", "needs_reentry"):
        status = "needs_reentry"

    reasons = parsed.get("reentry_reasons") or []
    if not isinstance(reasons, list):
        reasons = [str(reasons)]
    reasons = [str(r) for r in reasons if str(r).strip()]

    similar_ids_raw = parsed.get("similar_sample_ids") or []
    if not isinstance(similar_ids_raw, list):
        similar_ids_raw = []
    allowed = {s.id for s in candidates}
    similar_ids: list[int] = []
    for item in similar_ids_raw:
        try:
            sid = int(item)
        except (TypeError, ValueError):
            continue
        if sid in allowed and sid not in similar_ids:
            similar_ids.append(sid)
        if len(similar_ids) >= 5:
            break

    initial = parsed.get("initial_response")
    if status == "needs_reentry":
        if not reasons:
            reasons = [
                "内容が不足しているか、複数のトラブルが混在している可能性があります。"
                "1件ずつ、操作と結果を具体的に書き直してください。"
            ]
        return {
            "status": "needs_reentry",
            "reentry_reasons": reasons,
            "similar_sample_ids": [],
            "initial_response": None,
        }

    if not isinstance(initial, str) or not initial.strip():
        initial = (
            "類似事例を踏まえた一次回答を生成できませんでした。"
            "開発チームによる確認が必要です。"
        )

    return {
        "status": "ok",
        "reentry_reasons": [],
        "similar_sample_ids": similar_ids,
        "initial_response": initial.strip(),
    }


def run_triage(
    db: Session,
    expected_actions: str,
    actual_actions: str,
    error_code: str | None,
) -> dict[str, Any]:
    """
    トリアージを実行する（mock または OpenAI）。

    戻り値:
      {
        "status": "ok" | "needs_reentry",
        "reentry_reasons": [...],
        "similar_sample_ids": [...],
        "initial_response": str | None,
      }
    """
    mode = os.getenv("TRIAGE_MODE", "").strip().lower()
    api_key = os.getenv("OPENAI_API_KEY", "").strip()

    expected = expected_actions.strip()
    actual = actual_actions.strip()
    code = (error_code or "").strip() or None

    # TRIAGE_MODE=openai のときはキー必須（空なら mock に落とさない）
    if mode == "openai":
        if not api_key:
            raise HTTPException(
                status_code=503,
                detail=(
                    "TRIAGE_MODE=openai ですが OPENAI_API_KEY が未設定です。"
                    "backend/environments/.env.local に追加してください。"
                ),
            )
        return _run_openai_triage(db, expected, actual, code, api_key)

    # mock 明示、またはキーなし → モック
    if mode == "mock" or not api_key:
        return _run_mock_triage(db, expected, actual, code)

    # モード未指定かつキーあり → OpenAI
    return _run_openai_triage(db, expected, actual, code, api_key)
