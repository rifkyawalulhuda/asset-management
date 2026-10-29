import { useEffect, useRef, useState } from 'react'
import type { AxiosError } from 'axios'
import api from '../services/api'

type ImportStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

type ImportResponse = {
  message: string
  details: Record<string, number>
  elapsed_ms?: number
}

const formatMb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`

/** FastAPI returns `detail` as a string for HTTPException and as an array for 422. */
function readDetail(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const detail = (data as { detail?: unknown }).detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map(item => (item && typeof item === 'object' ? (item as { msg?: unknown }).msg : null))
      .filter((msg): msg is string => typeof msg === 'string' && msg.length > 0)
    return messages.length > 0 ? messages.join('; ') : null
  }
  return null
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

export default function ImportExcel() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [message, setMessage] = useState('')
  const [details, setDetails] = useState<Record<string, number> | null>(null)
  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const busy = status === 'uploading' || status === 'processing'

  useEffect(() => {
    if (!busy) return
    const startedAt = Date.now()
    setElapsed(0)
    const timer = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAt) / 1000))
    }, 500)
    return () => clearInterval(timer)
  }, [busy])

  const selectFile = (candidate: File | null | undefined) => {
    if (!candidate) return
    if (!/\.xlsx?$/i.test(candidate.name)) {
      setStatus('error')
      setMessage('File harus berformat .xlsx atau .xls.')
      return
    }
    setFile(candidate)
    setStatus('idle')
    setMessage('')
    setDetails(null)
    setProgress(0)
    setElapsed(0)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    if (busy) return
    selectFile(event.dataTransfer.files[0])
  }

  const handleImport = async () => {
    if (!file || busy) return

    setStatus('uploading')
    setMessage('')
    setDetails(null)
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const { data } = await api.post<ImportResponse>('/import/excel', formData, {
        onUploadProgress: event => {
          if (!event.total) return
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100))
          setProgress(percent)
          if (percent >= 100) setStatus('processing')
        },
      })

      setStatus('success')
      setMessage(data.message)
      setDetails(data.details ?? null)
    } catch (err) {
      const error = err as AxiosError<unknown>
      setStatus('error')

      if (error.response) {
        setMessage(
          readDetail(error.response.data) ??
            `Server menolak permintaan (HTTP ${error.response.status}).`,
        )
      } else if (error.code === 'ECONNABORTED') {
        setMessage('Permintaan timeout. Coba lagi, atau impor langsung di server.')
      } else {
        setMessage(
          `Tidak dapat menghubungi server di ${api.defaults.baseURL}. Pastikan backend berjalan dan port 8000 dapat diakses dari perangkat ini.`,
        )
      }
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-[19px] font-semibold leading-tight text-slate-900">Import Excel</h1>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">
        Upload file XLSX untuk mengimpor data aset. Data yang sudah ada diperbarui (upsert), tidak
        diduplikasi.
      </p>

      {/* Drop zone */}
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
              <div className="truncate text-[12px] font-medium text-slate-800" title={file.name}>
                {file.name}
              </div>
              <div className="text-[11px] text-slate-500 tabular">{formatMb(file.size)}</div>
            </div>
            {!busy && (
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation()
                  setFile(null)
                  setStatus('idle')
                  setMessage('')
                  setDetails(null)
                }}
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
            <div className="mt-2 text-[12px] font-medium text-slate-700">
              Drag &amp; drop file XLSX di sini
            </div>
            <div className="text-[11px] text-slate-400">atau klik untuk pilih file</div>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={event => {
            selectFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </div>

      {/* Import button */}
      <button
        type="button"
        onClick={handleImport}
        disabled={!file || busy}
        className="mt-4 w-full rounded bg-slate-800 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === 'uploading'
          ? `Mengunggah ${progress}%…`
          : status === 'processing'
            ? `Memproses… ${elapsed}s`
            : 'Import Data'}
      </button>

      {/* Progress */}
      {busy && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full bg-blue-700 transition-[width] duration-300 ${
                status === 'processing' ? 'w-full animate-pulse' : ''
              }`}
              style={status === 'processing' ? undefined : { width: `${progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            {status === 'processing'
              ? `File sudah terkirim. Server sedang memproses… ${elapsed}s — jangan tutup halaman ini.`
              : `Mengunggah ${progress}%…`}
          </p>
        </div>
      )}

      {/* Result */}
      {status === 'success' && (
        <div className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-[11.5px] text-green-800">
          <p className="font-semibold">{message}</p>
          {details && (
            <ul className="mt-1.5 space-y-0.5 text-[11px] text-green-700">
              {Object.entries(details).map(([sheet, count]) => (
                <li key={sheet}>
                  <span className="font-medium">{sheet}</span>: {count} baris
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-[11.5px] text-red-700">
          <p className="font-semibold">Import gagal</p>
          <p className="mt-0.5 leading-relaxed">{message}</p>
          <button
            type="button"
            onClick={handleImport}
            className="mt-2 rounded border border-red-300 bg-white px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Info */}
      <div className="mt-5 rounded border border-slate-200 bg-slate-50 p-3 text-[11.5px] text-slate-600">
        <div className="font-semibold text-slate-700">Sheet yang akan diimport</div>
        <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[11px]">
          <li><strong>FA_2026</strong> — fixed assets + jadwal depresiasi 2026</li>
          <li><strong>FA_2025</strong> — fixed assets 2025</li>
          <li><strong>List Approval 2022 / 2021</strong> — data akuisisi &amp; disposal</li>
        </ul>
      </div>
    </div>
  )
}