import { useState, useRef } from 'react'

export default function ImportExcel() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith('.xlsx')) setFile(f)
  }

  const handleImport = async () => {
    if (!file) return
    setStatus('loading')
    setMessage('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('http://localhost:8000/api/import/excel', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Import failed')
      }
      const data = await res.json()
      setStatus('success')
      setMessage(`Import berhasil: ${data.message || JSON.stringify(data)}`)
    } catch (err: any) {
      setStatus('error')
      setMessage(err.message || 'Import failed')
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-2">Import Excel</h1>
      <p className="text-gray-500 text-sm mb-6">Upload file XLSX untuk mengimpor data aset ke database.</p>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
      >
        <div className="text-4xl mb-3">📂</div>
        {file ? (
          <div>
            <div className="font-medium text-blue-700">{file.name}</div>
            <div className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB</div>
          </div>
        ) : (
          <div>
            <div className="font-medium text-gray-600">Drag & drop file XLSX di sini</div>
            <div className="text-xs text-gray-400 mt-1">atau klik untuk browse</div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]) }}
        />
      </div>

      {/* Import Button */}
      <button
        onClick={handleImport}
        disabled={!file || status === 'loading'}
        className="mt-4 w-full bg-blue-700 text-white py-2.5 rounded font-medium hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? 'Importing...' : 'Import Data'}
      </button>

      {/* Status */}
      {status === 'success' && (
        <div className="mt-4 bg-green-50 border border-green-200 text-green-700 rounded p-3 text-sm">{message}</div>
      )}
      {status === 'error' && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{message}</div>
      )}

      {/* Info */}
      <div className="mt-6 bg-gray-50 border rounded p-4 text-sm text-gray-600">
        <div className="font-medium mb-2">Sheets yang akan diimport:</div>
        <ul className="space-y-1 list-disc list-inside text-xs">
          <li><strong>FA_2026</strong> — 229 fixed assets dengan schedule depresiasi 2026</li>
          <li><strong>FA_2025</strong> — Fixed assets 2025</li>
          <li><strong>List Approval 2022</strong> — Data akuisisi & disposal 2022</li>
          <li><strong>List Approval 2021</strong> — Data akuisisi & disposal 2021</li>
        </ul>
      </div>
    </div>
  )
}
