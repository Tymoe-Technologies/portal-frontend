import { useEffect, useState, useCallback, useMemo } from 'react'
import { RotateCw, Info, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  subscriptionApi,
  type SubscriptionQueryResult,
  type CatalogPlan,
  type CatalogModule,
} from '@/services/subscription'
import { Btn, AlertBox, Spinner, toast } from '@/components/ui-kit'
import PlanCatalog from './PlanCatalog'
import SubscriptionDashboard from './SubscriptionDashboard'

// 结果态视图（替代 antd Result）
function StatusResult({ status, title, subTitle, extra }: {
  status: 'info' | 'warning'
  title: string
  subTitle: string
  extra?: React.ReactNode
}) {
  const Icon = status === 'warning' ? AlertTriangle : Info
  const color = status === 'warning' ? 'text-amber-500' : 'text-blue-500'
  return (
    <div className="text-center py-12">
      <Icon className={`w-12 h-12 mx-auto mb-4 ${color}`} />
      <h3 className="text-lg font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-slate-500 mb-5">{subTitle}</p>
      {extra}
    </div>
  )
}

export default function SubscriptionManagement() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  // 数据状态
  const [queryResult, setQueryResult] = useState<SubscriptionQueryResult | null>(null)
  const [catalogPlans, setCatalogPlans] = useState<CatalogPlan[]>([])
  const [catalogModules, setCatalogModules] = useState<CatalogModule[]>([])

  // 用于 canceled 状态下切换到选择计划视图
  const [showCatalog, setShowCatalog] = useState(false)

  const orgId = localStorage.getItem('organization_id') || ''

  // 并行加载 3 个 API
  const loadData = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(false)
    try {
      const [query, plans, modules] = await Promise.all([
        subscriptionApi.getSubscriptionQuery(orgId),
        subscriptionApi.getPlans(),
        subscriptionApi.getModules(),
      ])
      setQueryResult(query)
      setCatalogPlans(plans)
      setCatalogModules(modules)
      setShowCatalog(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [orgId])

  // Stripe 回调处理：检测 URL 参数
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('status')
    if (status) {
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (status === 'success') {
      toast.success(t('pages.subscription.paymentSuccess'))
      // 轮询等待 webhook 处理完成后订阅状态更新，最多重试 6 次（约 12 秒）
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        try {
          const query = await subscriptionApi.getSubscriptionQuery(orgId)
          if (query.subscription.status === 'active' || query.subscription.status === 'trialing') {
            clearInterval(poll)
            setQueryResult(query)
          }
        } catch {
          // 轮询失败静默处理
        }
        if (attempts >= 6) clearInterval(poll)
      }, 2000)
    } else if (status === 'canceled') {
      toast.warning(t('pages.subscription.paymentCanceled'))
    }
  }, [t, orgId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 打开 Stripe Portal
  const handlePortal = async () => {
    setPortalLoading(true)
    try {
      const result = await subscriptionApi.createPortal(orgId)
      window.location.href = result.portalUrl
    } catch {
      toast.error(t('pages.subscription.portalError'))
    } finally {
      setPortalLoading(false)
    }
  }

  // ─── 交叉引用：用 Catalog 数据富化 Query 结果 ─────────────────────

  const enrichedPlan = useMemo(() => {
    if (!queryResult?.subscription.planKey) return null
    const plan = catalogPlans.find((p) => p.key === queryResult.subscription.planKey)
    if (!plan) return null
    return {
      key: plan.key,
      name: plan.name,
      description: plan.description,
      monthlyPrice: plan.monthlyPrice,
    }
  }, [queryResult, catalogPlans])

  const enrichedModules = useMemo(() => {
    if (!queryResult) return []
    const plan = catalogPlans.find((p) => p.key === queryResult.subscription.planKey)
    const planIncludedKeys = new Set(plan?.includedModules.map((m) => m.moduleKey) || [])

    return queryResult.subscription.moduleKeys.map((key) => {
      const mod = catalogModules.find((m) => m.key === key)
      return {
        key,
        name: mod?.name || key,
        description: mod?.description || null,
        monthlyPrice: mod?.monthlyPrice || '0',
        isIncludedInPlan: planIncludedKeys.has(key),
      }
    })
  }, [queryResult, catalogPlans, catalogModules])

  // ─── 渲染逻辑 ────────────────────────────────────────────────────

  const subscriptionStatus = queryResult?.subscription.status || 'none'

  const renderContent = () => {
    if (loading) {
      return <div className="text-center py-12"><Spinner className="w-8 h-8 mx-auto text-slate-400" /></div>
    }

    if (error) {
      return (
        <AlertBox
          type="error"
          description={t('pages.subscription.loadError')}
          action={<Btn variant="secondary" size="sm" onClick={loadData}>{t('common.refresh')}</Btn>}
        />
      )
    }

    if (showCatalog || subscriptionStatus === 'none') {
      return <PlanCatalog orgId={orgId} plans={catalogPlans} modules={catalogModules} />
    }

    if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
      return (
        <SubscriptionDashboard
          queryResult={queryResult!}
          enrichedPlan={enrichedPlan}
          enrichedModules={enrichedModules}
          onManageBilling={handlePortal}
          portalLoading={portalLoading}
        />
      )
    }

    if (subscriptionStatus === 'past_due') {
      return (
        <div className="space-y-4">
          <AlertBox type="error" description={t('pages.subscription.pastDueWarning')} />
          <SubscriptionDashboard
            queryResult={queryResult!}
            enrichedPlan={enrichedPlan}
            enrichedModules={enrichedModules}
            onManageBilling={handlePortal}
            portalLoading={portalLoading}
          />
        </div>
      )
    }

    if (subscriptionStatus === 'canceled') {
      return (
        <StatusResult
          status="info"
          title={t('pages.subscription.canceledTitle')}
          subTitle={t('pages.subscription.canceledDesc')}
          extra={<Btn variant="primary" onClick={() => setShowCatalog(true)}>{t('pages.subscription.resubscribe')}</Btn>}
        />
      )
    }

    if (subscriptionStatus === 'unpaid') {
      return (
        <StatusResult
          status="warning"
          title={t('pages.subscription.needsActionUnpaidTitle')}
          subTitle={t('pages.subscription.needsActionUnpaidDesc')}
          extra={<Btn variant="primary" loading={portalLoading} onClick={handlePortal}>{t('pages.subscription.updatePayment')}</Btn>}
        />
      )
    }

    if (subscriptionStatus === 'incomplete') {
      return (
        <StatusResult
          status="warning"
          title={t('pages.subscription.needsActionIncompleteTitle')}
          subTitle={t('pages.subscription.needsActionIncompleteDesc')}
          extra={<Btn variant="primary" loading={portalLoading} onClick={handlePortal}>{t('pages.subscription.manageBilling')}</Btn>}
        />
      )
    }

    return <PlanCatalog orgId={orgId} plans={catalogPlans} modules={catalogModules} />
  }

  return (
    <div className="max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="m-0 text-xl font-semibold text-slate-800">{t('pages.subscription.title')}</h2>
          <p className="text-[13px] text-slate-500">{t('pages.subscription.description')}</p>
        </div>
        <Btn variant="secondary" icon={<RotateCw className="w-3.5 h-3.5" />} onClick={loadData}>{t('common.refresh')}</Btn>
      </div>

      {renderContent()}
    </div>
  )
}
