"""003 fix acquisition_disposals status column length

Revision ID: 003
Revises: 002
Create Date: 2026-07-17

Fixes mismatch: migration 001 created status as VARCHAR(20) but model has String(50).
Real-world values like 'Fotocopy Machine Fuji Xerox at ASC' (34 chars) exceed 20.
Raise to VARCHAR(100) to give ample room.
"""
from alembic import op
import sqlalchemy as sa

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        'acquisition_disposals',
        'status',
        existing_type=sa.String(20),
        type_=sa.String(100),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        'acquisition_disposals',
        'status',
        existing_type=sa.String(100),
        type_=sa.String(20),
        existing_nullable=True,
    )
