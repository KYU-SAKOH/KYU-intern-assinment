"""SQLAlchemyモデル"""

from datetime import datetime
from sqlalchemy import DateTime, Integer, String,Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class SampleModel(Base):
    __tablename__ = "samples"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    place: Mapped[str] = mapped_column(String(100), nullable=False)
    # 追加: トラブルの種類 ('customer' または 'stuff')
    trouble_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # 追加: トラブル内容の自由記述（長文対応のため Text型）
    trouble_detail: Mapped[str] = mapped_column(Text, nullable=False)

    # 追加: 顧客再現時の操作ログ（トラブル発生通知までに記録した操作）
    operation_log: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 追加: 登録者メール（一覧には出さず、更新・削除の照合に使う）
    email: Mapped[str] = mapped_column(String(255), nullable=False)
