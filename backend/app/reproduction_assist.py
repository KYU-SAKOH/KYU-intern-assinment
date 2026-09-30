"""
再現手順の入力支援（飛躍・省略の指摘と次操作サジェスト）

詳細ウィザードの step2 から呼ばれ、手順の過不足を Gemini でチェックする。
件数の下限・上限は schemas.py の定数を正とする（ここでも同じ値を使う）。

常に Gemini API を使う（mock なし）。GEMINI_API_KEY が必須。
読む順番の目安: run_reproduction_assist → _run_gemini_assist
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException

from gemini_client import DEFAULT_MODEL, get_client, require_api_key
from schemas import MAX_REPRODUCTION_STEPS, MIN_REPRODUCTION_STEPS


def normalize_steps(steps: list[str]) -> list[str]:
    """前後空白を除去し、空行を落とす。"""
    return [s.strip() for s in steps if isinstance(s, str) and s.strip()]


def validate_steps_basic(steps: list[str]) -> list[str]:
    """
    件数の基本ルール。違反があれば理由メッセージのリストを返す。
    （各手順の意味・具体性は Gemini 側で見る）
    """
    cleaned = normalize_steps(steps)
    errors: list[str] = []
    if len(cleaned) < MIN_REPRODUCTION_STEPS:
        errors.append(
            f"再現手順は少なくとも {MIN_REPRODUCTION_STEPS} 件必要です"
            f"（現在 {len(cleaned)} 件）。"
        )
    if len(cleaned) > MAX_REPRODUCTION_STEPS:
        errors.append(f"再現手順は最大 {MAX_REPRODUCTION_STEPS} 件までです。")
    return errors


def _run_gemini_assist(
    steps: list[str],
    expected: str,
    actual: str,
    error_code: str | None,
    api_key: str,
) -> dict[str, Any]:
    from google.genai import types

    cleaned = normalize_steps(steps)
    basic = validate_steps_basic(cleaned)
    if basic:
        # 基本ルール違反は AI に頼らず即不合格
        return {
            "gap_warnings": basic,
            "suggested_next_steps": [],
            "can_proceed": False,
        }

    system_prompt = """あなたは Terravie（園館向けチケット・入場システム）の再現手順レビューアです。
スタッフが時系列で書いた操作手順を見て、改善点を指摘し、次に書くべき操作を提案してください。
厳しすぎず、現場スタッフが短く書いても通せるようにしてください。

必ず JSON のみを返し、キーは次のとおりです:
{
  "gap_warnings": string[],  // 改善提案（日本語）。無くてもよい
  "suggested_next_steps": string[],  // 次に追加すべき操作の候補（短文・最大4）
  "can_proceed": boolean
}

can_proceed=true にする条件（こちらをデフォルト寄りに）:
- 手順が3件以上ある
- 各行が「何をしたか」がざっくり分かる操作である
- 最終ステップに結果や現場で試した応急対応があると望ましいが、無くても軽微なら true のまま

can_proceed=false にするのは次のときだけ:
- 空に近い・意味不明な文字列ばかり
- 操作が1つも読めない
- 「起動」直後に「エラー」だけで中間が完全に無い、など明らかな大飛躍
- ほぼ同じ文が連続している

gap_warnings はアドバイスとして積極的に出してよいが、軽微な指摘では can_proceed を false にしないこと。
"""

    user_prompt = {
        "reproduction_steps": cleaned,
        "expected_actions": expected,
        "actual_actions": actual,
        "error_code": error_code,
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
    except Exception as exc:  # noqa: BLE001
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

    warnings = parsed.get("gap_warnings") or []
    if not isinstance(warnings, list):
        warnings = [str(warnings)]
    warnings = [str(w).strip() for w in warnings if str(w).strip()]

    suggestions = parsed.get("suggested_next_steps") or []
    if not isinstance(suggestions, list):
        suggestions = []
    suggestions = [str(s).strip() for s in suggestions if str(s).strip()][:4]

    can_proceed = bool(parsed.get("can_proceed")) and not validate_steps_basic(cleaned)

    return {
        "gap_warnings": warnings,
        "suggested_next_steps": suggestions,
        "can_proceed": can_proceed,
    }


def run_reproduction_assist(
    steps: list[str],
    expected_actions: str,
    actual_actions: str,
    error_code: str | None,
) -> dict[str, Any]:
    """再現手順チェックを実行する（常に Gemini）。"""
    api_key = require_api_key()
    expected = (expected_actions or "").strip()
    actual = (actual_actions or "").strip()
    code = (error_code or "").strip() or None
    cleaned = normalize_steps(steps)
    return _run_gemini_assist(cleaned, expected, actual, code, api_key)
