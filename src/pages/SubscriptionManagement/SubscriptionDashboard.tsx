import { Card, Space, Tag, Typography, Button, Divider } from 'antd'
import {
  CheckCircleOutlined, CreditCardOutlined, AppstoreOutlined,
  CheckCircleFilled,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { SubscriptionQueryResult } from '@/services/subscription'

const { Text } = Typography

// 订阅状态 → Tag 颜色映射
const statusColorMap: Record<string, string> = {
  active: 'green',
  trialing: 'blue',
  past_due: 'red',
  canceled: 'default',
  unpaid: 'orange',
  incomplete: 'gold',
}

interface EnrichedPlan {
  key: string
  name: string
  description: string | null
  monthlyPrice: string
}

interface EnrichedModule {
  key: string
  name: string
  description: string | null
  monthlyPrice: string
  isIncludedInPlan: boolean
}

interface SubscriptionDashboardProps {
  queryResult: SubscriptionQueryResult
  enrichedPlan: EnrichedPlan | null
  enrichedModules: EnrichedModule[]
  onManageBilling: () => void
  portalLoading: boolean
}

export default function SubscriptionDashboard({
  queryResult,
  enrichedPlan,
  enrichedModules,
  onManageBilling,
  portalLoading,
}: SubscriptionDashboardProps) {
  const { t } = useTranslation()
  const { subscription } = queryResult

  // 计算 billing period 剩余天数
  const daysUntilRenewal = subscription.currentPeriodEnd
    ? Math.max(0, Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  // 计算试用期剩余天数
  const trialDaysLeft = subscription.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  // 格式化日期
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString()

  // 计算月费合计（仅额外购买模块）
  const addonModules = enrichedModules.filter((m) => !m.isIncludedInPlan)
  const planPrice = enrichedPlan ? parseFloat(enrichedPlan.monthlyPrice) : 0
  const addonTotal = addonModules.reduce((sum, m) => sum + parseFloat(m.monthlyPrice), 0)
  const monthlyTotal = planPrice + addonTotal

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* Card 1 — 当前计划 */}
      <Card
        size="small"
        title={
          <Space>
            <CheckCircleOutlined />
            {t('pages.subscription.currentPlan')}
          </Space>
        }
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ marginBottom: 8 }}>
              <Text strong style={{ fontSize: 18 }}>
                {enrichedPlan?.name || subscription.planName || subscription.planKey || '—'}
              </Text>
              <Tag
                color={statusColorMap[subscription.status] || 'default'}
                style={{ marginLeft: 8 }}
              >
                {t(`pages.subscription.statusLabel.${subscription.status}` as const) || subscription.status}
              </Tag>
            </div>

            {enrichedPlan && (
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary">{t('pages.subscription.price')}: </Text>
                <Text strong>${enrichedPlan.monthlyPrice}</Text>
                <Text type="secondary"> / {t('pages.subscription.month')}</Text>
              </div>
            )}

            {subscription.currentPeriodEnd && (
              <div style={{ marginBottom: 4 }}>
                <Text type="secondary">{t('pages.subscription.billingPeriodEnd')}: </Text>
                <Text>{formatDate(subscription.currentPeriodEnd)}</Text>
                {daysUntilRenewal !== null && (
                  <Text type="secondary"> ({daysUntilRenewal} {t('pages.subscription.daysRemaining')})</Text>
                )}
              </div>
            )}
          </div>

          {/* 试用期倒计时 */}
          {subscription.status === 'trialing' && trialDaysLeft !== null && subscription.trialEndsAt && (
            <Card
              size="small"
              style={{ background: '#e6f7ff', border: '1px solid #91d5ff', minWidth: 180 }}
            >
              <div style={{ textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('pages.subscription.trialRemaining')}
                </Text>
                <div>
                  <Text strong style={{ fontSize: 28, color: '#1890ff' }}>
                    {trialDaysLeft}
                  </Text>
                  <Text style={{ color: '#1890ff' }}> {t('pages.subscription.days')}</Text>
                </div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {t('pages.subscription.trialEndsOn', { date: formatDate(subscription.trialEndsAt) })}
                </Text>
              </div>
            </Card>
          )}
        </div>
      </Card>

      {/* Card 2 — 模块 */}
      {enrichedModules.length > 0 && (
        <Card
          size="small"
          title={
            <Space>
              <AppstoreOutlined />
              {t('pages.subscription.modules')}
            </Space>
          }
        >
          {/* Plan 自带模块 */}
          {enrichedModules.filter((m) => m.isIncludedInPlan).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {enrichedModules
                .filter((m) => m.isIncludedInPlan)
                .map((mod) => (
                  <div key={mod.key} style={{ display: 'flex', alignItems: 'center', padding: '6px 0' }}>
                    <CheckCircleFilled style={{ color: '#52c41a', marginRight: 8 }} />
                    <Text>{mod.name}</Text>
                    <Tag color="green" style={{ marginLeft: 8 }}>{t('pages.subscription.included')}</Tag>
                  </div>
                ))}
            </div>
          )}

          {/* 额外购买模块 */}
          {addonModules.length > 0 && (
            <>
              {enrichedModules.some((m) => m.isIncludedInPlan) && <Divider style={{ margin: '8px 0' }} />}
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                {t('pages.subscription.addonModules')}
              </Text>
              {addonModules.map((mod) => (
                <div key={mod.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                  <Text>{mod.name}</Text>
                  <Text type="secondary">${mod.monthlyPrice} / {t('pages.subscription.month')}</Text>
                </div>
              ))}
            </>
          )}

          {/* 月费合计 */}
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>{t('pages.subscription.monthlyTotal')}</Text>
            <Text strong style={{ fontSize: 16 }}>${monthlyTotal.toFixed(2)} / {t('pages.subscription.month')}</Text>
          </div>
        </Card>
      )}

      {/* Card 3 — 账单管理 */}
      <Card
        size="small"
        title={
          <Space>
            <CreditCardOutlined />
            {t('pages.subscription.billing')}
          </Space>
        }
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          {t('pages.subscription.billingDesc')}
        </Text>
        <Button onClick={onManageBilling} loading={portalLoading}>
          {t('pages.subscription.manageBilling')}
        </Button>
      </Card>
    </Space>
  )
}
