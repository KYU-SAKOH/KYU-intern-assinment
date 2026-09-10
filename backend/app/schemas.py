"""サンプル関連のPydanticスキーマ"""

from pydantic import BaseModel
from datetime import datetime


class SampleCreate(BaseModel):
    name: str
    date: datetime
    place: str


class SampleResponse(BaseModel):
    id: int
    name: str
    date: datetime
    place: str

    model_config = {"from_attributes": True}
