import { z } from 'zod'

/**
 * Numeric inputs verified against the live form: a plain `z.coerce.number()`
 * turns an empty field into `0`, so clearing a purchase price silently wrote
 * zero (and the backend then skipped recalculation, leaving stale figures).
 * `''` must mean "not set", while an actual typo must still be rejected.
 */
const optionalNumber = z.preprocess(
  value => {
    if (value === '' || value === null || value === undefined) return null
    if (typeof value === 'string') {
      const parsed = Number(value)
      return Number.isNaN(parsed) ? value : parsed
    }
    return value
  },
  z.number({ invalid_type_error: 'Enter a number' }).nullable(),
)

const integer = (messages: { invalid: string; min: string; max: string }, min: number, max: number) =>
  z.preprocess(
    value => {
      if (value === '' || value === null || value === undefined) return null
      if (typeof value === 'string') {
        const parsed = Number(value)
        return Number.isNaN(parsed) ? value : parsed
      }
      return value
    },
    z.number({ invalid_type_error: messages.invalid })
      .int('Use whole numbers')
      .min(min, messages.min)
      .max(max, messages.max)
      .nullable(),
  )

/** Optional text: an empty string is stored as NULL, never as ''. */
const optionalText = z.preprocess(
  value => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().nullable(),
)

const requiredText = (message: string) => z.preprocess(
  value => (typeof value === 'string' ? value.trim() : value),
  z.string().min(1, message),
)

export const assetSchema = z.object({
  asset_no: requiredText('Asset No is required'),
  name: requiredText('Name is required'),
  fixed_asset_number_ax: optionalText,
  group_name: optionalText,
  category: optionalText,
  site_location: optionalText,
  job: optionalText,
  account_no: optionalNumber,
  voucher_no: optionalText,
  purchase_date: optionalText,
  year: integer({ invalid: 'Enter a year', min: 'Year is too small', max: 'Year is too large' }, 1900, 2200),
  year_ref: z.preprocess(
    value => {
      if (value === '' || value === null || value === undefined) return null
      const parsed = Number(value)
      return Number.isNaN(parsed) ? value : parsed
    },
    z.number({ invalid_type_error: 'Choose a year' }).int().min(1900).max(2200),
  ),
  quantity: optionalNumber,
  maker_type_location: optionalText,
  capacity_size_user: optionalText,
  police_no: optionalText,
  machine_no: optionalText,
  chasis_no: optionalText,
  valas: optionalText,
  purchase_price: optionalNumber,
  depreciation_period_total: integer(
    { invalid: 'Enter a number of months', min: 'At least 1 month', max: 'Too long' },
    1,
    1200,
  ),
  photo_status: optionalText,
  condition: optionalText,
  remark: optionalText,
})

/** Every control is a text input, so the form state is all strings. */
export type AssetFormValues = {
  asset_no: string
  name: string
  fixed_asset_number_ax: string
  group_name: string
  category: string
  site_location: string
  job: string
  account_no: string
  voucher_no: string
  purchase_date: string
  year: string
  year_ref: string
  quantity: string
  maker_type_location: string
  capacity_size_user: string
  police_no: string
  machine_no: string
  chasis_no: string
  valas: string
  purchase_price: string
  depreciation_period_total: string
  photo_status: string
  condition: string
  remark: string
}

/** Validated payload handed to the API. */
export type AssetPayload = z.infer<typeof assetSchema>

export const EMPTY_FORM: AssetFormValues = {
  asset_no: '',
  name: '',
  fixed_asset_number_ax: '',
  group_name: '',
  category: '',
  site_location: '',
  job: '',
  account_no: '',
  voucher_no: '',
  purchase_date: '',
  year: '',
  year_ref: '2026',
  quantity: '',
  maker_type_location: '',
  capacity_size_user: '',
  police_no: '',
  machine_no: '',
  chasis_no: '',
  valas: '',
  purchase_price: '',
  depreciation_period_total: '',
  photo_status: '',
  condition: '',
  remark: '',
}

/** Stored values become form values: nulls render as empty inputs, never "null". */
export function toFormValues(source: Record<string, unknown>): AssetFormValues {
  const text = (value: unknown) => (value == null ? '' : String(value))
  const number = (value: unknown) => (value == null || value === '' ? '' : String(Number(value)))

  return {
    asset_no: text(source.asset_no),
    name: text(source.name),
    fixed_asset_number_ax: text(source.fixed_asset_number_ax),
    group_name: text(source.group_name),
    category: text(source.category),
    site_location: text(source.site_location),
    job: text(source.job),
    account_no: number(source.account_no),
    voucher_no: text(source.voucher_no),
    purchase_date: source.purchase_date ? String(source.purchase_date).slice(0, 10) : '',
    year: number(source.year),
    year_ref: source.year_ref == null ? '' : String(source.year_ref),
    quantity: number(source.quantity),
    maker_type_location: text(source.maker_type_location),
    capacity_size_user: text(source.capacity_size_user),
    police_no: text(source.police_no),
    machine_no: text(source.machine_no),
    chasis_no: text(source.chasis_no),
    valas: text(source.valas),
    purchase_price: number(source.purchase_price),
    depreciation_period_total: number(source.depreciation_period_total),
    photo_status: text(source.photo_status),
    condition: text(source.condition),
    remark: text(source.remark),
  }
}
