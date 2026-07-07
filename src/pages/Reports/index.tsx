import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { useAuthContext } from '@/auth/AuthProvider'
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  PageHeader, SectionCard, Tabs, StatCard, Table, Column, SelectInput, DateRangePicker, Btn, AlertBox, Spinner, EmptyState, toast,
  ChartTooltip,
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
  const { t } = useTranslation()
  return (
    <Btn variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={onExport}>{t('pages.reports.exportCsv')}</Btn>
  )
}

// 屏幕上的图表/表格分组标签走 i18n（随语言切换），CSV 导出的英文标签固定不变（见 groupKeyLabelEn）
function useGroupKeyLabel() {
  const { t } = useTranslation()
  const labels: Record<string, string> = {
    POS: t('pages.reports.sourcePos'),
    WEB: t('pages.reports.sourceWeb'),
    KIOSK: t('pages.reports.sourceKiosk'),
    UBER_EATS: t('pages.reports.sourceUberEats'),
  }
  return (key?: string) => (key ? (labels[key] ?? key) : t('pages.reports.unclassified'))
}
// CSV 导出用的英文分组标签（不随语言切换，导出文件表头/内容固定英文）
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
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <DateRangePicker
        startValue={startInput} endValue={endInput} onChange={onChange}
        showTime startTime={startTime} endTime={endTime} onTimeChange={onTimeChange}
      />
      {extra}
      <Btn variant="secondary" size="sm" onClick={onSearch} loading={loading}>{t('pages.reports.search')}</Btn>
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
  const { t } = useTranslation()
  const groupKeyLabel = useGroupKeyLabel()
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
      toast.error(e?.message || t('pages.reports.loadSalesFailed'))
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
    () => (revenue?.rows ?? []).map((row) => ({ day: dayLabel(row.bucket), revenue: row.totalAmount })),
    [revenue]
  )

  // 补齐 0-23 小时，缺失小时按 0 处理，柱状图连续不断档
  const hourChartData = useMemo(() => {
    const map = new Map((hourly?.rows ?? []).map((r) => [r.hour, r.totalAmount]))
    return Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, revenue: map.get(h) ?? 0 }))
  }, [hourly])

  const channelChartData = useMemo(
    () => (channelData?.rows ?? []).map((r) => ({ name: groupKeyLabel(r.key), revenue: r.totalAmount })),
    [channelData, groupKeyLabel]
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
        <p className="text-xs text-slate-400 mb-3">{t('pages.reports.storeTimezoneLabel', { tz: summary.storeTimezone })}</p>
      )}
      {loading && !summary ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatCard title={t('pages.reports.statRevenue')} value={money(summary?.totalRevenue ?? 0)} />
            <StatCard title={t('pages.reports.statOrders')} value={summary?.totalOrders ?? 0} />
            <StatCard title={t('pages.reports.statAvgOrder')} value={money(summary?.averageOrderValue ?? 0)} />
            <StatCard title={t('pages.reports.statCancelRate')} value={`${cancelRate}%`} tone={Number(cancelRate) > 10 ? 'danger' : 'default'} />
          </div>
          <SectionCard
            title={t('pages.reports.revenueTrendTitle')}
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
                  <Tooltip content={ChartTooltip} cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }} />
                  <Area
                    type="monotone" dataKey="revenue" name={t('pages.reports.revenueSeriesLabel')} stroke="#0f172a" strokeWidth={2}
                    fill="url(#revenueFill)" activeDot={{ r: 4, strokeWidth: 0 }} dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <div className="mt-4">
            <SectionCard
              title={t('pages.reports.hourlyRevenueTitle')}
              action={<ExportCsvBtn onExport={() => downloadReportCsv({
                location, reportName: 'Sales Report - Hourly Revenue', startInput, endInput, startTime, endTime,
                headers: ['Hour', 'Revenue'],
                rows: hourChartData.map((r) => [r.hour, r.revenue]),
              })} />}
            >
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="hour" tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickLine={false} axisLine={false} interval={1} tickMargin={8}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                      tickLine={false} axisLine={false} width={48}
                      tickFormatter={(v: number) => `$${v}`}
                    />
                    <Tooltip content={ChartTooltip} cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="revenue" name={t('pages.reports.revenueSeriesLabel')} fill="#0f172a" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>

          <div className="mt-4">
            <SectionCard
              title={t('pages.reports.channelComparisonTitle')}
              action={(
                <div className="flex items-center gap-2">
                  <SelectInput
                    value={channelGroupBy}
                    onChange={(v) => onChannelGroupByChange(v as 'source' | 'channel')}
                    options={[{ label: t('pages.reports.byTerminalSource'), value: 'source' }, { label: t('pages.reports.bySalesChannel'), value: 'channel' }]}
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
                <EmptyState title={t('pages.reports.noChannelData')} />
              ) : (
                <div style={{ height: Math.max(160, channelChartData.length * 44) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={channelChartData} layout="vertical" margin={{ top: 8, right: 8, left: 16, bottom: 0 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        type="number" tick={{ fontSize: 12, fill: '#94a3b8' }}
                        tickLine={false} axisLine={false}
                        tickFormatter={(v: number) => `$${v}`}
                      />
                      <YAxis
                        type="category" dataKey="name" width={110}
                        tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} axisLine={false}
                      />
                      <Tooltip content={ChartTooltip} cursor={{ fill: '#f1f5f9' }} />
                      <Bar dataKey="revenue" name={t('pages.reports.revenueSeriesLabel')} fill="#0f172a" radius={[0, 4, 4, 0]} maxBarSize={28} />
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
  const { t } = useTranslation()
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
      toast.error(e?.message || t('pages.reports.loadItemsFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [])

  const chartData = useMemo(
    () => (data?.rows ?? []).slice(0, 10).map((r) => ({ name: r.itemName, salesAmount: r.totalPrice })),
    [data]
  )

  const columns: Column<typeof data extends null ? never : NonNullable<typeof data>['rows'][number]>[] = [
    { key: 'itemName', title: t('pages.reports.colItemName'), render: (r) => r.itemName },
    { key: 'quantity', title: t('pages.reports.colQuantity'), align: 'right', render: (r) => r.quantity },
    { key: 'totalPrice', title: t('pages.reports.colSalesAmount'), align: 'right', render: (r) => money(r.totalPrice) },
    { key: 'discountAmount', title: t('pages.reports.colDiscountAmount'), align: 'right', render: (r) => money(r.discountAmount) },
  ]

  return (
    <div>
      <DateRangeBar startInput={startInput} endInput={endInput} startTime={startTime} endTime={endTime} loading={loading}
        onChange={onRangeChange} onTimeChange={onTimeChange} onSearch={() => load(1)} />
      {loading && !data ? <Spinner /> : !data || data.rows.length === 0 ? (
        <EmptyState title={t('pages.reports.noItemData')} />
      ) : (
        <>
          <SectionCard title={t('pages.reports.top10Title')} bodyClassName="pt-2">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 8, left: 40, bottom: 0 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    type="number" tick={{ fontSize: 12, fill: '#94a3b8' }}
                    tickLine={false} axisLine={false}
                    tickFormatter={(v: number) => `$${v}`}
                  />
                  <YAxis
                    type="category" dataKey="name" width={120}
                    tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} axisLine={false}
                  />
                  <Tooltip content={ChartTooltip} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="salesAmount" name={t('pages.reports.colSalesAmount')} fill="#0f172a" radius={[0, 4, 4, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
          <div className="mt-4">
            <SectionCard
              title={t('pages.reports.itemDetailTitle')}
              action={<ExportCsvBtn onExport={() => downloadReportCsv({
                location, reportName: 'Item Analysis Report', startInput, endInput, startTime, endTime,
                headers: ['Item Name', 'Quantity Sold', 'Sales Amount', 'Discount Amount'],
                rows: (data?.rows ?? []).map((r) => [r.itemName, r.quantity, r.totalPrice, r.discountAmount]),
              })} />}
            >
              <Table columns={columns} data={data.rows} rowKey={(r) => r.itemId} loading={loading} />
              <div className="flex items-center justify-end gap-2 mt-3">
                <Btn variant="secondary" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>{t('pages.reports.prevPage')}</Btn>
                <span className="text-xs text-slate-400">{t('pages.reports.pageInfo', { page, total: data.total })}</span>
                <Btn variant="secondary" size="sm" disabled={page * data.pageSize >= data.total} onClick={() => load(page + 1)}>{t('pages.reports.nextPage')}</Btn>
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  )
}

function TaxReportTab({ startInput, endInput, startTime, endTime, onRangeChange, onTimeChange, location }: RangeProps) {
  const { t } = useTranslation()
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
      toast.error(e?.message || t('pages.reports.loadTaxFailed'))
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
    { key: 'bucket', title: groupBy === 'day' ? t('pages.reports.colDate') : t('pages.reports.colGroup'), render: (r) => r.bucket ? dayLabel(r.bucket) : r.key },
    { key: 'orderCount', title: t('pages.reports.colOrderCount'), align: 'right', render: (r) => r.orderCount },
    { key: 'taxableSales', title: t('pages.reports.colTaxableSales'), align: 'right', render: (r) => money(r.taxableSales) },
    { key: 'taxCollected', title: t('pages.reports.colTaxCollected'), align: 'right', render: (r) => money(r.taxCollected) },
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
            options={[{ label: t('pages.reports.groupByDay'), value: 'day' }, { label: t('pages.reports.groupBySource'), value: 'source' }, { label: t('pages.reports.groupByChannel'), value: 'channel' }]}
          />
        )}
      />
      {data?.note && <AlertBox type="info" title={t('pages.reports.noteLabel')} description={data.note} />}
      <div className="grid grid-cols-2 gap-3 my-4">
        <StatCard title={t('pages.reports.taxableSalesTotal')} value={money(totals.taxableSales)} />
        <StatCard title={t('pages.reports.taxCollectedTotal')} value={money(totals.taxCollected)} />
      </div>
      {loading && !data ? <Spinner /> : !data || data.rows.length === 0 ? (
        <EmptyState title={t('pages.reports.noTaxData')} />
      ) : (
        <SectionCard
          title={t('pages.reports.taxDetailTitle')}
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
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ReconciliationStatistics | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const range = toUtcRange(startInput, endInput, startTime, endTime)
      const result = await getReconciliationStatistics(range)
      setData(result)
    } catch (e: any) {
      toast.error(e?.message || t('pages.reports.loadReconciliationFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const columns: Column<ReconciliationStatistics['rows'][number]>[] = [
    { key: 'paymentMethod', title: t('pages.reports.colPaymentMethod'), render: (r) => r.paymentMethod },
    { key: 'paymentStatus', title: t('pages.reports.colPaymentStatus'), render: (r) => r.paymentStatus },
    { key: 'settlementStatus', title: t('pages.reports.colSettlementStatus'), render: (r) => r.settlementStatus },
    { key: 'orderCount', title: t('pages.reports.colOrderCount'), align: 'right', render: (r) => r.orderCount },
    { key: 'totalAmount', title: t('pages.reports.colTotalAmount'), align: 'right', render: (r) => money(r.totalAmount) },
    { key: 'tipAmount', title: t('pages.reports.colTipAmount'), align: 'right', render: (r) => money(r.tipAmount) },
  ]

  return (
    <div>
      <DateRangeBar startInput={startInput} endInput={endInput} startTime={startTime} endTime={endTime} loading={loading}
        onChange={onRangeChange} onTimeChange={onTimeChange} onSearch={load} />
      {data?.note && <AlertBox type="warning" title={t('pages.reports.noteLabel')} description={data.note} />}
      {loading && !data ? <Spinner /> : !data || data.rows.length === 0 ? (
        <EmptyState title={t('pages.reports.noReconciliationData')} />
      ) : (
        <div className="mt-4">
          <SectionCard
            title={t('pages.reports.reconciliationSummaryTitle')}
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
  const { t } = useTranslation()
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
      <PageHeader title={t('pages.reports.pageTitle')} description={t('pages.reports.pageDesc')} />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'sales', label: t('pages.reports.tabSales') },
          { key: 'items', label: t('pages.reports.tabItems') },
          { key: 'tax', label: t('pages.reports.tabTax') },
          { key: 'reconciliation', label: t('pages.reports.tabReconciliation') },
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
