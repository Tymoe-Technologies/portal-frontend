import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { useAuthContext } from '@/auth/AuthProvider'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  type TooltipProps,
} from 'recharts'

// ─── shadcn 风格图表 tooltip（用于"营收趋势"）───────────────────────────────────
// 参照 shadcn/ui chart 组件的观感重新实现：白卡片+阴影、色点+数值右对齐、更克制的圆角，
// 不引入新依赖，仍是纯 recharts + Tailwind。
function RevenueChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md min-w-[9rem]">
      <p className="text-xs text-slate-400 mb-1.5">{label}</p>
      {payload.map((item) => (
        <div key={item.dataKey} className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
            {item.name}
          </span>
          <span className="font-medium text-slate-900 tabular-nums">{money(Number(item.value ?? 0))}</span>
        </div>
      ))}
    </div>
  )
}
import {
  PageHeader, SectionCard, Tabs, StatCard, Table, Column, SelectInput, DateRangePicker, Btn, AlertBox, Spinner, EmptyState, toast,
} from '@/components/ui-kit'
import {
  getOrderStatistics, getRevenueStatistics, getItemStatistics, getTaxStatistics, getReconciliationStatistics,
  type OrderStatistics, type RevenueStatistics, type RevenueGroupBy, type ItemStatistics,
  type TaxStatistics, type TaxGroupBy, type ReconciliationStatistics,
} from '@/services/reports'

// ─── CSV 导出（浏览器本地生成，不经后端） ───────────────────────────────────────
// 顶部固定写门店名、报表名、时间范围三行元信息，再空一行接表头+数据，方便打开就知道这是哪家店哪张报表
function toCsvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function sanitizeFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|\s]+/g, '_')
}
function downloadReportCsv({ location, reportName, startInput, endInput, startTime, endTime, headers, rows }: {
  location: string
  reportName: string
  startInput: string
  endInput: string
  startTime: string
  endTime: string
  headers: string[]
  rows: (string | number)[][]
}) {
  const metaRows: (string | number)[][] = [
    ['Store', location || '-'],
    ['Report', reportName],
    ['Date Range', `${startInput} ${startTime} to ${endInput} ${endTime}`],
    [],
  ]
  const csv = [...metaRows, headers, ...rows].map((r) => r.map(toCsvCell).join(',')).join('\n')
  // ﻿ 是 UTF-8 BOM，Excel 打开含中文数据的 CSV 不加会显示乱码
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(reportName)}_${sanitizeFilename(location || 'store')}_${startInput}_${endInput}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
function ExportCsvBtn({ onExport }: { onExport: () => void }) {
  return (
    <Btn variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={onExport}>导出CSV</Btn>
  )
}

const SOURCE_LABELS: Record<string, string> = { POS: '门店 POS', WEB: '线上小程序/网页', KIOSK: '自助点餐机', UBER_EATS: 'Uber Eats' }
const groupKeyLabel = (key?: string) => (key ? (SOURCE_LABELS[key] ?? key) : '未分类')
// CSV 导出用的英文分组标签（屏幕上的图表/表格仍用中文 groupKeyLabel，两者分开互不影响）
const SOURCE_LABELS_EN: Record<string, string> = { POS: 'POS', WEB: 'Online/Web', KIOSK: 'Self-Service Kiosk', UBER_EATS: 'Uber Eats' }
const groupKeyLabelEn = (key?: string) => (key ? (SOURCE_LABELS_EN[key] ?? key) : 'Unclassified')

// 默认取最近7天（含今天）00:00 至 23:59，门店本地时间切天后转 UTC 传参
function defaultRange() {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { startInput: fmt(start), endInput: fmt(end), startTime: '00:00', endTime: '23:59' }
}

function toUtcRange(startInput: string, endInput: string, startTime = '00:00', endTime = '23:59') {
  return {
    startDate: new Date(`${startInput}T${startTime}:00.000Z`).toISOString(),
    endDate: new Date(`${endInput}T${endTime}:59.999Z`).toISOString(),
  }
}

const money = (n: number) => `$${n.toFixed(2)}`
const dayLabel = (iso?: string) => (iso ? iso.slice(0, 10) : '-')

