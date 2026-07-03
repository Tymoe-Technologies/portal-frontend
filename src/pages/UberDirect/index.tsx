import React, { useState, useEffect, useCallback } from 'react'
import clsx from 'clsx'
import {
  Car, Plus, RotateCcw, CheckCircle2, ExternalLink, Pencil,
  AlertTriangle, MapPin, Settings, Phone, Mail, Gauge,
} from 'lucide-react'
import { useAuthContext } from '@/auth/AuthProvider'
import { getOrganization } from '@/services/auth'
import { uberService } from '@/services/uber'
import directService, { DirectOrganization, DirectDelivery, CreateDeliveryParams, DeliveryFeeRule } from '@/services/directService'
import { getOnlineOrderConfig, updateOnlineOrderConfig } from '@/services/onlineOrder'
import {
  PageHeader, SectionCard, Table, Badge, Btn, AlertBox, Spinner, EmptyState,
  Modal, ConfirmDialog, Field, TextInput, Textarea, NumberInput, type Column,
} from '@/components/ui-kit'

// 配送状态 → 徽章样式
const STATUS_VARIANT: Record<string, { variant: 'default' | 'blue' | 'green' | 'red' | 'gold'; label: string }> = {
  pending:         { variant: 'default', label: '等待接单' },
  pickup:          { variant: 'blue',    label: '前往取餐' },
  pickup_complete: { variant: 'blue',    label: '已取餐' },
  dropoff:         { variant: 'blue',    label: '配送中' },
  delivered:       { variant: 'green',   label: '已送达' },
  canceled:        { variant: 'red',     label: '已取消' },
  returned:        { variant: 'gold',    label: '已退回' },
}

const UBER_GREEN = '#06C167'

function isPickupInfoComplete(org: DirectOrganization): boolean {
  return !!(org.pickupStreet && org.pickupCity && org.phone)
}

// 计费方式单选卡片
function RadioCards({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; title: string; desc: string }[]
}) {
  return (
    <div className="space-y-2">
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={clsx(
              'w-full text-left rounded-lg border px-3.5 py-3 transition-all cursor-pointer',
              active ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300',
            )}
          >
            <div className="flex items-center gap-2">
              <span className={clsx('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2', active ? 'border-slate-900' : 'border-slate-300')}>
                {active && <span className="h-2 w-2 rounded-full bg-slate-900" />}
              </span>
              <span className="text-sm font-medium text-slate-800">{opt.title}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 pl-6">{opt.desc}</p>
          </button>
        )
      })}
    </div>
  )
}

const emptyOnboard = { name: '', email: '', phone: '', street1: '', city: '', state: '', zipcode: '', country_iso2: 'CA' }
const emptyPickup = {
  phone: '', pickupStreet: '', pickupCity: '', pickupProvince: '', pickupPostalCode: '',
  pickupCountry: 'CA', pickupLatitude: undefined as number | undefined, pickupLongitude: undefined as number | undefined, pickupNotes: '',
}
const emptyCreate = {
  pickupAddress: '', pickupName: '', pickupPhone: '', dropoffAddress: '', dropoffName: '',
  dropoffPhone: '', dropoffNotes: '', itemName: '', itemQty: 1,
}
const emptyFeeRule = {
  deliveryFeeRule: 'REALTIME' as DeliveryFeeRule,
  deliveryFlatFee: undefined as number | undefined,
  merchantSubsidyAmount: undefined as number | undefined,
  deliveryFreeAbove: undefined as number | undefined,
  minOrderAmount: undefined as number | undefined,
  deliveryRadius: undefined as number | undefined,
}

