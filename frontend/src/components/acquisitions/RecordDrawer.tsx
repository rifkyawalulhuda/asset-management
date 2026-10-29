import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AcquisitionDisposal, AcquisitionType, FixedAsset } from '../../types'
import { TYPES, fullIDR } from './acqUtils'
import AssetPicker from './AssetPicker'

type FormState = {
  asset_id: number | null
  fixed_asset_no: string
  asset_name: string
  site: string
  job: string
  type: AcquisitionType
  transaction_date: string
  price: string
  bookslip_no: string
  application: string
  vendor_customer: string
}

const EMPTY: FormState = {
  asset_id: null,
  fixed_asset_no: '',
  asset_name: '',
  site: '',
  job: '',
  type: 'Acquisition',
  transaction_date: '',
  price: '',
  bookslip_no: '',
  application: '',
  vendor_customer: '',
}

const toForm = (record: AcquisitionDisposal | null): FormState => {
  if (!record) return { ...EMPTY }
  const status = (record.status ?? '').toLowerCase()
  const type: AcquisitionType = status.startsWith('disp')
    ? 'Disposal'
    : status.startsWith('transf')
      ? 'Transfer'
      : status.startsWith('adjust')
        ? 'Adjustment'
        : 'Acquisition'

  return {
    asset_id: record.asset_id ?? null,
    fixed_asset_no: record.fixed_asset_no ?? '',
    asset_name: record.asset_name ?? '',
    site: record.site ?? '',
    job: record.job ?? '',
    type,
    transaction_date: record.transaction_date ?? '',
    price: record.price == null ? '' : String(Number(record.price)),
    bookslip_no: record.bookslip_no ?? '',
    application: record.application ?? '',
    vendor_customer: record.vendor_customer ?? '',
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-100 px-4 py-3 first:border-t-0">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </section>
  )
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-medium text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[10px] text-slate-400">{hint}</span>}
    </label>
  )
}

const inputClass =
  'h-8 w-full rounded border border-slate-300 px-2 text-[12px] text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200'

