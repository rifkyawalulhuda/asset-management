"""Initial migration

Revision ID: 001_initial
Revises: 
Create Date: 2026-07-14

"""
from alembic import op
import sqlalchemy as sa

revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'fixed_assets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('no', sa.Integer(), nullable=True),
        sa.Column('site_location', sa.String(50), nullable=True),
        sa.Column('job', sa.String(50), nullable=True),
        sa.Column('account_no', sa.Integer(), nullable=True),
        sa.Column('category', sa.String(50), nullable=True),
        sa.Column('asset_no', sa.String(50), nullable=False),
        sa.Column('fixed_asset_number_ax', sa.String(50), nullable=True),
        sa.Column('purchase_date', sa.Date(), nullable=True),
        sa.Column('group_name', sa.String(100), nullable=True),
        sa.Column('voucher_no', sa.String(50), nullable=True),
        sa.Column('name', sa.String(500), nullable=False),
        sa.Column('maker_type_location', sa.Text(), nullable=True),
        sa.Column('capacity_size_user', sa.Text(), nullable=True),
        sa.Column('year', sa.Integer(), nullable=True),
        sa.Column('police_no', sa.String(50), nullable=True),
        sa.Column('machine_no', sa.String(50), nullable=True),
        sa.Column('chasis_no', sa.String(50), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=True),
        sa.Column('valas', sa.String(20), nullable=True),
        sa.Column('purchase_price', sa.Numeric(20, 4), nullable=True),
        sa.Column('monthly_depreciation', sa.Numeric(20, 4), nullable=True),
        sa.Column('depreciation_period_total', sa.Integer(), nullable=True),
        sa.Column('dep_period_acc_prev_year', sa.Numeric(10, 2), nullable=True),
        sa.Column('dep_period_yearly', sa.Numeric(10, 2), nullable=True),
        sa.Column('dep_period_until_year', sa.Numeric(10, 2), nullable=True),
        sa.Column('dep_period_remain', sa.Numeric(10, 2), nullable=True),
        sa.Column('acc_depreciation_prev', sa.Numeric(20, 4), nullable=True),
        sa.Column('net_book_value_prev', sa.Numeric(20, 4), nullable=True),
        sa.Column('dep_expense_current', sa.Numeric(20, 4), nullable=True),
        sa.Column('acc_depreciation_curr', sa.Numeric(20, 4), nullable=True),
        sa.Column('net_book_value_curr', sa.Numeric(20, 4), nullable=True),
        sa.Column('status_additional', sa.Boolean(), nullable=True),
        sa.Column('status_disposals', sa.Boolean(), nullable=True),
        sa.Column('condition', sa.String(100), nullable=True),
        sa.Column('photo_status', sa.String(20), nullable=True),
        sa.Column('remark', sa.Text(), nullable=True),
        sa.Column('year_ref', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('asset_no', 'year_ref', name='uq_asset_no_year_ref'),
    )
    op.create_index('ix_fixed_assets_id', 'fixed_assets', ['id'])
    op.create_index('ix_fixed_assets_asset_no', 'fixed_assets', ['asset_no'])
    op.create_index('ix_fixed_assets_year_ref', 'fixed_assets', ['year_ref'])

    op.create_table(
        'depreciation_monthly',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(20, 4), nullable=True),
        sa.ForeignKeyConstraint(['asset_id'], ['fixed_assets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('asset_id', 'year', 'month', name='uq_asset_year_month'),
    )
    op.create_index('ix_depreciation_monthly_id', 'depreciation_monthly', ['id'])

    op.create_table(
        'acquisition_disposals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=True),
        sa.Column('site', sa.String(50), nullable=True),
        sa.Column('job', sa.String(50), nullable=True),
        sa.Column('fixed_asset_no', sa.String(50), nullable=True),
        sa.Column('application', sa.String(200), nullable=True),
        sa.Column('transaction_date', sa.Date(), nullable=True),
        sa.Column('bookslip_no', sa.String(50), nullable=True),
        sa.Column('asset_name', sa.String(500), nullable=True),
        sa.Column('price', sa.Numeric(20, 4), nullable=True),
        sa.Column('status', sa.String(20), nullable=True),
        sa.Column('vendor_customer', sa.String(200), nullable=True),
        sa.Column('year_ref', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['asset_id'], ['fixed_assets.id'],),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_acquisition_disposals_id', 'acquisition_disposals', ['id'])


def downgrade() -> None:
    op.drop_table('acquisition_disposals')
    op.drop_table('depreciation_monthly')
    op.drop_table('fixed_assets')
