import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthContext } from '@/auth/AuthProvider'
import {
  CheckCircle2, XCircle, CreditCard, Trash2, DollarSign, AlertCircle,
  ExternalLink, Plus, RotateCw, ChevronDown, ChevronRight,
} from 'lucide-react'
import {
  getDevices,
  type Device,
} from '@/services/device'
import {
  getDevicePaymentMethods,
  createDevicePaymentMethod,
  enableDevicePaymentMethod,
  disableDevicePaymentMethod,
  deleteDevicePaymentMethod,
  type PaymentMethodConfigResponse,
} from '@/services/device-payment-methods'
import {
  onboardStripeConnect,
  getStripeConnectStatus,
  refreshStripeOnboarding,
  bindParentStripeAccount,
  type StripeConnectStatus,
} from '@/services/payment-provider'
import {
  getSupportedCurrencies,
  type CurrencyConfig,
} from '@/services/currency'
import cloverLogo from '@/assets/clover-logo.svg'
import stripeLogo from '@/assets/stripe-logo.svg'
import wechatLogo from '@/assets/wechat-logo.svg'
import {
  getTenantPaymentConfig,
  upsertTenantPaymentConfig,
} from '@/services/tenant-payment-config'
import {
  SectionCard, Tabs, Switch, Btn, SelectInput, TextInput, AlertBox, Spinner,
  EmptyState, StatCard, Modal, ConfirmDialog, FormRow, toast,
} from '@/components/ui-kit'

type DeviceWithMethods = Device & { paymentMethods?: PaymentMethodConfigResponse[] }

// 卡片支付提供商选项（未来添加 stripe 等），label 用于显示文字
const CARD_PROVIDERS = [{ label: 'Clover', value: 'clover' }]

// 判断是否为卡片支付方式
const isCardMethod = (paymentMethod: string) => ['clover', 'stripe', 'square'].includes(paymentMethod)
// 判断是否为扫码支付方式（微信/支付宝）
const isQRMethod = (paymentMethod: string) => ['wechat', 'alipay'].includes(paymentMethod)
// 判断是否为系统预设方式（不可删除）
const isSystemMethod = (paymentMethod: string) => paymentMethod === 'cash' || isQRMethod(paymentMethod)
// 判断是否为自定义方式
const isCustomMethod = (paymentMethod: string) => !isCardMethod(paymentMethod) && !isSystemMethod(paymentMethod)

// 找零方式可选值（文案走 i18n，见组件内 useRoundingMethodOptions）
const ROUNDING_METHOD_VALUES = ['ROUND', 'ROUND_UP', 'ROUND_DOWN'] as const

// 设备类型标签配色（严禁紫色，MOBILE 归入 slate）
const DEVICE_TYPE_CLASS: Record<string, string> = {
  POS: 'bg-blue-50 text-blue-600 ring-blue-200',
  KIOSK: 'bg-green-50 text-green-600 ring-green-200',
  TABLET: 'bg-amber-50 text-amber-600 ring-amber-200',
  MOBILE: 'bg-slate-100 text-slate-600 ring-slate-200',
  WEB: 'bg-cyan-50 text-cyan-600 ring-cyan-200',
}

