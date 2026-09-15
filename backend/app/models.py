"""
SQLAlchemy モデル（DB のテーブル定義）

「Python のクラス」⇔「MySQL のテーブル samples」を対応づける。
実際のテーブル作成・変更は Alembic のマイグレーションで行う。
"""

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

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

    # 顧客再現時の操作ログ（未記録なら NULL 可）
    # Terravie 再現画面で「トラブル発生を通知」するとここに文字列が入る
    operation_log: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 登録者メール。一覧 API のレスポンスには含めない。
    # 更新・削除・操作ログ保存のときに「本人か」を照合するために使う
    email: Mapped[str] = mapped_column(String(255), nullable=False)
