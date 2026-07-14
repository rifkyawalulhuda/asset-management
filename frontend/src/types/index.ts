export interface DepreciationMonthly {
  id: number
  asset_id: number
  year: number
  month: number
  amount: number | null
}

export interface FixedAsset {
  id: number
  no: number | null
  site_location: string | null
  job: string | null
  account_no: number | null
  category: string | null
  asset_no: string
  fixed_asset_number_ax: string | null
  purchase_date: string | null
  group_name: string | null
  voucher_no: string | null
  name: string
  maker_type_location: string | null
  capacity_size_user: string | null
  year: number | null
  police_no: string | null
  machine_no: string | null
  chasis_no: string | null
  quantity: number | null
  valas: string | null
  purchase_price: number | null
  monthly_depreciation: number | null
  depreciation_period_total: number | null
  dep_period_acc_prev_year: number | null
  dep_period_yearly: number | null
  dep_period_until_year: number | null
  dep_period_remain: number | null
  acc_depreciation_prev: number | null
  net_book_value_prev: number | null
  dep_expense_current: number | null
  acc_depreciation_curr: number | null
  net_book_value_curr: number | null
  status_additional: boolean
  status_disposals: boolean
  condition: string | null
  photo_status: string | null
  remark: string | null
  year_ref: number
  created_at: string | null
  updated_at: string | null
  depreciation_monthly: DepreciationMonthly[]
}

export interface FixedAssetListResponse {
  items: FixedAsset[]
  total: number
  page: number
  size: number
}

export interface AcquisitionDisposal {
  id: number
  asset_id: number | null
  site: string | null
  job: string | null
  fixed_asset_no: string | null
  application: string | null
  transaction_date: string | null
  bookslip_no: string | null
  asset_name: string | null
  price: number | null
  status: string | null
  vendor_customer: string | null
  year_ref: number | null
  created_at: string | null
}

export interface SummaryMonthly {
  [job: string]: {
    jan: number; feb: number; mar: number; apr: number
    may: number; jun: number; jul: number; aug: number
    sep: number; oct: number; nov: number; dec: number
    total: number
  }
}

export interface SummaryByGroup {
  [group: string]: {
    yearly_depreciation: number
    purchase_price: number
    acc_depreciation: number
    net_book_value: number
    count: number
  }
}

export type AssetFilters = {
  year_ref?: number
  category?: string
  group_name?: string
  site_location?: string
  job?: string
  search?: string
  page?: number
  size?: number
}
