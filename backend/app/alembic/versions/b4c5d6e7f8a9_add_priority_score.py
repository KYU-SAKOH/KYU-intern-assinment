"""add priority_score

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-09-30 13:28:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b4c5d6e7f8a9"
down_revision: Union[str, Sequence[str], None] = "a3b4c5d6e7f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "samples",
        sa.Column(
            "priority_score",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.create_index(
        "ix_samples_priority_score", "samples", ["priority_score"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_samples_priority_score", table_name="samples")
    op.drop_column("samples", "priority_score")
