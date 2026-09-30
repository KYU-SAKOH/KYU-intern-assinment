"""add detail wizard fields

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-09-30 13:06:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a3b4c5d6e7f8"
down_revision: Union[str, Sequence[str], None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("samples", sa.Column("reproduction_steps", sa.Text(), nullable=True))
    op.add_column(
        "samples", sa.Column("reproduction_rate", sa.String(length=50), nullable=True)
    )
    op.add_column(
        "samples", sa.Column("severity", sa.String(length=50), nullable=True)
    )
    op.add_column(
        "samples", sa.Column("screenshot_path", sa.String(length=500), nullable=True)
    )
    op.add_column("samples", sa.Column("device_info", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("samples", "device_info")
    op.drop_column("samples", "screenshot_path")
    op.drop_column("samples", "severity")
    op.drop_column("samples", "reproduction_rate")
    op.drop_column("samples", "reproduction_steps")
