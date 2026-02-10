import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Button, Spin, Typography, Alert, Result, message,
} from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import {
  subscriptionApi,
  type SubscriptionQueryResult,
  type CatalogPlan,
  type CatalogModule,
} from '@/services/subscription'
import PlanCatalog from './PlanCatalog'
import SubscriptionDashboard from './SubscriptionDashboard'

const { Text } = Typography

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
    if (status === 'success') {
      message.success(t('pages.subscription.paymentSuccess'))
    } else if (status === 'canceled') {
      message.warning(t('pages.subscription.paymentCanceled'))
    }
    if (status) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [t])

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
      message.error(t('pages.subscription.portalError'))
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
    // 找到当前 plan 包含的模块 key 集合
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

  // 渲染内容区
  const renderContent = () => {
    if (loading) {
      return <Spin style={{ display: 'block', textAlign: 'center', padding: 48 }} />
    }

    if (error) {
      return (
        <Alert
          type="error"
          showIcon
          message={t('pages.subscription.loadError')}
          action={
            <Button size="small" onClick={loadData}>
              {t('common.refresh')}
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )
    }

    // canceled 状态下用户点了 resubscribe → 显示 PlanCatalog
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
        <>
          <Alert
            type="error"
            showIcon
            message={t('pages.subscription.pastDueWarning')}
            style={{ marginBottom: 16 }}
          />
          <SubscriptionDashboard
            queryResult={queryResult!}
            enrichedPlan={enrichedPlan}
            enrichedModules={enrichedModules}
            onManageBilling={handlePortal}
            portalLoading={portalLoading}
          />
        </>
      )
    }

    if (subscriptionStatus === 'canceled') {
      return (
        <Result
          status="info"
          title={t('pages.subscription.canceledTitle')}
          subTitle={t('pages.subscription.canceledDesc')}
          extra={
            <Button type="primary" onClick={() => setShowCatalog(true)}>
              {t('pages.subscription.resubscribe')}
            </Button>
          }
        />
      )
    }

    // unpaid / incomplete
    if (subscriptionStatus === 'unpaid') {
      return (
        <Result
          status="warning"
          title={t('pages.subscription.needsActionUnpaidTitle')}
          subTitle={t('pages.subscription.needsActionUnpaidDesc')}
          extra={
            <Button type="primary" onClick={handlePortal} loading={portalLoading}>
              {t('pages.subscription.updatePayment')}
            </Button>
          }
        />
      )
    }

    if (subscriptionStatus === 'incomplete') {
      return (
        <Result
          status="warning"
          title={t('pages.subscription.needsActionIncompleteTitle')}
          subTitle={t('pages.subscription.needsActionIncompleteDesc')}
          extra={
            <Button type="primary" onClick={handlePortal} loading={portalLoading}>
              {t('pages.subscription.manageBilling')}
            </Button>
          }
        />
      )
    }

    // 兜底：未知状态
    return <PlanCatalog orgId={orgId} plans={catalogPlans} modules={catalogModules} />
  }

  return (
    <div style={{ maxWidth: 960 }}>
      {/* 页面标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
            {t('pages.subscription.title')}
          </h2>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('pages.subscription.description')}
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData}>
          {t('common.refresh')}
        </Button>
      </div>

      {renderContent()}
    </div>
  )
}
