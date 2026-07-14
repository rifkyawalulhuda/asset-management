import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { fetchSummaryMonthly, fetchSummaryByGroup } from '../services/assets'
import { formatIDR } from '../utils/format'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']

export default function Dashboard() {
  const year = 2026
  const { data: monthly } = useQuery({ queryKey: ['summary-monthly', year], queryFn: () => fetchSummaryMonthly(year) })
  const { data: byGroup } = useQuery({ queryKey: ['summary-group', year], queryFn: () => fetchSummaryByGroup(year) })

  // Build chart data: sum all jobs per month
  const chartData = MONTHS.map((name, i) => {
    const key = MONTH_KEYS[i]
    let total = 0
    if (monthly) {
      Object.values(monthly).forEach(job => { total += job[key as keyof typeof job] as number || 0 })
    }
    return { name, total }
  })

  const grandTotal = chartData.reduce((s, d) => s + d.total, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
      <p className="text-gray-500 text-sm mb-6">PT. Sankyu Indonesia International — Depreciation 2026</p>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Depreciation 2026" value={formatIDR(grandTotal)} color="blue" />
        {byGroup && Object.entries(byGroup).map(([group, data]) => (
          <StatCard key={group} label={group} value={formatIDR(data.yearly_depreciation)} color="gray" />
        ))}
      </div>

      {/* Monthly Chart */}
      <div className="bg-white rounded-lg border p-4 mb-8">
        <h2 className="font-semibold text-lg mb-4">Monthly Depreciation 2026</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(v) => `${(v/1e9).toFixed(1)}B`} />
            <Tooltip formatter={(v: number) => formatIDR(v)} />
            <Legend />
            <Bar dataKey="total" name="Depreciation" fill="#1d4ed8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* By Group Table */}
      {byGroup && (
        <div className="bg-white rounded-lg border p-4">
          <h2 className="font-semibold text-lg mb-4">Summary by Group</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2 font-semibold">Group</th>
                <th className="px-3 py-2 font-semibold text-right">Assets</th>
                <th className="px-3 py-2 font-semibold text-right">Purchase Price</th>
                <th className="px-3 py-2 font-semibold text-right">Acc. Depreciation</th>
                <th className="px-3 py-2 font-semibold text-right">Net Book Value</th>
                <th className="px-3 py-2 font-semibold text-right">Yearly Depreciation</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byGroup).map(([group, d]) => (
                <tr key={group} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">{group}</td>
                  <td className="px-3 py-2 text-right">{d.count}</td>
                  <td className="px-3 py-2 text-right">{formatIDR(d.purchase_price)}</td>
                  <td className="px-3 py-2 text-right">{formatIDR(d.acc_depreciation)}</td>
                  <td className="px-3 py-2 text-right">{formatIDR(d.net_book_value)}</td>
                  <td className="px-3 py-2 text-right font-medium text-blue-700">{formatIDR(d.yearly_depreciation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: 'blue' | 'gray' }) {
  return (
    <div className={`rounded-lg border p-4 ${color === 'blue' ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`font-bold text-lg ${color === 'blue' ? 'text-blue-800' : 'text-gray-800'}`}>{value}</div>
    </div>
  )
}
