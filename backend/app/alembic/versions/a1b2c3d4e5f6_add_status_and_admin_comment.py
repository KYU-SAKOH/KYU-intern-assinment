"""add status and admin_comment for administrator page

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-09-15 23:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    samples テーブルに管理者用の列を追加する。

    - status: 既存行も含め初期値は Pending
    - admin_comment: コメントは任意なので NULL 可
    """
    op.add_column(
        "samples",
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            server_default="Pending",
        ),
    )
    # 以後の INSERT はアプリ側の default に任せるため、server_default を外す
    op.alter_column("samples", "status", server_default=None)

    op.add_column(
        "samples",
        sa.Column("admin_comment", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    """Upgrade の逆操作（列を削除して元に戻す）。"""
    op.drop_column("samples", "admin_comment")
    op.drop_column("samples", "status")
