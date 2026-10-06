"""
再現手順の入力支援（飛躍・省略の指摘と次操作サジェスト）

詳細ウィザードの step2 から呼ばれ、手順の過不足を Gemini でチェックする。
件数の下限・上限は schemas.py の定数を正とする（ここでも同じ値を使う）。

常に Gemini API を使う（mock なし）。GEMINI_API_KEY が必須。
読む順番の目安: run_reproduction_assist → _run_gemini_assist
"""

from __future__ import annotations

from typing import Any

from gemini_client import generate_json_object, require_api_key
from schemas import (
    MAX_REPRODUCTION_STEPS,
    MIN_REPRODUCTION_STEPS,
    clean_reproduction_steps,
)


def normalize_steps(steps: list[str]) -> list[str]:
    """前後空白を除去し、空行を落とす。"""
    return clean_reproduction_steps(steps)


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

    parsed = generate_json_object(
        api_key=api_key,
        system_prompt=system_prompt,
        user_payload=user_prompt,
        temperature=0.2,
        on_failure="raise",
    )

    warnings = parsed.get("gap_warnings") or []
    if not isinstance(warnings, list):
        warnings = [str(warnings)]
    warnings = [str(w).strip() for w in warnings if str(w).strip()]

    suggestions = parsed.get("suggested_next_steps") or []
    if not isinstance(suggestions, list):
        suggestions = []
    suggestions = [str(s).strip() for s in suggestions if str(s).strip()][:4]

    can_proceed = bool(parsed.get("can_proceed"))

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
    return _run_gemini_assist(steps, expected, actual, code, api_key)
