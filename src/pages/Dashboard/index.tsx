import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import {
  Store, ArrowRight, CheckCircle2, TrendingUp, TrendingDown,
  BarChart2, ShoppingCart, Gift, Package,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuthContext } from '@/auth/AuthProvider'
import { createOrganization } from '@/services/auth'
import { Btn, SectionCard, Spinner, StatCard, ChartTooltip, PageHeader } from '@/components/ui-kit'
import { getOrderStatistics, getRevenueStatistics, type OrderStatistics } from '@/services/reports'

const money = (n: number) => `$${n.toFixed(2)}`
const dayLabel = (iso?: string) => (iso ? iso.slice(0, 10) : '-')

// 与 Reports 页一致：直接把日历日期当 UTC 边界用，不做真实门店时区换算（后端 storeTimezone 仅用于展示提示）
function dayOffsetDateStr(offsetDays: number) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}
function rangeUtc(startDateStr: string, endDateStr: string) {
  return { startDate: `${startDateStr}T00:00:00.000Z`, endDate: `${endDateStr}T23:59:59.999Z` }
}

// 环比徽标：今日 vs 昨日
function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  const { t } = useTranslation()
  if (previous <= 0) return <span className="text-xs text-slate-400">{t('pages.dashboard.noYesterdayData')}</span>
  const pct = ((current - previous) / previous) * 100
  const up = pct >= 0
  return (
    <span className={clsx('inline-flex items-center gap-0.5 text-xs font-medium', up ? 'text-emerald-600' : 'text-red-500')}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(pct).toFixed(1)}% {t('pages.dashboard.vsYesterday')}
    </span>
  )
}

function useQuickLinks() {
  const { t } = useTranslation()
  return [
    { to: '/reports', label: t('pages.dashboard.quickLinkReports'), desc: t('pages.dashboard.quickLinkReportsDesc'), icon: BarChart2 },
    { to: '/order-config', label: t('pages.dashboard.quickLinkOrderConfig'), desc: t('pages.dashboard.quickLinkOrderConfigDesc'), icon: ShoppingCart },
    { to: '/member-management', label: t('pages.dashboard.quickLinkMemberManagement'), desc: t('pages.dashboard.quickLinkMemberManagementDesc'), icon: Gift },
    { to: '/item-management', label: t('pages.dashboard.quickLinkItemManagement'), desc: t('pages.dashboard.quickLinkItemManagementDesc'), icon: Package },
  ]
}

