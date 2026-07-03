import { CheckCircle2, CreditCard, LayoutGrid } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SubscriptionQueryResult } from '@/services/subscription'
import { SectionCard, Btn } from '@/components/ui-kit'

// 订阅状态 → 徽章配色（gold/incomplete 归 amber，canceled 归 slate；严禁紫色）
const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-50 text-green-600 ring-green-200',
  trialing: 'bg-blue-50 text-blue-600 ring-blue-200',
  past_due: 'bg-red-50 text-red-600 ring-red-200',
  canceled: 'bg-slate-100 text-slate-600 ring-slate-200',
  unpaid: 'bg-amber-50 text-amber-600 ring-amber-200',
  incomplete: 'bg-amber-50 text-amber-600 ring-amber-200',
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

  const daysUntilRenewal = subscription.currentPeriodEnd
    ? Math.max(0, Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  const trialDaysLeft = subscription.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString()

  const addonModules = enrichedModules.filter((m) => !m.isIncludedInPlan)
  const planPrice = enrichedPlan ? parseFloat(enrichedPlan.monthlyPrice) : 0
  const addonTotal = addonModules.reduce((sum, m) => sum + parseFloat(m.monthlyPrice), 0)
  const monthlyTotal = planPrice + addonTotal

  const badgeCls = STATUS_BADGE[subscription.status] || 'bg-slate-100 text-slate-600 ring-slate-200'

  return (
    <div className="space-y-4">
      {/* Card 1 — 当前计划 */}
      <SectionCard title={<span className="inline-flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{t('pages.subscription.currentPlan')}</span>}>
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <div className="mb-2">
              <span className="font-semibold text-lg text-slate-800">{enrichedPlan?.name || subscription.planName || subscription.planKey || '—'}</span>
              <span className={`ml-2 inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 ${badgeCls}`}>
                {t(`pages.subscription.statusLabel.${subscription.status}` as const) || subscription.status}
              </span>
            </div>

            {enrichedPlan && (
              <div className="mb-2 text-sm">
                <span className="text-slate-500">{t('pages.subscription.price')}: </span>
                <span className="font-semibold text-slate-800">${enrichedPlan.monthlyPrice}</span>
                <span className="text-slate-500"> / {t('pages.subscription.month')}</span>
              </div>
            )}

            {subscription.currentPeriodEnd && (
              <div className="mb-1 text-sm">
                <span className="text-slate-500">{t('pages.subscription.billingPeriodEnd')}: </span>
                <span className="text-slate-700">{formatDate(subscription.currentPeriodEnd)}</span>
                {daysUntilRenewal !== null && (
                  <span className="text-slate-500"> ({daysUntilRenewal} {t('pages.subscription.daysRemaining')})</span>
                )}
              </div>
            )}
          </div>

          {/* 试用期倒计时 */}
          {subscription.status === 'trialing' && trialDaysLeft !== null && subscription.trialEndsAt && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg min-w-[180px] p-3 text-center">
              <div className="text-xs text-slate-500">{t('pages.subscription.trialRemaining')}</div>
              <div>
                <span className="font-semibold text-[28px] text-blue-600">{trialDaysLeft}</span>
                <span className="text-blue-600"> {t('pages.subscription.days')}</span>
              </div>
              <div className="text-[11px] text-slate-500">{t('pages.subscription.trialEndsOn', { date: formatDate(subscription.trialEndsAt) })}</div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Card 2 — 模块 */}
      {enrichedModules.length > 0 && (
        <SectionCard title={<span className="inline-flex items-center gap-2"><LayoutGrid className="w-4 h-4" />{t('pages.subscription.modules')}</span>}>
          {/* Plan 自带模块 */}
          {enrichedModules.filter((m) => m.isIncludedInPlan).length > 0 && (
            <div className="mb-3">
              {enrichedModules.filter((m) => m.isIncludedInPlan).map((mod) => (
                <div key={mod.key} className="flex items-center py-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  <span className="text-slate-700">{mod.name}</span>
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded ring-1 bg-green-50 text-green-600 ring-green-200">{t('pages.subscription.included')}</span>
                </div>
              ))}
            </div>
          )}

          {/* 额外购买模块 */}
          {addonModules.length > 0 && (
            <>
              {enrichedModules.some((m) => m.isIncludedInPlan) && <div className="border-t border-slate-100 my-2" />}
              <span className="text-xs text-slate-500 block mb-2">{t('pages.subscription.addonModules')}</span>
              {addonModules.map((mod) => (
                <div key={mod.key} className="flex items-center justify-between py-1.5">
                  <span className="text-slate-700">{mod.name}</span>
                  <span className="text-slate-500 text-sm">${mod.monthlyPrice} / {t('pages.subscription.month')}</span>
                </div>
              ))}
            </>
          )}

          {/* 月费合计 */}
          <div className="border-t border-slate-100 my-2" />
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-800">{t('pages.subscription.monthlyTotal')}</span>
            <span className="font-semibold text-base text-slate-800">${monthlyTotal.toFixed(2)} / {t('pages.subscription.month')}</span>
          </div>
        </SectionCard>
      )}

      {/* Card 3 — 账单管理 */}
      <SectionCard title={<span className="inline-flex items-center gap-2"><CreditCard className="w-4 h-4" />{t('pages.subscription.billing')}</span>}>
        <p className="text-sm text-slate-500 mb-4">{t('pages.subscription.billingDesc')}</p>
        <Btn variant="secondary" loading={portalLoading} onClick={onManageBilling}>{t('pages.subscription.manageBilling')}</Btn>
      </SectionCard>
    </div>
  )
}
