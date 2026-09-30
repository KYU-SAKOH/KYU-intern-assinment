"""
再現手順の入力支援（飛躍・省略の指摘と次操作サジェスト）

TRIAGE_MODE / GEMINI_API_KEY は triage.py と同じ規則。
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

from fastapi import HTTPException

from triage import DEFAULT_MODEL

MIN_STEPS = 3
MAX_STEPS = 15
MIN_STEP_LEN = 8


def normalize_steps(steps: list[str]) -> list[str]:
    """前後空白を除去し、空行を落とす。"""
    return [s.strip() for s in steps if isinstance(s, str) and s.strip()]


def validate_steps_basic(steps: list[str]) -> list[str]:
    """
    件数・文字数の基本ルール。違反があれば理由メッセージのリストを返す。
    """
    cleaned = normalize_steps(steps)
    errors: list[str] = []
    if len(cleaned) < MIN_STEPS:
        errors.append(
            f"再現手順は少なくとも {MIN_STEPS} 件必要です（現在 {len(cleaned)} 件）。"
        )
    if len(cleaned) > MAX_STEPS:
        errors.append(f"再現手順は最大 {MAX_STEPS} 件までです。")
    for i, step in enumerate(cleaned, start=1):
        if len(step) < MIN_STEP_LEN:
            errors.append(
                f"手順 {i} が短すぎます（{MIN_STEP_LEN} 文字以上にしてください）。"
            )
    return errors


def _heuristic_gaps(steps: list[str], expected: str, actual: str) -> list[str]:
    """mock / 補完用の簡易ギャップ検出。"""
    warnings: list[str] = []
    joined = "\n".join(steps)
    basic = validate_steps_basic(steps)
    warnings.extend(basic)

    if len(steps) >= 2:
        first = steps[0]
        last = steps[-1]
        bootish = bool(re.search(r"起動|電源|オン|再起動", first))
        errorish = bool(re.search(r"エラー|失敗|落ち|フリーズ|表示されない", last))
        mid = steps[1:-1] if len(steps) > 2 else []
        if bootish and errorish and len(mid) == 0:
            warnings.append(
                "「起動」から「エラー／失敗」までの中間操作が抜けている可能性があります。"
            )
        # 隣接ステップがほぼ同じ
        for i in range(len(steps) - 1):
            a, b = steps[i], steps[i + 1]
            if a == b or (len(a) > 4 and a in b and abs(len(a) - len(b)) <= 2):
                warnings.append(
                    f"手順 {i + 1} と {i + 2} がほぼ同じです。時系列で区別できる操作に分けてください。"
                )
                break

    total_len = sum(len(s) for s in steps)
    if len(steps) >= MIN_STEPS and total_len < MIN_STEPS * MIN_STEP_LEN + 10:
        warnings.append(
            "全体の記述が短すぎます。各操作で「何をしたか」を具体的に書いてください。"
        )

    # トリアージで触れているのに手順に無い語の簡易チェック
    context = f"{expected}\n{actual}"
    for keyword, label in (
        ("チケット", "チケット操作"),
        ("スキャン", "スキャン操作"),
        ("ログイン", "ログイン"),
        ("ネットワーク", "ネットワーク確認"),
        ("Wi-Fi", "Wi-Fi / 通信確認"),
        ("再起動", "再起動"),
    ):
        if keyword in context and keyword not in joined:
            warnings.append(
                f"報告内容に「{keyword}」がありますが、再現手順に{label}がありません。"
            )

    # 重複除去（順序維持）
    seen: set[str] = set()
    unique: list[str] = []
    for w in warnings:
        if w not in seen:
            seen.add(w)
            unique.append(w)
    return unique


def _suggest_next(steps: list[str], expected: str, actual: str) -> list[str]:
    """次に足しそうな操作候補（mock）。"""
    suggestions: list[str] = []
    context = f"{expected}\n{actual}"

    if not any(re.search(r"起動|電源|オン", s) for s in steps):
        suggestions.append("端末の電源を入れ、ホーム画面が表示されるまで待つ")
    if not any(re.search(r"アプリ|起動|開く", s) for s in steps):
        suggestions.append("対象アプリ（または管理画面）を開く")
    if "チケット" in context and "チケット" not in "\n".join(steps):
        suggestions.append("対象のチケットを選択する（または読み取る）")
    if "スキャン" in context and "スキャン" not in "\n".join(steps):
        suggestions.append("バーコード／QR をスキャンする")
    if not any(re.search(r"結果|表示|エラー|失敗", s) for s in steps):
        suggestions.append("画面に表示された結果（エラー文言含む）を確認する")
    if "再起動" in context and "再起動" not in "\n".join(steps):
        suggestions.append("端末を再起動して同じ操作をやり直す")

    # まだ少ないときは汎用候補
    if len(suggestions) < 2:
        suggestions.append("発生直前に行っていた操作を時系列で1つ追記する")
        suggestions.append("正常時との違いが分かる操作結果を1ステップとして書く")

    # 既に似た文がある候補は落とす
    filtered: list[str] = []
    for s in suggestions:
        if any(s[:8] in step for step in steps):
            continue
        filtered.append(s)
        if len(filtered) >= 4:
            break
    return filtered or suggestions[:3]


def _mock_assist(
    steps: list[str],
    expected: str,
    actual: str,
    error_code: str | None,
) -> dict[str, Any]:
    cleaned = normalize_steps(steps)
    warnings = _heuristic_gaps(cleaned, expected, actual)
    suggestions = _suggest_next(cleaned, expected, actual)
    basic_ok = not validate_steps_basic(cleaned)
    # 基本ルールを満たし、ヒューリスティック警告が「件数・長さ以外」で多くないこと
    soft = [w for w in warnings if "少なくとも" not in w and "短すぎます" not in w and "最大" not in w]
    can_proceed = basic_ok and len(soft) == 0
    if basic_ok and soft:
        # 文脈キーワード欠落だけの軽い警告は1件まで許容し、2件以上で止める
        can_proceed = len(soft) <= 1 and not any(
            "中間操作" in w or "ほぼ同じ" in w for w in soft
        )
    return {
        "gap_warnings": warnings,
        "suggested_next_steps": suggestions,
        "can_proceed": can_proceed,
    }


def _run_gemini_assist(
    steps: list[str],
    expected: str,
    actual: str,
    error_code: str | None,
    api_key: str,
) -> dict[str, Any]:
    from google import genai
    from google.genai import types

    cleaned = normalize_steps(steps)
    basic = validate_steps_basic(cleaned)
    if basic:
        # 基本ルール違反は AI に頼らず即不合格
        return {
            "gap_warnings": basic + _heuristic_gaps(cleaned, expected, actual),
            "suggested_next_steps": _suggest_next(cleaned, expected, actual),
            "can_proceed": False,
        }

    system_prompt = """あなたは Terravie（園館向けチケット・入場システム）の再現手順レビューアです。
