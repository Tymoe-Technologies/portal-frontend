import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, Search, RotateCcw, ShoppingCart,
  DollarSign, Store, Car, Lock, Percent, Users,
} from 'lucide-react'
import { useAuthContext } from '../../auth/AuthProvider'
import { canEditModule } from '../../auth/permissions'
import {
  getSalesChannels,
  createSalesChannel,
  updateSalesChannel,
  deleteSalesChannel,
  getChannelMembers,
  addChannelMember,
  updateChannelMember,
  removeChannelMember,
  type SalesChannel,
  type ChannelMember,
  type CheckoutMode,
  type ChannelAccessMode,
  type BillingCycle,
  type DiscountType,
  type CreateSalesChannelRequest,
  type UpdateSalesChannelRequest,
} from '../../services/order-config'
import {
  PageHeader, SectionCard, Table, Badge, Btn, Switch, SwitchOrStatus, TextInput, Textarea,
  NumberInput, SelectInput, Field, AlertBox, Modal, ConfirmDialog, EmptyState,
  Spinner, Tooltip, type Column,
} from '../../components/ui-kit'

// 外卖平台销售渠道的 sourceType 集合
const DELIVERY_PLATFORM_TYPES = new Set([
  'UBER_EATS', 'DOORDASH', 'SKIP_THE_DISHES', 'GRUBHUB', 'RITUAL', 'FANTUAN', 'OTHER_PLATFORM',
])

const PLATFORM_LABELS: Record<string, string> = {
  UBER_EATS: 'Uber Eats',
  DOORDASH: 'DoorDash',
  SKIP_THE_DISHES: 'Skip The Dishes',
  GRUBHUB: 'Grubhub',
  RITUAL: 'Ritual',
  FANTUAN: 'Fantuan',
}

const PLATFORM_LOGOS: Record<string, string> = {
  UBER_EATS: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Uber_Eats_2020_logo.svg/320px-Uber_Eats_2020_logo.svg.png',
  DOORDASH: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/DoorDash_Logo.svg/320px-DoorDash_Logo.svg.png',
  SKIP_THE_DISHES: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/35/SkipTheDishes_logo.svg/320px-SkipTheDishes_logo.svg.png',
  GRUBHUB: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Grubhub_logo_2016.svg/320px-Grubhub_logo_2016.svg.png',
  RITUAL: 'https://images.ctfassets.net/hkpf2qd2vxgx/4rT0QqZLCMNVIi9cEgomLn/5e1bc16e6c4c9e3d8b4c9d4a2e8e8e8e/ritual-logo.png',
  FANTUAN: 'https://play-lh.googleusercontent.com/W2DaOQRfj6x1QOJ-sGbh2g3XvXJk0nRNNKOEeNzYvXJK1tKI1IYFrABq9ZHPpuEb_g=w240-h480-rw',
  OTHER_PLATFORM: '',
}

const PLATFORM_COLORS: Record<string, string> = {
  UBER_EATS: '#06C167',
  DOORDASH: '#FF3008',
  SKIP_THE_DISHES: '#FF6900',
  GRUBHUB: '#F63440',
  RITUAL: '#FF5A5F',
  FANTUAN: '#E8312A',
  OTHER_PLATFORM: '#64748b',
}

const getBillingCycleLabels = (t: (key: string) => string): Record<string, string> => ({
  WEEKLY: t('pages.orderConfig.billingCycleWeekly'),
  BIWEEKLY: t('pages.orderConfig.billingCycleBiweekly'),
  MONTHLY: t('pages.orderConfig.billingCycleMonthly'),
})

// 平台 Logo：有 URL 显示图片，失败或无 URL 显示品牌色缩写块
const PlatformLogo: React.FC<{ platform: string; size?: number }> = ({ platform, size = 40 }) => {
  const { t } = useTranslation()
  const [imgError, setImgError] = useState(false)
  const logoUrl = PLATFORM_LOGOS[platform]
  const color = PLATFORM_COLORS[platform] ?? '#64748b'
  const label = platform === 'OTHER_PLATFORM' ? t('pages.orderConfig.otherPlatformLabel') : (PLATFORM_LABELS[platform] ?? platform)

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt={label}
        style={{ width: size * 2, height: size, objectFit: 'contain' }}
        onError={() => setImgError(true)}
      />
    )
  }
  return (
    <div
      className="flex items-center justify-center rounded-md text-white font-bold"
      style={{ width: size * 2, height: size, background: color, fontSize: size * 0.36 }}
    >
      {label.slice(0, 2).toUpperCase()}
    </div>
  )
}

