"""
Pydantic スキーマ（API の入出力の形）

models.py  … DB に保存する形（SQLAlchemy）
schemas.py … HTTP で受け取る / 返す形（Pydantic）

分けておく理由の例:
  - リクエストでは email が必須でも、レスポンスでは email を返したくない
  - PUT と PATCH で「全部必須」か「一部だけ」かを変えたい
  - 管理者更新は本人メール照合なしで status / admin_comment だけ触る
"""

import json
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

# 管理者が選べる対応状況（英語のまま DB に保存する）
SampleStatus = Literal["Pending", "Temporarily Resolved", "Fully Resolved"]
ReproductionRate = Literal["always", "often", "sometimes", "rare"]
SeverityLevel = Literal["low", "medium", "high"]

MIN_REPRODUCTION_STEPS = 3
MAX_REPRODUCTION_STEPS = 15


def serialize_reproduction_steps(steps: list[str]) -> str:
    cleaned = [s.strip() for s in steps if isinstance(s, str) and s.strip()]
    return json.dumps(cleaned, ensure_ascii=False)


def deserialize_reproduction_steps(raw: str | None) -> list[str]:
    if not raw or not raw.strip():
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    return [str(s).strip() for s in data if str(s).strip()]


def assert_reproduction_steps_valid(steps: list[str]) -> list[str]:
    """検証して正規化済みリストを返す。不正なら ValueError。"""
    cleaned = [s.strip() for s in steps if isinstance(s, str) and s.strip()]
    if len(cleaned) < MIN_REPRODUCTION_STEPS:
        raise ValueError(
            f"再現手順は少なくとも {MIN_REPRODUCTION_STEPS} 件必要です。"
        )
    if len(cleaned) > MAX_REPRODUCTION_STEPS:
        raise ValueError(f"再現手順は最大 {MAX_REPRODUCTION_STEPS} 件までです。")
    return cleaned


class SampleCreate(BaseModel):
    """POST /samples のリクエストボディ（新規作成）。status はサーバ側で Pending を付ける。"""

    name: str
    date: datetime
    place: str
    trouble_type: str
    trouble_detail: str = ""
    # 登録者メール（必須。あとで更新・削除の照合キーになる）
    email: str = Field(min_length=3, max_length=255)
    # トップページのトリアージ入力（任意。トリアージ経由で登録するとき使う）
    expected_actions: str | None = None
    actual_actions: str | None = None
    error_code: str | None = None
    ai_initial_response: str | None = None
    reproduction_steps: list[str] | None = None
    reproduction_rate: ReproductionRate | None = None
    severity: SeverityLevel | None = None
    screenshot_path: str | None = None
    device_info: str | None = None


class SampleTriageCompleteCreate(BaseModel):
    """
    トップページ「詳細を入力」からの本登録。
    日時はサーバ側で現在時刻を記録する。
    """

    name: str
    place: str
    trouble_type: str
    email: str = Field(min_length=3, max_length=255)
    expected_actions: str = Field(min_length=1)
    actual_actions: str = Field(min_length=1)
    error_code: str | None = None
    ai_initial_response: str | None = None
    reproduction_steps: list[str]
    reproduction_rate: ReproductionRate | None = None
    severity: SeverityLevel | None = None
    screenshot_path: str | None = None
    device_info: str | None = None

    @model_validator(mode="after")
    def _check_steps(self) -> "SampleTriageCompleteCreate":
        self.reproduction_steps = assert_reproduction_steps_valid(
            self.reproduction_steps
        )
        return self


class SampleDraftCreate(BaseModel):
    """POST /samples/draft … 一時保存（報告者名 + トリアージ内容）。"""

    name: str = Field(min_length=1)
    expected_actions: str = Field(min_length=1)
    actual_actions: str = Field(min_length=1)
    error_code: str | None = None
    ai_initial_response: str | None = None


