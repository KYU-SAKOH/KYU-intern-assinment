"""
スタッフへの更新通知（差し替え口）

管理者がステータスを変えた・コメントしたときに、登録メール宛へ知らせる。

現状（デモ）:
  実メールは送らず、ログに宛先・内容を残す。

将来（実送信）:
  NOTIFY_MODE=smtp のときに SMTP 実装を足す想定。
  呼び出し側は notify_staff_update(...) だけ呼べばよい。

環境変数:
  NOTIFY_MODE … demo（既定）/ smtp（未実装・ログにフォールバック）
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def _resolve_mode() -> str:
    mode = os.getenv("NOTIFY_MODE", "demo").strip().lower()
    if mode not in ("demo", "smtp"):
        return "demo"
    return mode


def notify_staff_update(
    *,
    to_email: str,
    sample_id: int,
    kind: str,
    summary: str,
) -> None:
    """
    スタッフへ更新通知を送る。

    kind: "status" | "comment" など
    summary: 一覧・メール本文向けの短い説明
    """
    mode = _resolve_mode()
    if mode == "smtp":
        # 将来ここに SMTP 送信を実装する。未実装のためデモに落とす。
        logger.warning(
            "NOTIFY_MODE=smtp ですが SMTP 実装が未設定のため、デモ通知（ログ）にフォールバックします。"
        )
        mode = "demo"

    message = (
        f"[staff-notify/{mode}] to={to_email} sample_id={sample_id} "
        f"kind={kind} summary={summary}"
    )
    # uvicorn の標準出力にも出して、docker logs で確認しやすくする
    print(message, flush=True)
    logger.info(message)