function DateRangeBar({
  startInput, endInput, startTime, endTime, onChange, onTimeChange, onSearch, loading, extra,
}: {
  startInput: string
  endInput: string
  startTime: string
  endTime: string
  onChange: (start: string, end: string) => void
  onTimeChange: (startTime: string, endTime: string) => void
  onSearch: () => void
  loading: boolean
  extra?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <DateRangePicker
        startValue={startInput} endValue={endInput} onChange={onChange}
        showTime startTime={startTime} endTime={endTime} onTimeChange={onTimeChange}
      />
      {extra}
      <Btn variant="secondary" size="sm" onClick={onSearch} loading={loading}>查询</Btn>
    </div>
  )
}

interface RangeProps {
  startInput: string
  endInput: string
  startTime: string
  endTime: string
  onRangeChange: (start: string, end: string) => void
  onTimeChange: (startTime: string, endTime: string) => void
  location: string
}

function SalesReportTab({ startInput, endInput, startTime, endTime, onRangeChange, onTimeChange, location }: RangeProps) {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<OrderStatistics | null>(null)
  const [revenue, setRevenue] = useState<RevenueStatistics | null>(null)
  const [hourly, setHourly] = useState<RevenueStatistics | null>(null)
  const [channelGroupBy, setChannelGroupBy] = useState<'source' | 'channel'>('source')
  const [channelData, setChannelData] = useState<RevenueStatistics | null>(null)

  const load = async (cg: 'source' | 'channel' = channelGroupBy) => {
    setLoading(true)
    try {
      const range = toUtcRange(startInput, endInput, startTime, endTime)
      const [s, r, h, c] = await Promise.all([
        getOrderStatistics(range),
        getRevenueStatistics({ ...range, groupBy: 'day' as RevenueGroupBy }),
        getRevenueStatistics({ ...range, groupBy: 'hour' as RevenueGroupBy }),
        getRevenueStatistics({ ...range, groupBy: cg as RevenueGroupBy }),
      ])
      setSummary(s)
      setRevenue(r)
      setHourly(h)
      setChannelData(c)
    } catch (e: any) {
      toast.error(e?.message || '加载销售报表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onChannelGroupByChange = (v: 'source' | 'channel') => {
    setChannelGroupBy(v)
    load(v)
  }

  const chartData = useMemo(
    () => (revenue?.rows ?? []).map((row) => ({ day: dayLabel(row.bucket), 营收: row.totalAmount })),
    [revenue]
  )

  // 补齐 0-23 小时，缺失小时按 0 处理，柱状图连续不断档
  const hourChartData = useMemo(() => {
    const map = new Map((hourly?.rows ?? []).map((r) => [r.hour, r.totalAmount]))
    return Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, 营收: map.get(h) ?? 0 }))
  }, [hourly])

  const channelChartData = useMemo(
    () => (channelData?.rows ?? []).map((r) => ({ name: groupKeyLabel(r.key), 营收: r.totalAmount })),
    [channelData]
  )

  const cancelled = summary?.ordersByStatus?.CANCELLED ?? 0
  const cancelRate = summary && summary.totalOrders + cancelled > 0
    ? ((cancelled / (summary.totalOrders + cancelled)) * 100).toFixed(1)
    : '0.0'

  return (
    <div>
      <DateRangeBar startInput={startInput} endInput={endInput} startTime={startTime} endTime={endTime} loading={loading}
        onChange={onRangeChange} onTimeChange={onTimeChange} onSearch={() => load()} />
      {summary?.storeTimezone && (
        <p className="text-xs text-slate-400 mb-3">门店时区：{summary.storeTimezone}（已剔除已取消订单营收）</p>
      )}
      {loading && !summary ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatCard title="总营收（不含取消）" value={money(summary?.totalRevenue ?? 0)} />
            <StatCard title="订单数（不含取消）" value={summary?.totalOrders ?? 0} />
            <StatCard title="客单价" value={money(summary?.averageOrderValue ?? 0)} />
            <StatCard title="取消率" value={`${cancelRate}%`} tone={Number(cancelRate) > 10 ? 'danger' : 'default'} />
          </div>
          <SectionCard
            title="营收趋势（按天）"
            action={<ExportCsvBtn onExport={() => downloadReportCsv({
              location, reportName: 'Sales Report - Revenue Trend', startInput, endInput, startTime, endTime,
              headers: ['Date', 'Order Count', 'Revenue'],
              rows: (revenue?.rows ?? []).map((r) => [dayLabel(r.bucket), r.orderCount, r.totalAmount]),
            })} />}
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f172a" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }}
                    tickLine={false} axisLine={false} tickMargin={8}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    tickLine={false} axisLine={false} width={48}
                    tickFormatter={(v: number) => `$${v}`}
                  />
                  <Tooltip content={<RevenueChartTooltip />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }} />
                  <Area
                    type="monotone" dataKey="营收" stroke="#0f172a" strokeWidth={2}
                    fill="url(#revenueFill)" activeDot={{ r: 4, strokeWidth: 0 }} dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <div className="mt-4">
            <SectionCard
              title="分时段营收（一天中各小时累计，按门店时区）"
              action={<ExportCsvBtn onExport={() => downloadReportCsv({
                location, reportName: 'Sales Report - Hourly Revenue', startInput, endInput, startTime, endTime,
                headers: ['Hour', 'Revenue'],
                rows: hourChartData.map((r) => [r.hour, r.营收]),
              })} />}
            >
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={1} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => money(v)} />
                    <Bar dataKey="营收" fill="#0f172a" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>

          <div className="mt-4">
            <SectionCard
              title="渠道对比"
              action={(
                <div className="flex items-center gap-2">
                  <SelectInput
                    value={channelGroupBy}
                    onChange={(v) => onChannelGroupByChange(v as 'source' | 'channel')}
                    options={[{ label: '按终端来源', value: 'source' }, { label: '按销售渠道', value: 'channel' }]}
                  />
                  <ExportCsvBtn onExport={() => downloadReportCsv({
                    location, reportName: `Sales Report - Channel Comparison (${channelGroupBy === 'source' ? 'By Terminal Source' : 'By Sales Channel'})`, startInput, endInput, startTime, endTime,
                    headers: ['Group', 'Order Count', 'Revenue'],
                    rows: (channelData?.rows ?? []).map((r) => [groupKeyLabelEn(r.key), r.orderCount, r.totalAmount]),
                  })} />
                </div>
              )}
            >
              {channelChartData.length === 0 ? (
                <EmptyState title="所选时间范围内暂无渠道数据" />
              ) : (
                <div style={{ height: Math.max(160, channelChartData.length * 44) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={channelChartData} layout="vertical" margin={{ left: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: number) => money(v)} />
                      <Bar dataKey="营收" fill="#0f172a" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  )
}

function ItemAnalysisTab({ startInput, endInput, startTime, endTime, onRangeChange, onTimeChange, location }: RangeProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ItemStatistics | null>(null)
  const [page, setPage] = useState(1)

  const load = async (p = page) => {
    setLoading(true)
    try {
      const range = toUtcRange(startInput, endInput, startTime, endTime)
      const result = await getItemStatistics({ ...range, page: p, pageSize: 20 })
      setData(result)
      setPage(p)
    } catch (e: any) {
      toast.error(e?.message || '加载商品分析失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [])

  const chartData = useMemo(
    () => (data?.rows ?? []).slice(0, 10).map((r) => ({ name: r.itemName, 销售额: r.totalPrice })),
    [data]
  )

  const columns: Column<typeof data extends null ? never : NonNullable<typeof data>['rows'][number]>[] = [
    { key: 'itemName', title: '商品名称', render: (r) => r.itemName },
    { key: 'quantity', title: '销量', align: 'right', render: (r) => r.quantity },
    { key: 'totalPrice', title: '销售额', align: 'right', render: (r) => money(r.totalPrice) },
    { key: 'discountAmount', title: '折扣金额', align: 'right', render: (r) => money(r.discountAmount) },
  ]

  return (
    <div>
      <DateRangeBar startInput={startInput} endInput={endInput} startTime={startTime} endTime={endTime} loading={loading}
        onChange={onRangeChange} onTimeChange={onTimeChange} onSearch={() => load(1)} />
      {loading && !data ? <Spinner /> : !data || data.rows.length === 0 ? (
        <EmptyState title="暂无商品销售数据" />
      ) : (
        <>
          <SectionCard title="销售额 Top 10" bodyClassName="pt-2">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Bar dataKey="销售额" fill="#0f172a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
          <div className="mt-4">
            <SectionCard
              title="商品销售明细"
              action={<ExportCsvBtn onExport={() => downloadReportCsv({
                location, reportName: 'Item Analysis Report', startInput, endInput, startTime, endTime,
                headers: ['Item Name', 'Quantity Sold', 'Sales Amount', 'Discount Amount'],
                rows: (data?.rows ?? []).map((r) => [r.itemName, r.quantity, r.totalPrice, r.discountAmount]),
              })} />}
            >
              <Table columns={columns} data={data.rows} rowKey={(r) => r.itemId} loading={loading} />
              <div className="flex items-center justify-end gap-2 mt-3">
                <Btn variant="secondary" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>上一页</Btn>
                <span className="text-xs text-slate-400">第 {page} 页 / 共 {data.total} 个商品</span>
                <Btn variant="secondary" size="sm" disabled={page * data.pageSize >= data.total} onClick={() => load(page + 1)}>下一页</Btn>
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  )
}

function TaxReportTab({ startInput, endInput, startTime, endTime, onRangeChange, onTimeChange, location }: RangeProps) {
  const [groupBy, setGroupBy] = useState<TaxGroupBy>('day')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<TaxStatistics | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const range = toUtcRange(startInput, endInput, startTime, endTime)
      const result = await getTaxStatistics({ ...range, groupBy })
      setData(result)
    } catch (e: any) {
      toast.error(e?.message || '加载税务报表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totals = useMemo(() => {
    const rows = data?.rows ?? []
    return rows.reduce(
      (acc, r) => ({ taxableSales: acc.taxableSales + r.taxableSales, taxCollected: acc.taxCollected + r.taxCollected }),
      { taxableSales: 0, taxCollected: 0 }
    )
  }, [data])

  const columns: Column<TaxStatistics['rows'][number]>[] = [
    { key: 'bucket', title: groupBy === 'day' ? '日期' : '分组', render: (r) => r.bucket ? dayLabel(r.bucket) : r.key },
    { key: 'orderCount', title: '订单数', align: 'right', render: (r) => r.orderCount },
    { key: 'taxableSales', title: '应税销售额', align: 'right', render: (r) => money(r.taxableSales) },
    { key: 'taxCollected', title: '已收税额', align: 'right', render: (r) => money(r.taxCollected) },
  ]

  return (
    <div>
      <DateRangeBar
        startInput={startInput} endInput={endInput} startTime={startTime} endTime={endTime} loading={loading}
        onChange={onRangeChange} onTimeChange={onTimeChange} onSearch={load}
        extra={(
          <SelectInput
            value={groupBy}
            onChange={(v) => setGroupBy(v as TaxGroupBy)}
            options={[{ label: '按天', value: 'day' }, { label: '按来源', value: 'source' }, { label: '按渠道', value: 'channel' }]}
          />
        )}
      />
      {data?.note && <AlertBox type="info" title="口径说明" description={data.note} />}
      <div className="grid grid-cols-2 gap-3 my-4">
        <StatCard title="应税销售额合计" value={money(totals.taxableSales)} />
        <StatCard title="已收税额合计" value={money(totals.taxCollected)} />
      </div>
      {loading && !data ? <Spinner /> : !data || data.rows.length === 0 ? (
        <EmptyState title="所选时间范围内暂无税务数据" />
      ) : (
        <SectionCard
          title="明细"
          action={<ExportCsvBtn onExport={() => downloadReportCsv({
            location, reportName: 'Tax Report', startInput, endInput, startTime, endTime,
            headers: ['Group', 'Order Count', 'Taxable Sales', 'Tax Collected'],
            rows: (data?.rows ?? []).map((r) => [r.bucket ? dayLabel(r.bucket) : groupKeyLabelEn(r.key), r.orderCount, r.taxableSales, r.taxCollected]),
          })} />}
        >
          <Table columns={columns} data={data.rows} rowKey={(r, i) => r.bucket ?? r.key ?? String(i)} loading={loading} />
        </SectionCard>
      )}
    </div>
  )
}

function ReconciliationTab({ startInput, endInput, startTime, endTime, onRangeChange, onTimeChange, location }: RangeProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ReconciliationStatistics | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const range = toUtcRange(startInput, endInput, startTime, endTime)
      const result = await getReconciliationStatistics(range)
      setData(result)
    } catch (e: any) {
      toast.error(e?.message || '加载对账报表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const columns: Column<ReconciliationStatistics['rows'][number]>[] = [
    { key: 'paymentMethod', title: '支付方式', render: (r) => r.paymentMethod },
    { key: 'paymentStatus', title: '支付状态', render: (r) => r.paymentStatus },
    { key: 'settlementStatus', title: '结算状态', render: (r) => r.settlementStatus },
    { key: 'orderCount', title: '订单数', align: 'right', render: (r) => r.orderCount },
    { key: 'totalAmount', title: '订单总额', align: 'right', render: (r) => money(r.totalAmount) },
    { key: 'tipAmount', title: '小费', align: 'right', render: (r) => money(r.tipAmount) },
  ]

  return (
    <div>
      <DateRangeBar startInput={startInput} endInput={endInput} startTime={startTime} endTime={endTime} loading={loading}
        onChange={onRangeChange} onTimeChange={onTimeChange} onSearch={load} />
      {data?.note && <AlertBox type="warning" title="口径说明" description={data.note} />}
      {loading && !data ? <Spinner /> : !data || data.rows.length === 0 ? (
        <EmptyState title="所选时间范围内暂无对账数据" />
      ) : (
        <div className="mt-4">
          <SectionCard
            title="按支付方式/状态汇总"
            action={<ExportCsvBtn onExport={() => downloadReportCsv({
              location, reportName: 'Reconciliation Report', startInput, endInput, startTime, endTime,
              headers: ['Payment Method', 'Payment Status', 'Settlement Status', 'Order Count', 'Total Amount', 'Tip Amount'],
              rows: (data?.rows ?? []).map((r) => [r.paymentMethod, r.paymentStatus, r.settlementStatus, r.orderCount, r.totalAmount, r.tipAmount]),
            })} />}
          >
            <Table columns={columns} data={data.rows}
              rowKey={(r) => `${r.paymentMethod}-${r.paymentStatus}-${r.settlementStatus}`} loading={loading} />
          </SectionCard>
        </div>
      )}
    </div>
  )
}

export default function Reports() {
  const [tab, setTab] = useState('sales')
  // 日期/时间范围提到父级共享，切换页签时保留用户选的区间，不随子组件卸载重置
  const [{ startInput, endInput, startTime, endTime }, setRange] = useState(defaultRange())
  const onRangeChange = (start: string, end: string) =>
    setRange((prev) => ({ ...prev, startInput: start, endInput: end }))
  const onTimeChange = (newStartTime: string, newEndTime: string) =>
    setRange((prev) => ({ ...prev, startTime: newStartTime, endTime: newEndTime }))

  const { organizations } = useAuthContext()
  const currentOrgId = localStorage.getItem('organization_id') || ''
  const currentOrg = organizations.find((o) => o.id === currentOrgId)
  const location = currentOrg?.orgName || ''

  const rangeProps = { startInput, endInput, startTime, endTime, onRangeChange, onTimeChange, location }

  return (
    <div>
      <PageHeader title="报表" description="销售、商品分析、税务与对账报表" />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'sales', label: '销售报表' },
          { key: 'items', label: '商品分析' },
          { key: 'tax', label: '税务报表' },
          { key: 'reconciliation', label: '对账报表' },
        ]}
      />
      <div className="mt-5">
        {tab === 'sales' && <SalesReportTab {...rangeProps} />}
        {tab === 'items' && <ItemAnalysisTab {...rangeProps} />}
        {tab === 'tax' && <TaxReportTab {...rangeProps} />}
        {tab === 'reconciliation' && <ReconciliationTab {...rangeProps} />}
      </div>
    </div>
  )
}
