import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { fetchAsset, createAsset, updateAsset, fetchAssetMeta } from '../services/assets'
import { Field, Section } from '../components/asset/formControls'
import { AREA, FIELD } from '../components/asset/fieldStyles'
import DepPreview from '../components/asset/DepPreview'
import Combobox from '../components/asset/Combobox'
import { calcDepreciation } from '../components/asset/depCalc'
import {
  EMPTY_FORM,
  assetSchema,
  toFormValues,
  type AssetFormValues,
} from '../components/asset/assetFormSchema'
import { apiErrorMessage } from '../utils/apiError'
import { idrCompact } from '../utils/currency'

const withCurrent = (options: string[] | undefined, current: string) => {
  const list = options ?? []
  if (!current || list.includes(current)) return list
  return [current, ...list]
}

export default function AssetForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: asset, isPending: loadingAsset } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => fetchAsset(id!),
    enabled: isEdit,
  })

  // Option lists come from the database: a hard-coded list could not represent
  // values such as "Tools, Furniture & Fixtures" and silently blanked the field.
  const { data: meta } = useQuery({
    queryKey: ['asset-meta'],
    queryFn: () => fetchAssetMeta(),
    staleTime: 300_000,
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: EMPTY_FORM,
    mode: 'onBlur',
  })

  useEffect(() => {
    if (asset) reset(toFormValues(asset as unknown as Record<string, unknown>))
  }, [asset, reset])

  useEffect(() => {
    if (isEdit || !meta?.years?.length) return
    reset(current => ({ ...current, year_ref: String(meta.years[0]) }))
  }, [isEdit, meta, reset])

  // Warn before the tab closes with unsaved edits.
  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  const values = watch()
  const preview = useMemo(
    () => calcDepreciation(
      Number(values.purchase_price) || 0,
      Number(values.depreciation_period_total) || 0,
      values.purchase_date || null,
      Number(values.year_ref) || 2026,
    ),
    [values.purchase_price, values.depreciation_period_total, values.purchase_date, values.year_ref],
  )

  const createMut = useMutation({
    mutationFn: createAsset,
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      qc.invalidateQueries({ queryKey: ['summary-totals'] })
      navigate(`/assets/${data.fixed_asset_number_ax || data.id}`)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ key, data }: { key: string; data: Parameters<typeof updateAsset>[1] }) =>
      updateAsset(key, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      qc.invalidateQueries({ queryKey: ['asset', id] })
      qc.invalidateQueries({ queryKey: ['summary-totals'] })
      navigate(`/assets/${id}`)
    },
  })

  const onSubmit = (form: AssetFormValues) => {
    const parsed = assetSchema.safeParse(form)
    if (!parsed.success) return
    if (isEdit) updateMut.mutate({ key: id!, data: parsed.data })
    else createMut.mutate(parsed.data as Parameters<typeof createAsset>[0])
  }

  const saving = isSubmitting || createMut.isPending || updateMut.isPending
  const failure = apiErrorMessage(createMut.error ?? updateMut.error)
  const errorCount = Object.keys(errors).length

  const leave = () => {
    if (isDirty && !window.confirm('Discard unsaved changes?')) return
    navigate(isEdit ? `/assets/${id}` : '/assets')
  }

  const groupOptions = withCurrent(meta?.groups, values.group_name)
  const categoryOptions = withCurrent(meta?.categories, values.category)
  const siteOptions = withCurrent(meta?.sites, values.site_location)
  const jobOptions = withCurrent(meta?.jobs, values.job)
  const yearOptions = useMemo(() => {
    const years = (meta?.years ?? []).map(String)
    const current = values.year_ref
    return current && !years.includes(current) ? [current, ...years] : years
  }, [meta, values.year_ref])

  const price = Number(values.purchase_price) || 0
  const period = Number(values.depreciation_period_total) || 0

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            <Link to="/assets" className="hover:text-slate-600">Fixed assets</Link>
            <span aria-hidden="true">/</span>
            <span className="text-slate-500">{isEdit ? 'Edit' : 'New'}</span>
          </p>
          <h1 className="mt-0.5 truncate text-[19px] font-semibold leading-tight text-slate-900">
            {isEdit ? (asset?.name ?? 'Edit asset') : 'Add new asset'}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-slate-500">
            <span>PT. Sankyu Indonesia International</span>
            <span className="text-slate-300">·</span>
            <span className="font-mono text-[11px]">{values.asset_no || (isEdit ? '—' : 'new record')}</span>
            {values.fixed_asset_number_ax && values.fixed_asset_number_ax !== values.asset_no && (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-mono text-[11px]">{values.fixed_asset_number_ax}</span>
              </>
            )}
            {price > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span>{idrCompact(price)}</span>
              </>
            )}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col gap-2" noValidate>
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
          {isDirty ? (
            <span className="inline-flex items-center gap-1.5 rounded bg-amber-50 px-1.5 py-[2px] text-[10.5px] font-medium text-amber-800">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              Unsaved changes
            </span>
          ) : (
            <span className="text-[10.5px] text-slate-400">
              {isEdit ? (loadingAsset ? 'Loading asset…' : 'No changes yet') : 'Fill in the required fields'}
            </span>
          )}

          {errorCount > 0 && (
            <span role="alert" className="rounded bg-rose-50 px-1.5 py-[2px] text-[10.5px] font-medium text-rose-700">
              {errorCount} field{errorCount === 1 ? '' : 's'} need attention
            </span>
          )}

          <span className="ml-auto" />

          <button
            type="button"
            onClick={leave}
            disabled={saving}
            className="h-7 rounded border border-slate-300 bg-white px-3 text-[11.5px] font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-7 rounded bg-slate-800 px-3.5 text-[11.5px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-900 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create asset'}
          </button>
        </div>

        {failure && (
          <p role="alert" className="shrink-0 rounded border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-800">
            Could not save: {failure}
          </p>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto fx-scroll pr-0.5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-2">
            <Section title="Identification" description="How the asset is registered in the ledger">
              <Field label="Asset No" required htmlFor="asset_no" error={errors.asset_no?.message}>
                <input
                  id="asset_no"
                  {...register('asset_no')}
                  aria-invalid={Boolean(errors.asset_no)}
                  className={FIELD}
                />
              </Field>
              <Field label="Fixed asset no (AX)" htmlFor="fixed_asset_number_ax" hint="Printed on the asset tag">
                <input id="fixed_asset_number_ax" {...register('fixed_asset_number_ax')} className={FIELD} />
              </Field>
              <Field label="Name" required htmlFor="name" error={errors.name?.message} className="sm:col-span-2">
                <input id="name" {...register('name')} aria-invalid={Boolean(errors.name)} className={FIELD} />
              </Field>
              <Field label="Asset group" htmlFor="group_name" hint="Closed list, taken from existing records">
                <select id="group_name" {...register('group_name')} className={FIELD}>
                  <option value="">Not set</option>
                  {groupOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Category" htmlFor="category">
                <select id="category" {...register('category')} className={FIELD}>
                  <option value="">Not set</option>
                  {categoryOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Site / location" htmlFor="site_location" hint="Pick from the list or type a new one">
                <Controller
                  control={control}
                  name="site_location"
                  render={({ field }) => (
                    <Combobox
                      id="site_location"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      options={siteOptions}
                      placeholder="Select or type a site"
                    />
                  )}
                />
              </Field>
              <Field label="Job" htmlFor="job" hint="Pick from the list or type a new one">
                <Controller
                  control={control}
                  name="job"
                  render={({ field }) => (
                    <Combobox
                      id="job"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      options={jobOptions}
                      placeholder="Select or type a job"
                    />
                  )}
                />
              </Field>
            </Section>

            <Section title="Accounting" description="Document references and the fiscal year this row belongs to">
              <Field label="Account no" htmlFor="account_no" error={errors.account_no?.message}>
                <input id="account_no" type="number" {...register('account_no')} className={FIELD} />
              </Field>
              <Field label="Voucher no" htmlFor="voucher_no">
                <input id="voucher_no" {...register('voucher_no')} className={FIELD} />
              </Field>
              <Field label="Purchase date" htmlFor="purchase_date" hint="Drives the whole schedule">
                <input id="purchase_date" type="date" {...register('purchase_date')} className={FIELD} />
              </Field>
              <Field label="Year" htmlFor="year" error={errors.year?.message}>
                <input id="year" type="number" {...register('year')} className={FIELD} />
              </Field>
              <Field
                label="Fiscal year (year ref)"
                htmlFor="year_ref"
                error={errors.year_ref?.message}
                hint="Which reporting year this row belongs to"
              >
                <select id="year_ref" {...register('year_ref')} className={FIELD}>
                  {yearOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Quantity" htmlFor="quantity" error={errors.quantity?.message}>
                <input id="quantity" type="number" {...register('quantity')} className={FIELD} />
              </Field>
            </Section>

            <Section title="Depreciation" description="Straight-line over the useful life">
              <Field
                label="Purchase price (IDR)"
                htmlFor="purchase_price"
                error={errors.purchase_price?.message}
                hint={price > 0 ? idrCompact(price) : 'Leave empty if not yet valued'}
              >
                <input
                  id="purchase_price"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...register('purchase_price')}
                  aria-invalid={Boolean(errors.purchase_price)}
                  className={FIELD}
                />
              </Field>
              <Field
                label="Useful life (months)"
                htmlFor="depreciation_period_total"
                error={errors.depreciation_period_total?.message}
                hint={period > 0 ? `${(period / 12).toFixed(1)} years` : 'Leave empty for non-depreciable assets'}
              >
                <input
                  id="depreciation_period_total"
                  type="number"
                  {...register('depreciation_period_total')}
                  aria-invalid={Boolean(errors.depreciation_period_total)}
                  className={FIELD}
                />
              </Field>
            </Section>

            <Section title="Specification" description="Identification of the physical item">
              <Field label="Maker / type / location" htmlFor="maker_type_location" className="sm:col-span-2">
                <textarea id="maker_type_location" rows={2} {...register('maker_type_location')} className={AREA} />
              </Field>
              <Field label="Capacity / size / user" htmlFor="capacity_size_user" className="sm:col-span-2">
                <textarea id="capacity_size_user" rows={2} {...register('capacity_size_user')} className={AREA} />
              </Field>
              <Field label="Police no" htmlFor="police_no">
                <input id="police_no" {...register('police_no')} className={FIELD} />
              </Field>
              <Field label="Machine no" htmlFor="machine_no">
                <input id="machine_no" {...register('machine_no')} className={FIELD} />
              </Field>
              <Field label="Chasis no" htmlFor="chasis_no">
                <input id="chasis_no" {...register('chasis_no')} className={FIELD} />
              </Field>
              <Field label="Currency (valas)" htmlFor="valas" hint="e.g. USD">
                <input id="valas" {...register('valas')} className={FIELD} />
              </Field>
            </Section>

            <Section title="Status & condition" description="Condition reporting used by the audit">
              <Field label="Photo status" htmlFor="photo_status">
                <select id="photo_status" {...register('photo_status')} className={FIELD}>
                  <option value="">Not set</option>
                  <option value="Ok">Ok</option>
                  <option value="Not Ok">Not Ok</option>
                </select>
              </Field>
              <Field label="Condition" htmlFor="condition">
                <input id="condition" {...register('condition')} className={FIELD} />
              </Field>
              <Field label="Remark" htmlFor="remark" className="sm:col-span-2">
                <textarea id="remark" rows={2} {...register('remark')} className={AREA} />
              </Field>
            </Section>
          </div>

          <aside className="self-start xl:sticky xl:top-0">
            <DepPreview
              preview={preview}
              year={Number(values.year_ref) || 2026}
              purchaseDate={values.purchase_date}
              hasPrice={price > 0}
              hasPeriod={period > 0}
            />
          </aside>
        </div>
      </form>
    </div>
  )
}
