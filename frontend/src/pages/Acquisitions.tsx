import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAcquisitions, createAcquisition, deleteAcquisition } from '../services/assets'
import { formatIDR, formatDate } from '../utils/format'
import type { AcquisitionDisposal } from '../types'

export default function Acquisitions() {
  const qc = useQueryClient()
  const [year, setYear] = useState(2026)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Partial<AcquisitionDisposal>>({ year_ref: 2026, status: 'Acquisition' })

  const { data: records, isLoading } = useQuery({
    queryKey: ['acquisitions', year],
    queryFn: () => fetchAcquisitions({ year_ref: year }),
  })

  const createMut = useMutation({
    mutationFn: createAcquisition,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['acquisitions'] }); setShowForm(false); setForm({ year_ref: 2026, status: 'Acquisition' }) },
  })

  const deleteMut = useMutation({
    mutationFn: deleteAcquisition,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['acquisitions'] }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Acquisitions & Disposals</h1>
          <p className="text-gray-500 text-sm">{records?.length ?? 0} records</p>
        </div>
        <div className="flex gap-3">
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="border rounded px-3 py-1.5 text-sm">
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
            <option value={2022}>2022</option>
            <option value={2021}>2021</option>
          </select>
          <button onClick={() => setShowForm(!showForm)} className="bg-blue-700 text-white px-4 py-2 rounded text-sm">
            + Add Record
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white border rounded-lg p-4 mb-4">
          <h2 className="font-semibold mb-4">New Acquisition / Disposal</h2>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              ['Site', 'site'], ['Job', 'job'], ['Fixed Asset No', 'fixed_asset_no'],
              ['Asset Name', 'asset_name'], ['Vendor/Customer', 'vendor_customer'], ['Bookslip No', 'bookslip_no'],
            ].map(([label, key]) => (
              <div key={key}>
                <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                <input
                  className="border rounded px-2 py-1.5 w-full text-sm"
                  value={(form as any)[key] || ''}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Transaction Date</label>
              <input type="date" className="border rounded px-2 py-1.5 w-full text-sm"
                value={form.transaction_date || ''}
                onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Price (IDR)</label>
              <input type="number" className="border rounded px-2 py-1.5 w-full text-sm"
                value={form.price || ''}
                onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Status</label>
              <select className="border rounded px-2 py-1.5 w-full text-sm"
                value={form.status || 'Acquisition'}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="Acquisition">Acquisition</option>
                <option value="Disposal">Disposal</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => createMut.mutate({ ...form, year_ref: year })}
              disabled={createMut.isPending}
              className="bg-blue-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
              {createMut.isPending ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} className="border px-4 py-2 rounded text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-left">
              <th className="px-3 py-2">No</th>
              <th className="px-3 py-2">Site</th>
              <th className="px-3 py-2">Job</th>
              <th className="px-3 py-2">Fixed Asset No</th>
              <th className="px-3 py-2">Asset Name</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Vendor/Customer</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={10} className="text-center py-8 text-gray-400">Loading...</td></tr>}
            {records?.map((r, i) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                <td className="px-3 py-2">{r.site}</td>
                <td className="px-3 py-2">{r.job}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.fixed_asset_no}</td>
                <td className="px-3 py-2">{r.asset_name}</td>
                <td className="px-3 py-2 text-xs">{formatDate(r.transaction_date)}</td>
                <td className="px-3 py-2 text-right">{formatIDR(r.price)}</td>
                <td className="px-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${r.status === 'Acquisition' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">{r.vendor_customer}</td>
                <td className="px-3 py-2">
                  <button onClick={() => { if (confirm('Delete this record?')) deleteMut.mutate(r.id) }}
                    className="text-xs text-red-500 hover:underline">Del</button>
                </td>
              </tr>
            ))}
            {records?.length === 0 && (
              <tr><td colSpan={10} className="text-center py-8 text-gray-400">No records found for {year}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
