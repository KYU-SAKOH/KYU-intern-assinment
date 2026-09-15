"""サンプル CRUD API"""

import os
import re
# ===== 追加: 日付フィルタ用 =====
from datetime import date, datetime, time
# ===== 追加ここまで =====

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from models import SampleModel
from schemas import SampleCreate, SamplePartialUpdate, SampleResponse, SampleUpdate

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
    trouble_type: str | None = Query(None, description="問題タイプ"),
    # ===== 追加: 日付レンジフィルタ（YYYY-MM-DD） =====
    date_from: date | None = Query(None, description="この日以降（含む）"),
    date_to: date | None = Query(None, description="この日以前（含む）"),
    # ===== 追加ここまで =====
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
                    SampleModel.trouble_detail.like(pattern, escape="\\"),
                )
            )
    if trouble_type and trouble_type.strip():
        query = query.filter(SampleModel.trouble_type == trouble_type)
    # ===== 追加: 日付で絞り込み（開始日・終了日は両方任意） =====
    if date_from:
        query = query.filter(SampleModel.date >= datetime.combine(date_from, time.min))
    if date_to:
        query = query.filter(SampleModel.date <= datetime.combine(date_to, time.max))
    # ===== 追加ここまで =====
    return query.order_by(SampleModel.date.desc()).all()

  
@app.post("/samples", response_model=SampleResponse, status_code=201)
def create_sample(sample: SampleCreate, db: Session = Depends(get_db)):
    """サンプルを追加する"""
    db_sample = SampleModel(**sample.model_dump())
    db.add(db_sample)
    db.commit()
    db.refresh(db_sample)
    return db_sample


# ===== 追加: 更新 API（PUT / PATCH） =====
@app.put("/samples/{sample_id}", response_model=SampleResponse)
def update_sample(
    sample_id: int, sample: SampleUpdate, db: Session = Depends(get_db)
):
    """サンプルを全項目で上書き更新する（PUT）"""
    db_sample = db.query(SampleModel).filter(SampleModel.id == sample_id).first()
    if not db_sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    for key, value in sample.model_dump().items():
        setattr(db_sample, key, value)
    db.commit()
    db.refresh(db_sample)
    return db_sample


@app.patch("/samples/{sample_id}", response_model=SampleResponse)
def partial_update_sample(
    sample_id: int, sample: SamplePartialUpdate, db: Session = Depends(get_db)
):
    """サンプルの一部フィールドだけ更新する（PATCH）"""
    db_sample = db.query(SampleModel).filter(SampleModel.id == sample_id).first()
    if not db_sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    # exclude_unset=True: リクエストに含まれたフィールドだけ適用
    for key, value in sample.model_dump(exclude_unset=True).items():
        setattr(db_sample, key, value)
    db.commit()
    db.refresh(db_sample)
    return db_sample
# ===== 追加ここまで =====


@app.delete("/samples/{sample_id}", status_code=204)
def delete_sample(sample_id: int, db: Session = Depends(get_db)):
    """サンプルを削除する"""
    sample = db.query(SampleModel).filter(SampleModel.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    db.delete(sample)
    db.commit()
