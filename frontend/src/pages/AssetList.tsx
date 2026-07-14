import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchAssets, deleteAsset } from '../services/assets'
import { formatIDR, formatDate } from '../utils/format'
import type { AssetFilters } from '../types'

const GROUPS = ['Building', 'Structures', 'Machinary and Equipment', 'Tools Furniture Fixtures', 'Vehicles']
const CATEGORIES = ['WH1', 'WH2', 'TRP', 'BALI', 'MDN', 'PBG', 'MKS', 'SBY', 'OTHERS']

export default function AssetList() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState<AssetFilters>({ year_ref: 2026, page: 1, size: 50 })
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['assets', filters],
    queryFn: () => fetchAssets(filters),
  })

  const deleteMut = useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  })

  const handleSearch = () => setFilters(f => ({ ...f, search, page: 1 }))
  const handleFilter = (key: keyof AssetFilters, value: string) =>
    setFilters(f => ({ ...f, [key]: value || undefined, page: 1 }))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Fixed Assets</h1>
          <p className="text-gray-500 text-sm">{data?.total ?? 0} assets</p>
        </div>
        <Link to="/assets/new" className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800 text-sm font-medium">
          + Add Asset
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-3 mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search name / asset no..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="border rounded px-3 py-1.5 text-sm w-56"
        />
        <button onClick={handleSearch} className="bg-blue-700 text-white px-3 py-1.5 rounded text-sm">Search</button>
        <select onChange={e => handleFilter('group_name', e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All Groups</option>
          {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select onChange={e => handleFilter('category', e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select onChange={e => handleFilter('year_ref', e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="2026">2026</option>
          <option value="2025">2025</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left border-b">
              <th className="px-3 py-2">No</th>
              <th className="px-3 py-2">Asset No</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Site</th>
              <th className="px-3 py-2">Purchase Date</th>
              <th className="px-3 py-2 text-right">Purchase Price</th>
              <th className="px-3 py-2 text-right">Monthly Depr.</th>
              <th className="px-3 py-2 text-right">NBV</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={12} className="text-center py-8 text-gray-400">Loading...</td></tr>
            )}
            {data?.items.map(asset => {
              const key = asset.fixed_asset_number_ax || String(asset.id)
              return (
              <tr key={key} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-500">{asset.no}</td>
                <td className="px-3 py-2 font-mono text-xs">{asset.asset_no}</td>
                <td className="px-3 py-2 max-w-xs">
                  <Link to={`/assets/${key}`} className="text-blue-700 hover:underline font-medium">
                    {asset.name}
                  </Link>
                  {asset.fixed_asset_number_ax && (
                    <div className="text-xs text-gray-400">{asset.fixed_asset_number_ax}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{asset.group_name}</td>
                <td className="px-3 py-2">
                  <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">{asset.category}</span>
                </td>
                <td className="px-3 py-2 text-xs">{asset.site_location}</td>
                <td className="px-3 py-2 text-xs">{formatDate(asset.purchase_date)}</td>
                <td className="px-3 py-2 text-right text-xs">{formatIDR(asset.purchase_price)}</td>
                <td className="px-3 py-2 text-right text-xs">{formatIDR(asset.monthly_depreciation)}</td>
                <td className="px-3 py-2 text-right text-xs font-medium">{formatIDR(asset.net_book_value_curr)}</td>
                <td className="px-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${asset.net_book_value_curr === 0 ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                    {asset.net_book_value_curr === 0 ? 'Fully Depr.' : 'Active'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <Link to={`/assets/${key}/edit`} className="text-xs text-blue-600 hover:underline">Edit</Link>
                    <button
                      onClick={() => { if (confirm(`Delete ${asset.name}?`)) deleteMut.mutate(asset.id) }}
                      className="text-xs text-red-500 hover:underline"
                    >Del</button>
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.total > filters.size! && (
        <div className="flex gap-2 mt-4 justify-center">
          <button
            disabled={filters.page === 1}
            onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) - 1 }))}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >Prev</button>
          <span className="px-3 py-1 text-sm">Page {filters.page} / {Math.ceil(data.total / filters.size!)}</span>
          <button
            disabled={(filters.page || 1) * filters.size! >= data.total}
            onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) + 1 }))}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >Next</button>
        </div>
      )}
    </div>
  )
}