// 今日经营速览："驾驶舱"基础版：核心指标 + 7 天趋势 + 快捷入口
// 后续可扩展：多门店对比、异常预警、待办事项等，先跑通数据链路
function CockpitOverview() {
  const { t } = useTranslation()
  const quickLinks = useQuickLinks()
  const [loading, setLoading] = useState(true)
  const [today, setToday] = useState<OrderStatistics | null>(null)
  const [yesterday, setYesterday] = useState<OrderStatistics | null>(null)
  const [trend, setTrend] = useState<{ day: string; revenue: number }[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const todayRange = rangeUtc(dayOffsetDateStr(0), dayOffsetDateStr(0))
        const yesterdayRange = rangeUtc(dayOffsetDateStr(-1), dayOffsetDateStr(-1))
        const weekRange = rangeUtc(dayOffsetDateStr(-6), dayOffsetDateStr(0))
        const [todayStats, yesterdayStats, revenue] = await Promise.all([
          getOrderStatistics(todayRange),
          getOrderStatistics(yesterdayRange),
          getRevenueStatistics({ ...weekRange, groupBy: 'day' }),
        ])
        if (cancelled) return
        setToday(todayStats)
        setYesterday(yesterdayStats)
        setTrend((revenue.rows ?? []).map((row) => ({ day: dayLabel(row.bucket), revenue: row.totalAmount })))
      } catch {
        // 单个统计接口失败不阻塞整个仪表盘展示
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const cancelledOrders = today?.ordersByStatus?.CANCELLED ?? 0
  const cancelRate = today && today.totalOrders + cancelledOrders > 0
    ? ((cancelledOrders / (today.totalOrders + cancelledOrders)) * 100).toFixed(1)
    : '0.0'

  return (
    <div>
      <PageHeader title={t('pages.dashboard.cockpitTitle')} description={t('pages.dashboard.cockpitDesc')} />

      {loading && !today ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatCard
              title={<span className="flex items-center gap-1.5">{t('pages.dashboard.todayRevenue')} {today && yesterday && (
                <DeltaBadge current={today.totalRevenue} previous={yesterday.totalRevenue} />
              )}</span>}
              value={money(today?.totalRevenue ?? 0)}
            />
            <StatCard
              title={<span className="flex items-center gap-1.5">{t('pages.dashboard.todayOrders')} {today && yesterday && (
                <DeltaBadge current={today.totalOrders} previous={yesterday.totalOrders} />
              )}</span>}
              value={today?.totalOrders ?? 0}
            />
            <StatCard title={t('pages.dashboard.avgOrderValue')} value={money(today?.averageOrderValue ?? 0)} />
            <StatCard title={t('pages.dashboard.cancelRate')} value={`${cancelRate}%`} tone={Number(cancelRate) > 10 ? 'danger' : 'default'} />
          </div>

          <SectionCard
            title={t('pages.dashboard.weekTrend')}
            action={<Link to="/reports" className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-0.5">{t('pages.dashboard.viewFullReport')} <ArrowRight className="w-3 h-3" /></Link>}
          >
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f172a" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => `$${v}`} />
                  <Tooltip content={ChartTooltip} cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }} />
                  <Area type="monotone" dataKey="revenue" name={t('pages.dashboard.revenueLabel')} stroke="#0f172a" strokeWidth={2} fill="url(#dashboardRevenueFill)" activeDot={{ r: 4, strokeWidth: 0 }} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {quickLinks.map(({ to, label, desc, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 mb-2.5">
                  <Icon className="w-[18px] h-[18px]" />
                </div>
                <p className="text-sm font-medium text-slate-900">{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// 首次登录无组织时显示的欢迎引导
function OnboardingGuide() {
  const { t } = useTranslation()
  const { refreshUser } = useAuthContext()
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleCreate = async () => {
    const name = orgName.trim()
    if (!name) { setError(t('pages.dashboard.onboardingStoreNameRequired')); return }
    if (name.length < 2) { setError(t('pages.dashboard.onboardingStoreNameTooShort')); return }
    setError('')
    setLoading(true)
    try {
      const org = await createOrganization({ orgName: name, orgType: 'MAIN' }, 'beverage')
      localStorage.setItem('organization_id', org.id)
      setDone(true)
      // 刷新 AuthProvider 里的 user + organizations，让顶部切换器和导航更新
      await refreshUser()
    } catch (err: any) {
      setError(err?.response?.data?.detail || t('pages.dashboard.onboardingCreateFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 ring-1 ring-green-100">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">{t('pages.dashboard.onboardingSuccessTitle')}</h2>
        <p className="max-w-xs text-sm text-slate-500">{t('pages.dashboard.onboardingSuccessDesc')}</p>
        <Btn variant="primary" icon={<ArrowRight className="h-4 w-4" />} onClick={() => window.location.reload()}>
          {t('pages.dashboard.onboardingEnterConsole')}
        </Btn>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* 图标 */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900">
            <Store className="h-7 w-7 text-white" />
          </div>
        </div>

        {/* 标题 */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('pages.dashboard.onboardingWelcomeTitle')}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {t('pages.dashboard.onboardingWelcomeDesc')}
          </p>
        </div>

        {/* 表单卡片 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('pages.dashboard.onboardingStoreNameLabel')}</label>
          <input
            type="text"
            value={orgName}
            onChange={e => { setOrgName(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder={t('pages.dashboard.onboardingStoreNamePlaceholder')}
            maxLength={100}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-900/5"
          />

          {/* 固定高度错误区 */}
          <div className="mt-2 h-4">
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          <Btn
            variant="primary"
            className="mt-3 h-11 w-full rounded-xl! text-[15px]"
            loading={loading}
            onClick={handleCreate}
          >
            {t('pages.dashboard.onboardingCreateButton')}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Btn>
        </div>

        {/* 跳过提示 */}
        <p className="mt-4 text-center text-xs text-slate-400">
          {t('pages.dashboard.onboardingSkipHintPrefix')}{' '}
          <a href="/organizations" className="underline underline-offset-2 hover:text-slate-600">
            {t('pages.dashboard.onboardingSkipHintLink')}
          </a>
          {' '}{t('pages.dashboard.onboardingSkipHintSuffix')}
        </p>
      </div>
    </div>
  )
}

const Dashboard: React.FC = () => {
  const { organizations, loading } = useAuthContext()
  // AuthProvider 有多个异步 effect 会延迟填充 organizations，
  // 用本地稳定计时器：AuthProvider loading 结束后再等 1.5s，
  // 若仍为空才认定是「真正无组织的新用户」，避免误显引导。
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (loading) { setSettled(false); return }
    const t = setTimeout(() => setSettled(true), 1500)
    return () => clearTimeout(t)
  }, [loading])

  if (!settled) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-6 w-6 text-slate-400" />
      </div>
    )
  }

  if (organizations.length === 0) {
    return <OnboardingGuide />
  }

  return <CockpitOverview />
}

export default Dashboard
