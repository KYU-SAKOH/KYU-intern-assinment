"""add triage fields (expected/actual/error_code/ai_initial_response)

Revision ID: c9d0e1f2a3b4
Revises: a1b2c3d4e5f6
Create Date: 2026-09-16 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("samples", sa.Column("expected_actions", sa.Text(), nullable=True))
    op.add_column("samples", sa.Column("actual_actions", sa.Text(), nullable=True))
    op.add_column("samples", sa.Column("error_code", sa.String(length=100), nullable=True))
    op.add_column("samples", sa.Column("ai_initial_response", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("samples", "ai_initial_response")
    op.drop_column("samples", "error_code")
    op.drop_column("samples", "actual_actions")
    op.drop_column("samples", "expected_actions")
