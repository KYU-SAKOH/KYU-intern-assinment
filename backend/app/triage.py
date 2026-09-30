"""
トリアージ（類似事例の提示・一次回答・再入力判定）

トップページから送られた「期待結果 / 実際の結果 / エラーコード」を解析し、
- 情報不足や複数トラブル混在なら needs_reentry
- 問題なければ類似サンプル ID と一次回答を返す

常に Gemini API を使う（mock なし）。GEMINI_API_KEY が必須。
読む順番の目安: run_triage → find_candidate_samples → _run_gemini_triage
"""

from __future__ import annotations

import json
import re
from typing import Any

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from gemini_client import DEFAULT_MODEL, get_client, require_api_key
from models import SampleModel
from text_utils import like_pattern


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
    一時保存（is_draft）は除外し、完全対応済み（Fully Resolved）のみ対象にする。
    """
    blob = " ".join(
        part for part in [expected_actions, actual_actions, error_code or ""] if part
    )
    keywords = _extract_keywords(blob)
    query = db.query(SampleModel).filter(
        SampleModel.is_draft.is_(False),
        SampleModel.status == "Fully Resolved",
    )

    if keywords:
        conditions = []
        for keyword in keywords:
            pattern = like_pattern(keyword)
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


def _parse_triage_response(
    parsed: dict[str, Any],
    candidates: list[SampleModel],
) -> dict[str, Any]:
    """Gemini JSON 応答のバリデーションと正規化。"""
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


def _run_gemini_triage(
    db: Session,
    expected: str,
    actual: str,
    code: str | None,
    api_key: str,
) -> dict[str, Any]:
    """Gemini API によるトリアージ。"""
    from google.genai import types

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
  "initial_response": string | null  // ok のとき日本語。needs_reentry なら null
}

ok のときの initial_response は、次の4項目をこの順番・見出し付きで必ず含めてください:
1. 想定原因
2. 一時的な解決方法（園館側ですぐ試せる応急対応）
3. 対応要否（開発チームへの連絡・エスカレーションが必要か）
4. 次に確認すべき点
"""

    user_prompt = {
        "new_report": {
            "expected_actions": expected,
            "actual_actions": actual,
            "error_code": code,
        },
        "candidate_samples": candidate_payload,
    }

    client = get_client(api_key)
    try:
        response = client.models.generate_content(
            model=DEFAULT_MODEL,
            contents=json.dumps(user_prompt, ensure_ascii=False),
            config=types.GenerateContentConfig(
                temperature=0.2,
                response_mime_type="application/json",
                system_instruction=system_prompt,
            ),
        )
    except Exception as exc:  # noqa: BLE001 — API 障害をそのまま 502 にする
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API の呼び出しに失敗しました: {exc}",
        ) from exc

    raw = response.text or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail="Gemini の応答を JSON として解釈できませんでした。",
        ) from exc

    if not isinstance(parsed, dict):
        raise HTTPException(
            status_code=502,
            detail="Gemini の応答を JSON オブジェクトとして解釈できませんでした。",
        )

    return _parse_triage_response(parsed, candidates)


def run_triage(
    db: Session,
    expected_actions: str,
    actual_actions: str,
    error_code: str | None,
) -> dict[str, Any]:
    """
    トリアージを実行する（常に Gemini）。

    戻り値:
      {
        "status": "ok" | "needs_reentry",
        "reentry_reasons": [...],
        "similar_sample_ids": [...],
        "initial_response": str | None,
      }
    """
    api_key = require_api_key()
    expected = expected_actions.strip()
    actual = actual_actions.strip()
    code = (error_code or "").strip() or None
    return _run_gemini_triage(db, expected, actual, code, api_key)
