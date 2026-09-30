"""
対応優先度スコアの算出（管理者一覧の並び替え用）

ルール基礎点は常に計算する。GEMINI_API_KEY があれば AI 点とブレンドする。
キーが無くても登録・更新は止めず、ルール点のみを返す（偽の AI 応答は返さない）。

読む順番の目安: calc_priority_score / score_from_sample_fields → _rule_score
"""

from __future__ import annotations

import json

from gemini_client import DEFAULT_MODEL, get_api_key, get_client

SEVERITY_POINTS = {
    "high": 40,
    "medium": 20,
    "low": 5,
}
RATE_POINTS = {
    "always": 30,
    "often": 20,
    "sometimes": 10,
    "rare": 5,
}
STATUS_POINTS = {
    "Pending": 10,
    "Temporarily Resolved": 5,
    "Fully Resolved": -50,
}

# 本文に含まれると優先度を上げるキーワード
_CONTENT_KEYWORDS: tuple[tuple[str, int], ...] = (
    ("入場できない", 20),
    ("入場不可", 20),
    ("決済", 15),
    ("全員", 15),
    ("全台", 15),
    ("停止", 15),
    ("ダウン", 15),
    ("クラッシュ", 12),
    ("フリーズ", 10),
    ("エラー", 8),
    ("スキャンできない", 12),
    ("読み取れない", 10),
    ("緊急", 20),
)


def _rule_score(
    *,
    expected_actions: str | None,
    actual_actions: str | None,
    error_code: str | None,
    reproduction_steps: list[str] | None,
    reproduction_rate: str | None,
    severity: str | None,
    status: str | None,
) -> int:
    score = 0
    score += SEVERITY_POINTS.get((severity or "").strip(), 10)
    score += RATE_POINTS.get((reproduction_rate or "").strip(), 10)
    score += STATUS_POINTS.get((status or "Pending").strip(), 0)

    blob_parts = [
        expected_actions or "",
        actual_actions or "",
        error_code or "",
        " ".join(reproduction_steps or []),
    ]
    blob = "\n".join(blob_parts)
    for keyword, points in _CONTENT_KEYWORDS:
        if keyword in blob:
            score += points

    # エラーコードがあるだけでも少し上げる
    if (error_code or "").strip():
        score += 5

    return max(0, min(100, score))


def _gemini_priority_score(
    *,
    expected_actions: str | None,
    actual_actions: str | None,
    error_code: str | None,
    reproduction_steps: list[str] | None,
    reproduction_rate: str | None,
    severity: str | None,
    status: str | None,
    api_key: str,
) -> int | None:
    from google.genai import types

    system_prompt = """あなたは Terravie（園館向けチケット・入場システム）の障害トリアージ担当です。
問い合わせの対応優先度を 0〜100 の整数で評価してください（高いほど先に対応すべき）。

必ず JSON のみを返してください:
{ "priority_score": number }

評価の目安:
- 入場・決済の全面停止、多数ゲスト影響 → 80〜100
- 再現性が高く重要度も高い単体障害 → 60〜79
- 一時的・限定的で回避可能 → 30〜59
- 情報不足や軽微 → 0〜29
対応状況が Fully Resolved なら低くする。
"""

    user_prompt = {
        "expected_actions": expected_actions,
        "actual_actions": actual_actions,
        "error_code": error_code,
        "reproduction_steps": reproduction_steps or [],
        "reproduction_rate": reproduction_rate,
        "severity": severity,
        "status": status,
    }

    client = get_client(api_key)
    try:
        response = client.models.generate_content(
            model=DEFAULT_MODEL,
            contents=json.dumps(user_prompt, ensure_ascii=False),
            config=types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json",
                system_instruction=system_prompt,
            ),
        )
    except Exception:  # noqa: BLE001 — 失敗時はルールのみにフォールバック
        return None

    raw = response.text or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, dict):
        return None
    try:
        value = int(parsed.get("priority_score"))
    except (TypeError, ValueError):
        return None
    return max(0, min(100, value))


def calc_priority_score(
    *,
    expected_actions: str | None = None,
    actual_actions: str | None = None,
    error_code: str | None = None,
    reproduction_steps: list[str] | None = None,
    reproduction_rate: str | None = None,
    severity: str | None = None,
    status: str | None = "Pending",
) -> int:
    """
    対応優先度スコア（0〜100）を返す。
    キーがあるときはルール 40% + AI 60% でブレンド。
    """
    rule = _rule_score(
        expected_actions=expected_actions,
        actual_actions=actual_actions,
        error_code=error_code,
        reproduction_steps=reproduction_steps,
        reproduction_rate=reproduction_rate,
        severity=severity,
        status=status,
    )

    api_key = get_api_key()
    if not api_key:
        return rule

    ai = _gemini_priority_score(
        expected_actions=expected_actions,
        actual_actions=actual_actions,
        error_code=error_code,
        reproduction_steps=reproduction_steps,
        reproduction_rate=reproduction_rate,
        severity=severity,
        status=status,
        api_key=api_key,
    )
    if ai is None:
        return rule

    blended = int(round(0.4 * rule + 0.6 * ai))
    return max(0, min(100, blended))


def score_from_sample_fields(
    *,
    expected_actions: str | None,
    actual_actions: str | None,
    error_code: str | None,
    reproduction_steps_raw: str | list[str] | None,
    reproduction_rate: str | None,
    severity: str | None,
    status: str | None,
) -> int:
    """DB 列（JSON 文字列含む）からスコアを計算するヘルパー。"""
    steps: list[str] = []
    if isinstance(reproduction_steps_raw, list):
        steps = [str(s).strip() for s in reproduction_steps_raw if str(s).strip()]
    elif isinstance(reproduction_steps_raw, str) and reproduction_steps_raw.strip():
        try:
            data = json.loads(reproduction_steps_raw)
            if isinstance(data, list):
                steps = [str(s).strip() for s in data if str(s).strip()]
        except json.JSONDecodeError:
            steps = []

    return calc_priority_score(
        expected_actions=expected_actions,
        actual_actions=actual_actions,
        error_code=error_code,
        reproduction_steps=steps,
        reproduction_rate=reproduction_rate,
        severity=severity,
        status=status,
    )
