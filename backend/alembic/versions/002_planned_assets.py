"""002 planned assets

Revision ID: 002
Revises: 001
Create Date: 2026-07-16

"""
from alembic import op
import sqlalchemy as sa

revision = '002'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'planned_assets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('forecast_year', sa.Integer(), nullable=False),
        sa.Column('site_location', sa.String(length=50), nullable=True),
        sa.Column('job', sa.String(length=50), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('group_name', sa.String(length=100), nullable=True),
        sa.Column('name', sa.String(length=500), nullable=False),
        sa.Column('purchase_price', sa.Numeric(precision=20, scale=4), nullable=True),
        sa.Column('depreciation_period_total', sa.Integer(), nullable=True),
        sa.Column('planned_purchase_month', sa.Integer(), nullable=False),
        sa.Column('planned_purchase_year', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_planned_assets_id', 'planned_assets', ['id'], unique=False)
    op.create_index('ix_planned_assets_forecast_year', 'planned_assets', ['forecast_year'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_planned_assets_forecast_year', table_name='planned_assets')
    op.drop_index('ix_planned_assets_id', table_name='planned_assets')
    op.drop_table('planned_assets')