// 支付方式行容器
function MethodRow({ children, dashed, faded }: { children: React.ReactNode; dashed?: boolean; faded?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-lg border ${dashed ? 'border-dashed border-slate-300' : 'border-slate-100'} ${faded ? 'opacity-50' : ''}`}>
      {children}
    </div>
  )
}

/**
 * 支付方式设置页面
 * 管理每个设备的支付方式配置
 */
const PaymentSettings: React.FC = () => {
  const { t } = useTranslation()
  const { user, organizations } = useAuthContext()

  const tenantId = localStorage.getItem('organization_id') || ''
  // 组织类型：直营分店（BRANCH）绑定主店收款账户，主店/加盟店走 Stripe onboarding
  const currentOrg = organizations.find(o => o.id === tenantId)
  const isBranch = currentOrg?.orgType === 'BRANCH'

  const [activeTab, setActiveTab] = useState('devices')
  const [loading, setLoading] = useState(false)
  const [devices, setDevices] = useState<DeviceWithMethods[]>([])
  const [openDevices, setOpenDevices] = useState<Set<string>>(new Set())

  // 自定义支付添加模态框
  const [customModalVisible, setCustomModalVisible] = useState(false)
  const [customModalDevice, setCustomModalDevice] = useState<DeviceWithMethods | null>(null)
  const [customName, setCustomName] = useState('')
  const [customError, setCustomError] = useState('')

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<{ device: DeviceWithMethods; method: PaymentMethodConfigResponse } | null>(null)

  // 货币配置相关状态
  const [currencies, setCurrencies] = useState<CurrencyConfig[]>([])
  const [currenciesLoading, setCurrenciesLoading] = useState(false)

  // 租户级全局货币配置状态
  const [tenantConfigLoading, setTenantConfigLoading] = useState(false)
  const [tenantCfg, setTenantCfg] = useState<{ currency: string; roundingUnit: string; roundingMethod: string }>({
    currency: '', roundingUnit: '', roundingMethod: 'ROUND',
  })
  const [tenantCfgError, setTenantCfgError] = useState('')

  // Stripe Connect 相关状态
  const [stripeConnectStatus, setStripeConnectStatus] = useState<StripeConnectStatus | null>(null)
  const [stripeConnectLoading, setStripeConnectLoading] = useState(false)

  // 货币选项 - 从后端加载
  const currencyOptions = currencies.map(c => ({ label: `${c.name} (${c.code})`, value: c.code }))

  // 初始化 - 监听 tenantId 变化，切换组织时自动重新加载
  useEffect(() => {
    if (tenantId) {
      loadDevices(tenantId)
      loadTenantPaymentConfig(tenantId)
      loadStripeConnectStatus(tenantId)
    }
    loadCurrencies()
  }, [tenantId])

  const toggleDevice = (id: string) => {
    setOpenDevices(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // 加载货币配置
  const loadCurrencies = async () => {
    try {
      setCurrenciesLoading(true)
      const data = await getSupportedCurrencies()
      if (data.length === 0) toast.warning(t('pages.paymentSettings.toastNoCurrencyConfig'))
      setCurrencies(data)
    } catch (error: any) {
      console.error('加载货币配置失败:', error.message)
      toast.error(t('pages.paymentSettings.toastLoadCurrencyFailed'))
      setCurrencies([])
    } finally {
      setCurrenciesLoading(false)
    }
  }

  // 加载租户级全局货币配置
  const loadTenantPaymentConfig = async (tid: string) => {
    try {
      setTenantConfigLoading(true)
      const config = await getTenantPaymentConfig(tid)
      if (config) {
        setTenantCfg({
          currency: config.currency || '',
          roundingUnit: config.roundingUnit || '',
          roundingMethod: config.roundingMethod || 'ROUND',
        })
      } else {
        setTenantCfg({ currency: '', roundingUnit: '', roundingMethod: 'ROUND' })
      }
    } catch (error: any) {
      console.error('加载租户货币配置失败:', error.message)
    } finally {
      setTenantConfigLoading(false)
    }
  }

  // 选择币种时自动填充最小硬币面额
  const handleCurrencyChange = (code: string) => {
    const selected = currencies.find(c => c.code === code)
    setTenantCfg(prev => ({
      ...prev,
      currency: code,
      roundingUnit: selected?.defaultRoundingUnit != null ? String(selected.defaultRoundingUnit) : prev.roundingUnit,
    }))
  }

  // 保存租户级全局货币配置
  const handleSaveTenantConfig = async () => {
    if (!tenantCfg.currency) { setTenantCfgError(t('pages.paymentSettings.toastPleaseSelectCurrency')); return }
    setTenantCfgError('')
    try {
      setTenantConfigLoading(true)
      await upsertTenantPaymentConfig(tenantId, {
        currency: tenantCfg.currency,
        roundingUnit: tenantCfg.roundingUnit,
        roundingMethod: tenantCfg.roundingMethod || 'ROUND',
      })
      toast.success(t('pages.paymentSettings.toastTenantConfigSaved'))
    } catch (error: any) {
      toast.error(error.message || t('pages.paymentSettings.toastSaveConfigFailed'))
    } finally {
      setTenantConfigLoading(false)
    }
  }

  // 加载 Stripe Connect 状态
  const loadStripeConnectStatus = async (tid: string) => {
    try {
      setStripeConnectLoading(true)
      const status = await getStripeConnectStatus(tid)
      setStripeConnectStatus(status)
    } catch (error: any) {
      console.error('[Stripe Connect] 加载状态失败:', error.message, error)
      setStripeConnectStatus({ status: 'not_connected', message: error.message || t('pages.paymentSettings.toastCannotConnectStripe') })
    } finally {
      setStripeConnectLoading(false)
    }
  }

  // 处理 Stripe Connect Onboarding
  const handleStripeOnboard = async () => {
    try {
      setStripeConnectLoading(true)
      const userEmail = user?.email || ''
      if (!userEmail) { toast.error(t('pages.paymentSettings.toastNoUserEmail')); return }
      const response = await onboardStripeConnect({ tenantId, email: userEmail, businessType: 'individual', country: 'US' })
      toast.success(t('pages.paymentSettings.toastRedirectingStripe'))
      window.location.href = response.onboardingUrl
    } catch (error: any) {
      console.error('[Stripe Onboard] 失败:', error.message, error)
      toast.error(error.message || t('pages.paymentSettings.toastStripeSetupFailed'))
    } finally {
      setStripeConnectLoading(false)
    }
  }

  // 直营分店：绑定主店收款账户（不创建自己的 Stripe 账户）
  const handleBindParentAccount = async () => {
    try {
      setStripeConnectLoading(true)
      await bindParentStripeAccount(tenantId)
      toast.success(t('pages.paymentSettings.toastBoundParentAccount'))
      await loadStripeConnectStatus(tenantId)
    } catch (error: any) {
      console.error('[Stripe Bind] 失败:', error.message, error)
      const backendMsg = error?.response?.data?.message
      toast.error(backendMsg || error.message || t('pages.paymentSettings.toastBindParentFailed'))
    } finally {
      setStripeConnectLoading(false)
    }
  }

  // 刷新 Stripe Onboarding 链接
  const handleRefreshStripeOnboarding = async () => {
    try {
      setStripeConnectLoading(true)
      const response = await refreshStripeOnboarding(tenantId)
      toast.success(t('pages.paymentSettings.toastRedirectingStripe'))
      window.location.href = response.onboardingUrl
    } catch (error: any) {
      console.error('[Stripe Refresh] 失败:', error.message, error)
      toast.error(error.message || t('pages.paymentSettings.toastRefreshStripeFailed'))
    } finally {
      setStripeConnectLoading(false)
    }
  }

  // 加载设备列表
  const loadDevices = async (tid: string) => {
    try {
      setLoading(true)
      const response = await getDevices({ orgId: tid })
      const list: DeviceWithMethods[] = []
      for (const device of response.data || []) {
        try {
          const methods = await getDevicePaymentMethods(tid, device.id || '')
          list.push({ ...device, paymentMethods: methods })
        } catch {
          list.push({ ...device, paymentMethods: [] })
        }
      }
      setDevices(list)
    } catch (error: any) {
      toast.error(error.message || t('pages.paymentSettings.toastLoadDevicesFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 切换启用状态
  const handleToggleMethod = async (device: DeviceWithMethods, method: PaymentMethodConfigResponse) => {
    if (!device.id) return
    try {
      setLoading(true)
      if (method.isEnabled) {
        await disableDevicePaymentMethod(tenantId, device.id, method.paymentMethod)
        toast.success(t('pages.paymentSettings.toastMethodDisabled', { name: method.displayName }))
      } else {
        await enableDevicePaymentMethod(tenantId, device.id, method.paymentMethod)
        toast.success(t('pages.paymentSettings.toastMethodEnabled', { name: method.displayName }))
      }
      await loadDevices(tenantId)
    } catch (error: any) {
      toast.error(error.message || t('pages.paymentSettings.toastOperationFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 删除支付方式
  const confirmDeleteMethod = async () => {
    if (!deleteTarget?.device.id) return
    const { device, method } = deleteTarget
    try {
      setLoading(true)
      await deleteDevicePaymentMethod(tenantId, device.id!, method.paymentMethod)
      toast.success(t('pages.paymentSettings.toastMethodDeleted'))
      setDeleteTarget(null)
      await loadDevices(tenantId)
    } catch (error: any) {
      toast.error(error.message || t('pages.paymentSettings.toastDeleteFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 切换卡片支付开关（同时只能启用一个）
  const handleToggleCard = async (device: DeviceWithMethods, provider: string) => {
    if (!device.id) return
    try {
      setLoading(true)
      const methods = device.paymentMethods || []
      const target = methods.find(m => m.paymentMethod === provider)
      const displayName = CARD_PROVIDERS.find(p => p.value === provider)?.label || provider

      if (!target) {
        const otherCard = methods.find(m => isCardMethod(m.paymentMethod) && m.paymentMethod !== provider)
        if (otherCard) await disableDevicePaymentMethod(tenantId, device.id, otherCard.paymentMethod)
        await createDevicePaymentMethod(tenantId, device.id, { paymentMethod: provider, displayName, isEnabled: true, posProvider: provider })
      } else if (target.isEnabled) {
        await disableDevicePaymentMethod(tenantId, device.id, provider)
      } else {
        const otherCard = methods.find(m => isCardMethod(m.paymentMethod) && m.paymentMethod !== provider && m.isEnabled)
        if (otherCard) await disableDevicePaymentMethod(tenantId, device.id, otherCard.paymentMethod)
        await enableDevicePaymentMethod(tenantId, device.id, provider)
      }
      await loadDevices(tenantId)
    } catch (error: any) {
      toast.error(error.message || t('pages.paymentSettings.toastOperationFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 切换微信/支付宝扫码支付
  const handleToggleQR = async (device: DeviceWithMethods, method: 'wechat' | 'alipay') => {
    if (!device.id) return
    const displayName = method === 'wechat' ? 'WeChat Pay' : 'Alipay'
    try {
      setLoading(true)
      const methods = device.paymentMethods || []
      const target = methods.find(m => m.paymentMethod === method)
      if (!target) {
        await createDevicePaymentMethod(tenantId, device.id, { paymentMethod: method, displayName, isEnabled: true, posProvider: 'stripe' })
      } else if (target.isEnabled) {
        await disableDevicePaymentMethod(tenantId, device.id, method)
      } else {
        await enableDevicePaymentMethod(tenantId, device.id, method)
      }
      await loadDevices(tenantId)
    } catch (error: any) {
      toast.error(error.message || t('pages.paymentSettings.toastOperationFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 打开自定义支付添加模态框
  const openCustomModal = (device: DeviceWithMethods) => {
    setCustomModalDevice(device)
    setCustomName('')
    setCustomError('')
    setCustomModalVisible(true)
  }

  // 提交自定义支付
  const handleCustomSubmit = async () => {
    if (!customModalDevice?.id) return
    if (!customName.trim()) { setCustomError(t('pages.paymentSettings.pleaseEnterName')); return }
    setCustomError('')
    try {
      setLoading(true)
      const key = `custom_${Date.now()}`
      await createDevicePaymentMethod(tenantId, customModalDevice.id, { paymentMethod: key, displayName: customName.trim(), isEnabled: true })
      toast.success(t('pages.paymentSettings.toastCustomMethodAdded'))
      setCustomModalVisible(false)
      await loadDevices(tenantId)
    } catch (error: any) {
      toast.error(error.message || t('pages.paymentSettings.toastOperationFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 初始化设备的现金支付（如不存在则创建）
  const handleInitCash = async (device: DeviceWithMethods) => {
    if (!device.id) return
    try {
      setLoading(true)
      await createDevicePaymentMethod(tenantId, device.id, { paymentMethod: 'cash', displayName: t('pages.paymentSettings.cashLabel'), isEnabled: true })
      toast.success(t('pages.paymentSettings.toastCashEnabled'))
      await loadDevices(tenantId)
    } catch (error: any) {
      toast.error(error.message || t('pages.paymentSettings.toastOperationFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 展开项内容
  const renderDeviceContent = (device: DeviceWithMethods) => {
    const methods = device.paymentMethods || []
    const cashMethod = methods.find(m => m.paymentMethod === 'cash')
    const customMethods = methods.filter(m => isCustomMethod(m.paymentMethod))
    const cloverMethod = methods.find(m => m.paymentMethod === 'clover')
    const wechatMethod = methods.find(m => m.paymentMethod === 'wechat')

    return (
      <div className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <div className="text-xs text-slate-400">{t('pages.paymentSettings.deviceIdLabel')}</div>
            <div className="mt-1 font-mono text-xs text-slate-600">{device.id}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">{t('pages.paymentSettings.deviceTypeLabel')}</div>
            <div className="mt-1 text-sm text-slate-700">{device.deviceType}</div>
          </div>
        </div>

        <div className="border-t border-slate-100 my-3" />

        {/* ===== 现金支付 ===== */}
        <div className="mb-5">
          <div className="font-semibold text-[13px] text-slate-700 mb-2.5">{t('pages.paymentSettings.cashLabel')}</div>
          {cashMethod ? (
            <MethodRow>
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-[18px] h-[18px] text-green-500" />
                <div className="font-medium text-slate-700">{t('pages.paymentSettings.cashLabel')}</div>
              </div>
              <Switch checked={cashMethod.isEnabled} onCheckedChange={() => handleToggleMethod(device, cashMethod)} disabled={loading} />
            </MethodRow>
          ) : (
            <MethodRow dashed>
              <span className="text-slate-400 text-[13px]">{t('pages.paymentSettings.notEnabled')}</span>
              <Btn variant="secondary" size="sm" onClick={() => handleInitCash(device)} loading={loading}>{t('pages.paymentSettings.enableCash')}</Btn>
            </MethodRow>
          )}
        </div>

        {/* ===== 卡片支付 ===== */}
        <div className="mb-5">
          <div className="font-semibold text-[13px] text-slate-700 mb-2.5">
            {t('pages.paymentSettings.cardPaymentTitle')}<span className="font-normal text-xs text-slate-400 ml-2">{t('pages.paymentSettings.onlyOneEnabledHint')}</span>
          </div>
          <div className="flex flex-col gap-2">
            {/* Clover */}
            <MethodRow>
              <div className="flex items-center gap-2.5"><img src={cloverLogo} alt="Clover" className="h-5 shrink-0" /></div>
              <Switch checked={cloverMethod?.isEnabled ?? false} onCheckedChange={() => handleToggleCard(device, 'clover')} disabled={loading} />
            </MethodRow>
            {cloverMethod?.isEnabled && (
              <div className="px-3 py-2 bg-blue-50 rounded-md border border-blue-200 text-xs text-blue-600">
                {t('pages.paymentSettings.cloverPairHint')}
              </div>
            )}
            {/* Stripe - 即将推出 */}
            <MethodRow faded>
              <div className="flex items-center gap-2.5">
                <img src={stripeLogo} alt="Stripe" className="h-5 shrink-0" />
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">{t('pages.paymentSettings.comingSoon')}</span>
              </div>
              <Switch checked={false} onCheckedChange={() => {}} disabled />
            </MethodRow>
          </div>
        </div>

        {/* ===== 扫码支付（微信/支付宝）===== */}
        <div className="mb-5">
          <div className="font-semibold text-[13px] text-slate-700 mb-2.5">
            {t('pages.paymentSettings.internationalPaymentTitle')}<span className="font-normal text-xs text-slate-400 ml-2">{t('pages.paymentSettings.viaStripeHint')}</span>
          </div>
          <div className="flex flex-col gap-2">
            {/* 微信支付 */}
            <MethodRow>
              <div className="flex items-center gap-2.5"><img src={wechatLogo} alt="WeChat Pay" className="h-6 shrink-0" /></div>
              <Switch checked={wechatMethod?.isEnabled ?? false} onCheckedChange={() => handleToggleQR(device, 'wechat')} disabled={loading} />
            </MethodRow>
            {/* 支付宝（即将推出）*/}
            <MethodRow faded>
              <div className="flex items-center gap-2.5">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="24" height="24" rx="4" fill="#1677FF" />
                  <path d="M12 4C7.6 4 4 7.6 4 12s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm3.8 10.8c-.8-.3-1.5-.6-2.1-.9.6-.9 1-2 1.1-3.1H13v-.7h2.2V9.5H13V8.4h-1.1v1.1H9.8v.7h2.1c-.1 1-.5 2-1.1 2.8-.8-.4-1.6-.7-2.3-.8-.9-.2-1.5.1-1.7.7-.2.7.3 1.4 1.4 1.8.8.3 1.7.3 2.6 0 .9.5 1.9.9 3 1.2l.5-1.1z" fill="white" />
                </svg>
                <div className="font-medium text-slate-700">{t('pages.paymentSettings.alipayLabel')}</div>
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">{t('pages.paymentSettings.comingSoon')}</span>
              </div>
              <Switch checked={false} onCheckedChange={() => {}} disabled />
            </MethodRow>
          </div>
        </div>

        {/* ===== 自定义支付 ===== */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="font-semibold text-[13px] text-slate-700">
              {t('pages.paymentSettings.customTitle')}<span className="font-normal text-xs text-slate-400 ml-2">{t('pages.paymentSettings.addMultipleHint')}</span>
            </div>
            <Btn variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => openCustomModal(device)} loading={loading}>{t('pages.paymentSettings.addBtn')}</Btn>
          </div>
          {customMethods.length > 0 ? (
            <div className="flex flex-col gap-2">
              {customMethods.map(m => (
                <MethodRow key={m.paymentMethod}>
                  <div className="font-medium text-slate-700">{m.displayName}</div>
                  <div className="flex items-center gap-2">
                    <Switch checked={m.isEnabled} onCheckedChange={() => handleToggleMethod(device, m)} disabled={loading} />
                    <Btn variant="danger" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setDeleteTarget({ device, method: m })}>{t('pages.paymentSettings.deleteBtn')}</Btn>
                  </div>
                </MethodRow>
              ))}
            </div>
          ) : (
            <MethodRow dashed><span className="text-slate-400 text-[13px]">{t('pages.paymentSettings.noCustomMethods')}</span></MethodRow>
          )}
        </div>
      </div>
    )
  }

  if (loading && devices.length === 0) {
    return (
      <div className="p-6"><Spinner className="w-8 h-8 text-slate-400" /></div>
    )
  }

  const totalMethods = devices.reduce((sum, d) => sum + (d.paymentMethods?.length || 0), 0)
  const enabledDevices = devices.filter(d => d.paymentMethods?.some(m => m.isEnabled)).length

  return (
    <div className="py-5">
      {!tenantId ? (
        <SectionCard>
          <EmptyState title={t('pages.paymentSettings.selectOrgFirst')} />
        </SectionCard>
      ) : (
        <>
          {/* 统计卡片 */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard title={t('pages.paymentSettings.statTotalDevices')} value={devices.length} icon={<CreditCard className="w-5 h-5" />} />
            <StatCard title={t('pages.paymentSettings.statTotalConfigs')} value={totalMethods} icon={<DollarSign className="w-5 h-5" />} />
            <StatCard title={t('pages.paymentSettings.statEnabledDevices')} value={enabledDevices} icon={<CheckCircle2 className="w-5 h-5" />} />
          </div>

          {/* 标签页 */}
          <Tabs
            value={activeTab}
            onChange={setActiveTab}
            items={[
              { key: 'devices', label: t('pages.paymentSettings.tabDevices'), icon: <CreditCard className="w-4 h-4" /> },
              { key: 'stripe', label: t('pages.paymentSettings.tabStripe'), icon: <CreditCard className="w-4 h-4" /> },
            ]}
          />

          <div className="mt-5">
            {activeTab === 'devices' && (
              <div className="space-y-6">
                {/* 租户级全局货币配置卡片 */}
                <SectionCard title={t('pages.paymentSettings.globalCurrencyConfigTitle')}>
                  {tenantConfigLoading && !currencies.length ? (
                    <Spinner className="w-6 h-6 text-slate-400" />
                  ) : (
                    <div className="flex flex-wrap items-end gap-4">
                      <div>
                        <div className="text-sm text-slate-600 mb-1.5">{t('pages.paymentSettings.currencyLabel')} <span className="text-red-500">*</span></div>
                        <div className="w-52">
                          <SelectInput className="w-full" placeholder={t('pages.paymentSettings.currencyPlaceholder')}
                            value={tenantCfg.currency} onChange={(v) => handleCurrencyChange(String(v))} options={currencyOptions}
                            disabled={currenciesLoading} />
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-600 mb-1.5">{t('pages.paymentSettings.minCoinDenomination')}</div>
                        <input type="number" step={0.01} disabled placeholder={t('pages.paymentSettings.autoFillPlaceholder')} value={tenantCfg.roundingUnit}
                          className="w-36 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-400" />
                      </div>
                      <div>
                        <div className="text-sm text-slate-600 mb-1.5">{t('pages.paymentSettings.roundingMethodLabel')}</div>
                        <div className="w-52">
                          <SelectInput className="w-full" value={tenantCfg.roundingMethod}
                            onChange={(v) => setTenantCfg(prev => ({ ...prev, roundingMethod: String(v) }))}
                            options={ROUNDING_METHOD_VALUES.map(m => ({
                              label: t(`pages.paymentSettings.rounding${m === 'ROUND' ? 'Round' : m === 'ROUND_UP' ? 'Up' : 'Down'}`),
                              value: m,
                            }))} />
                        </div>
                      </div>
                      <Btn variant="primary" onClick={handleSaveTenantConfig} loading={tenantConfigLoading}>{t('common.save')}</Btn>
                    </div>
                  )}
                  {tenantCfgError && <p className="text-sm text-red-500 mt-2">{tenantCfgError}</p>}
                </SectionCard>

                {/* 设备支付方式说明 */}
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-[13px] text-slate-600">
                      <strong>{t('pages.paymentSettings.configNoteTitle')}</strong>
                      <ul className="list-disc mt-2 ml-5 space-y-0.5">
                        <li>{t('pages.paymentSettings.configNoteCash')}</li>
                        <li>{t('pages.paymentSettings.configNoteInternational')}</li>
                        <li>{t('pages.paymentSettings.configNoteCard')}</li>
                        <li>{t('pages.paymentSettings.configNoteCustom')}</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 设备列表卡片 */}
                <SectionCard
                  title={<span className="inline-flex items-center gap-2.5"><CreditCard className="w-5 h-5 text-blue-500" />{t('pages.paymentSettings.deviceListTitle')}</span>}
                  action={<Btn variant="ghost" icon={<RotateCw className="w-3.5 h-3.5" />} onClick={() => loadDevices(tenantId)} loading={loading}>{t('common.refresh')}</Btn>}
                >
                  {devices.length === 0 ? (
                    <EmptyState title={t('pages.paymentSettings.noDevices')} description={t('pages.paymentSettings.noDevicesDesc')} />
                  ) : (
                    <div className="flex flex-col gap-2">
                      {devices.map(device => {
                        const open = openDevices.has(device.id || '')
                        return (
                          <div key={device.id} className="border border-slate-200 rounded-lg overflow-hidden">
                            <button
                              onClick={() => toggleDevice(device.id || '')}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                            >
                              {open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                              <span className={`text-xs px-2 py-0.5 rounded ring-1 ${DEVICE_TYPE_CLASS[device.deviceType] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                                {device.deviceType}
                              </span>
                              <span className="font-medium text-slate-700">{device.deviceName}</span>
                              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-blue-500 text-white" title={t('pages.paymentSettings.configCountTooltip')}>
                                {device.paymentMethods?.length || 0}
                              </span>
                            </button>
                            {open && renderDeviceContent(device)}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </SectionCard>
              </div>
            )}

            {activeTab === 'stripe' && (
              <div>
                {stripeConnectStatus ? (
                  <SectionCard
                    title={
                      <span className="inline-flex items-center gap-2">
                        <span>Stripe Connect</span>
                        {stripeConnectStatus.status === 'active' && (
                          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600 ring-1 ring-green-200"><CheckCircle2 className="w-3 h-3" />{t('pages.paymentSettings.stripeActive')}</span>
                        )}
                        {stripeConnectStatus.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 ring-1 ring-amber-200"><AlertCircle className="w-3 h-3" />{t('pages.paymentSettings.stripePending')}</span>
                        )}
                        {stripeConnectStatus.status === 'not_connected' && (
                          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 ring-1 ring-slate-200"><XCircle className="w-3 h-3" />{t('pages.paymentSettings.stripeNotConnected')}</span>
                        )}
                      </span>
                    }
                    action={
                      stripeConnectStatus.status === 'active' ? (
                        <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
                          <ExternalLink className="w-3.5 h-3.5" />{t('pages.paymentSettings.stripeConsoleLink')}
                        </a>
                      ) : undefined
                    }
                  >
                    {stripeConnectStatus.status === 'not_connected' && (
                      <div className="text-[13px] text-slate-600">
                        {isBranch
                          ? <p className="m-0">{t('pages.paymentSettings.branchNoStripeNeeded')}</p>
                          : <p className="m-0">{t('pages.paymentSettings.notConnectedYetDesc')}</p>}
                      </div>
                    )}

                    {stripeConnectStatus.status === 'pending' && (
                      <dl className="text-sm space-y-2">
                        <div className="flex gap-3"><dt className="text-slate-500 w-24">{t('pages.paymentSettings.chargesLabel')}</dt><dd>{stripeConnectStatus.chargesEnabled
                          ? <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600 ring-1 ring-green-200">{t('pages.paymentSettings.enabledStatus')}</span>
                          : <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 ring-1 ring-amber-200">{t('pages.paymentSettings.notActiveStatus')}</span>}</dd></div>
                        <div className="flex gap-3"><dt className="text-slate-500 w-24">{t('pages.paymentSettings.payoutsLabel')}</dt><dd>{stripeConnectStatus.payoutsEnabled
                          ? <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600 ring-1 ring-green-200">{t('pages.paymentSettings.enabledStatus')}</span>
                          : <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 ring-1 ring-amber-200">{t('pages.paymentSettings.notActiveStatus')}</span>}</dd></div>
                        {(stripeConnectStatus.requirements?.currentlyDue?.length ?? 0) > 0 && (
                          <div className="flex gap-3"><dt className="text-slate-500 w-24">{t('pages.paymentSettings.pendingRequirementsLabel')}</dt><dd className="text-amber-600 text-xs">{stripeConnectStatus.requirements!.currentlyDue.join('、')}</dd></div>
                        )}
                      </dl>
                    )}

                    {stripeConnectStatus.status === 'active' && (
                      <dl className="text-sm space-y-2">
                        <div className="flex gap-3"><dt className="text-slate-500 w-24">{t('pages.paymentSettings.accountIdLabel')}</dt><dd className="font-mono text-xs text-slate-600">{stripeConnectStatus.accountId}</dd></div>
                        <div className="flex gap-3"><dt className="text-slate-500 w-24">{t('pages.paymentSettings.chargesLabel')}</dt><dd>{stripeConnectStatus.chargesEnabled
                          ? <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600 ring-1 ring-green-200">{t('pages.paymentSettings.enabledStatus')}</span>
                          : <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 ring-1 ring-red-200">{t('pages.paymentSettings.disabledStatus')}</span>}</dd></div>
                        <div className="flex gap-3"><dt className="text-slate-500 w-24">{t('pages.paymentSettings.payoutsLabel')}</dt><dd>{stripeConnectStatus.payoutsEnabled
                          ? <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600 ring-1 ring-green-200">{t('pages.paymentSettings.enabledStatus')}</span>
                          : <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 ring-1 ring-red-200">{t('pages.paymentSettings.disabledStatus')}</span>}</dd></div>
                      </dl>
                    )}

                    {/* 操作按钮 */}
                    <div className="mt-4">
                      {stripeConnectStatus.status === 'not_connected' && (
                        isBranch
                          ? <Btn variant="primary" onClick={handleBindParentAccount} loading={stripeConnectLoading}>{t('pages.paymentSettings.bindParentAccountBtn')}</Btn>
                          : <Btn variant="primary" onClick={handleStripeOnboard} loading={stripeConnectLoading}>{t('pages.paymentSettings.connectStripeBtn')}</Btn>
                      )}
                      {stripeConnectStatus.status === 'pending' && (
                        isBranch
                          ? <Btn variant="secondary" onClick={handleBindParentAccount} loading={stripeConnectLoading}>{t('pages.paymentSettings.syncParentStatusBtn')}</Btn>
                          : <Btn variant="primary" onClick={handleRefreshStripeOnboarding} loading={stripeConnectLoading}>{t('pages.paymentSettings.continueSetupBtn')}</Btn>
                      )}
                    </div>
                  </SectionCard>
                ) : (
                  <SectionCard><Spinner className="w-6 h-6 text-slate-400" /></SectionCard>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* 自定义支付添加模态框 */}
      <Modal
        open={customModalVisible}
        onOpenChange={(o) => !o && setCustomModalVisible(false)}
        title={t('pages.paymentSettings.addCustomPaymentTitle')}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setCustomModalVisible(false)}>{t('common.cancel')}</Btn>
            <Btn variant="primary" loading={loading} onClick={handleCustomSubmit}>{t('common.confirm')}</Btn>
          </div>
        }
      >
        <div className="mb-4 px-3 py-2.5 bg-slate-100 rounded-md text-[13px] text-slate-600">
          {t('pages.paymentSettings.deviceLabel')}：{customModalDevice?.deviceName} ({customModalDevice?.deviceType})
        </div>
        <FormRow label={t('pages.paymentSettings.paymentMethodNameLabel')}>
          <TextInput className="w-full" value={customName} onChange={setCustomName} maxLength={30}
            placeholder={t('pages.paymentSettings.customNamePlaceholder')} />
        </FormRow>
        {customError && <p className="text-sm text-red-500 mt-2">{customError}</p>}
      </Modal>

      {/* 删除支付方式确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t('pages.paymentSettings.confirmDeleteTitle')}
        description={deleteTarget ? t('pages.paymentSettings.confirmDeleteDesc', { name: deleteTarget.method.displayName }) : ''}
        danger
        loading={loading}
        onConfirm={confirmDeleteMethod}
      />
    </div>
  )
}

export default PaymentSettings
