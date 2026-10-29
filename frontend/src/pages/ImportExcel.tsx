import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  applyImport,
  fetchImportRuns,
  previewImport,
  type ImportPreview,
  type ImportResult,
  type ImportSample,
} from '../services/assets'
import { apiErrorMessage } from '../utils/apiError'
import { idrCell } from '../utils/currency'
import { formatDate } from '../utils/format'

type Stage = 'idle' | 'previewing' | 'previewed' | 'applying' | 'applied'

const formatMb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`

const FIELD_LABEL: Record<string, string> = {
  purchase_price: 'harga',
  depreciation_period_total: 'periode',
  purchase_date: 'tgl beli',
  name: 'nama',
  site_location: 'site',
  job: 'job',
  group_name: 'group',
  dep_expense_current: 'beban tahun',
  acc_depreciation_curr: 'akumulasi',
  net_book_value_curr: 'NBV',
  monthly_depreciation: 'depresiasi/bulan',
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="mx-auto h-7 w-7 text-slate-400">
      <path
        d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'in' | 'out' | 'muted' }) {
  const color = tone === 'in'
    ? 'text-emerald-700'
    : tone === 'out'
      ? 'text-rose-600'
      : tone === 'muted'
        ? 'text-slate-400'
        : 'text-slate-900'
  return (
    <div className="rounded border border-slate-200 bg-white px-2.5 py-1.5">
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className={`tabular mt-0.5 text-[15px] font-semibold leading-none ${color}`}>{value.toLocaleString('id-ID')}</p>
    </div>
  )
}

function SampleList({ title, rows, render }: {
  title: string
  rows: ImportSample[]
  render: (row: ImportSample) => string
}) {
  if (!rows.length) return null
  return (
    <details className="mt-2 rounded border border-slate-200 bg-white">
      <summary className="cursor-pointer px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50">
        {title} <span className="tabular text-slate-400">({rows.length})</span>
      </summary>
      <ul className="max-h-48 overflow-auto fx-scroll border-t border-slate-100 px-2.5 py-1.5">
        {rows.map(row => (
          <li key={`${row.ax}-${render(row)}`} className="flex items-baseline justify-between gap-2 py-[2px] text-[10.5px]">
            <span className="font-mono text-slate-600">{row.ax}</span>
            <span className="min-w-0 flex-1 truncate text-slate-600" title={row.name ?? ''}>{render(row)}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}

export default function ImportExcel() {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const busy = stage === 'previewing' || stage === 'applying'

  const { data: runs = [] } = useQuery({
    queryKey: ['import-runs'],
    queryFn: () => fetchImportRuns(10),
    staleTime: 10_000,
  })

  useEffect(() => {
    if (!busy) return
    const startedAt = Date.now()
    setElapsed(0)
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 500)
    return () => clearInterval(timer)
  }, [busy])

  const reset = () => {
    setPreview(null)
    setResult(null)
    setError(null)
    setProgress(0)
    setElapsed(0)
    setStage('idle')
  }

  const selectFile = (candidate: File | null | undefined) => {
    if (!candidate) return
    if (!/\.xlsx?$/i.test(candidate.name)) {
      setError('File harus berformat .xlsx atau .xls.')
      setStage('idle')
      return
    }
    setFile(candidate)
    reset()
  }

  const runPreview = async () => {
    if (!file || busy) return
    setStage('previewing')
    setError(null)
    setPreview(null)
    setProgress(0)
    try {
      const data = await previewImport(file, setProgress)
      setPreview(data)
      setStage('previewed')
    } catch (err) {
      setError(apiErrorMessage(err) ?? 'Preview gagal.')
      setStage('idle')
    }
  }

  const runApply = async () => {
    if (!file || !preview || busy) return
    setStage('applying')
    setError(null)
    setProgress(0)
    try {
      const data = await applyImport(file, preview.file_hash, setProgress)
      setResult(data)
      setStage('applied')
      qc.invalidateQueries()
    } catch (err) {
      setError(apiErrorMessage(err) ?? 'Import gagal.')
      setStage('previewed')
    }
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    if (busy) return
    selectFile(event.dataTransfer.files[0])
  }

  const deactivateImpact = preview?.deactivate_samples.reduce((sum, row) => sum + (row.dep_expense ?? 0), 0) ?? 0

  return (
    <div className="max-w-3xl">
      <h1 className="text-[19px] font-semibold leading-tight text-slate-900">Import Excel</h1>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">
        File Excel adalah sumber kebenaran. Import selalu <strong>preview dulu</strong> — tidak ada yang
        ditulis sebelum Anda menekan Apply.
      </p>

      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={event => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          if (!busy) inputRef.current?.click()
        }}
        onDrop={handleDrop}
        onDragOver={event => event.preventDefault()}
        className={`mt-4 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
          busy
            ? 'cursor-default border-slate-200 bg-slate-50'
            : 'cursor-pointer border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/60'
        }`}
      >
        {file ? (
          <div className="flex items-center justify-center gap-2">
            <div className="min-w-0 text-left">
              <div className="truncate text-[12px] font-medium text-slate-800" title={file.name}>{file.name}</div>
              <div className="tabular text-[11px] text-slate-500">{formatMb(file.size)}</div>
            </div>
            {!busy && (
              <button
                type="button"
                onClick={event => { event.stopPropagation(); setFile(null); reset() }}
                aria-label="Hapus file"
                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
              >
                <svg viewBox="0 0 10 10" aria-hidden="true" className="h-3 w-3">
                  <path d="m2 2 6 6M8 2 2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <>
            <UploadIcon />
            <div className="mt-2 text-[12px] font-medium text-slate-700">Drag &amp; drop file XLSX di sini</div>
            <div className="text-[11px] text-slate-400">atau klik untuk pilih file</div>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={event => { selectFile(event.target.files?.[0]); event.target.value = '' }}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runPreview}
          disabled={!file || busy}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-[11.5px] font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {stage === 'previewing' ? `Memeriksa… ${elapsed}s` : 'Preview perubahan'}
        </button>
        <button
          type="button"
          onClick={runApply}
          disabled={!preview || busy || Boolean(result)}
          className="rounded bg-slate-800 px-3 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {stage === 'applying' ? `Menerapkan… ${elapsed}s` : 'Apply import'}
        </button>
      </div>

      {busy && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full bg-blue-700 transition-[width] duration-300 ${stage === 'applying' ? 'w-full animate-pulse' : ''}`}
              style={stage === 'applying' ? undefined : { width: `${progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            {stage === 'applying'
              ? 'Menulis ke database dalam satu transaksi… jangan tutup halaman ini.'
              : `Mengunggah ${progress}%…`}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded border border-rose-200 bg-rose-50 p-3 text-[11.5px] text-rose-800">
          <p className="font-semibold">Gagal</p>
          <p className="mt-0.5 leading-relaxed">{error}</p>
        </div>
      )}

      {preview && !result && (
        <section className="mt-4 rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
            <div>
              <h2 className="text-[12px] font-semibold text-slate-800">Preview perubahan</h2>
              <p className="text-[10.5px] text-slate-500">
                {preview.filename} · tahun {preview.years.join(', ') || '—'} · belum ada yang ditulis
              </p>
            </div>
            <span className="tabular rounded bg-slate-100 px-1.5 py-[2px] text-[9.5px] text-slate-500" title={preview.file_hash}>
              {preview.file_hash.slice(0, 10)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 px-3 py-2.5 sm:grid-cols-5">
            <Stat label="Baru" value={preview.assets.created} tone="in" />
            <Stat label="Berubah" value={preview.assets.updated} />
            <Stat label="Tetap" value={preview.assets.unchanged} tone="muted" />
            <Stat label="Nonaktif" value={preview.assets.deactivated} tone="out" />
            <Stat label="Aktif lagi" value={preview.assets.reactivated} tone="in" />
          </div>

          <div className="border-t border-slate-100 px-3 py-2 text-[10.5px] text-slate-600">
            Movement: <span className="font-medium text-slate-800">{preview.approvals.created}</span> baru ·{' '}
            <span className="font-medium text-slate-800">{preview.approvals.updated}</span> diperbarui
            {preview.assets.deactivated > 0 && (
              <>
                {' · '}dampak deaktivasi ke beban 2026: <span className="tabular font-medium text-rose-600">−{idrCell(deactivateImpact)}</span>
              </>
            )}
          </div>

          {preview.warnings.length > 0 && (
            <ul className="border-t border-amber-100 bg-amber-50 px-3 py-2 text-[10.5px] leading-relaxed text-amber-900">
              {preview.warnings.map(warning => <li key={warning}>• {warning}</li>)}
            </ul>
          )}

          <div className="px-3 pb-3">
            <SampleList
              title="Akan dinonaktifkan (tidak ada di file)"
              rows={preview.deactivate_samples}
              render={row => `${row.name ?? ''} · ${idrCell(row.dep_expense)}`.trim()}
            />
            <SampleList
              title="Akan diubah"
              rows={preview.update_samples}
              render={row => (row.fields ?? []).map(field => FIELD_LABEL[field] ?? field).join(', ')}
            />
            <SampleList title="Aset baru" rows={preview.create_samples} render={row => row.name ?? ''} />
            <SampleList title="Aktif kembali" rows={preview.reactivate_samples} render={row => row.name ?? ''} />
          </div>
        </section>
      )}

      {result && (
        <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-[11.5px] text-emerald-900">
          <p className="font-semibold">{result.message}</p>
          <p className="mt-1 text-[10.5px] text-emerald-800">
            {result.details.approval_created} movement baru · {result.details.approval_updated} diperbarui ·
            selesai dalam {result.elapsed_ms} ms
          </p>
          {result.snapshot && (
            <p className="mt-1 break-all text-[10px] text-emerald-700">Snapshot: {result.snapshot}</p>
          )}
        </div>
      )}

      <section className="mt-5 rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-3 py-2">
          <h2 className="text-[12px] font-semibold text-slate-800">Riwayat import</h2>
          <p className="text-[10.5px] text-slate-500">10 import terakhir, terbaru di atas</p>
        </div>
        {runs.length === 0 ? (
          <p className="px-3 py-3 text-[11px] text-slate-400">Belum ada import yang tercatat.</p>
        ) : (
          <div className="overflow-x-auto fx-scroll">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-50 text-[9.5px] uppercase tracking-[0.08em] text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-1.5 font-semibold" scope="col">Waktu</th>
                  <th className="px-2 py-1.5 font-semibold" scope="col">File</th>
                  <th className="px-2 py-1.5 font-semibold" scope="col">Tahun</th>
                  <th className="px-2 py-1.5 text-right font-semibold" scope="col">Baru</th>
                  <th className="px-2 py-1.5 text-right font-semibold" scope="col">Ubah</th>
                  <th className="px-2 py-1.5 text-right font-semibold" scope="col">Nonaktif</th>
                  <th className="px-2 py-1.5 text-right font-semibold" scope="col">Movement</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => (
                  <tr key={run.id} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-3 py-[5px] text-slate-600">
                      {run.created_at ? formatDate(run.created_at) : '—'}
                    </td>
                    <td className="max-w-[220px] truncate px-2 py-[5px] text-slate-700" title={run.filename ?? ''}>
                      {run.filename ?? '—'}
                    </td>
                    <td className="tabular px-2 py-[5px] text-slate-600">{run.years ?? '—'}</td>
                    <td className="tabular px-2 py-[5px] text-right text-emerald-700">{run.assets_created}</td>
                    <td className="tabular px-2 py-[5px] text-right text-slate-700">{run.assets_updated}</td>
                    <td className="tabular px-2 py-[5px] text-right text-rose-600">{run.assets_deactivated}</td>
                    <td className="tabular px-2 py-[5px] text-right text-slate-600">
                      {run.approval_created + run.approval_updated}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
        <div className="font-semibold text-slate-700">Yang dijaga oleh import</div>
        <ul className="mt-1.5 list-inside list-disc space-y-0.5">
          <li><strong>Category</strong> tidak pernah ditimpa — nilainya milik aplikasi, terikat ke nomor AX.</li>
          <li>Aset yang hilang dari file ditandai <strong>nonaktif</strong>; baris dan jadwalnya disimpan.</li>
          <li>Semua perubahan masuk dalam <strong>satu transaksi</strong>; gagal berarti tidak ada yang tersimpan.</li>
          <li>Sebelum menulis, nilai baris terdampak disimpan sebagai <strong>snapshot</strong>.</li>
        </ul>
      </div>
    </div>
  )
}