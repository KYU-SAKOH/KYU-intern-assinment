"""サンプル関連のPydanticスキーマ"""

from pydantic import BaseModel
from datetime import datetime


class SampleCreate(BaseModel):
    name: str
    date: datetime
    place: str
    trouble_type: str
    trouble_detail: str


class SampleResponse(BaseModel):
    id: int
    name: str
    date: datetime
    place: str
    trouble_type: str
    trouble_detail: str

    model_config = {"from_attributes": True}
