"""add operation_log

Revision ID: e7f8a9b0c1d2
Revises: cacadad236f6
Create Date: 2026-09-15 18:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7f8a9b0c1d2'
down_revision: Union[str, Sequence[str], None] = 'cacadad236f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('samples', sa.Column('operation_log', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('samples', 'operation_log')
