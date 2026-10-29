"""004 import runs and asset activity

Adds:
  import_runs            one row per applied import (file, counts, snapshot)
  fixed_assets.is_active false when the asset no longer appears in the workbook
  fixed_assets.last_seen_at  last import that contained the asset

Revision ID: 004
Revises: 003
Create Date: 2026-10-29
"""
from alembic import op
import sqlalchemy as sa

revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'fixed_assets',
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column('fixed_assets', sa.Column('last_seen_at', sa.DateTime(), nullable=True))
    op.create_index('ix_fixed_assets_is_active', 'fixed_assets', ['is_active'])

    op.create_table(
        'import_runs',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('filename', sa.String(255), nullable=True),
        sa.Column('file_hash', sa.String(64), nullable=True, index=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='applied'),
        sa.Column('years', sa.String(100), nullable=True),
        sa.Column('assets_created', sa.Integer(), server_default='0'),
        sa.Column('assets_updated', sa.Integer(), server_default='0'),
        sa.Column('assets_unchanged', sa.Integer(), server_default='0'),
        sa.Column('assets_deactivated', sa.Integer(), server_default='0'),
        sa.Column('assets_reactivated', sa.Integer(), server_default='0'),
        sa.Column('approval_created', sa.Integer(), server_default='0'),
        sa.Column('approval_updated', sa.Integer(), server_default='0'),
        sa.Column('elapsed_ms', sa.Integer(), nullable=True),
        sa.Column('snapshot_path', sa.Text(), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), index=True),
    )


def downgrade() -> None:
    op.drop_table('import_runs')
    op.drop_index('ix_fixed_assets_is_active', table_name='fixed_assets')
    op.drop_column('fixed_assets', 'last_seen_at')
    op.drop_column('fixed_assets', 'is_active')
