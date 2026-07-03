import { useState, useMemo } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  subscriptionApi,
  type CatalogPlan,
  type CatalogModule,
} from '@/services/subscription'
import { Btn, Checkbox, toast } from '@/components/ui-kit'

interface PlanCatalogProps {
  orgId: string
  plans: CatalogPlan[]
  modules: CatalogModule[]
}

export default function PlanCatalog({ orgId, plans, modules }: PlanCatalogProps) {
  const { t } = useTranslation()
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [selectedPlanKey, setSelectedPlanKey] = useState<string | null>(
    plans.length === 1 ? plans[0].key : null,
  )
  const [selectedModuleKeys, setSelectedModuleKeys] = useState<string[]>([])

  const includedModuleKeys = useMemo(() => {
    const plan = plans.find((p) => p.key === selectedPlanKey)
    if (!plan) return new Set<string>()
    return new Set(plan.includedModules.map((m) => m.moduleKey))
  }, [plans, selectedPlanKey])

  const extraModules = useMemo(() => {
    return modules.filter((m) => !includedModuleKeys.has(m.key))
  }, [modules, includedModuleKeys])

  const handleSelectPlan = (planKey: string) => {
    setSelectedPlanKey(planKey)
    setSelectedModuleKeys([])
  }

  const handleToggleModule = (moduleKey: string) => {
    setSelectedModuleKeys((prev) =>
      prev.includes(moduleKey) ? prev.filter((k) => k !== moduleKey) : [...prev, moduleKey],
    )
  }

  const handleCheckout = async () => {
    if (!selectedPlanKey) {
      toast.warning(t('pages.subscription.selectPlanFirst'))
      return
    }
    setCheckoutLoading(true)
    try {
      const result = await subscriptionApi.createCheckout({
        orgId,
        planKey: selectedPlanKey,
        moduleKeys: selectedModuleKeys.length > 0 ? selectedModuleKeys : undefined,
      })
      window.location.href = result.checkoutUrl
    } catch {
      toast.error(t('pages.subscription.checkoutError'))
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <div>
      {/* 计划卡片 */}
      <h5 className="text-base font-semibold text-slate-800 mb-4">{t('pages.subscription.choosePlan')}</h5>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isSelected = selectedPlanKey === plan.key
          return (
            <div
              key={plan.key}
              onClick={() => handleSelectPlan(plan.key)}
              className={`bg-white rounded-xl p-5 cursor-pointer transition-all hover:shadow-md ${
                isSelected ? 'border-2 border-blue-500' : 'border border-slate-200'
              }`}
            >
              <h4 className="text-lg font-semibold text-slate-900 mb-1">{plan.name}</h4>
              {plan.description && <p className="text-sm text-slate-500 mb-3">{plan.description}</p>}

              {/* 价格 */}
              <div className="mb-3">
                <span className="font-semibold text-2xl text-slate-900">${plan.monthlyPrice}</span>
                <span className="text-slate-500"> / {t('pages.subscription.month')}</span>
              </div>

              {/* 试用期 */}
              {plan.trialDurationDays > 0 && (
                <span className="inline-block mb-3 text-xs px-1.5 py-0.5 rounded ring-1 bg-blue-50 text-blue-600 ring-blue-200">
                  {t('pages.subscription.trialDays', { days: plan.trialDurationDays })}
                </span>
              )}

              {/* 包含的模块 */}
              <div>
                <span className="text-xs text-slate-500">{t('pages.subscription.includedModules')}</span>
                {plan.includedModules.length > 0 ? (
                  <ul className="list-none pl-0 mt-1 mb-0">
                    {plan.includedModules.map((im) => {
                      const mod = modules.find((m) => m.key === im.moduleKey)
                      return (
                        <li key={im.moduleKey} className="mb-0.5 flex items-center">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mr-1.5 shrink-0" />
                          <span className="text-[13px] text-slate-700">{mod?.name || im.moduleKey}</span>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-[13px] text-slate-400 mt-1">{t('pages.subscription.noIncludedModules')}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 额外可选模块 */}
      {selectedPlanKey && extraModules.length > 0 && (
        <div className="mt-8">
          <h5 className="text-base font-semibold text-slate-800 mb-4">{t('pages.subscription.additionalModules')}</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {extraModules.map((mod) => {
              const isChecked = selectedModuleKeys.includes(mod.key)
              return (
                <div
                  key={mod.key}
                  onClick={() => handleToggleModule(mod.key)}
                  className={`bg-white rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                    isChecked ? 'border-2 border-blue-500' : 'border border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5" onClick={(e) => e.stopPropagation()}><Checkbox checked={isChecked} onCheckedChange={() => handleToggleModule(mod.key)} /></div>
                    <div>
                      <span className="font-semibold text-slate-800">{mod.name}</span>
                      {mod.description && <span className="block text-xs text-slate-500">{mod.description}</span>}
                      <span className="text-[13px] text-slate-700">${mod.monthlyPrice} / {t('pages.subscription.month')}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 结账按钮 */}
      <div className="text-center mt-8">
        <Btn variant="primary" disabled={!selectedPlanKey} loading={checkoutLoading} onClick={handleCheckout}>
          {t('pages.subscription.proceedToCheckout')}
        </Btn>
      </div>
    </div>
  )
}
