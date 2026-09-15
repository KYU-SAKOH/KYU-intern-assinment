"""
Pydantic スキーマ（API の入出力の形）

models.py  … DB に保存する形（SQLAlchemy）
schemas.py … HTTP で受け取る / 返す形（Pydantic）

分けておく理由の例:
  - リクエストでは email が必須でも、レスポンスでは email を返したくない
  - PUT と PATCH で「全部必須」か「一部だけ」かを変えたい
  - 管理者更新は本人メール照合なしで status / admin_comment だけ触る
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# 管理者が選べる対応状況（英語のまま DB に保存する）
SampleStatus = Literal["Pending", "Temporarily Resolved", "Fully Resolved"]


class SampleCreate(BaseModel):
    """POST /samples のリクエストボディ（新規作成）。status はサーバ側で Pending を付ける。"""

    name: str
    date: datetime
    place: str
    trouble_type: str
    trouble_detail: str
    # 登録者メール（必須。あとで更新・削除の照合キーになる）
    email: str = Field(min_length=3, max_length=255)
    # 操作ログは後から PATCH することが多いので、作成時は省略可
    operation_log: str | None = None


class SampleUpdate(BaseModel):
    """
    PUT /samples/{id} 用。
    全フィールドを送り直す前提。email は照合用で、サーバ側では変更しない。
    status / admin_comment は管理者専用なのでここには含めない。
    """

    name: str
    date: datetime
    place: str
    trouble_type: str
    trouble_detail: str
    email: str = Field(min_length=3, max_length=255)
    operation_log: str | None = None


class SamplePartialUpdate(BaseModel):
    """
    PATCH /samples/{id} 用（登録者向け）。
    送ったフィールドだけ更新する。email だけは必ず必要（本人確認）。

    例（操作ログだけ更新）:
      { "email": "a@example.com", "operation_log": "..." }
    """

    email: str = Field(min_length=3, max_length=255)
    name: str | None = None
    date: datetime | None = None
    place: str | None = None
    trouble_type: str | None = None
    trouble_detail: str | None = None
    operation_log: str | None = None


class SampleAdminUpdate(BaseModel):
    """
    PATCH /samples/{id}/admin 用（管理者向け）。

    本人メールの照合はしない（デモ用の簡易管理者画面）。
    status と admin_comment だけを更新する。
    """

    status: SampleStatus
    admin_comment: str | None = None


class SampleResponse(BaseModel):
    """
    一覧・詳細のレスポンス。
    email は意図的に含めていない（画面にも返さない）。
    status / admin_comment は管理者・一般画面の両方で表示できる。
    """

    id: int
    name: str
    date: datetime
    place: str
    trouble_type: str
    trouble_detail: str
    operation_log: str | None = None
    status: SampleStatus = "Pending"
    admin_comment: str | None = None

    # ORM オブジェクト（SampleModel）から自動でフィールドを読めるようにする設定
    model_config = {"from_attributes": True}
