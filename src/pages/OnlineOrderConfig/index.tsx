import React, { useState, useEffect } from 'react'
import * as RadixSwitch from '@radix-ui/react-switch'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthContext } from '../../auth/AuthProvider'
import {
  getOnlineOrderConfig,
  createOnlineOrderConfig,
  updateOnlineOrderConfig,
  buildOnlineOrderUrl,
  type OnlineOrderConfig,
  type UpdateOnlineOrderConfigPayload
} from '../../services/onlineOrder'
import { updateOrganization } from '../../services/auth'
import { getStoreStripeAccountPublic } from '../../services/payment-provider'
import directService from '../../services/directService'
import clsx from 'clsx'
import {
  Save,
  RotateCcw,
  ExternalLink,
  AlertTriangle,
  Info,
  Crown,
  Store,
  GitBranch,
  Car,
  CheckCircle2,
  Loader2,
} from 'lucide-react'

// ─── 通用基础组件 ──────────────────────────────────────────────────────────────

function Badge({ children, variant = 'default', icon }: {
  children: React.ReactNode
  variant?: 'default' | 'gold' | 'blue' | 'green'
  icon?: React.ReactNode
}) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ring-1',
      variant === 'gold'  && 'bg-amber-50 text-amber-700 ring-amber-200',
      variant === 'blue'  && 'bg-blue-50 text-blue-700 ring-blue-200',
      variant === 'green' && 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      variant === 'default' && 'bg-slate-100 text-slate-600 ring-slate-200',
    )}>
      {icon}{children}
    </span>
  )
}

function Btn({
  children, variant = 'primary', size = 'md', loading = false,
  disabled = false, onClick, type = 'button', icon,
}: {
  children?: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'link'
  size?: 'sm' | 'md'
  loading?: boolean
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  icon?: React.ReactNode
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 font-medium rounded-lg transition-all duration-150 cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        variant === 'primary'   && 'bg-slate-900 text-white hover:bg-slate-800 px-3.5 py-2 text-sm focus-visible:outline-slate-900',
        variant === 'secondary' && 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 px-3.5 py-2 text-sm focus-visible:outline-slate-400',
        variant === 'ghost'     && 'text-slate-600 hover:bg-slate-100 px-3 py-1.5 text-sm focus-visible:outline-slate-400',
        variant === 'link'      && 'text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline text-sm',
        size === 'sm' && 'text-xs px-2.5 py-1.5',
      )}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </button>
  )
}

