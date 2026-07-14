import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSummaryMonthly, fetchSummaryByGroup } from '../services/assets'
import { formatIDR } from '../utils/format'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']

export default function SummaryReport() {
  const [year, setYear] = useState(2026)

  const { data: monthly } = useQuery({ queryKey: ['summary-monthly', year], queryFn: () => fetchSummaryMonthly(year) })
  const { data: byGroup } = useQuery({ queryKey: ['summary-group', year], queryFn: () => fetchSummaryByGroup(year) })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Summary Report</h1>
          <p className="text-gray-500 text-sm">Depreciation schedule by category</p>
        </div>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="border rounded px-3 py-1.5 text-sm">
          <option value={2026}>2026</option>
          <option value={2025}>2025</option>
        </select>
      </div>

      {/* Monthly by Job */}
      {monthly && (
        <div className="bg-white border rounded-lg p-4 mb-6 overflow-x-auto">
          <h2 className="font-semibold mb-3">Monthly Depreciation by Job — {year}</h2>
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 text-right">
                <th className="px-2 py-2 text-left font-semibold">CATEGORY</th>
                {MONTHS.map(m => <th key={m} className="px-2 py-2 font-semibold">{m}</th>)}
                <th className="px-2 py-2 font-semibold bg-blue-50">TOTAL/YEAR</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(monthly).map(([job, data]) => (
                <tr key={job} className="border-t hover:bg-gray-50">
                  <td className="px-2 py-2 font-medium">{job}</td>
                  {MONTH_KEYS.map(k => (
                    <td key={k} className="px-2 py-2 text-right">{formatIDR(data[k as keyof typeof data] as number)}</td>
                  ))}
                  <td className="px-2 py-2 text-right font-bold bg-blue-50">{formatIDR(data.total)}</td>
                </tr>
              ))}
              {/* Grand Total Row */}
              <tr className="border-t-2 bg-blue-50 font-bold">
                <td className="px-2 py-2">GRAND TOTAL</td>
                {MONTH_KEYS.map(k => {
                  const total = Object.values(monthly).reduce((s, d) => s + ((d[k as keyof typeof d] as number) || 0), 0)
                  return <td key={k} className="px-2 py-2 text-right">{formatIDR(total)}</td>
                })}
                <td className="px-2 py-2 text-right">
                  {formatIDR(Object.values(monthly).reduce((s, d) => s + d.total, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* By Group */}
      {byGroup && (
        <div className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold mb-3">Summary by Asset Group — {year}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2 font-semibold">Group</th>
                <th className="px-3 py-2 font-semibold text-right">Count</th>
                <th className="px-3 py-2 font-semibold text-right">Purchase Price</th>
                <th className="px-3 py-2 font-semibold text-right">Acc. Depreciation</th>
                <th className="px-3 py-2 font-semibold text-right">Net Book Value</th>
                <th className="px-3 py-2 font-semibold text-right bg-blue-50">Yearly Depreciation</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byGroup).map(([group, d]) => (
                <tr key={group} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{group}</td>
                  <td className="px-3 py-2 text-right">{d.count}</td>
                  <td className="px-3 py-2 text-right">{formatIDR(d.purchase_price)}</td>
                  <td className="px-3 py-2 text-right">{formatIDR(d.acc_depreciation)}</td>
                  <td className="px-3 py-2 text-right">{formatIDR(d.net_book_value)}</td>
                  <td className="px-3 py-2 text-right font-bold text-blue-700 bg-blue-50">{formatIDR(d.yearly_depreciation)}</td>
                </tr>
              ))}
              <tr className="border-t-2 bg-gray-50 font-bold">
                <td className="px-3 py-2">TOTAL</td>
                <td className="px-3 py-2 text-right">{Object.values(byGroup).reduce((s, d) => s + d.count, 0)}</td>
                <td className="px-3 py-2 text-right">{formatIDR(Object.values(byGroup).reduce((s, d) => s + d.purchase_price, 0))}</td>
                <td className="px-3 py-2 text-right">{formatIDR(Object.values(byGroup).reduce((s, d) => s + d.acc_depreciation, 0))}</td>
                <td className="px-3 py-2 text-right">{formatIDR(Object.values(byGroup).reduce((s, d) => s + d.net_book_value, 0))}</td>
                <td className="px-3 py-2 text-right bg-blue-50">{formatIDR(Object.values(byGroup).reduce((s, d) => s + d.yearly_depreciation, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