スタッフが時系列で書いた操作手順を見て、飛躍・省略を指摘し、次に書くべき操作を提案してください。

必ず JSON のみを返し、キーは次のとおりです:
{
  "gap_warnings": string[],  // 飛躍・省略・曖昧さの指摘（日本語）。問題なければ []
  "suggested_next_steps": string[],  // 次に追加すべき操作の候補（短文・最大4）
  "can_proceed": boolean  // 手順として十分具体的で時系列が追えるなら true
}

can_proceed=true にする条件:
- 操作が時系列で追える
- 明らかな中間操作の欠落がない
- 各ステップが具体的（何をしたか分かる）
雑に短い手順や、起動直後にエラーだけ、のような飛躍がある場合は false。
"""

    user_prompt = {
        "reproduction_steps": cleaned,
        "expected_actions": expected,
        "actual_actions": actual,
        "error_code": error_code,
    }

    client = genai.Client(api_key=api_key)
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
        "suggested_next_steps": suggestions
        or _suggest_next(cleaned, expected, actual),
        "can_proceed": can_proceed,
    }


def run_reproduction_assist(
    steps: list[str],
    expected_actions: str,
    actual_actions: str,
    error_code: str | None,
) -> dict[str, Any]:
    mode = os.getenv("TRIAGE_MODE", "").strip().lower()
    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    expected = (expected_actions or "").strip()
    actual = (actual_actions or "").strip()
    code = (error_code or "").strip() or None
    cleaned = normalize_steps(steps)

    if mode == "gemini":
        if not api_key:
            raise HTTPException(
                status_code=503,
                detail=(
                    "TRIAGE_MODE=gemini ですが GEMINI_API_KEY が未設定です。"
                ),
            )
        return _run_gemini_assist(cleaned, expected, actual, code, api_key)

    if mode == "mock" or not api_key:
        return _mock_assist(cleaned, expected, actual, code)

    return _run_gemini_assist(cleaned, expected, actual, code, api_key)
