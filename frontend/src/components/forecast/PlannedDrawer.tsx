import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchJobs } from '../../services/assets'
import type { PlannedAsset, PlannedPayload } from './forecastUtils'
import { MONTHS, idrCompact } from './forecastUtils'

const GROUPS = ['Building', 'Structures', 'Machinary and Equipment', 'Tools Furniture Fixtures', 'Vehicles']
const CATEGORIES = ['WH1', 'WH2', 'TRP', 'BALI', 'MDN', 'PBG', 'MKS', 'SBY', 'OTHERS']

type FormState = {
  name: string
  group_name: string
  category: string
  site_location: string
  job: string
  purchase_price: string
  depreciation_period_total: string
  planned_purchase_month: number
  planned_purchase_year: number
}

const toForm = (record: PlannedAsset | null, year: number, site: string): FormState => ({
  name: record?.name ?? '',
  group_name: record?.group_name ?? '',
  category: record?.category ?? '',
  site_location: record?.site_location ?? site,
  job: record?.job ?? '',
  purchase_price: record?.purchase_price ? String(Math.round(Number(record.purchase_price))) : '',
  depreciation_period_total: record?.depreciation_period_total ? String(record.depreciation_period_total) : '',
  planned_purchase_month: record?.planned_purchase_month ?? 1,
  planned_purchase_year: record?.planned_purchase_year ?? year,
})

const inputClass =
  'h-8 w-full rounded border border-slate-300 px-2 text-[12px] text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200'

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-medium text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[10px] text-slate-400">{hint}</span>}
    </label>
  )
}

export default function PlannedDrawer({
  open,
  record,
  year,
  defaultSite,
  purchaseYears,
  sites,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean
  record: PlannedAsset | null
  year: number
  defaultSite: string
  purchaseYears: number[]
  sites: { site_location: string; count: number }[]
  saving: boolean
  onClose: () => void
  onSubmit: (payload: PlannedPayload) => void
}) {
  const [form, setForm] = useState<FormState>(() => toForm(record, year, defaultSite))
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setForm(toForm(record, year, defaultSite))
  }, [open, record, year, defaultSite])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => nameRef.current?.focus(), 60)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs', form.site_location],
    queryFn: () => fetchJobs(form.site_location || undefined, 2026),
    enabled: open && Boolean(form.site_location),
    staleTime: 60_000,
  })

  const patch = (value: Partial<FormState>) => setForm(current => ({ ...current, ...value }))

  const price = Number(form.purchase_price || 0)
  const period = Number(form.depreciation_period_total || 0)
  const monthly = price > 0 && period > 0 ? price / period : 0
  const valid = form.name.trim().length > 0 && price > 0 && period > 0

  const save = () => {
    onSubmit({
      forecast_year: year,
      name: form.name.trim(),
      group_name: form.group_name || undefined,
      category: form.category || undefined,
      site_location: form.site_location || undefined,
      job: form.job || undefined,
      purchase_price: price || undefined,
      depreciation_period_total: period || undefined,
      planned_purchase_month: Number(form.planned_purchase_month),
      planned_purchase_year: Number(form.planned_purchase_year),
    })
  }

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open} inert={!open}>
      <div
        className={`absolute inset-0 bg-slate-900/25 transition-opacity duration-150 motion-reduce:transition-none ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="planned-drawer-title"
        className={`absolute right-0 top-0 flex h-full w-[480px] max-w-[94vw] flex-col bg-white shadow-[-18px_0_45px_-20px_rgba(15,23,42,0.45)] transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {record ? 'Edit planned asset' : 'New planned asset'}
            </p>
            <h2 id="planned-drawer-title" className="text-[15px] font-semibold text-slate-900">
              {record?.name || `Forecast ${year}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
              <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto fx-scroll">
          <section className="border-t border-slate-100 px-4 py-3 first:border-t-0">
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Asset</h3>
            <div className="space-y-2.5">
              <Field label="Asset name">
                <input
                  ref={nameRef}
                  className={inputClass}
                  value={form.name}
                  onChange={event => patch({ name: event.target.value })}
                  placeholder="e.g. Forklift Toyota 3 Ton"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Asset group">
                  <select className={inputClass} value={form.group_name} onChange={event => patch({ group_name: event.target.value })}>
                    <option value="">Unset</option>
                    {GROUPS.map(group => <option key={group} value={group}>{group}</option>)}
                  </select>
                </Field>
                <Field label="Category">
                  <select className={inputClass} value={form.category} onChange={event => patch({ category: event.target.value })}>
                    <option value="">Unset</option>
                    {CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          </section>

          <section className="border-t border-slate-100 px-4 py-3">
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Placement</h3>
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Site">
                  <input
                    className={inputClass}
                    list="planned-site-options"
                    value={form.site_location}
                    onChange={event => patch({ site_location: event.target.value, job: '' })}
                    placeholder="Search or type…"
                  />
                  <datalist id="planned-site-options">
                    {sites.map(item => <option key={item.site_location} value={item.site_location} />)}
                  </datalist>
                </Field>
                <Field label="Job">
                  <select
                    className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`}
                    value={form.job}
                    onChange={event => patch({ job: event.target.value })}
                    disabled={!form.site_location}
                  >
                    <option value="">{form.site_location ? 'Unset' : 'Pick a site first'}</option>
                    {(jobs as { job: string; count: number }[]).map(item => (
                      <option key={item.job} value={item.job}>{item.job} ({item.count})</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </section>

          <section className="border-t border-slate-100 px-4 py-3">
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Schedule</h3>
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Purchase price (IDR)">
                  <input
                    className={`${inputClass} tabular`}
                    inputMode="numeric"
                    value={form.purchase_price ? Number(form.purchase_price).toLocaleString('id-ID') : ''}
                    onChange={event => patch({ purchase_price: event.target.value.replace(/\D/g, '') })}
                    placeholder="150.000.000"
                  />
                </Field>
                <Field label="Depreciation period (months)">
                  <input
                    className={`${inputClass} tabular`}
                    type="number"
                    min="1"
                    value={form.depreciation_period_total}
                    onChange={event => patch({ depreciation_period_total: event.target.value })}
                    placeholder="60"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Purchase month">
                  <select
                    className={inputClass}
                    value={form.planned_purchase_month}
                    onChange={event => patch({ planned_purchase_month: Number(event.target.value) })}
                  >
                    {MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                  </select>
                </Field>
                <Field label="Purchase year">
                  <select
                    className={inputClass}
                    value={form.planned_purchase_year}
                    onChange={event => patch({ planned_purchase_year: Number(event.target.value) })}
                  >
                    {purchaseYears.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
              </div>

              {monthly > 0 && (
                <div className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-700">Estimated monthly depreciation</p>
                  <p className="tabular text-[15px] font-semibold text-emerald-800">{idrCompact(monthly)}</p>
                  <p className="text-[10px] text-emerald-700/70">
                    {form.depreciation_period_total} months · starts {MONTHS[form.planned_purchase_month - 1]} {form.planned_purchase_year}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="border-t border-slate-200 px-4 py-3">
          {!valid && (
            <p className="mb-2 text-[10.5px] text-amber-700">
              Name, purchase price, and depreciation period are required.
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-[11.5px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!valid || saving}
              className="rounded bg-slate-800 px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : record ? 'Save changes' : 'Add planned asset'}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  )
}