interface ChannelFormData {
  channelName: string
  description: string
  isActive: boolean
  displayOrder: number
  accessMode: ChannelAccessMode
  checkoutMode: CheckoutMode
  billingCycle?: BillingCycle
  cycleLimit?: number
  discountEnabled: boolean
  discountType: DiscountType
  discountValue?: number
}

const emptyChannelForm = (order: number): ChannelFormData => ({
  channelName: '',
  description: '',
  isActive: true,
  displayOrder: order,
  accessMode: 'PUBLIC',
  checkoutMode: 'NORMAL',
  billingCycle: undefined,
  cycleLimit: undefined,
  discountEnabled: false,
  discountType: 'PERCENTAGE',
  discountValue: undefined,
})

const ChannelManagement: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const tk = (key: string) => t(`pages.orderConfig.${key}`)
  const { isAuthenticated, role, permissions } = useAuthContext()
  const canEdit = canEditModule('salesChannels', role, permissions)

  const [loading, setLoading] = useState(false)
  const [allSources, setAllSources] = useState<SalesChannel[]>([])
  const [searchText, setSearchText] = useState('')
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const notify = (type: 'success' | 'error', msg: string) => {
    setFlash({ type, msg }); setTimeout(() => setFlash(null), type === 'success' ? 3000 : 5000)
  }

  // 自定义渠道弹窗
  const [modalVisible, setModalVisible] = useState(false)
  const [editingSource, setEditingSource] = useState<SalesChannel | null>(null)
  const [channelForm, setChannelForm] = useState<ChannelFormData>(emptyChannelForm(1))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const setField = <K extends keyof ChannelFormData>(k: K, v: ChannelFormData[K]) =>
    setChannelForm(prev => ({ ...prev, [k]: v }))
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SalesChannel | null>(null)

  // 外卖平台配置弹窗
  const [deliveryModalVisible, setDeliveryModalVisible] = useState(false)
  const [editingDelivery, setEditingDelivery] = useState<SalesChannel | null>(null)
  const [deliveryActive, setDeliveryActive] = useState(false)
  const [deliveryCommission, setDeliveryCommission] = useState<number | undefined>(undefined)

  // 成员管理弹窗
  const [memberModalChannel, setMemberModalChannel] = useState<SalesChannel | null>(null)
  const [members, setMembers] = useState<ChannelMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [memberPhone, setMemberPhone] = useState('')
  const [memberName, setMemberName] = useState('')
  const [memberNote, setMemberNote] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [removeMemberTarget, setRemoveMemberTarget] = useState<ChannelMember | null>(null)

  // 分组数据
  const customChannels = allSources.filter(s => !DELIVERY_PLATFORM_TYPES.has(s.sourceType))
  const deliveryChannels = allSources.filter(s => DELIVERY_PLATFORM_TYPES.has(s.sourceType))
  const filteredCustom = customChannels.filter(
    s =>
      s.sourceName.toLowerCase().includes(searchText.toLowerCase()) ||
      s.sourceType.toLowerCase().includes(searchText.toLowerCase())
  )

  const loadSources = async () => {
    if (!isAuthenticated) return
    setLoading(true)
    try {
      const sources = await getSalesChannels()
      setAllSources(Array.isArray(sources) ? sources : [])
    } catch {
      notify('error', tk('loadFailed'))
      setAllSources([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSources() }, [isAuthenticated])

  // ── 成员管理 ────────────────────────────────────────────────

  const openMemberModal = async (channel: SalesChannel) => {
    setMemberModalChannel(channel)
    setMemberPhone(''); setMemberName(''); setMemberNote('')
    setMembersLoading(true)
    try {
      setMembers(await getChannelMembers(channel.id))
    } catch {
      notify('error', tk('loadMembersFailed'))
    } finally {
      setMembersLoading(false)
    }
  }

  const handleAddMember = async () => {
    if (!memberModalChannel) return
    if (!memberPhone.trim()) { notify('error', tk('pleaseEnterPhone')); return }
    setAddingMember(true)
    try {
      await addChannelMember(memberModalChannel.id, { phone: memberPhone.trim(), name: memberName || undefined, note: memberNote || undefined } as any)
      notify('success', tk('memberAdded'))
      setMemberPhone(''); setMemberName(''); setMemberNote('')
      setMembers(await getChannelMembers(memberModalChannel.id))
    } catch (e: any) {
      notify('error', tk('addFailedPrefix') + (e?.message || tk('pleaseRetry')))
    } finally {
      setAddingMember(false)
    }
  }

  const handleRemoveMember = async (member: ChannelMember) => {
    if (!memberModalChannel) return
    try {
      await removeChannelMember(memberModalChannel.id, member.id)
      setMembers(prev => prev.filter(m => m.id !== member.id))
    } catch {
      notify('error', tk('deleteFailedGeneric'))
    } finally {
      setRemoveMemberTarget(null)
    }
  }

  const handleToggleMember = async (member: ChannelMember, isActive: boolean) => {
    if (!memberModalChannel) return
    try {
      const updated = await updateChannelMember(memberModalChannel.id, member.id, { isActive })
      setMembers(prev => prev.map(m => m.id === updated.id ? updated : m))
    } catch {
      notify('error', tk('updateFailedGeneric'))
    }
  }

  // ── 自定义渠道弹窗 ─────────────────────────────────────────

  const openModal = (source?: SalesChannel) => {
    setErrors({})
    if (source) {
      setEditingSource(source)
      const mode = source.checkoutMode ?? 'NORMAL'
      const discount = source.checkoutRules?.orderDiscount
      setChannelForm({
        channelName: source.sourceName,
        description: source.description ?? '',
        isActive: source.isActive,
        displayOrder: source.displayOrder,
        accessMode: source.accessMode ?? 'PUBLIC',
        checkoutMode: mode,
        billingCycle: source.creditConfig?.billingCycle,
        cycleLimit: source.creditConfig?.cycleLimit ? source.creditConfig.cycleLimit / 100 : undefined,
        discountEnabled: discount?.enabled ?? false,
        discountType: discount?.type ?? 'PERCENTAGE',
        discountValue: discount?.value,
      })
    } else {
      setEditingSource(null)
      setChannelForm(emptyChannelForm(customChannels.length + 1))
    }
    setModalVisible(true)
  }

  const closeModal = () => {
    setModalVisible(false)
    setEditingSource(null)
    setErrors({})
  }

  const validateChannel = (): boolean => {
    const e: Record<string, string> = {}
    const name = channelForm.channelName.trim()
    if (!name) e.channelName = tk('sourceNameRequired')
    else if (name.length < 2) e.channelName = tk('sourceNameMinLength')
    else if (name.length > 100) e.channelName = tk('sourceNameMaxLength')
    if (!channelForm.displayOrder) e.displayOrder = tk('requiredField')
    if (channelForm.checkoutMode === 'CREDIT_ACCOUNT') {
      if (!channelForm.billingCycle) e.billingCycle = tk('pleaseSelectBillingCycle')
      if (channelForm.cycleLimit == null) e.cycleLimit = tk('pleaseEnterCycleLimit')
    }
    if (channelForm.discountEnabled && channelForm.discountValue == null) {
      e.discountValue = tk('pleaseEnterDiscountValue')
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validateChannel()) return
    setSaving(true)
    try {
      const v = channelForm
      const creditConfig =
        v.checkoutMode === 'CREDIT_ACCOUNT' && v.billingCycle
          ? { billingCycle: v.billingCycle, cycleLimit: Math.round((v.cycleLimit ?? 0) * 100) }
          : undefined

      const checkoutRules =
        v.discountEnabled
          ? { orderDiscount: { enabled: true, type: v.discountType, value: v.discountValue ?? 0 } }
          : { orderDiscount: { enabled: false, type: 'PERCENTAGE' as DiscountType, value: 0 } }

      if (editingSource) {
        const req: UpdateSalesChannelRequest = {
          channelName: v.channelName,
          description: v.description,
          isActive: v.isActive,
          displayOrder: v.displayOrder,
          accessMode: v.accessMode,
          checkoutMode: v.checkoutMode,
          creditConfig: creditConfig ?? null,
          checkoutRules,
        }
        await updateSalesChannel(editingSource.id, req)
        notify('success', tk('updateSuccess'))
      } else {
        const req: CreateSalesChannelRequest = {
          channelType: 'CUSTOM',
          channelName: v.channelName,
          description: v.description,
          isActive: v.isActive,
          displayOrder: v.displayOrder,
          accessMode: v.accessMode,
          checkoutMode: v.checkoutMode,
          creditConfig,
          checkoutRules,
        }
        await createSalesChannel(req)
        notify('success', tk('createSuccess'))
      }
      closeModal()
      await loadSources()
    } catch {
      notify('error', editingSource ? tk('updateFailed') : tk('createFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (source: SalesChannel) => {
    setSaving(true)
    try {
      await deleteSalesChannel(source.id)
      notify('success', tk('deleteSuccess'))
      await loadSources()
    } catch {
      notify('error', tk('deleteFailed'))
    } finally {
      setSaving(false)
      setDeleteTarget(null)
    }
  }

  // ── 外卖平台配置弹窗 ───────────────────────────────────────

  const openDeliveryModal = (source: SalesChannel) => {
    setEditingDelivery(source)
    setDeliveryActive(source.isActive)
    setDeliveryCommission(source.commissionRate ? parseFloat(source.commissionRate) * 100 : undefined)
    setDeliveryModalVisible(true)
  }

  const handleDeliverySave = async () => {
    if (!editingDelivery) return
    setSaving(true)
    try {
      const req: UpdateSalesChannelRequest = {
        isActive: deliveryActive,
        commissionRate: deliveryCommission != null ? deliveryCommission / 100 : null,
      }
      await updateSalesChannel(editingDelivery.id, req)
      notify('success', tk('updateSuccess'))
      setDeliveryModalVisible(false)
      await loadSources()
    } catch {
      notify('error', tk('updateFailed'))
    } finally {
      setSaving(false)
    }
  }

  // ── 自定义渠道表格列 ─────────────────────────────────────────

  const customColumns: Column<SalesChannel>[] = [
    {
      key: 'sourceName',
      title: tk('sourceName'),
      render: r => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-800">{r.sourceName}</span>
          {r.isSystemChannel && <Badge variant="blue">{tk('systemPreset')}</Badge>}
        </div>
      ),
    },
    { key: 'description', title: tk('descriptionColumn'), render: r => <span className="text-slate-500">{r.description || '-'}</span> },
    {
      key: 'accessMode',
      title: tk('accessModeColumn'),
      width: 100,
      render: r => r.accessMode === 'MEMBER_ONLY'
        ? <Badge variant="gold" icon={<Lock className="w-3 h-3" />}>{tk('memberOnlyBadge')}</Badge>
        : <Badge>{tk('publicBadge')}</Badge>,
    },
    {
      key: 'checkoutMode',
      title: tk('checkoutModeColumn'),
      width: 120,
      render: r => r.checkoutMode === 'CREDIT_ACCOUNT'
        ? (
          <span title={r.creditConfig ? t('pages.orderConfig.cycleAndLimitTooltip', { cycle: getBillingCycleLabels(t)[r.creditConfig.billingCycle], limit: (r.creditConfig.cycleLimit / 100).toFixed(2) }) : tk('creditCycleNotConfigured')}>
            <Badge variant="blue">{tk('creditAccountBadge')}</Badge>
          </span>
        )
        : <Badge variant="green">{tk('normalCheckoutBadge')}</Badge>,
    },
    {
      key: 'discount',
      title: tk('orderDiscountColumn'),
      width: 110,
      render: r => {
        const d = r.checkoutRules?.orderDiscount
        if (!d?.enabled) return <span className="text-slate-400">-</span>
        return (
          <Badge variant="blue" icon={<Percent className="w-3 h-3" />}>
            {d.type === 'PERCENTAGE' ? `${d.value}% off` : `$${(d.value / 100).toFixed(2)} off`}
          </Badge>
        )
      },
    },
    {
      key: 'isActive',
      title: tk('status'),
      width: 80,
      render: r => <Badge variant={r.isActive ? 'green' : 'red'}>{r.isActive ? tk('active') : tk('inactive')}</Badge>,
    },
    {
      key: 'actions',
      title: tk('actions'),
      width: 220,
      render: r => (
        <div className="flex items-center gap-1">
          <Btn variant="ghost" size="sm" icon={<DollarSign className="w-3.5 h-3.5" />} onClick={() => navigate(`/order-config/pricing?channelId=${r.id}`)}>
            {tk('managePricing')}
          </Btn>
          {!r.isSystemChannel && canEdit && (
            <>
              <span className="w-px h-4 bg-slate-200 mx-0.5" />
              <Tooltip label={tk('memberManagementBtn')}>
                <button onClick={() => openMemberModal(r)} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer">
                  <Users className="w-4 h-4" />
                </button>
              </Tooltip>
              <Tooltip label={tk('edit')}>
                <button onClick={() => openModal(r)} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer">
                  <Pencil className="w-4 h-4" />
                </button>
              </Tooltip>
              <Tooltip label={tk('delete')}>
                <button onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </Tooltip>
            </>
          )}
        </div>
      ),
    },
  ]

  // ── 渲染 ───────────────────────────────────────────────────

  return (
    <div className="px-1 py-2">
      <PageHeader
        title={<span className="inline-flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-slate-400" />{tk('channelManagementTitle')}</span>}
        description={tk('channelManagementDesc')}
        actions={
          <>
            <Btn variant="secondary" icon={<RotateCcw className="w-3.5 h-3.5" />} loading={loading} onClick={loadSources} />
            {canEdit && <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => openModal()}>{tk('createSource')}</Btn>}
          </>
        }
      />

      <div className="space-y-4">
        {flash && <AlertBox type={flash.type} title={flash.msg} />}

        {/* 外卖平台销售渠道 */}
        <SectionCard
          title={<span className="inline-flex items-center gap-2"><Car className="w-4 h-4 text-slate-400" />{tk('deliveryChannelsTitle')}</span>}
          description={tk('deliveryChannelsDesc')}
        >
          {deliveryChannels.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">{tk('noDeliveryChannels')}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {deliveryChannels.map(ch => {
                const rate = ch.commissionRate ? parseFloat(ch.commissionRate) * 100 : null
                return (
                  <div key={ch.id} className={clsxCard(ch.isActive)}>
                    <div className="flex items-center gap-3 p-3">
                      <PlatformLogo platform={ch.sourceType} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-800 text-sm truncate">{ch.sourceName}</span>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ch.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </div>
                        <div className="mt-1">
                          {rate != null
                            ? <Badge variant="gold" icon={<Percent className="w-3 h-3" />}>{t('pages.orderConfig.commissionRateBadge', { rate: rate.toFixed(1) })}</Badge>
                            : <span className="text-xs text-slate-400">{tk('commissionRateNotConfigured')}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex border-t border-slate-100 divide-x divide-slate-100">
                      {canEdit && (
                        <button onClick={() => openDeliveryModal(ch)} className="flex-1 py-2 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer inline-flex items-center justify-center gap-1">
                          <Pencil className="w-3 h-3" />{tk('configureBtn')}
                        </button>
                      )}
                      <button onClick={() => navigate(`/order-config/pricing?channelId=${ch.id}`)} className="flex-1 py-2 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer inline-flex items-center justify-center gap-1">
                        <DollarSign className="w-3 h-3" />{tk('pricingBtn')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        {/* 自定义销售渠道 */}
        <SectionCard
          title={<span className="inline-flex items-center gap-2"><Store className="w-4 h-4 text-slate-400" />{tk('customChannelsTitle')}</span>}
          action={
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                placeholder={tk('search')}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-slate-700 placeholder:text-slate-300 focus:outline-2 focus:outline-slate-900"
              />
            </div>
          }
          bodyClassName="p-0"
        >
          <div className="p-4">
            {loading ? (
              <Spinner />
            ) : filteredCustom.length === 0 ? (
              <EmptyState
                title={tk('empty')}
                action={canEdit ? <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => openModal()}>{tk('createSource')}</Btn> : undefined}
              />
            ) : (
              <Table columns={customColumns} data={filteredCustom} rowKey={r => r.id} />
            )}
          </div>
        </SectionCard>
      </div>

      {/* 自定义渠道创建/编辑弹窗 */}
      <Modal
        open={modalVisible}
        onOpenChange={v => !v && closeModal()}
        title={editingSource ? tk('editSource') : tk('createSource')}
        size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={closeModal}>{tk('cancel')}</Btn>
            <Btn variant="primary" loading={saving} onClick={handleSave}>{tk('confirm')}</Btn>
          </>
        }
      >
        <div className="space-y-4">
          <SectionLabel>{tk('basicInfoSection')}</SectionLabel>
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-7">
              <Field label={tk('sourceName')} required error={errors.channelName}>
                <TextInput value={channelForm.channelName} onChange={v => setField('channelName', v)} placeholder={tk('sourceNamePlaceholder')} />
              </Field>
            </div>
            <div className="col-span-3">
              <Field label={tk('displayOrder')} required>
                <NumberInput value={channelForm.displayOrder} onChange={v => setField('displayOrder', v)} min={1} max={1000} className="w-full" />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label={tk('status')}>
                <div className="pt-1.5"><Switch checked={channelForm.isActive} onCheckedChange={v => setField('isActive', v)} /></div>
              </Field>
            </div>
          </div>

          <Field label={tk('descriptionLabel')} hint={`${channelForm.description.length}/500`}>
            <Textarea value={channelForm.description} onChange={v => setField('description', v.slice(0, 500))} rows={2} placeholder={tk('descriptionPlaceholder')} />
          </Field>

          <SectionLabel>{tk('accessSettingsSection')}</SectionLabel>
          <Field label={tk('channelAccessLabel')} hint={tk('channelAccessHint')}>
            <SelectInput
              value={channelForm.accessMode}
              onChange={v => setField('accessMode', v)}
              className="w-full"
              options={[
                { label: tk('publicAccessOption'), value: 'PUBLIC' },
                { label: tk('memberOnlyAccessOption'), value: 'MEMBER_ONLY' },
              ]}
            />
          </Field>

          <SectionLabel>{tk('checkoutSettingsSection')}</SectionLabel>
          <Field label={tk('checkoutModeLabel')}>
            <SelectInput
              value={channelForm.checkoutMode}
              onChange={v => setField('checkoutMode', v)}
              className="w-full"
              options={[
                { label: tk('normalCheckoutOption'), value: 'NORMAL' },
                { label: tk('creditAccountOption'), value: 'CREDIT_ACCOUNT' },
              ]}
            />
          </Field>

          {channelForm.checkoutMode === 'CREDIT_ACCOUNT' && (
            <>
              <AlertBox type="info" title={tk('creditModeTitle')} description={tk('creditModeDesc')} />
              <div className="grid grid-cols-2 gap-3">
                <Field label={tk('billingCycleLabel')} required error={errors.billingCycle}>
                  <SelectInput
                    value={channelForm.billingCycle ?? ''}
                    onChange={v => setField('billingCycle', v)}
                    className="w-full"
                    options={[
                      { label: tk('pleaseSelectOption'), value: '' },
                      { label: tk('billingCycleWeekly'), value: 'WEEKLY' },
                      { label: tk('billingCycleBiweekly'), value: 'BIWEEKLY' },
                      { label: tk('billingCycleMonthly'), value: 'MONTHLY' },
                    ]}
                  />
                </Field>
                <Field label={tk('cycleLimitLabel')} required error={errors.cycleLimit} hint={tk('cycleLimitHint')}>
                  <NumberInput value={channelForm.cycleLimit ?? NaN} onChange={v => setField('cycleLimit', v)} min={0} className="w-full" />
                </Field>
              </div>
            </>
          )}

          <SectionLabel>{tk('checkoutRulesSection')}</SectionLabel>
          <FieldRow label={tk('orderDiscountLabel')}>
            <Switch checked={channelForm.discountEnabled} onCheckedChange={v => setField('discountEnabled', v)} />
          </FieldRow>

          {channelForm.discountEnabled && (
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-5">
                <Field label={tk('discountTypeLabel')}>
                  <SelectInput
                    value={channelForm.discountType}
                    onChange={v => setField('discountType', v)}
                    className="w-full"
                    options={[
                      { label: tk('percentageDiscountOption'), value: 'PERCENTAGE' },
                      { label: tk('fixedAmountDiscountOption'), value: 'FIXED' },
                    ]}
                  />
                </Field>
              </div>
              <div className="col-span-7">
                <Field
                  label={tk('discountValueLabel')}
                  required
                  error={errors.discountValue}
                  hint={channelForm.discountType === 'PERCENTAGE' ? tk('discountValuePercentHint') : tk('discountValueFixedHint')}
                >
                  <NumberInput value={channelForm.discountValue ?? NaN} onChange={v => setField('discountValue', v)} min={0} className="w-full" />
                </Field>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* 外卖平台配置弹窗 */}
      <Modal
        open={deliveryModalVisible}
        onOpenChange={v => !v && setDeliveryModalVisible(false)}
        title={t('pages.orderConfig.configurePlatformTitle', { name: editingDelivery?.sourceName ?? '' })}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setDeliveryModalVisible(false)}>{tk('cancel')}</Btn>
            <Btn variant="primary" loading={saving} onClick={handleDeliverySave}>{tk('confirm')}</Btn>
          </>
        }
      >
        <div className="space-y-4">
          <FieldRow label={tk('enabledStatusLabel')}>
            <Switch checked={deliveryActive} onCheckedChange={setDeliveryActive} />
          </FieldRow>
          <Field label={tk('platformCommissionRateLabel')} hint={tk('platformCommissionRateHint')}>
            <NumberInput value={deliveryCommission ?? NaN} onChange={setDeliveryCommission} min={0} max={100} suffix="%" className="w-full" />
          </Field>
        </div>
      </Modal>

      {/* 成员管理弹窗 */}
      <Modal
        open={!!memberModalChannel}
        onOpenChange={v => !v && (setMemberModalChannel(null), setMembers([]))}
        title={t('pages.orderConfig.memberManagementModalTitle', { name: memberModalChannel?.sourceName ?? '' })}
        size="lg"
      >
        <div className="space-y-4">
          {/* 添加成员 */}
          {canEdit && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextInput value={memberPhone} onChange={setMemberPhone} placeholder={tk('memberPhonePlaceholder')} />
              </div>
              <div className="w-28">
                <TextInput value={memberName} onChange={setMemberName} placeholder={tk('memberNamePlaceholder')} />
              </div>
              <div className="w-28">
                <TextInput value={memberNote} onChange={setMemberNote} placeholder={tk('memberNotePlaceholder')} />
              </div>
              <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} loading={addingMember} onClick={handleAddMember}>{tk('addBtn')}</Btn>
            </div>
          )}

          {/* 成员列表 */}
          {membersLoading ? (
            <Spinner />
          ) : (
            <Table
              columns={[
                { key: 'phone', title: tk('phoneColumn'), render: (m: ChannelMember) => m.phone },
                { key: 'name', title: tk('nameColumn'), render: (m: ChannelMember) => m.name || '-' },
                { key: 'note', title: tk('noteColumn'), render: (m: ChannelMember) => m.note || '-' },
                {
                  key: 'isActive', title: tk('status'),
                  render: (m: ChannelMember) => (
                    <SwitchOrStatus
                      checked={m.isActive}
                      editable={canEdit}
                      onCheckedChange={c => handleToggleMember(m, c)}
                      onLabel={tk('active')}
                      offLabel={tk('inactive')}
                    />
                  ),
                },
                {
                  key: 'actions', title: tk('actions'),
                  render: (m: ChannelMember) => !canEdit ? null : (
                    <Btn variant="ghost" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setRemoveMemberTarget(m)}>{tk('removeBtn')}</Btn>
                  ),
                },
              ]}
              data={members}
              rowKey={(m: ChannelMember) => m.id}
              empty={tk('noMembersHint')}
            />
          )}
        </div>
      </Modal>

      {/* 删除渠道确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={v => !v && setDeleteTarget(null)}
        title={tk('deleteConfirm')}
        description={tk('deleteWarning')}
        confirmText={tk('confirm')}
        cancelText={tk('cancel')}
        danger
        loading={saving}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
      />

      {/* 移除成员确认 */}
      <ConfirmDialog
        open={!!removeMemberTarget}
        onOpenChange={v => !v && setRemoveMemberTarget(null)}
        title={tk('confirmRemoveMemberTitle')}
        confirmText={tk('removeBtn')}
        danger
        onConfirm={() => removeMemberTarget && handleRemoveMember(removeMemberTarget)}
      />
    </div>
  )
}

// 弹窗内小节标题
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-2 pt-1">
    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{children}</span>
    <span className="flex-1 h-px bg-slate-100" />
  </div>
)

// 弹窗内左右布局行
const FieldRow: React.FC<{ label: React.ReactNode; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    {children}
  </div>
)

// 外卖平台卡片外壳样式
function clsxCard(active: boolean) {
  return `rounded-xl border overflow-hidden transition-all ${active ? 'border-slate-200' : 'border-slate-200 opacity-60'}`
}

export default ChannelManagement