export default function RecordDrawer({
  open,
  record,
  year,
  sites,
  jobs,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean
  record: AcquisitionDisposal | null
  year: number
  sites: string[]
  jobs: string[]
  saving: boolean
  onClose: () => void
  onSubmit: (payload: Partial<AcquisitionDisposal>) => void
}) {
  const [form, setForm] = useState<FormState>(() => toForm(record))
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setForm(toForm(record))
  }, [open, record])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => firstFieldRef.current?.focus(), 60)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  const patch = (value: Partial<FormState>) => setForm(current => ({ ...current, ...value }))

  const warnings: string[] = []
  if (!form.site.trim()) warnings.push('site')
  if (!form.job.trim()) warnings.push('job')
  if (!form.transaction_date) warnings.push('date')
  if (!form.price && (form.type === 'Acquisition' || form.type === 'Disposal')) warnings.push('price')

  const pickAsset = (asset: FixedAsset) => {
    patch({
      asset_id: asset.id,
      fixed_asset_no: asset.fixed_asset_number_ax || asset.asset_no,
      asset_name: form.asset_name || asset.name,
      site: form.site || asset.site_location || '',
      job: form.job || asset.job || '',
    })
  }

  const save = () => {
    onSubmit({
      asset_id: form.asset_id,
      fixed_asset_no: form.fixed_asset_no.trim() || null,
      asset_name: form.asset_name.trim() || null,
      site: form.site.trim() || null,
      job: form.job.trim() || null,
      transaction_date: form.transaction_date || null,
      price: form.price === '' ? null : Number(form.price),
      status: form.type,
      bookslip_no: form.bookslip_no.trim() || null,
      application: form.application.trim() || null,
      vendor_customer: form.vendor_customer.trim() || null,
      year_ref: record?.year_ref ?? year,
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
        aria-labelledby="acq-drawer-title"
        className={`absolute right-0 top-0 flex h-full w-[480px] max-w-[94vw] flex-col bg-white shadow-[-18px_0_45px_-20px_rgba(15,23,42,0.45)] transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {record ? 'Edit movement' : 'New movement'}
            </p>
            <h2 id="acq-drawer-title" className="text-[15px] font-semibold text-slate-900">
              {record ? record.asset_name || 'Record' : 'Acquisition / Disposal'}
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
          <Section title="Asset">
            <Field label="Fixed asset number (AX)" hint="Type at least 2 characters to search the register.">
              <AssetPicker
                year={record?.year_ref ?? year}
                value={form.fixed_asset_no}
                onChange={value => patch({ fixed_asset_no: value, asset_id: null })}
                onSelect={pickAsset}
              />
            </Field>
            <Field label="Asset name">
              <input
                ref={firstFieldRef}
                className={inputClass}
                value={form.asset_name}
                onChange={event => patch({ asset_name: event.target.value })}
                placeholder="e.g. Forklift Sumitomo"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Site">
                <input
                  className={inputClass}
                  list="acq-site-options"
                  value={form.site}
                  onChange={event => patch({ site: event.target.value })}
                />
              </Field>
              <Field label="Job">
                <input
                  className={inputClass}
                  list="acq-job-options"
                  value={form.job}
                  onChange={event => patch({ job: event.target.value })}
                />
              </Field>
            </div>
            <datalist id="acq-site-options">
              {sites.map(item => <option key={item} value={item} />)}
            </datalist>
            <datalist id="acq-job-options">
              {jobs.map(item => <option key={item} value={item} />)}
            </datalist>
          </Section>

          <Section title="Transaction">
            <div>
              <span className="mb-1 block text-[10.5px] font-medium text-slate-500">Type</span>
              <div className="flex rounded border border-slate-300 p-[2px]" role="group" aria-label="Movement type">
                {TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={form.type === type}
                    onClick={() => patch({ type })}
                    className={`flex-1 rounded px-1 py-1 text-[10.5px] font-semibold transition-colors ${
                      form.type === type ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Transaction date">
                <input
                  type="date"
                  className={inputClass}
                  value={form.transaction_date}
                  onChange={event => patch({ transaction_date: event.target.value })}
                />
              </Field>
              <Field label={form.type === 'Disposal' ? 'Proceeds (IDR)' : 'Price (IDR)'}>
                <input
                  type="number"
                  min="0"
                  className={`${inputClass} tabular`}
                  value={form.price}
                  onChange={event => patch({ price: event.target.value })}
                  placeholder="0"
                />
                {form.price !== '' && (
                  <span className="mt-0.5 block text-[10px] text-slate-400">{fullIDR(Number(form.price))}</span>
                )}
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Bookslip no.">
                <input
                  className={`${inputClass} font-mono`}
                  value={form.bookslip_no}
                  onChange={event => patch({ bookslip_no: event.target.value })}
                />
              </Field>
              <Field label="Application no.">
                <input
                  className={`${inputClass} font-mono`}
                  value={form.application}
                  onChange={event => patch({ application: event.target.value })}
                  placeholder="001/CLC/FA-Purc/I/2026"
                />
              </Field>
            </div>
          </Section>

          <Section title="Counterparty">
            <Field label={form.type === 'Disposal' ? 'Buyer / customer' : 'Vendor'}>
              <input
                className={inputClass}
                value={form.vendor_customer}
                onChange={event => patch({ vendor_customer: event.target.value })}
              />
            </Field>
          </Section>
        </div>

        <footer className="border-t border-slate-200 px-4 py-3">
          {warnings.length > 0 && (
            <p className="mb-2 flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10.5px] text-amber-800">
              <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
              <span>
                Missing: {warnings.join(', ')}. You can still save, but the row will be marked incomplete.
              </span>
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
              disabled={saving}
              className="rounded bg-slate-800 px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : record ? 'Save changes' : 'Add record'}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  )
}