function Switch({ checked, onCheckedChange, disabled }: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={clsx(
        'relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900',
        checked ? 'bg-slate-900' : 'bg-slate-200',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <RadixSwitch.Thumb className="block w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 translate-x-0.5 data-[state=checked]:translate-x-[22px]" />
    </RadixSwitch.Root>
  )
}

function AlertBox({ type = 'info', title, description, action }: {
  type?: 'info' | 'warning' | 'success'
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  const styles = {
    info:    { wrap: 'bg-blue-50 border-blue-200',   icon: <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />,         text: 'text-blue-800',  sub: 'text-blue-600' },
    warning: { wrap: 'bg-amber-50 border-amber-200', icon: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />, text: 'text-amber-800', sub: 'text-amber-700' },
    success: { wrap: 'bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />, text: 'text-emerald-800', sub: 'text-emerald-700' },
  }[type]

  return (
    <div className={clsx('flex items-start gap-3 rounded-xl border px-4 py-3', styles.wrap)}>
      {styles.icon}
      <div className="flex-1 min-w-0">
        <p className={clsx('text-sm font-medium', styles.text)}>{title}</p>
        {description && <p className={clsx('text-sm mt-0.5', styles.sub)}>{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-5 py-3 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function FormRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function TextInput({ value, onChange, placeholder, disabled, pattern }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  pattern?: string
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      pattern={pattern}
      className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 w-full
        disabled:bg-slate-50 disabled:text-slate-400
        focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
    />
  )
}

function NumberInput({ value, onChange, min, max, suffix }: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  suffix?: string
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(Number(e.target.value))}
        className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 w-20
          focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
      />
      {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
    </div>
  )
}

function SelectInput({ value, onChange, options }: {
  value: string | number
  onChange: (v: any) => void
  options: { label: string; value: string | number }[]
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value) || e.target.value)}
      className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 cursor-pointer
        focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ─── 主页面 ───────────────────────────────────────────────────────────────────

const OnlineOrderConfigPage: React.FC = () => {
  const { organizations } = useAuthContext()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<OnlineOrderConfig | null>(null)
  const [uberDirectReady, setUberDirectReady] = useState<boolean | null>(null)
  const [stripeOnboarded, setStripeOnboarded] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // 表单状态
  const [enabled, setEnabled] = useState(false)
  const [subdomain, setSubdomain] = useState('')
  const [allowPickup, setAllowPickup] = useState(true)
  const [allowDelivery, setAllowDelivery] = useState(false)
  const [allowPickupSchedule, setAllowPickupSchedule] = useState(true)
  const [pickupLeadMinutes, setPickupLeadMinutes] = useState(15)
  const [pickupSlotInterval, setPickupSlotInterval] = useState(30)
  const [pickupAdvanceDays, setPickupAdvanceDays] = useState(0)

  const currentOrgId = localStorage.getItem('organization_id')
  const currentOrganization = organizations.find(org => org.id === currentOrgId)

  const isMainStore     = currentOrganization?.orgType === 'MAIN'
  const isBranchStore   = currentOrganization?.orgType === 'BRANCH'
  const isFranchiseStore = currentOrganization?.orgType === 'FRANCHISE'
  const isSubStore      = isBranchStore || isFranchiseStore

  const parentOrg = currentOrganization?.parentOrgId
    ? organizations.find(o => o.id === currentOrganization.parentOrgId)
    : null
  const effectiveSubdomain: string | null =
    (isMainStore ? currentOrganization?.subdomain : parentOrg?.subdomain) ?? null

  useEffect(() => {
    if (currentOrganization?.id) loadConfig()
  }, [currentOrganization?.id])

  useEffect(() => {
    if (isSubStore && effectiveSubdomain) setSubdomain(effectiveSubdomain)
  }, [effectiveSubdomain])

  const flash = (msg: string, type: 'success' | 'error') => {
    if (type === 'success') { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3000) }
    else { setError(msg); setTimeout(() => setError(null), 5000) }
  }

  const loadConfig = async () => {
    if (!currentOrganization?.id) return
    setLoading(true)
    try {
      const [data, uberOrg, stripeAccount] = await Promise.all([
        getOnlineOrderConfig(currentOrganization.id),
        directService.getOrganization(currentOrganization.id).catch(() => null),
        getStoreStripeAccountPublic(currentOrganization.id).catch(() => null),
      ])
      setConfig(data)
      setUberDirectReady(uberOrg !== null && !!(uberOrg.pickupStreet && uberOrg.pickupCity && uberOrg.phone))
      const stripeReady = stripeAccount?.onboarded === true
      setStripeOnboarded(stripeAccount ? stripeAccount.onboarded : null)

      if (data) {
        if (!stripeReady && data.enabled) {
          await updateOnlineOrderConfig(currentOrganization.id, { enabled: false }).catch(() => null)
        }
        setEnabled(stripeReady ? data.enabled : false)
        setAllowPickup(data.allowPickup)
        setAllowDelivery(data.allowDelivery)
        setAllowPickupSchedule(data.allowPickupSchedule ?? true)
        setPickupLeadMinutes(data.pickupLeadMinutes ?? 15)
        setPickupSlotInterval(data.pickupSlotInterval ?? 30)
        setPickupAdvanceDays(data.pickupAdvanceDays ?? 0)
      }
      setSubdomain(effectiveSubdomain ?? '')
    } catch (e: any) {
      flash(t('onlineOrder.loadError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!currentOrganization?.id) { flash(t('onlineOrder.selectOrgError'), 'error'); return }

    if (enabled) {
      const stripeAccount = await getStoreStripeAccountPublic(currentOrganization.id).catch(() => null)
      setStripeOnboarded(stripeAccount ? stripeAccount.onboarded : null)
      if (!stripeAccount?.onboarded) {
        flash(
          isBranchStore ? t('onlineOrder.stripeBlockBranch') : t('onlineOrder.stripeBlockMain'),
          'error'
        )
        return
      }
    }

    setSaving(true)
    try {
      if (isMainStore && subdomain && subdomain !== effectiveSubdomain) {
        try {
          await updateOrganization(
            currentOrganization.id,
            { subdomain } as any,
            (currentOrganization.productType ?? 'beauty') as any,
          )
          flash(t('onlineOrder.subdomainSaved'), 'success')
        } catch (err: any) {
          const code = err?.response?.data?.error
          const detail = err?.response?.data?.detail
          if (code === 'subdomain_taken') flash(t('onlineOrder.subdomainTaken'), 'error')
          else if (code === 'invalid_subdomain') flash(detail || t('onlineOrder.subdomainInvalid'), 'error')
          else flash(t('onlineOrder.subdomainSaveFailed'), 'error')
          return
        }
      }

      const payload: UpdateOnlineOrderConfigPayload = {
        enabled,
        allowPickup,
        allowDineIn: false,
        allowDelivery,
        allowPickupSchedule,
        pickupLeadMinutes,
        pickupSlotInterval,
        pickupAdvanceDays,
      }

      let result: OnlineOrderConfig
      if (config) {
        result = await updateOnlineOrderConfig(currentOrganization.id, payload)
        flash(t('onlineOrder.saveSuccess'), 'success')
      } else {
        result = await createOnlineOrderConfig(currentOrganization.id, payload)
        flash(t('onlineOrder.createSuccess'), 'success')
      }
      setConfig(result)
    } catch (e: any) {
      const code = e?.response?.data?.error?.code
      if (code === 'PARENT_NOT_ENABLED') flash(t('onlineOrder.parentNotEnabled'), 'error')
      else if (e.response?.data?.error?.message) flash(e.response.data.error.message, 'error')
      else flash(t('onlineOrder.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!currentOrganization) {
    return (
      <div className="p-6">
        <AlertBox type="warning" title={t('onlineOrder.selectOrgError')} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* 页头 */}
        <div className="flex items-center gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{t('onlineOrder.title')}</h1>
              {isMainStore     && <Badge variant="gold"  icon={<Crown className="w-3 h-3" />}>{t('onlineOrder.badges.main')}</Badge>}
              {isBranchStore   && <Badge variant="blue"  icon={<Store className="w-3 h-3" />}>{t('onlineOrder.badges.branch')}</Badge>}
              {isFranchiseStore && <Badge variant="green" icon={<GitBranch className="w-3 h-3" />}>{t('onlineOrder.badges.franchise')}</Badge>}
            </div>
            {isMainStore && <p className="text-sm text-slate-400 mt-1">{t('onlineOrder.mainStoreHint')}</p>}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-4">

            {/* 消息提示 */}
            {error      && <AlertBox type="warning" title={error} />}
            {successMsg && <AlertBox type="success" title={successMsg} />}

            {/* Stripe 未配置警告 */}
            {stripeOnboarded === false && (
              <AlertBox
                type="warning"
                title={t('onlineOrder.stripeWarning.title')}
                description={isBranchStore ? t('onlineOrder.stripeWarning.descBranch') : t('onlineOrder.stripeWarning.descMain')}
                action={
                  <Btn variant="secondary" size="sm" onClick={() => navigate('/payment-settings')}>{t('onlineOrder.stripeWarning.action')}</Btn>
                }
              />
            )}

            {/* 在线点单地址 */}
            {effectiveSubdomain && (
              <AlertBox
                type="success"
                title={t('onlineOrder.urlLabel')}
                description={
                  <a
                    href={buildOnlineOrderUrl(effectiveSubdomain)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-2"
                  >
                    {buildOnlineOrderUrl(effectiveSubdomain)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                }
              />
            )}

            {/* 基础配置 */}
            <SectionCard title={t('onlineOrder.basic.title')}>
              <FormRow label={t('onlineOrder.basic.enableLabel')} hint={enabled ? t('onlineOrder.basic.enabledHint') : t('onlineOrder.basic.disabledHint')}>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </FormRow>
              <FormRow
                label={isSubStore ? t('onlineOrder.basic.subdomainInherited') : t('onlineOrder.basic.subdomainLabel')}
                hint={isMainStore ? t('onlineOrder.basic.subdomainHint') : undefined}
              >
                <div className="w-48">
                  <TextInput
                    value={subdomain}
                    onChange={setSubdomain}
                    placeholder={t('onlineOrder.basic.subdomainPlaceholder')}
                    disabled={isSubStore}
                  />
                </div>
              </FormRow>
            </SectionCard>

            {/* 订单类型 */}
            <SectionCard title={t('onlineOrder.orderType.title')}>
              <FormRow label={t('onlineOrder.orderType.allowPickup')}>
                <Switch checked={allowPickup} onCheckedChange={setAllowPickup} />
              </FormRow>

              {allowPickup && (
                <div className="ml-4 mb-2 bg-slate-50 rounded-lg border border-slate-100 px-4 py-3 space-y-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('onlineOrder.orderType.scheduleTitle')}</p>
                  <FormRow label={t('onlineOrder.orderType.allowSchedule')}>
                    <Switch checked={allowPickupSchedule} onCheckedChange={setAllowPickupSchedule} />
                  </FormRow>
                  {allowPickupSchedule && (
                    <>
                      <FormRow label={t('onlineOrder.orderType.leadMinutes')} hint={t('onlineOrder.orderType.leadMinutesHint')}>
                        <NumberInput value={pickupLeadMinutes} onChange={setPickupLeadMinutes} min={0} max={1440} suffix={t('onlineOrder.orderType.minutes')} />
                      </FormRow>
                      <FormRow label={t('onlineOrder.orderType.slotInterval')}>
                        <SelectInput
                          value={pickupSlotInterval}
                          onChange={setPickupSlotInterval}
                          options={[
                            { label: t('onlineOrder.orderType.min15'), value: 15 },
                            { label: t('onlineOrder.orderType.min30'), value: 30 },
                            { label: t('onlineOrder.orderType.min60'), value: 60 },
                          ]}
                        />
                      </FormRow>
                      <FormRow label={t('onlineOrder.orderType.advanceDays')} hint={t('onlineOrder.orderType.advanceDaysHint')}>
                        <NumberInput value={pickupAdvanceDays} onChange={setPickupAdvanceDays} min={0} max={30} suffix={t('onlineOrder.orderType.days')} />
                      </FormRow>
                    </>
                  )}
                </div>
              )}

              <FormRow label={t('onlineOrder.orderType.allowDelivery')}>
                <div className="flex items-center gap-2">
                  <Switch checked={allowDelivery} onCheckedChange={setAllowDelivery} />
                  <Btn variant="ghost" size="sm" icon={<Car className="w-3.5 h-3.5" />} onClick={() => navigate('/direct-delivery')}>
                    {t('onlineOrder.orderType.deliveryConfig')}
                  </Btn>
                </div>
              </FormRow>
              {allowDelivery && uberDirectReady === false && (
                <div className="mt-2">
                  <AlertBox type="warning" title={t('onlineOrder.orderType.deliveryIncomplete')} />
                </div>
              )}
            </SectionCard>

            {/* 营业时间 */}
            <SectionCard title={t('onlineOrder.hours.title')}>
              <AlertBox
                type="info"
                title={t('onlineOrder.hours.migratedTitle')}
                description={t('onlineOrder.hours.migratedDesc')}
                action={
                  <Btn variant="link" size="sm" onClick={() => navigate('/organization')}>{t('onlineOrder.hours.goSetup')}</Btn>
                }
              />
            </SectionCard>

            {/* 操作按钮 */}
            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="secondary" icon={<RotateCcw className="w-3.5 h-3.5" />} onClick={loadConfig}>
                {t('common.reset')}
              </Btn>
              <Btn variant="primary" icon={<Save className="w-3.5 h-3.5" />} loading={saving} onClick={handleSave}>
                {t('onlineOrder.save')}
              </Btn>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

export default OnlineOrderConfigPage