class SampleFinalize(BaseModel):
    """PATCH /samples/{id}/finalize … 一時保存の詳細入力完了。"""

    name: str
    place: str
    trouble_type: str
    email: str = Field(min_length=3, max_length=255)
    reproduction_steps: list[str]
    reproduction_rate: ReproductionRate | None = None
    severity: SeverityLevel | None = None
    screenshot_path: str | None = None
    device_info: str | None = None

    @model_validator(mode="after")
    def _check_steps(self) -> "SampleFinalize":
        self.reproduction_steps = assert_reproduction_steps_valid(
            self.reproduction_steps
        )
        return self


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
    trouble_detail: str = ""
    email: str = Field(min_length=3, max_length=255)
    expected_actions: str | None = None
    actual_actions: str | None = None
    error_code: str | None = None
    ai_initial_response: str | None = None
    # 本登録の再編集では再現手順も必須（フロントの詳細ウィザードと揃える）
    reproduction_steps: list[str]
    reproduction_rate: ReproductionRate | None = None
    severity: SeverityLevel | None = None
    screenshot_path: str | None = None
    device_info: str | None = None

    @model_validator(mode="after")
    def _check_steps(self) -> "SampleUpdate":
        self.reproduction_steps = assert_reproduction_steps_valid(
            self.reproduction_steps
        )
        return self


class SamplePartialUpdate(BaseModel):
    """
    PATCH /samples/{id} 用（登録者向け）。
    送ったフィールドだけ更新する。email だけは必ず必要（本人確認）。

    例（部分更新）:
      { "email": "a@example.com", "place": "ゲート1" }
    """

    email: str = Field(min_length=3, max_length=255)
    name: str | None = None
    date: datetime | None = None
    place: str | None = None
    trouble_type: str | None = None
    trouble_detail: str | None = None
    expected_actions: str | None = None
    actual_actions: str | None = None
    error_code: str | None = None
    ai_initial_response: str | None = None
    reproduction_steps: list[str] | None = None
    reproduction_rate: ReproductionRate | None = None
    severity: SeverityLevel | None = None
    screenshot_path: str | None = None
    device_info: str | None = None


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
    expected_actions: str | None = None
    actual_actions: str | None = None
    error_code: str | None = None
    ai_initial_response: str | None = None
    status: SampleStatus = "Pending"
    admin_comment: str | None = None
    is_draft: bool = False
    reproduction_steps: list[str] = Field(default_factory=list)
    reproduction_rate: str | None = None
    severity: str | None = None
    screenshot_path: str | None = None
    device_info: str | None = None
    priority_score: int = 0

    model_config = {"from_attributes": True}

    @field_validator("reproduction_steps", mode="before")
    @classmethod
    def _parse_steps(cls, value: object) -> list[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return [str(s).strip() for s in value if str(s).strip()]
        if isinstance(value, str):
            return deserialize_reproduction_steps(value)
        return []


class ReproductionAssistRequest(BaseModel):
    """POST /reproduction-assist のリクエスト。"""

    reproduction_steps: list[str] = Field(default_factory=list)
    expected_actions: str = ""
    actual_actions: str = ""
    error_code: str | None = None


class ReproductionAssistResponse(BaseModel):
    """再現手順の AI チェック結果。"""

    gap_warnings: list[str] = Field(default_factory=list)
    suggested_next_steps: list[str] = Field(default_factory=list)
    can_proceed: bool = False


class UploadScreenshotResponse(BaseModel):
    """スクショアップロード結果。"""

    path: str
    url: str


class TriageRequest(BaseModel):
    """POST /triage のリクエスト。トップページの新規エントリ入力。"""

    expected_actions: str = Field(min_length=1, description="実施した操作と期待結果")
    actual_actions: str = Field(min_length=1, description="実施した操作と実際の結果")
    error_code: str | None = Field(None, description="エラーコード（任意）")


class TriageResponse(BaseModel):
    """
    AI トリアージ結果。

    status=needs_reentry … 情報不足や複数トラブル混在のため再入力を求める
    status=ok … 類似サンプルと一次回答を返す
    """

    status: Literal["ok", "needs_reentry"]
    reentry_reasons: list[str] = Field(default_factory=list)
    similar_samples: list[SampleResponse] = Field(default_factory=list)
    initial_response: str | None = None


MessageAuthorRole = Literal["staff", "admin"]


class SampleMessageCreate(BaseModel):
    """POST /samples/{id}/messages のリクエスト。"""

    author_role: MessageAuthorRole
    body: str = Field(min_length=1)
    # staff 投稿時は登録時メールが必須。admin は不要。
    email: str | None = None


class SampleMessageResponse(BaseModel):
    """チャットメッセージ1件のレスポンス。"""

    id: int
    sample_id: int
    author_role: MessageAuthorRole
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}
