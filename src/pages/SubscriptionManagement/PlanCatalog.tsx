import { useState, useMemo } from 'react'
import {
  Row, Col, Card, Button, Tag, Typography, Checkbox, message,
} from 'antd'
import { CheckCircleFilled } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import {
  subscriptionApi,
  type CatalogPlan,
  type CatalogModule,
} from '@/services/subscription'

const { Text, Title } = Typography

interface PlanCatalogProps {
  orgId: string
  plans: CatalogPlan[]
  modules: CatalogModule[]
}

export default function PlanCatalog({ orgId, plans, modules }: PlanCatalogProps) {
  const { t } = useTranslation()
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [selectedPlanKey, setSelectedPlanKey] = useState<string | null>(
    // 若只有 1 个计划，默认选中
    plans.length === 1 ? plans[0].key : null,
  )
  const [selectedModuleKeys, setSelectedModuleKeys] = useState<string[]>([])

  // 选中计划已包含的模块 key 集合
  const includedModuleKeys = useMemo(() => {
    const plan = plans.find((p) => p.key === selectedPlanKey)
    if (!plan) return new Set<string>()
    return new Set(plan.includedModules.map((m) => m.moduleKey))
  }, [plans, selectedPlanKey])

  // 额外可选模块 = 所有模块 - 选中计划已包含的模块
  const extraModules = useMemo(() => {
    return modules.filter((m) => !includedModuleKeys.has(m.key))
  }, [modules, includedModuleKeys])

  // 选择计划时清除之前选的额外模块
  const handleSelectPlan = (planKey: string) => {
    setSelectedPlanKey(planKey)
    setSelectedModuleKeys([])
  }

  // 切换额外模块选择
  const handleToggleModule = (moduleKey: string) => {
    setSelectedModuleKeys((prev) =>
      prev.includes(moduleKey)
        ? prev.filter((k) => k !== moduleKey)
        : [...prev, moduleKey],
    )
  }

  // 前往结账
  const handleCheckout = async () => {
    if (!selectedPlanKey) {
      message.warning(t('pages.subscription.selectPlanFirst'))
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
      message.error(t('pages.subscription.checkoutError'))
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <div>
      {/* 计划卡片 */}
      <Title level={5} style={{ marginBottom: 16 }}>
        {t('pages.subscription.choosePlan')}
      </Title>
      <Row gutter={[16, 16]}>
        {plans.map((plan) => {
          const isSelected = selectedPlanKey === plan.key
          return (
            <Col key={plan.key} xs={24} sm={12} lg={8}>
              <Card
                hoverable
                onClick={() => handleSelectPlan(plan.key)}
                style={{
                  borderColor: isSelected ? '#1890ff' : undefined,
                  borderWidth: isSelected ? 2 : 1,
                  cursor: 'pointer',
                }}
              >
                <Title level={4} style={{ marginBottom: 4 }}>{plan.name}</Title>
                {plan.description && (
                  <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                    {plan.description}
                  </Text>
                )}

                {/* 价格 */}
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ fontSize: 24 }}>
                    ${plan.monthlyPrice}
                  </Text>
                  <Text type="secondary"> / {t('pages.subscription.month')}</Text>
                </div>

                {/* 试用期 */}
                {plan.trialDurationDays > 0 && (
                  <Tag color="blue" style={{ marginBottom: 12 }}>
                    {t('pages.subscription.trialDays', { days: plan.trialDurationDays })}
                  </Tag>
                )}

                {/* 包含的模块 */}
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('pages.subscription.includedModules')}
                  </Text>
                  {plan.includedModules.length > 0 ? (
                    <ul style={{ paddingLeft: 0, listStyle: 'none', marginTop: 4, marginBottom: 0 }}>
                      {plan.includedModules.map((im) => {
                        const mod = modules.find((m) => m.key === im.moduleKey)
                        return (
                          <li key={im.moduleKey} style={{ marginBottom: 2 }}>
                            <CheckCircleFilled style={{ color: '#52c41a', marginRight: 6 }} />
                            <Text style={{ fontSize: 13 }}>{mod?.name || im.moduleKey}</Text>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <Text type="secondary" style={{ display: 'block', fontSize: 13, marginTop: 4 }}>
                      {t('pages.subscription.noIncludedModules')}
                    </Text>
                  )}
                </div>
              </Card>
            </Col>
          )
        })}
      </Row>

      {/* 额外可选模块 */}
      {selectedPlanKey && extraModules.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <Title level={5} style={{ marginBottom: 16 }}>
            {t('pages.subscription.additionalModules')}
          </Title>
          <Row gutter={[16, 16]}>
            {extraModules.map((mod) => {
              const isChecked = selectedModuleKeys.includes(mod.key)
              return (
                <Col key={mod.key} xs={24} sm={12} lg={8}>
                  <Card
                    size="small"
                    hoverable
                    onClick={() => handleToggleModule(mod.key)}
                    style={{
                      borderColor: isChecked ? '#1890ff' : undefined,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <Checkbox checked={isChecked} style={{ marginTop: 2 }} />
                      <div>
                        <Text strong>{mod.name}</Text>
                        {mod.description && (
                          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                            {mod.description}
                          </Text>
                        )}
                        <Text style={{ fontSize: 13 }}>
                          ${mod.monthlyPrice} / {t('pages.subscription.month')}
                        </Text>
                      </div>
                    </div>
                  </Card>
                </Col>
              )
            })}
          </Row>
        </div>
      )}

      {/* 结账按钮 */}
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <Button
          type="primary"
          size="large"
          disabled={!selectedPlanKey}
          loading={checkoutLoading}
          onClick={handleCheckout}
        >
          {t('pages.subscription.proceedToCheckout')}
        </Button>
      </div>
    </div>
  )
}
