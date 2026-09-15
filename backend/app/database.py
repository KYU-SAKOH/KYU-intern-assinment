"""
データベース接続設定

FastAPI（main.py）が MySQL に触るための「つなぎ」を用意するファイル。

流れのイメージ:
  get_db() がセッションを渡す
    → main.py の API がそのセッションで query / add / commit する
    → リクエスト終了時にセッションを閉じる
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# 接続情報は環境変数（Docker の .env.local）から読む。無いときは右のデフォルト値
DATABASE_USER = os.getenv("DATABASE_USER", "user")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD", "password")
DATABASE_HOST = os.getenv("DATABASE_HOST", "db")  # compose 内の MySQL サービス名
DATABASE_PORT = os.getenv("DATABASE_PORT", "3306")
DATABASE_NAME = os.getenv("DATABASE_NAME", "database")

# SQLAlchemy 用の接続文字列（mysql+pymysql://ユーザー:パスワード@ホスト:ポート/DB名）
DATABASE_URL = (
    f"mysql+pymysql://{DATABASE_USER}:{DATABASE_PASSWORD}"
    f"@{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_NAME}"
)

# engine … DB への接続プールを管理するオブジェクト
# echo=True のとき、発行した SQL がログに出る（デバッグ向き）
engine = create_engine(DATABASE_URL, echo=os.getenv("DEBUG", "true") == "true")

# SessionLocal … 「1リクエスト分の作業机」を作る工場
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """
    全モデル（SampleModel など）の親クラス。
    models.py の class SampleModel(Base) がこの Base を継承する。
    """

    pass


def get_db():
    """
    FastAPI の Depends(get_db) から呼ばれる。

    yield までが「準備」、yield した db を API 関数が使う。
    finally で必ず close するので、接続の取りっぱなしを防げる。
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
