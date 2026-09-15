"""add email for owner verification

Revision ID: f1a2b3c4d5e6
Revises: e7f8a9b0c1d2
Create Date: 2026-09-15 19:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'e7f8a9b0c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'samples',
        sa.Column('email', sa.String(length=255), nullable=False, server_default=''),
    )
    op.alter_column('samples', 'email', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('samples', 'email')
