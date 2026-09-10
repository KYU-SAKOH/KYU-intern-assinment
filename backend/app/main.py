"""サンプル CRUD API"""

import os
import re

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from models import SampleModel
from schemas import SampleCreate, SampleResponse

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app = FastAPI(title="Sample API", version="1.0.0")

# CORS設定（フロントエンドからのアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {"status": "healthy"}


# ---------- Samples CRUD （サンプル） ----------


def _like_pattern(keyword: str) -> str:
    """ユーザー入力の % や _ をリテラルとして扱い、部分一致用のパターンにする"""
    escaped = keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


@app.get("/samples", response_model=list[SampleResponse])
def get_samples(
    q: str | None = Query(None, description="空白区切りのキーワード。AND条件・部分一致"),
    db: Session = Depends(get_db),
):
    """サンプル一覧を取得する。q があるときは名前・場所をキーワード検索する。"""
    query = db.query(SampleModel)

    if q and q.strip():
        # 半角・全角スペースで分割し、空文字は捨てる
        keywords = [k for k in re.split(r"[\s\u3000]+", q.strip()) if k]
        for keyword in keywords:
            pattern = _like_pattern(keyword)
            # 1キーワードは「名前または場所」に部分一致すればヒット
            # 複数キーワードはすべて満たす（AND）
            query = query.filter(
                or_(
                    SampleModel.name.like(pattern, escape="\\"),
                    SampleModel.place.like(pattern, escape="\\"),
                )
            )

    return query.order_by(SampleModel.date.desc()).all()

  
@app.post("/samples", response_model=SampleResponse, status_code=201)
def create_sample(sample: SampleCreate, db: Session = Depends(get_db)):
    """サンプルを追加する"""
    db_sample = SampleModel(**sample.model_dump())
    db.add(db_sample)
    db.commit()
    db.refresh(db_sample)
    return db_sample


@app.delete("/samples/{sample_id}", status_code=204)
def delete_sample(sample_id: int, db: Session = Depends(get_db)):
    """サンプルを削除する"""
    sample = db.query(SampleModel).filter(SampleModel.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    db.delete(sample)
    db.commit()