const UberDirectPage: React.FC = () => {
  const { user } = useAuthContext()
  const merchantId = localStorage.getItem('organization_id') || ''

  const [defaultName, setDefaultName] = useState('')
  const [defaultEmail, setDefaultEmail] = useState('')
  const [defaultPhone, setDefaultPhone] = useState('')
  const [defaultAddress, setDefaultAddress] = useState<{ street?: string; city?: string; province?: string; postalCode?: string; latitude?: number; longitude?: number } | null>(null)
  const [org, setOrg] = useState<DirectOrganization | null>(null)
  const [orgLoading, setOrgLoading] = useState(true)
  const [deliveries, setDeliveries] = useState<DirectDelivery[]>([])
  const [deliveriesLoading, setDeliveriesLoading] = useState(false)
  const [deliveryRadius, setDeliveryRadius] = useState<number | null>(null)

  const [flash, setFlash] = useState<{ type: 'success' | 'error' | 'warning'; msg: string } | null>(null)
  const notify = (type: 'success' | 'error' | 'warning', msg: string) => {
    setFlash({ type, msg }); setTimeout(() => setFlash(null), type === 'success' ? 3000 : 5000)
  }

  // 弹窗与表单状态
  const [onboardModal, setOnboardModal] = useState(false)
  const [onboardLoading, setOnboardLoading] = useState(false)
  const [onboard, setOnboard] = useState({ ...emptyOnboard })
  const [onboardErr, setOnboardErr] = useState<Record<string, string>>({})

  const [createModal, setCreateModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [create, setCreate] = useState({ ...emptyCreate })
  const [createErr, setCreateErr] = useState<Record<string, string>>({})

  const [pickupModal, setPickupModal] = useState(false)
  const [pickupLoading, setPickupLoading] = useState(false)
  const [pickup, setPickup] = useState({ ...emptyPickup })
  const [pickupErr, setPickupErr] = useState<Record<string, string>>({})

  const [feeRuleModal, setFeeRuleModal] = useState(false)
  const [feeRuleLoading, setFeeRuleLoading] = useState(false)
  const [feeRule, setFeeRule] = useState({ ...emptyFeeRule })
  const [feeRuleErr, setFeeRuleErr] = useState<Record<string, string>>({})

  const [cancelTarget, setCancelTarget] = useState<string | null>(null)

  const oset = (p: Partial<typeof onboard>) => setOnboard(prev => ({ ...prev, ...p }))
  const pset = (p: Partial<typeof pickup>) => setPickup(prev => ({ ...prev, ...p }))
  const cset = (p: Partial<typeof create>) => setCreate(prev => ({ ...prev, ...p }))
  const fset = (p: Partial<typeof feeRule>) => setFeeRule(prev => ({ ...prev, ...p }))

  // 解析完整地址字符串
  const parseAddressString = (addr: string): { street?: string; city?: string; province?: string; postalCode?: string } => {
    if (!addr) return {}
    const parts = addr.split(',').map(s => s.trim())
    if (parts.length >= 3) {
      const street = parts[0]
      const city = parts[1]
      const provincePostal = parts[2]
      const match = provincePostal.match(/^([A-Z]{2})\s+(.+)$/)
      if (match) return { street, city, province: match[1], postalCode: match[2] }
      return { street, city, province: provincePostal }
    }
    return { street: addr }
  }

  const checkOrg = useCallback(async () => {
    if (!merchantId) return
    setOrgLoading(true)
    try {
      const [found, authOrg, activatedStore, onlineConfig] = await Promise.all([
        directService.getOrganization(merchantId),
        getOrganization(merchantId, 'fb').catch(() => null),
        uberService.getActivatedStore(merchantId).catch(() => null),
        getOnlineOrderConfig(merchantId).catch(() => null),
      ])
      setOrg(found)
      setDeliveryRadius(onlineConfig?.deliveryRadius ?? null)

      if (authOrg) {
        setDefaultName(authOrg.orgName || '')
        setDefaultEmail(authOrg.email || user?.email || '')
        setDefaultPhone(authOrg.phone || '')
      } else {
        setDefaultEmail(user?.email || '')
      }

      let addr: { street?: string; city?: string; province?: string; postalCode?: string; latitude?: number; longitude?: number } | null = null
      if (authOrg?.street) {
        addr = {
          street: authOrg.street, city: authOrg.city, province: authOrg.province,
          postalCode: authOrg.postalCode, latitude: authOrg.latitude, longitude: authOrg.longitude,
        }
      } else {
        const addrStr = activatedStore?.storeAddress || authOrg?.location || ''
        if (addrStr) addr = parseAddressString(addrStr)
      }
      if (addr) setDefaultAddress(addr)

      // 已开通但取货信息不完整 → 自动弹窗
      if (found && !isPickupInfoComplete(found)) {
        setPickup({
          phone: found.phone || authOrg?.phone || '',
          pickupStreet: found.pickupStreet || addr?.street || '',
          pickupCity: found.pickupCity || addr?.city || '',
          pickupProvince: found.pickupProvince || addr?.province || '',
          pickupPostalCode: found.pickupPostalCode || addr?.postalCode || '',
          pickupCountry: found.pickupCountry || 'CA',
          pickupLatitude: found.pickupLatitude || addr?.latitude,
          pickupLongitude: found.pickupLongitude || addr?.longitude,
          pickupNotes: found.pickupNotes || '',
        })
        setPickupModal(true)
      }
    } catch {
      setOrg(null)
    } finally {
      setOrgLoading(false)
    }
  }, [merchantId, user?.email])

  const fetchDeliveries = useCallback(async () => {
    setDeliveriesLoading(true)
    try {
      const data = await directService.listDeliveries(merchantId)
      setDeliveries(Array.isArray(data) ? data : [])
    } catch (e: any) {
      notify('error', '获取配送列表失败：' + e.message)
    } finally {
      setDeliveriesLoading(false)
    }
  }, [])

  useEffect(() => { checkOrg() }, [checkOrg])
  useEffect(() => { if (org) fetchDeliveries() }, [org, fetchDeliveries])

  // ── 开通 ───────────────────────────────────────────────────

  const openOnboardModal = () => {
    setOnboard({
      ...emptyOnboard,
      name: defaultName, email: defaultEmail, phone: defaultPhone,
      street1: defaultAddress?.street || '', city: defaultAddress?.city || '',
      state: defaultAddress?.province || '', zipcode: defaultAddress?.postalCode || '',
    })
    setOnboardErr({})
    setOnboardModal(true)
  }

  const handleOnboard = async () => {
    const e: Record<string, string> = {}
    if (!onboard.name) e.name = '请输入商家名称'
    if (!onboard.email || !/^[^@]+@[^@]+\.[^@]+$/.test(onboard.email)) e.email = '请输入有效邮箱'
    if (!onboard.phone) e.phone = '请输入联系电话'
    if (!onboard.street1) e.street1 = '请输入街道地址'
    if (!onboard.city) e.city = '请输入城市'
    if (!onboard.state) e.state = '必填'
    if (!onboard.zipcode) e.zipcode = '必填'
    setOnboardErr(e)
    if (Object.keys(e).length) return

    setOnboardLoading(true)
    try {
      const address = { street1: onboard.street1, city: onboard.city, state: onboard.state, zipcode: onboard.zipcode, country_iso2: onboard.country_iso2 || 'CA' }
      const newOrg = await directService.createOrganization(
        merchantId, onboard.name, onboard.email, onboard.phone, address,
        defaultAddress?.latitude, defaultAddress?.longitude,
      )
      setOrg(newOrg)
      setOnboardModal(false)
      notify('success', '自配送已开通！')

      if (!isPickupInfoComplete(newOrg)) {
        setPickup({
          ...emptyPickup,
          phone: onboard.phone || '', pickupStreet: onboard.street1 || '', pickupCity: onboard.city || '',
          pickupProvince: onboard.state || '', pickupPostalCode: onboard.zipcode || '', pickupCountry: onboard.country_iso2 || 'CA',
        })
        setPickupModal(true)
      }
    } catch (e: any) {
      notify('error', '开通失败：' + e.message)
    } finally {
      setOnboardLoading(false)
    }
  }

  // ── 取货信息 ───────────────────────────────────────────────

  const openPickupModal = () => {
    if (!org) return
    setPickup({
      phone: org.phone || '', pickupStreet: org.pickupStreet || '', pickupCity: org.pickupCity || '',
      pickupProvince: org.pickupProvince || '', pickupPostalCode: org.pickupPostalCode || '',
      pickupCountry: org.pickupCountry || 'CA', pickupLatitude: org.pickupLatitude, pickupLongitude: org.pickupLongitude,
      pickupNotes: org.pickupNotes || '',
    })
    setPickupErr({})
    setPickupModal(true)
  }

  const handleSavePickupInfo = async () => {
    if (!org) return
    const e: Record<string, string> = {}
    if (!pickup.phone) e.phone = '请输入门店电话'
    if (!pickup.pickupStreet) e.pickupStreet = '请输入街道地址'
    if (!pickup.pickupCity) e.pickupCity = '请输入城市'
    if (!pickup.pickupProvince) e.pickupProvince = '必填'
    if (!pickup.pickupPostalCode) e.pickupPostalCode = '必填'
    setPickupErr(e)
    if (Object.keys(e).length) return

    setPickupLoading(true)
    try {
      const updated = await directService.updateOrganization(merchantId, org.orgId, {
        phone: pickup.phone,
        pickupStreet: pickup.pickupStreet,
        pickupCity: pickup.pickupCity,
        pickupProvince: pickup.pickupProvince,
        pickupPostalCode: pickup.pickupPostalCode,
        pickupCountry: pickup.pickupCountry || 'CA',
        pickupLatitude: pickup.pickupLatitude,
        pickupLongitude: pickup.pickupLongitude,
        pickupNotes: pickup.pickupNotes,
      })
      setOrg({ ...org, ...updated })
      setPickupModal(false)
      notify('success', '取货信息已保存')
    } catch (e: any) {
      notify('error', '保存失败：' + e.message)
    } finally {
      setPickupLoading(false)
    }
  }

  // ── 配送设置 ───────────────────────────────────────────────

  const openFeeRuleModal = async () => {
    if (!org) return
    const rule = (org.deliveryFeeRule || 'REALTIME') as DeliveryFeeRule
    const onlineConfig = await getOnlineOrderConfig(merchantId).catch(() => null)
    setFeeRule({
      deliveryFeeRule: rule,
      deliveryFlatFee: org.deliveryFlatFee != null ? org.deliveryFlatFee / 100 : undefined,
      deliveryFreeAbove: org.deliveryFreeAbove != null ? org.deliveryFreeAbove / 100 : undefined,
      merchantSubsidyAmount: org.merchantSubsidyAmount != null ? org.merchantSubsidyAmount / 100 : undefined,
      minOrderAmount: org.minOrderAmount != null ? org.minOrderAmount / 100 : undefined,
      deliveryRadius: onlineConfig?.deliveryRadius ?? undefined,
    })
    setFeeRuleErr({})
    setFeeRuleModal(true)
  }

  const handleSaveFeeRule = async () => {
    if (!org) return
    const e: Record<string, string> = {}
    if (feeRule.deliveryFeeRule === 'FLAT_FEE' && feeRule.deliveryFlatFee == null) e.deliveryFlatFee = '请输入配送费金额'
    if (feeRule.deliveryFeeRule === 'MERCHANT_SUBSIDY' && feeRule.merchantSubsidyAmount == null) e.merchantSubsidyAmount = '请输入商家承担金额'
    setFeeRuleErr(e)
    if (Object.keys(e).length) return

    setFeeRuleLoading(true)
    try {
      const updates: any = { deliveryFeeRule: feeRule.deliveryFeeRule }
      if (feeRule.deliveryFeeRule === 'FLAT_FEE') {
        updates.deliveryFlatFee = Math.round((feeRule.deliveryFlatFee || 0) * 100)
        updates.merchantSubsidyAmount = null
      } else if (feeRule.deliveryFeeRule === 'MERCHANT_SUBSIDY') {
        updates.merchantSubsidyAmount = Math.round((feeRule.merchantSubsidyAmount || 0) * 100)
        updates.deliveryFlatFee = null
      } else {
        updates.deliveryFlatFee = null
        updates.merchantSubsidyAmount = null
      }
      updates.deliveryFreeAbove = feeRule.deliveryFreeAbove ? Math.round(feeRule.deliveryFreeAbove * 100) : null
      updates.minOrderAmount = feeRule.minOrderAmount ? Math.round(feeRule.minOrderAmount * 100) : null

      const updated = await directService.updateOrganization(merchantId, org.orgId, updates)
      setOrg({ ...org, ...updated })

      const newDeliveryRadius = feeRule.deliveryRadius ?? null
      await updateOnlineOrderConfig(merchantId, {
        minOrderAmount: updates.minOrderAmount ?? null,
        deliveryRadius: newDeliveryRadius,
      }).catch(() => notify('warning', '配送设置已保存，但同步到点单配置失败，请稍后重试'))
      setDeliveryRadius(newDeliveryRadius)

      setFeeRuleModal(false)
      notify('success', '配送设置已保存')
    } catch (e: any) {
      notify('error', '保存失败：' + e.message)
    } finally {
      setFeeRuleLoading(false)
    }
  }

  // ── 创建配送单 ─────────────────────────────────────────────

  const openCreateModal = () => { setCreate({ ...emptyCreate }); setCreateErr({}); setCreateModal(true) }

  const handleCreateDelivery = async () => {
    const e: Record<string, string> = {}
    if (!create.pickupAddress) e.pickupAddress = '请输入取餐地址'
    if (!create.dropoffAddress) e.dropoffAddress = '请输入送达地址'
    if (!create.dropoffName) e.dropoffName = '请输入收件人'
    if (!create.dropoffPhone) e.dropoffPhone = '请输入联系电话'
    setCreateErr(e)
    if (Object.keys(e).length) return

    setCreateLoading(true)
    try {
      const params: CreateDeliveryParams = {
        merchantId,
        pickupAddress: create.pickupAddress,
        pickupName: create.pickupName,
        pickupPhone: create.pickupPhone,
        pickupNotes: (create as any).pickupNotes,
        dropoffAddress: create.dropoffAddress,
        dropoffName: create.dropoffName,
        dropoffPhone: create.dropoffPhone,
        dropoffNotes: create.dropoffNotes,
        manifestItems: [{ name: create.itemName || '餐品', quantity: Number(create.itemQty) || 1, size: 'small', price: 1000 }],
      }
      await directService.createDelivery(params)
      notify('success', '配送单创建成功！')
      setCreateModal(false)
      fetchDeliveries()
    } catch (e: any) {
      notify('error', '创建失败：' + e.message)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleCancel = async (deliveryId: string) => {
    try {
      await directService.cancelDelivery(deliveryId)
      notify('success', '配送单已取消')
      fetchDeliveries()
    } catch (e: any) {
      notify('error', '取消失败：' + e.message)
    } finally {
      setCancelTarget(null)
    }
  }

  const columns: Column<DirectDelivery>[] = [
    { key: 'id', title: '配送单 ID', width: 200, render: r => <span className="font-mono text-xs text-slate-600">{r.id}</span> },
    {
      key: 'status', title: '状态', width: 100,
      render: r => {
        const cfg = STATUS_VARIANT[r.status] ?? { variant: 'default' as const, label: r.status }
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>
      },
    },
    { key: 'pickup', title: '取餐地址', render: r => <span className="text-slate-600 line-clamp-1 max-w-[180px] inline-block align-middle">{r.pickup?.address}</span> },
    {
      key: 'dropoff', title: '送达地址',
      render: r => (
        <div>
          <div className="font-medium text-slate-800">{r.dropoff?.name}</div>
          <div className="text-xs text-slate-400 line-clamp-1 max-w-[180px]">{r.dropoff?.address}</div>
        </div>
      ),
    },
    { key: 'fee', title: '配送费', width: 90, render: r => r.fee ? `${r.currency?.toUpperCase()} ${(r.fee / 100).toFixed(2)}` : '-' },
    { key: 'eta', title: '预计送达', width: 110, render: r => r.dropoff_eta ? new Date(r.dropoff_eta).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '-' },
    {
      key: 'action', title: '操作', width: 120,
      render: r => (
        <div className="flex items-center gap-1">
          {r.tracking_url && (
            <a href={r.tracking_url} target="_blank" rel="noreferrer" title="追踪配送" className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          {['pending', 'pickup'].includes(r.status) && (
            <Btn variant="ghost" size="sm" onClick={() => setCancelTarget(r.id)}>取消</Btn>
          )}
        </div>
      ),
    },
  ]

  const pickupAddressDisplay = org?.pickupStreet
    ? [org.pickupStreet, org.pickupCity, org.pickupProvince, org.pickupPostalCode].filter(Boolean).join(', ')
    : null

  if (orgLoading) return <Spinner className="py-24" />

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <PageHeader
        title={<span className="inline-flex items-center gap-2"><Car className="w-6 h-6" style={{ color: UBER_GREEN }} />自配送</span>}
      />

      <div className="space-y-4">
        {flash && <AlertBox type={flash.type} title={flash.msg} />}

        {!org ? (
          <SectionCard>
            <EmptyState
              icon={<Car className="w-12 h-12" style={{ color: UBER_GREEN }} />}
              title="还未开通自配送服务"
              description="开通后可调用骑手，实现自主配送"
              action={<Btn variant="primary" onClick={openOnboardModal}>开通自配送</Btn>}
            />
          </SectionCard>
        ) : (
          <>
            {!isPickupInfoComplete(org) && (
              <AlertBox
                type="warning"
                title="取货信息不完整"
                description="请补全门店取货地址和联系电话，否则无法自动创建配送单。"
                action={<Btn variant="primary" size="sm" onClick={openPickupModal}>立即补全</Btn>}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 门店信息 */}
              <SectionCard
                title={
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />门店信息
                    <Badge variant="green">{org.name}</Badge>
                  </span>
                }
                action={<Btn variant="secondary" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={openPickupModal}>编辑</Btn>}
              >
                <div className="space-y-3">
                  <InfoLine icon={<MapPin className="w-4 h-4" />} label="取货地址">
                    {pickupAddressDisplay ?? <span className="text-red-500">未配置</span>}
                  </InfoLine>
                  <InfoLine icon={<Phone className="w-4 h-4" />} label="联系电话">
                    {org.phone ?? <span className="text-red-500">未配置</span>}
                  </InfoLine>
                  <InfoLine icon={<Mail className="w-4 h-4" />} label="联系邮箱">{org.email}</InfoLine>
                  {org.pickupNotes && (
                    <InfoLine icon={<span className="w-4" />} label="取货指引">{org.pickupNotes}</InfoLine>
                  )}
                </div>
              </SectionCard>

              {/* 配送设置 */}
              <SectionCard
                title={<span className="inline-flex items-center gap-2"><Gauge className="w-4 h-4 text-slate-400" />配送设置</span>}
                action={<Btn variant="secondary" size="sm" icon={<Settings className="w-3.5 h-3.5" />} onClick={openFeeRuleModal}>编辑</Btn>}
              >
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">计费方式</div>
                    <div className="flex flex-wrap gap-1.5">
                      {org.deliveryFeeRule === 'FLAT_FEE'
                        ? <Badge variant="blue">固定 ${((org.deliveryFlatFee || 0) / 100).toFixed(2)}</Badge>
                        : org.deliveryFeeRule === 'FREE'
                        ? <Badge variant="green">全场免费</Badge>
                        : org.deliveryFeeRule === 'MERCHANT_SUBSIDY'
                        ? <Badge variant="blue">商家补贴 ${((org.merchantSubsidyAmount || 0) / 100).toFixed(2)}</Badge>
                        : <Badge variant="gold">顾客支付实时报价</Badge>}
                      {org.deliveryFreeAbove ? <Badge variant="green">满 ${(org.deliveryFreeAbove / 100).toFixed(2)} 免运</Badge> : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-slate-400">起送金额</div>
                      <div className="text-sm font-medium text-slate-800 mt-0.5">{org.minOrderAmount ? `$${(org.minOrderAmount / 100).toFixed(2)}` : '不限'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">配送半径</div>
                      <div className="text-sm font-medium text-slate-800 mt-0.5">{deliveryRadius ? `${deliveryRadius} 公里` : '不限'}</div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* 配送单管理 */}
            <SectionCard
              title={<span className="inline-flex items-center gap-2"><Car className="w-4 h-4 text-slate-400" />配送单管理</span>}
              action={
                <div className="flex items-center gap-2">
                  <Btn variant="secondary" size="sm" icon={<RotateCcw className="w-3.5 h-3.5" />} loading={deliveriesLoading} onClick={fetchDeliveries}>刷新</Btn>
                  <Btn variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateModal}>新建配送</Btn>
                </div>
              }
              bodyClassName="p-0"
            >
              <div className="p-4">
                <Table columns={columns} data={deliveries} rowKey={r => r.id} loading={deliveriesLoading} empty="暂无配送单" />
              </div>
            </SectionCard>
          </>
        )}
      </div>

      {/* 开通弹窗 */}
      <Modal
        open={onboardModal}
        onOpenChange={v => !v && setOnboardModal(false)}
        title="开通自配送"
        footer={<><Btn variant="secondary" onClick={() => setOnboardModal(false)}>取消</Btn><Btn variant="primary" loading={onboardLoading} onClick={handleOnboard}>确认开通</Btn></>}
      >
        <div className="space-y-4">
          <Field label="商家名称" required error={onboardErr.name}><TextInput value={onboard.name} onChange={v => oset({ name: v })} placeholder="如：My Restaurant" /></Field>
          <Field label="联系邮箱" required error={onboardErr.email}><TextInput value={onboard.email} onChange={v => oset({ email: v })} placeholder="merchant@example.com" /></Field>
          <Field label="联系电话" required error={onboardErr.phone}><TextInput value={onboard.phone} onChange={v => oset({ phone: v })} placeholder="+16041234567" /></Field>
          <p className="text-xs font-medium text-slate-400 pt-1">门店取货地址（必填，骑手取餐地点）</p>
          <Field label="街道地址" required error={onboardErr.street1}><TextInput value={onboard.street1} onChange={v => oset({ street1: v })} placeholder="800 Robson St" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Field label="城市" required error={onboardErr.city}><TextInput value={onboard.city} onChange={v => oset({ city: v })} placeholder="Vancouver" /></Field></div>
            <Field label="省/州" required error={onboardErr.state}><TextInput value={onboard.state} onChange={v => oset({ state: v })} placeholder="BC" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="邮政编码" required error={onboardErr.zipcode}><TextInput value={onboard.zipcode} onChange={v => oset({ zipcode: v })} placeholder="V6Z 3B7" /></Field>
            <Field label="国家代码"><TextInput value={onboard.country_iso2} onChange={v => oset({ country_iso2: v })} placeholder="CA" /></Field>
          </div>
        </div>
      </Modal>

      {/* 取货信息弹窗 */}
      <Modal
        open={pickupModal}
        onOpenChange={v => { if (!v && org && isPickupInfoComplete(org)) setPickupModal(false) }}
        title={<span className="inline-flex items-center gap-2"><MapPin className="w-4 h-4" style={{ color: UBER_GREEN }} />门店取货信息</span>}
        footer={<Btn variant="primary" loading={pickupLoading} onClick={handleSavePickupInfo} className="w-full">保存取货信息</Btn>}
      >
        <div className="space-y-4">
          <AlertBox type="info" title="骑手会根据以下地址前来取餐，请确保地址准确。" />
          <Field label="门店电话" required error={pickupErr.phone} hint="骑手到达时会拨打此号码"><TextInput value={pickup.phone} onChange={v => pset({ phone: v })} placeholder="+16041234567" /></Field>
          <Field label="街道地址" required error={pickupErr.pickupStreet}><TextInput value={pickup.pickupStreet} onChange={v => pset({ pickupStreet: v })} placeholder="800 Robson St" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Field label="城市" required error={pickupErr.pickupCity}><TextInput value={pickup.pickupCity} onChange={v => pset({ pickupCity: v })} placeholder="Vancouver" /></Field></div>
            <Field label="省/州" required error={pickupErr.pickupProvince}><TextInput value={pickup.pickupProvince} onChange={v => pset({ pickupProvince: v })} placeholder="BC" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="邮政编码" required error={pickupErr.pickupPostalCode}><TextInput value={pickup.pickupPostalCode} onChange={v => pset({ pickupPostalCode: v })} placeholder="V6Z 3B7" /></Field>
            <Field label="国家代码"><TextInput value={pickup.pickupCountry} onChange={v => pset({ pickupCountry: v })} placeholder="CA" /></Field>
          </div>
          <Field label="取货指引（可选）"><Textarea value={pickup.pickupNotes} onChange={v => pset({ pickupNotes: v })} rows={2} placeholder="如：从后门进入，到前台取餐" /></Field>
        </div>
      </Modal>

      {/* 新建配送弹窗 */}
      <Modal
        open={createModal}
        onOpenChange={v => !v && setCreateModal(false)}
        title="新建配送单"
        size="lg"
        footer={<><Btn variant="secondary" onClick={() => setCreateModal(false)}>取消</Btn><Btn variant="primary" loading={createLoading} onClick={handleCreateDelivery}>创建配送单</Btn></>}
      >
        <div className="space-y-4">
          <p className="text-xs font-medium text-slate-400">取餐信息</p>
          <Field label="取餐地址" required error={createErr.pickupAddress}><TextInput value={create.pickupAddress} onChange={v => cset({ pickupAddress: v })} placeholder="425 Market St, San Francisco, CA 94105" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="取餐联系人"><TextInput value={create.pickupName} onChange={v => cset({ pickupName: v })} placeholder="商家名称" /></Field>
            <Field label="联系电话"><TextInput value={create.pickupPhone} onChange={v => cset({ pickupPhone: v })} placeholder="+14155551234" /></Field>
          </div>
          <p className="text-xs font-medium text-slate-400 pt-1">送达信息</p>
          <Field label="送达地址" required error={createErr.dropoffAddress}><TextInput value={create.dropoffAddress} onChange={v => cset({ dropoffAddress: v })} placeholder="201 Mission St, San Francisco, CA 94105" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="收件人姓名" required error={createErr.dropoffName}><TextInput value={create.dropoffName} onChange={v => cset({ dropoffName: v })} placeholder="顾客姓名" /></Field>
            <Field label="联系电话" required error={createErr.dropoffPhone}><TextInput value={create.dropoffPhone} onChange={v => cset({ dropoffPhone: v })} placeholder="+14155555678" /></Field>
          </div>
          <Field label="备注"><Textarea value={create.dropoffNotes} onChange={v => cset({ dropoffNotes: v })} rows={2} placeholder="门牌号、楼层等信息" /></Field>
          <p className="text-xs font-medium text-slate-400 pt-1">货物信息</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Field label="货物描述"><TextInput value={create.itemName} onChange={v => cset({ itemName: v })} placeholder="餐品" /></Field></div>
            <Field label="数量"><NumberInput value={create.itemQty} onChange={v => cset({ itemQty: v })} min={1} className="w-full" /></Field>
          </div>
        </div>
      </Modal>

      {/* 配送设置弹窗 */}
      <Modal
        open={feeRuleModal}
        onOpenChange={v => !v && setFeeRuleModal(false)}
        title={<span className="inline-flex items-center gap-2"><Settings className="w-4 h-4" style={{ color: UBER_GREEN }} />配送设置</span>}
        footer={<><Btn variant="secondary" onClick={() => setFeeRuleModal(false)}>取消</Btn><Btn variant="primary" loading={feeRuleLoading} onClick={handleSaveFeeRule}>保存配送设置</Btn></>}
      >
        <div className="space-y-4">
          <AlertBox type="info" title="配置向顾客收取的配送费规则及配送限制" />

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">计费方式</p>
            <RadioCards
              value={feeRule.deliveryFeeRule}
              onChange={v => fset({ deliveryFeeRule: v as DeliveryFeeRule })}
              options={[
                { value: 'REALTIME', title: '顾客支付实时报价', desc: '每次下单时获取实时配送报价，费用按实际距离计算' },
                { value: 'FLAT_FEE', title: '顾客支付固定金额', desc: '无论距离远近，向顾客收取统一固定配送费' },
                { value: 'MERCHANT_SUBSIDY', title: '商家补贴固定金额', desc: '商家承担固定金额，顾客支付实时报价超出的部分（不足则免费）' },
                { value: 'FREE', title: '全场免费配送', desc: '所有订单均不向顾客收取配送费' },
              ]}
            />
          </div>

          {feeRule.deliveryFeeRule === 'FLAT_FEE' && (
            <Field label="固定配送费" required error={feeRuleErr.deliveryFlatFee}>
              <NumberInput value={feeRule.deliveryFlatFee ?? NaN} onChange={v => fset({ deliveryFlatFee: v })} min={0} suffix="$" className="w-full" />
            </Field>
          )}
          {feeRule.deliveryFeeRule === 'MERCHANT_SUBSIDY' && (
            <Field label="商家承担金额" required error={feeRuleErr.merchantSubsidyAmount} hint="从实时报价中扣除此金额后向顾客收取，若报价不足则顾客免费">
              <NumberInput value={feeRule.merchantSubsidyAmount ?? NaN} onChange={v => fset({ merchantSubsidyAmount: v })} min={0} suffix="$" className="w-full" />
            </Field>
          )}

          {feeRule.deliveryFeeRule !== 'FREE' && (
            <Field label="满额免运金额（可选）" hint="订单小计达到此金额时，顾客免运费。留空表示不启用">
              <NumberInput value={feeRule.deliveryFreeAbove ?? NaN} onChange={v => fset({ deliveryFreeAbove: v })} min={0} suffix="$" className="w-full" />
            </Field>
          )}

          <Field label="起送金额" hint="低于此金额的订单不允许配送，留空表示不限">
            <NumberInput value={feeRule.minOrderAmount ?? NaN} onChange={v => fset({ minOrderAmount: v })} min={0} suffix="$" className="w-full" />
          </Field>
          <Field label="配送半径（公里）" hint="超出范围的地址无法下配送单，留空表示不限">
            <NumberInput value={feeRule.deliveryRadius ?? NaN} onChange={v => fset({ deliveryRadius: v })} min={0} suffix="km" className="w-full" />
          </Field>
        </div>
      </Modal>

      {/* 取消配送确认 */}
      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={v => !v && setCancelTarget(null)}
        title="确认取消配送？"
        description="取消后无法恢复，可能产生取消费用。"
        confirmText="确认取消"
        cancelText="返回"
        danger
        onConfirm={() => cancelTarget && handleCancel(cancelTarget)}
      />
    </div>
  )
}

// 门店信息行
const InfoLine: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
  <div className="flex items-start gap-2.5">
    <span className="text-slate-400 mt-0.5 shrink-0">{icon}</span>
    <div className="min-w-0">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm text-slate-700 mt-0.5 break-words">{children}</div>
    </div>
  </div>
)

export default UberDirectPage
