"""
SQLAlchemy モデル（DB のテーブル定義）

「Python のクラス」⇔「MySQL のテーブル samples」を対応づける。
実際のテーブル作成・変更は Alembic のマイグレーションで行う。
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class SampleModel(Base):
    """
    問い合わせ1件分のレコード。

    Mapped[型] + mapped_column(...) で「この属性は DB のこの列」と宣言する。
    nullable=False … 必ず値が入る列（必須）。
    """

    __tablename__ = "samples"  # 実際のテーブル名

    # 主キー。追加のたびに自動で増える番号
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # 基本情報
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    place: Mapped[str] = mapped_column(String(100), nullable=False)

    # トラブルの種類（'customer' または 'stuff'）
    trouble_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # トラブル内容の自由記述（長い文章用に Text 型）
    trouble_detail: Mapped[str] = mapped_column(Text, nullable=False)

    # トップページの AI トリアージ入力（既存データは NULL のまま）
    # 実施した操作と期待結果 / 実施した操作と実際の結果 / エラーコード（任意）
    expected_actions: Mapped[str | None] = mapped_column(Text, nullable=True)
    actual_actions: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # AI が返した一次回答（想定原因・対応要否など）。未分析なら NULL
    ai_initial_response: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 登録者メール。一覧 API のレスポンスには含めない。
    # 更新・削除・メッセージ投稿のときに「本人か」を照合するために使う
    email: Mapped[str] = mapped_column(String(255), nullable=False)

    # 管理者用の対応状況（新規作成時の初期値は "Pending"）
    # 取りうる値: "Pending" / "Temporarily Resolved" / "Fully Resolved"
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="Pending")

    # 管理者コメント（任意。未記入なら NULL）
    admin_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    # トップページの一時保存（詳細未入力）。False = 本登録済み
    is_draft: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    # チャット形式の対応履歴（園館スタッフ ↔ 管理者）
    messages: Mapped[list["SampleMessageModel"]] = relationship(
        "SampleMessageModel",
        back_populates="sample",
        cascade="all, delete-orphan",
        order_by="SampleMessageModel.created_at",
    )


class SampleMessageModel(Base):
    """問い合わせ1件に紐づくチャットメッセージ。"""

    __tablename__ = "sample_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sample_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("samples.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # 'staff' = 園館スタッフ / 'admin' = 管理者
    author_role: Mapped[str] = mapped_column(String(20), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    sample: Mapped["SampleModel"] = relationship(
        "SampleModel", back_populates="messages"
    )
