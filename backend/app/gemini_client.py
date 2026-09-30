"""
Gemini API クライアントの共通入り口

トリアージ・再現支援・優先度スコアなど、AI を使う処理はここ経由でキーとクライアントを取る。
mock モードはない。GEMINI_API_KEY が無いとトリアージ／再現支援はエラーになる。

環境変数:
  GEMINI_API_KEY … API キー（必須。通常は .env.secret に書く）
  GEMINI_MODEL   … モデル名（未設定なら gemini-3.5-flash-lite）
"""

from __future__ import annotations

import os

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
