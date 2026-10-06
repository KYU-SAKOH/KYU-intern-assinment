"""
Gemini API クライアントの共通入り口

トリアージ・再現支援・優先度スコアなど、AI を使う処理はここ経由でキーとクライアントを取る。
mock モードはない。GEMINI_API_KEY が無いとトリアージ／再現支援はエラーになる。

環境変数:
  GEMINI_API_KEY … API キー（必須。通常は .env.secret に書く）
  GEMINI_MODEL   … モデル名（未設定なら gemini-3.5-flash-lite）
"""

from __future__ import annotations

import json
import os
from typing import Any, Literal, overload

from fastapi import HTTPException

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")


def get_api_key() -> str | None:
    """設定されていれば API キー、無ければ None。"""
    key = os.getenv("GEMINI_API_KEY", "").strip()
    return key or None


def require_api_key() -> str:
    """
    API キーを返す。未設定なら 503。
    トリアージ／再現支援など「必ず Gemini が必要な処理」から呼ぶ。
    """
    key = get_api_key()
    if not key:
        raise HTTPException(
            status_code=503,
            detail=(
                "GEMINI_API_KEY が未設定です。"
                "backend/environments/.env.secret にキーを書き、"
                "backend コンテナを再起動してください。"
            ),
        )
    return key


def get_client(api_key: str | None = None):
    """
    google-genai の Client を返す。
    api_key を省略すると require_api_key() で取得する。
    """
    from google import genai

    key = api_key if api_key is not None else require_api_key()
    return genai.Client(api_key=key)


@overload
def generate_json_object(
    *,
    api_key: str,
    system_prompt: str,
    user_payload: dict[str, Any],
    temperature: float,
    on_failure: Literal["raise"],
) -> dict[str, Any]: ...


@overload
def generate_json_object(
    *,
    api_key: str,
    system_prompt: str,
    user_payload: dict[str, Any],
    temperature: float,
    on_failure: Literal["none"],
) -> dict[str, Any] | None: ...


def generate_json_object(
    *,
    api_key: str,
    system_prompt: str,
    user_payload: dict[str, Any],
    temperature: float,
    on_failure: Literal["raise", "none"],
) -> dict[str, Any] | None:
    """
    Gemini に JSON オブジェクトを返させる。

    on_failure="raise" … トリアージ・再現支援。失敗は 502。
    on_failure="none" … 優先度。失敗は None（ルール点に戻す）。
    """
    from google.genai import types

    client = get_client(api_key)
    try:
        response = client.models.generate_content(
            model=DEFAULT_MODEL,
            contents=json.dumps(user_payload, ensure_ascii=False),
            config=types.GenerateContentConfig(
                temperature=temperature,
                response_mime_type="application/json",
                system_instruction=system_prompt,
            ),
        )
    except Exception as exc:  # noqa: BLE001
        if on_failure == "none":
            return None
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API の呼び出しに失敗しました: {exc}",
        ) from exc

    raw = response.text or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        if on_failure == "none":
            return None
        raise HTTPException(
            status_code=502,
            detail="Gemini の応答を JSON として解釈できませんでした。",
        ) from exc

    if not isinstance(parsed, dict):
        if on_failure == "none":
            return None
        raise HTTPException(
            status_code=502,
            detail="Gemini の応答を JSON オブジェクトとして解釈できませんでした。",
        )
    return parsed
