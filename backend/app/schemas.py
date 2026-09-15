"""サンプル関連のPydanticスキーマ"""

from pydantic import BaseModel
from datetime import datetime


class SampleCreate(BaseModel):
    name: str
    date: datetime
    place: str
    trouble_type: str
    trouble_detail: str


# ===== 追加: 更新用スキーマ（PUT = 全項目 / PATCH = 一部だけ） =====
class SampleUpdate(BaseModel):
    """PUT用: 全フィールドを送り直す"""
    name: str
    date: datetime
    place: str
    trouble_type: str
    trouble_detail: str


class SamplePartialUpdate(BaseModel):
    """PATCH用: 送ったフィールドだけ更新する"""
    name: str | None = None
    date: datetime | None = None
    place: str | None = None
    trouble_type: str | None = None
    trouble_detail: str | None = None
# ===== 追加ここまで =====


class SampleResponse(BaseModel):
    id: int
    name: str
    date: datetime
    place: str
    trouble_type: str
    trouble_detail: str

    model_config = {"from_attributes": True}
