import type { DepCalc } from './depCalc'
import { idrCompact, idrFull } from '../../utils/currency'

function Row({
  label,
  value,
  title,
  strong,
  tone,
}: {
  label: string
  value: string
  title?: string
  strong?: boolean
  tone?: 'blue' | 'muted'
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-[3px]">
      <span className="text-[10.5px] text-slate-500">{label}</span>
      <span
        title={title}
        className={`tabular text-right text-[11.5px] ${
          strong ? 'font-semibold text-slate-900' : tone === 'blue' ? 'font-medium text-blue-700' : 'text-slate-700'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 mb-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-400 first:mt-0">
      {children}
    </p>
  )
}

export default function DepPreview({
  preview,
  year,
  purchaseDate,
  hasPrice,
  hasPeriod,
}: {
  preview: DepCalc | null
  year: number
  purchaseDate: string
  hasPrice: boolean
  hasPeriod: boolean
}) {
  const previousYear = year - 1

  return (
    <section
      className="flex flex-col rounded-md border border-slate-200 bg-white shadow-sm"
      aria-live="polite"
      aria-label="Depreciation preview"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <h2 className="text-[12px] font-semibold text-slate-800">Depreciation preview</h2>
        <span
          className={`rounded px-1.5 py-[1px] text-[9.5px] font-semibold uppercase tracking-[0.08em] ${
            preview ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {preview ? 'Live' : 'Incomplete'}
        </span>
      </div>

      <div className="px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Monthly depreciation</p>
        <p
          className={`tabular mt-0.5 text-[19px] font-semibold leading-none ${preview ? 'text-emerald-700' : 'text-slate-300'}`}
          title={preview ? idrFull(preview.monthly) : undefined}
        >
          {preview ? idrCompact(preview.monthly) : '—'}
        </p>
        <p className="mt-1 text-[10.5px] text-slate-500">
          {preview
            ? `Purchase price ÷ ${preview.periodTotal} months`
            : !hasPrice && !hasPeriod
              ? 'Enter a purchase price and a depreciation period'
              : !hasPrice
                ? 'Enter a purchase price'
                : 'Set a depreciation period'}
        </p>

        {preview && (
          <>
            <div className="mt-2 h-1 overflow-hidden rounded bg-slate-100">
              <div
                className="h-1 rounded bg-slate-700 transition-[width] duration-200 motion-reduce:transition-none"
                style={{ width: `${preview.progress}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>{preview.untilYear} of {preview.periodTotal} months elapsed</span>
              <span>{preview.remain} left</span>
            </div>
          </>
        )}

        <div className="mt-2 border-t border-slate-100 pt-1.5">
          <Heading>Fiscal {year}</Heading>
          <Row
            label={`Depreciation expense ${year}`}
            value={preview ? idrCompact(preview.depExpCurrent) : '—'}
            title={preview ? idrFull(preview.depExpCurrent) : undefined}
            tone="blue"
          />
          <Row
            label={`Acc. depreciation 31 Dec ${year}`}
            value={preview ? idrCompact(preview.accDepCurr) : '—'}
            title={preview ? idrFull(preview.accDepCurr) : undefined}
          />
          <Row
            label={`Net book value 31 Dec ${year}`}
            value={preview ? idrCompact(preview.nbvCurr) : '—'}
            title={preview ? idrFull(preview.nbvCurr) : undefined}
            strong
          />

          <Heading>Previous year · {previousYear}</Heading>
          <Row
            label={`Acc. depreciation 31 Dec ${previousYear}`}
            value={preview ? idrCompact(preview.accDepPrev) : '—'}
            title={preview ? idrFull(preview.accDepPrev) : undefined}
          />
          <Row
            label={`Net book value 31 Dec ${previousYear}`}
            value={preview ? idrCompact(preview.nbvPrev) : '—'}
            title={preview ? idrFull(preview.nbvPrev) : undefined}
          />
        </div>
      </div>

      {preview && !purchaseDate && (
        <p className="border-t border-amber-100 bg-amber-50 px-3 py-1.5 text-[10px] leading-snug text-amber-800">
          Without a purchase date every period counts as 0, so the figures above are not usable.
        </p>
      )}

      {!preview && (
        <p className="border-t border-slate-100 px-3 py-1.5 text-[10px] leading-snug text-slate-400">
          Updates as you type; the server recalculates on save.
        </p>
      )}
    </section>
  )
}
