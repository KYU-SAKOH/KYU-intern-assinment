"""add staff notify fields

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-09-30 16:22:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c5d6e7f8a9b0"
down_revision: Union[str, Sequence[str], None] = "b4c5d6e7f8a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "samples",
        sa.Column(
            "staff_notify_unread",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "samples",
        sa.Column("staff_notify_kind", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "samples",
        sa.Column("staff_notify_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "samples",
        sa.Column("staff_notify_summary", sa.String(length=500), nullable=True),
    )
    op.create_index(
        "ix_samples_staff_notify_unread",
        "samples",
        ["staff_notify_unread"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_samples_staff_notify_unread", table_name="samples")
    op.drop_column("samples", "staff_notify_summary")
    op.drop_column("samples", "staff_notify_at")
    op.drop_column("samples", "staff_notify_kind")
    op.drop_column("samples", "staff_notify_unread")
