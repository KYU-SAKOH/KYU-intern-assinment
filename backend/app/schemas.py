"""サンプル関連のPydanticスキーマ"""

from pydantic import BaseModel, Field
from datetime import datetime


class SampleCreate(BaseModel):
    name: str
    date: datetime
    place: str
    trouble_type: str
    trouble_detail: str
    # 追加: 登録者メール（必須。更新・削除時の照合キー）
    email: str = Field(min_length=3, max_length=255)
    # 追加: 操作ログ（顧客再現フローで後から PATCH することも多い）
    operation_log: str | None = None


# ===== 追加: 更新用スキーマ（PUT = 全項目 / PATCH = 一部だけ） =====
class SampleUpdate(BaseModel):
    """PUT用: 全フィールドを送り直す。email は照合用（変更不可）"""
    name: str
    date: datetime
    place: str
    trouble_type: str
    trouble_detail: str
    email: str = Field(min_length=3, max_length=255)
    operation_log: str | None = None


class SamplePartialUpdate(BaseModel):
    """PATCH用: 送ったフィールドだけ更新する。email は必須（照合用）"""
    email: str = Field(min_length=3, max_length=255)
    name: str | None = None
    date: datetime | None = None
    place: str | None = None
    trouble_type: str | None = None
    trouble_detail: str | None = None
    operation_log: str | None = None
# ===== 追加ここまで =====


class SampleResponse(BaseModel):
    """一覧・詳細用。email は含めない（画面にも返さない）"""
    id: int
    name: str
    date: datetime
    place: str
    trouble_type: str
    trouble_detail: str
    operation_log: str | None = None

    model_config = {"from_attributes": True}
