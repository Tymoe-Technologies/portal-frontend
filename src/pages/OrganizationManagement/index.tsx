import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import '../../styles/phone-input.css'
import {
  Plus, Pencil, Trash2, Search, RefreshCw, Store, GitBranch, Crown,
  Upload as UploadIcon, Loader2, Globe, Copy, Building2,
} from 'lucide-react'
import {
  Btn, SectionCard, Table, type Column, Tabs, SelectInput, TextInput, Textarea,
  Field, AlertBox, Badge, EmptyState, Checkbox, ConfirmDialog, Modal, toast,
} from '@/components/ui-kit'
import { useAuthContext } from '../../auth/AuthProvider'
import {
  getOrganizations,
  createOrganization,
  updateOrganization,
  uploadOrgLogo,
  deleteOrgLogo,
  type Organization,
  type CreateOrganizationPayload,
  type GetOrganizationsParams
} from '../../services/auth'
import AddressAutocomplete from '../../components/AddressAutocomplete'
import tzlookup from 'tz-lookup'
import type { AddressSuggestion } from '../../services/address'
import './OrganizationManagement.css'

// ============ 营业时间编辑器 ============

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const WEEKDAY_LABELS: Record<string, string> = {
  monday: '周一', tuesday: '周二', wednesday: '周三', thursday: '周四',
  friday: '周五', saturday: '周六', sunday: '周日',
}

interface DayPeriod { open: string; close: string; nextDay?: boolean }
interface DayHours { closed: boolean; periods: DayPeriod[] }
interface BusinessHours { monday: DayHours; tuesday: DayHours; wednesday: DayHours; thursday: DayHours; friday: DayHours; saturday: DayHours; sunday: DayHours }

// 营业时间本地状态直接用 "HH:mm" 字符串（原生 time input），无需 dayjs
interface PeriodState { open: string; close: string; nextDay: boolean }
interface DayState { closed: boolean; periods: PeriodState[] }

const DEFAULT_DAY: DayHours = { closed: false, periods: [{ open: '09:00', close: '22:00' }] }
const DEFAULT_PERIOD: PeriodState = { open: '09:00', close: '22:00', nextDay: false }

function normalizeDayHours(raw: any): DayHours {
  if (!raw) return { ...DEFAULT_DAY }
  if (Array.isArray(raw.periods)) return raw as DayHours
  return { closed: raw.closed === true, periods: [{ open: raw.open || '09:00', close: raw.close || '22:00' }] }
}

function toDayState(hours: DayHours): DayState {
  return { closed: hours.closed, periods: hours.periods.map(p => ({ open: p.open || '09:00', close: p.close || '22:00', nextDay: p.nextDay ?? false })) }
}

function fromDayState(state: DayState): DayHours {
  return { closed: state.closed, periods: state.periods.map(p => ({ open: p.open || '09:00', close: p.close || '22:00', ...(p.nextDay ? { nextDay: true } : {}) })) }
}

function DayEditor({ day, state, onChange, onCopy }: { day: string; state: DayState; onChange: (s: DayState) => void; onCopy: () => void }) {
  const setPeriod = (i: number, patch: Partial<PeriodState>) => {
    const periods = state.periods.map((p, idx) => idx === i ? { ...p, ...patch } : p)
    onChange({ ...state, periods })
  }
  const addPeriod = () => onChange({ ...state, periods: [...state.periods, { ...DEFAULT_PERIOD }] })
  const removePeriod = (i: number) => onChange({ ...state, periods: state.periods.filter((_, idx) => idx !== i) })

  return (
    <div className="flex items-start gap-3 mb-3">
      <span className="w-14 shrink-0 text-sm font-semibold text-slate-700 leading-8">{WEEKDAY_LABELS[day]}</span>
      <div className="w-20 shrink-0 leading-8">
        <Checkbox checked={state.closed} onCheckedChange={v => onChange({ ...state, closed: v })} label="休息" />
      </div>
      <div className="flex-1 min-w-0">
        {state.closed ? (
          <span className="text-sm text-slate-400 leading-8">全天休息</span>
        ) : (
          <div className="flex flex-col gap-1.5">
            {state.periods.map((period, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1.5">
                <input
                  type="time"
                  value={period.open}
                  onChange={e => setPeriod(i, { open: e.target.value })}
                  className="text-sm bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
                />
                <span className="text-slate-400">—</span>
                <input
                  type="time"
                  value={period.close}
                  onChange={e => setPeriod(i, { close: e.target.value })}
                  className="text-sm bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
                />
                <span title="结束时间是次日（跨午夜）">
                  <Checkbox checked={period.nextDay} onCheckedChange={v => setPeriod(i, { nextDay: v })} label="次日" />
                </span>
                {state.periods.length > 1 && (
                  <Btn variant="ghost" size="sm" icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />} onClick={() => removePeriod(i)} />
                )}
              </div>
            ))}
            <div className="mt-0.5">
              <Btn variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={addPeriod}>加一段</Btn>
            </div>
          </div>
        )}
      </div>
      <div className="shrink-0 mt-0.5">
        <Btn variant="secondary" size="sm" icon={<Copy className="w-3.5 h-3.5" />} onClick={onCopy}>复制到其他天</Btn>
      </div>
    </div>
  )
}

// ============ 时区选择器 ============

// 生成完整 IANA 时区列表，按区域分组 + 可搜索城市名
const buildTimezoneOptions = (): { value: string; label: string }[] => {
  // 常用时区置顶
  const popular = new Set([
    'America/Toronto', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg',
    'America/Halifax', 'America/St_Johns', 'America/New_York', 'America/Chicago',
    'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage',
    'Pacific/Honolulu', 'Asia/Shanghai', 'Asia/Tokyo', 'Europe/London', 'Europe/Paris',
    'Australia/Sydney',
  ])

  const getUtcOffset = (tz: string) => {
    try {
      const now = new Date()
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(now)
      const offsetStr = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT'
      // "GMT+8" → +8, "GMT-5" → -5, "GMT" → 0
      const match = offsetStr.match(/([+-]?\d+(?::\d+)?)$/)
      if (!match) return 0
      const [h, m] = match[1].split(':').map(Number)
      return h + (m || 0) / 60
    } catch { return 0 }
  }

  const fmtOffset = (tz: string) => {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date())
      return parts.find(p => p.type === 'timeZoneName')?.value || 'UTC'
    } catch { return 'UTC' }
  }

  let allTz: string[]
  try {
    allTz = Intl.supportedValuesOf('timeZone')
  } catch {
    allTz = [...popular]
  }

  const sorted = allTz
    .map(tz => ({
      value: tz,
      label: `${tz.replace(/_/g, ' ')} (${fmtOffset(tz)})`,
      offset: getUtcOffset(tz),
      isPopular: popular.has(tz),
    }))
    .sort((a, b) => {
      if (a.isPopular !== b.isPopular) return a.isPopular ? -1 : 1
      return a.offset - b.offset
    })

  return sorted.map(({ value, label }) => ({ value, label }))
}

const TIMEZONE_OPTIONS = buildTimezoneOptions()

interface OrganizationFormData {
  orgName: string
  orgType: 'MAIN' | 'BRANCH' | 'FRANCHISE'
  parentOrgId?: string | null
  description?: string
  location?: string
  street?: string
  unit?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
  latitude?: number
  longitude?: number
  phone?: string
  email?: string
  timezone?: string
}

const EMPTY_FORM: OrganizationFormData = {
  orgName: '',
  orgType: 'MAIN',
  parentOrgId: null,
  description: '',
  location: '',
  street: '',
  unit: '',
  city: '',
  province: '',
  postalCode: '',
  country: '',
  latitude: undefined,
  longitude: undefined,
  phone: '',
  email: '',
  timezone: undefined,
}

type FormErrors = Partial<Record<keyof OrganizationFormData, string>>

const OrganizationManagement: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated, updateOrganizations: updateAuthOrganizations } = useAuthContext()

  // 表单状态（受控，手写校验）
  const [form, setForm] = useState<OrganizationFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const setField = <K extends keyof OrganizationFormData>(key: K, value: OrganizationFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  // 状态管理
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [filteredOrganizations, setFilteredOrganizations] = useState<Organization[]>([])

  // 模态框状态
  const [modalVisible, setModalVisible] = useState(false)
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [activeTab, setActiveTab] = useState('basic')

  // 搜索和筛选状态
  const [searchQuery, setSearchQuery] = useState('')
  const [orgTypeFilter, setOrgTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE')

  // 地址相关状态
  const [selectedAddress, setSelectedAddress] = useState<AddressSuggestion | null>(null)

  // Logo 上传状态
  const [logoUploading, setLogoUploading] = useState(false)
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null)
  const logoInputRef = React.useRef<HTMLInputElement>(null)

  // 删除确认状态（替代 Modal.confirm）
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null)
  const [logoDeleteConfirm, setLogoDeleteConfirm] = useState(false)

  // 营业时间本地状态（脱离表单管理，方便动态增删时间段）
  const initDayStates = (): Record<string, DayState> =>
    Object.fromEntries(WEEKDAYS.map(d => [d, toDayState(DEFAULT_DAY)]))
  const [dayStates, setDayStates] = useState<Record<string, DayState>>(initDayStates)

  // 初始化数据
  useEffect(() => {
    if (isAuthenticated) {
      loadOrganizations()
    }
  }, [isAuthenticated])

  // 筛选组织列表
  useEffect(() => {
    let filtered = organizations

    // 按搜索关键词筛选
    if (searchQuery) {
      filtered = filtered.filter(org =>
        org.orgName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.location?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // 按组织类型筛选
    if (orgTypeFilter) {
      filtered = filtered.filter(org => org.orgType === orgTypeFilter)
    }

    // 按状态筛选
    if (statusFilter) {
      filtered = filtered.filter(org => org.status === statusFilter)
    }

    setFilteredOrganizations(filtered)
  }, [organizations, searchQuery, orgTypeFilter, statusFilter])

  // 加载组织列表
  const loadOrganizations = async () => {
    setLoading(true)
    try {
      const params: GetOrganizationsParams = {
        status: 'ACTIVE' // 默认只显示活跃的组织
      }

      console.log('🔍 [ORG MANAGEMENT] Loading organizations with params:', params)
      const orgList = await getOrganizations(params, 'beverage')
      console.log('🔍 [ORG MANAGEMENT] Loaded organizations:', orgList)
      setOrganizations(orgList)

      // 同步到 AuthProvider
      updateAuthOrganizations(orgList)
      console.log('✅ [ORG MANAGEMENT] Updated AuthProvider organizations:', orgList.length)

      if (orgList.length > 0) {
        // 自动设置第一个组织为当前组织
        localStorage.setItem('organization_id', orgList[0].id)
        console.log('✅ [ORG MANAGEMENT] Set organization ID:', orgList[0].id)
      } else {
        console.log('⚠️ [ORG MANAGEMENT] No organizations found')
      }
    } catch (error) {
      console.error('Failed to load organizations:', error)
      toast.error(t('organization.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 创建组织
  const handleCreate = () => {
    setEditingOrg(null)
    setForm({ ...EMPTY_FORM })
    setErrors({})
    setSelectedAddress(null)
    setCurrentLogoUrl(null)
    setDayStates(initDayStates())
    setActiveTab('basic')
    setModalVisible(true)
  }

  // 编辑组织
  const handleEdit = (org: Organization) => {
    setEditingOrg(org)
    setErrors({})
    setActiveTab('basic')
    // 加载已有营业时间
    const bh = (org as any).businessHours as BusinessHours | null
    if (bh) {
      const states: Record<string, DayState> = {}
      for (const day of WEEKDAYS) {
        states[day] = toDayState(normalizeDayHours((bh as any)[day]))
      }
      setDayStates(states)
    } else {
      setDayStates(initDayStates())
    }
    setForm({
      orgName: org.orgName,
      orgType: org.orgType,
      parentOrgId: org.parentOrgId,
      description: org.description || '',
      location: org.location || '',
      street: org.street || '',
      unit: (org as any).unit || '',
      city: org.city || '',
      province: org.province || '',
      postalCode: org.postalCode || '',
      country: org.country || '',
      latitude: org.latitude,
      longitude: org.longitude,
      phone: org.phone || '',
      email: org.email || '',
      timezone: org.timezone || undefined
    })
    setSelectedAddress(null)
    setCurrentLogoUrl((org.themeSettings as any)?.logoUrl || null)
    setModalVisible(true)
  }

  // 删除组织（确认后执行）
  const handleDeleteConfirm = async () => {
    if (!deletingOrg) return
    try {
      // TODO: 实现删除组织API
      toast.success(t('organization.deleteSuccess'))
      setDeletingOrg(null)
      loadOrganizations()
    } catch (error) {
      console.error('Failed to delete organization:', error)
      toast.error(t('organization.deleteFailed'))
    }
  }

  // 校验表单
  const validate = (): boolean => {
    const next: FormErrors = {}
    const name = form.orgName?.trim()
    if (!name) {
      next.orgName = t('organization.orgNameRequired')
    } else if (name.length < 2 || name.length > 100) {
      next.orgName = '组织名称长度为2-100字符'
    }
    if (!form.orgType) {
      next.orgType = t('organization.orgTypeRequired')
    }
    const isMainOrg = form.orgType === 'MAIN'
    if (!isMainOrg && !form.parentOrgId) {
      next.parentOrgId = t('organization.parentOrgRequired')
    }
    const phone = form.phone?.trim()
    if (!phone) {
      next.phone = t('organization.phoneRequired')
    } else if (!/^\+[1-9]\d{1,14}$/.test(phone)) {
      next.phone = t('organization.phoneInvalid')
    }
    const email = form.email?.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = t('organization.emailInvalid')
    }
    const location = form.location?.trim()
    if (!location) {
      next.location = t('organization.locationRequired')
    } else if (location.length < 5) {
      next.location = t('organization.locationMinLength')
    }
    setErrors(next)
    // 若地址信息校验失败，切换到地址标签方便用户查看
    if (next.location && !next.orgName && !next.orgType && !next.parentOrgId && !next.phone && !next.email) {
      setActiveTab('address')
    } else if (next.orgName || next.orgType || next.parentOrgId || next.phone || next.email) {
      setActiveTab('basic')
    }
    return Object.keys(next).length === 0
  }

  // 提交表单
  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      const values = form
      // 从本地状态构建营业时间 JSON
      const businessHoursData: BusinessHours = {} as BusinessHours
      for (const day of WEEKDAYS) {
        (businessHoursData as any)[day] = fromDayState(dayStates[day])
      }

      if (editingOrg) {
        // 更新组织
        const updatePayload: any = {
          orgName: values.orgName?.trim(),
          description: values.description?.trim() || undefined,
          location: values.location?.trim(),
          street: values.street?.trim(),
          unit: values.unit?.trim(),
          city: values.city?.trim(),
          province: values.province?.trim(),
          postalCode: values.postalCode?.trim(),
          country: values.country?.trim(),
          latitude: values.latitude,
          longitude: values.longitude,
          phone: values.phone?.trim(),
          email: values.email?.trim() || undefined,
          timezone: values.timezone?.trim() || undefined,
          businessHours: businessHoursData,
        }

        // 清理undefined值
        Object.keys(updatePayload).forEach(key => {
          if (updatePayload[key as keyof typeof updatePayload] === undefined) {
            delete updatePayload[key as keyof typeof updatePayload]
          }
        })

        console.log('📝 [FORM DEBUG] Update payload:', updatePayload)

        await updateOrganization(editingOrg.id, updatePayload, 'beverage')
        toast.success(t('organization.updateSuccess'))
      } else {
        // 创建组织
        const createPayload: CreateOrganizationPayload = {
          orgName: values.orgName?.trim(),
          orgType: values.orgType,
          parentOrgId: values.parentOrgId || null,
          description: values.description?.trim() || undefined,
          location: values.location?.trim(),
          street: values.street?.trim(),
          unit: values.unit?.trim(),
          city: values.city?.trim(),
          province: values.province?.trim(),
          postalCode: values.postalCode?.trim(),
          country: values.country?.trim(),
          latitude: values.latitude,
          longitude: values.longitude,
          phone: values.phone?.trim(),
          email: values.email?.trim() || undefined,
          timezone: values.timezone?.trim() || undefined,
          businessHours: businessHoursData,
        } as any

        // 清理undefined值
        Object.keys(createPayload).forEach(key => {
          if (createPayload[key as keyof CreateOrganizationPayload] === undefined) {
            delete createPayload[key as keyof CreateOrganizationPayload]
          }
        })

        console.log('📝 [FORM DEBUG] Form values:', values)
        console.log('📝 [FORM DEBUG] Cleaned payload:', createPayload)

        // 验证必填字段
        if (!createPayload.orgName || !createPayload.orgType) {
          throw new Error('组织名称和组织类型是必填项')
        }

        const newOrg = await createOrganization(createPayload, 'beverage')
        toast.success(t('organization.createSuccess'))

        console.log('✅ [ORG MANAGEMENT] Organization created:', newOrg)

        // 设置新创建的组织为当前组织
        localStorage.setItem('organization_id', newOrg.id)
        console.log('✅ [ORG MANAGEMENT] Set new organization ID:', newOrg.id)

        // 如果是第一个组织，跳转到仪表板
        if (organizations.length === 0) {
          setTimeout(() => {
            navigate('/dashboard')
          }, 1000) // 延迟1秒让用户看到成功消息
        }
      }

      setModalVisible(false)
      loadOrganizations()
    } catch (error: any) {
      console.error('Failed to save organization:', error)
      const errorMessage = error?.response?.data?.detail || error.message || (editingOrg ? t('organization.updateFailed') : t('organization.createFailed'))
      toast.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  // 获取可选的父组织列表（用于BRANCH和FRANCHISE类型）
  const getAvailableParentOrgs = () => {
    return organizations.filter(org => org.orgType === 'MAIN')
  }

  // 从 Mapbox context 中提取字段值
  const getContextValue = (context: Array<{ id: string; text: string }> | undefined, prefix: string): string => {
    if (!context) return ''
    const item = context.find(c => c.id.startsWith(prefix))
    return item?.text || ''
  }

  // 处理地址选择
  const handleAddressSelect = (address: AddressSuggestion) => {
    setSelectedAddress(address)
    console.log('📍 选中地址:', {
      display_name: address.display_name,
      coordinates: `${address.lat}, ${address.lon}`,
      place_id: address.place_id,
      context: address.context
    })

    // 从 Mapbox context 解析结构化地址
    const houseNumber = address.address || ''
    const streetName = address.text || ''
    const street = houseNumber ? `${houseNumber} ${streetName}` : streetName
    const city = getContextValue(address.context, 'place')
    const province = getContextValue(address.context, 'region')
    const postalCode = getContextValue(address.context, 'postcode')
    const country = getContextValue(address.context, 'country')

    // 根据经纬度自动推导门店时区
    const lat = parseFloat(address.lat)
    const lng = parseFloat(address.lon)
    let detectedTz: string | undefined
    try {
      detectedTz = tzlookup(lat, lng)
    } catch {
      // 坐标超出范围（如南极），忽略
    }

    // 自动填充结构化地址字段、经纬度和时区
    setForm(prev => ({
      ...prev,
      location: address.display_name,
      street, city, province, postalCode, country,
      latitude: lat,
      longitude: lng,
      ...(detectedTz ? { timezone: detectedTz } : {}),
    }))
    setErrors(prev => ({ ...prev, location: undefined }))
    if (detectedTz) {
      toast.info(`已自动识别时区：${detectedTz}`)
    }
  }

  // Logo 上传
  const handleLogoUpload = async (file: File) => {
    if (!editingOrg) return
    const isValid = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    if (!isValid) {
      toast.error('Only JPG, PNG, or WebP images are allowed')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB')
      return
    }

    setLogoUploading(true)
    try {
      const { logoUrl } = await uploadOrgLogo(editingOrg.id, file)
      setCurrentLogoUrl(logoUrl)
      toast.success('Logo uploaded successfully')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to upload logo')
    } finally {
      setLogoUploading(false)
    }
  }

  // Logo 删除（确认后执行）
  const handleLogoDeleteConfirm = async () => {
    if (!editingOrg) return
    try {
      await deleteOrgLogo(editingOrg.id)
      setCurrentLogoUrl(null)
      toast.success('Logo deleted')
      setLogoDeleteConfirm(false)
      loadOrganizations()
    } catch {
      toast.error('Failed to delete logo')
    }
  }

  // 获取组织类型图标
  const getOrgTypeIcon = (orgType: string) => {
    switch (orgType) {
      case 'MAIN':
        return <Crown className="w-4 h-4 text-amber-500" />
      case 'BRANCH':
        return <GitBranch className="w-4 h-4 text-green-600" />
      case 'FRANCHISE':
        return <Store className="w-4 h-4 text-blue-600" />
      default:
        return <Store className="w-4 h-4 text-slate-400" />
    }
  }

  // 获取组织类型标签
  const getOrgTypeTag = (orgType: string) => {
    const configs = {
      MAIN: { variant: 'gold' as const, text: t('organization.typeMain') },
      BRANCH: { variant: 'green' as const, text: t('organization.typeBranch') },
      FRANCHISE: { variant: 'blue' as const, text: t('organization.typeFranchise') }
    }
    const config = configs[orgType as keyof typeof configs]
    if (!config) return null
    return <Badge variant={config.variant}>{config.text}</Badge>
  }

  // 表格列定义
  const columns: Column<Organization>[] = [
    {
      key: 'orgName',
      title: t('organization.orgName'),
      width: 200,
      render: (record) => (
        <div className="flex items-center gap-2">
          {getOrgTypeIcon(record.orgType)}
          <span>{record.orgName}</span>
        </div>
      )
    },
    {
      key: 'orgType',
      title: t('organization.orgType'),
      width: 100,
      render: (record) => getOrgTypeTag(record.orgType)
    },
    {
      key: 'parentOrgName',
      title: t('organization.parentOrg'),
      width: 150,
      render: (record) => (record as any).parentOrgName || '-'
    },
    {
      key: 'description',
      title: t('organization.description'),
      width: 200,
      render: (record) => <span className="truncate block max-w-[200px]" title={record.description}>{record.description || '-'}</span>
    },
    {
      key: 'location',
      title: t('organization.location'),
      width: 200,
      render: (record) => <span className="truncate block max-w-[200px]" title={record.location}>{record.location || '-'}</span>
    },
    {
      key: 'phone',
      title: t('organization.phone'),
      width: 150,
      render: (record) => record.phone || '-'
    },
    {
      key: 'email',
      title: t('organization.email'),
      width: 180,
      render: (record) => <span className="truncate block max-w-[180px]" title={record.email}>{record.email || '-'}</span>
    },
    {
      key: 'status',
      title: t('organization.status'),
      width: 100,
      render: (record) => {
        const variants: Record<string, 'green' | 'gold' | 'red'> = {
          ACTIVE: 'green',
          SUSPENDED: 'gold',
          DELETED: 'red'
        }
        const labels = {
          ACTIVE: t('organization.statusActive'),
          SUSPENDED: t('organization.statusInactive'),
          DELETED: t('organization.statusInactive')
        }
        const status = record.status as keyof typeof labels
        return <Badge variant={variants[status] || 'default'}>{labels[status]}</Badge>
      }
    },
    {
      key: 'createdAt',
      title: t('organization.createdAt'),
      width: 180,
      render: (record) => record.createdAt ? new Date(record.createdAt).toLocaleString() : '-'
    },
    {
      key: 'actions',
      title: t('organization.actions'),
      width: 160,
      render: (record) => (
        <div className="flex items-center gap-1">
          <Btn
            variant="link"
            size="sm"
            icon={<Pencil className="w-3.5 h-3.5" />}
            onClick={() => handleEdit(record)}
          >
            {t('organization.edit')}
          </Btn>
          <Btn
            variant="link"
            size="sm"
            icon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => setDeletingOrg(record)}
            disabled={record.orgType === 'MAIN'} // 主店不能删除
            className="text-red-500! hover:text-red-600!"
          >
            {t('organization.delete')}
          </Btn>
        </div>
      )
    }
  ]

  if (!isAuthenticated) {
    return (
      <div className="p-6 text-center">
        <span className="text-slate-600">请先登录以使用组织管理功能</span>
      </div>
    )
  }

  const isMainOrg = form.orgType === 'MAIN'

  const tabItems = [
    { key: 'basic', label: '基本信息' },
    { key: 'address', label: '地址信息' },
    { key: 'hours', label: '营业时间' },
  ]

  return (
    <div className="p-6">
      <SectionCard>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">{t('organization.title')}</h2>

        {/* 说明信息 */}
        <div className="mb-6">
          <AlertBox
            type="info"
            title={t('organization.infoTitle')}
            description={
              <div>
                <p className="mb-3 font-medium text-blue-600">
                  📍 {t('organization.organizationConcept')}
                </p>
                <p>• <strong>{t('organization.typeMain')}</strong>: {t('organization.infoMain')}</p>
                <p>• <strong>{t('organization.typeBranch')}</strong>: {t('organization.infoBranch')}</p>
                <p>• <strong>{t('organization.typeFranchise')}</strong>: {t('organization.infoFranchise')}</p>
              </div>
            }
          />
        </div>

        {/* 搜索和操作栏 */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative w-64 max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('organization.search')}
              className="w-full text-sm bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-700 placeholder:text-slate-400 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
            />
          </div>
          <div className="w-44">
            <SelectInput
              value={orgTypeFilter}
              onChange={setOrgTypeFilter}
              placeholder={t('organization.orgType')}
              className="w-full"
              options={[
                { label: t('organization.orgType'), value: '' },
                { label: t('organization.typeMain'), value: 'MAIN' },
                { label: t('organization.typeBranch'), value: 'BRANCH' },
                { label: t('organization.typeFranchise'), value: 'FRANCHISE' },
              ]}
            />
          </div>
          <div className="w-44">
            <SelectInput
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder={t('organization.status')}
              className="w-full"
              options={[
                { label: t('organization.status'), value: '' },
                { label: t('organization.statusActive'), value: 'ACTIVE' },
                { label: t('organization.statusInactive'), value: 'SUSPENDED' },
              ]}
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Btn
              variant="secondary"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={loadOrganizations}
              loading={loading}
            >
              {t('organization.refresh')}
            </Btn>
            <Btn
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={handleCreate}
            >
              {t('organization.create')}
            </Btn>
          </div>
        </div>

        {/* 组织表格 */}
        {filteredOrganizations.length > 0 ? (
          <Table
            columns={columns}
            data={filteredOrganizations}
            rowKey={(row) => row.id}
            loading={loading}
          />
        ) : organizations.length === 0 ? (
          // 真的没有任何组织
          <EmptyState
            icon={<Building2 className="w-12 h-12" />}
            title={t('organization.emptyTitle')}
            description={t('organization.emptyDescription')}
            action={
              <div className="flex flex-col items-center gap-3">
                <Btn
                  variant="primary"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={handleCreate}
                >
                  {t('organization.emptyButton')}
                </Btn>
                <span className="text-xs text-slate-400">
                  {t('organization.emptyTip')}
                </span>
              </div>
            }
          />
        ) : (
          // 有组织但筛选后没有结果
          <EmptyState
            icon={<Search className="w-12 h-12" />}
            title={t('organization.noResultsTitle')}
            description={
              <>
                <span className="block">{t('organization.noResultsDescription')}</span>
                <span className="block mt-3">{t('organization.noResultsTotal', { count: organizations.length })}</span>
              </>
            }
            action={
              <div className="flex items-center gap-2">
                <Btn
                  variant="secondary"
                  onClick={() => {
                    setSearchQuery('')
                    setOrgTypeFilter('')
                    setStatusFilter('ACTIVE')
                  }}
                >
                  {t('organization.clearFilters')}
                </Btn>
                <Btn
                  variant="primary"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={handleCreate}
                >
                  {t('organization.createNew')}
                </Btn>
              </div>
            }
          />
        )}
      </SectionCard>

      {/* 创建/编辑组织模态框 */}
      <Modal
        title={editingOrg ? t('organization.edit') : t('organization.create')}
        open={modalVisible}
        onOpenChange={setModalVisible}
        size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setModalVisible(false)}>
              {t('organization.cancel')}
            </Btn>
            <Btn variant="primary" loading={submitting} onClick={handleSubmit}>
              {t('organization.save')}
            </Btn>
          </>
        }
      >
        <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} />

        <div className="mt-4">
          {/* 基本信息 */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <Field label={t('organization.orgName')} required error={errors.orgName}>
                <TextInput
                  value={form.orgName}
                  onChange={v => setField('orgName', v)}
                  placeholder={t('organization.orgNamePlaceholder')}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label={t('organization.orgType')} required error={errors.orgType}>
                  <SelectInput
                    value={form.orgType}
                    onChange={(v) => {
                      setField('orgType', v as OrganizationFormData['orgType'])
                      if (v === 'MAIN') setField('parentOrgId', null)
                    }}
                    disabled={!!editingOrg}
                    placeholder={t('organization.orgTypeRequired')}
                    className="w-full"
                    options={[
                      { label: t('organization.typeMain'), value: 'MAIN' },
                      { label: t('organization.typeBranch'), value: 'BRANCH' },
                      { label: t('organization.typeFranchise'), value: 'FRANCHISE' },
                    ]}
                  />
                </Field>
                <Field label={t('organization.parentOrg')} required={!isMainOrg} error={errors.parentOrgId}>
                  <SelectInput
                    value={form.parentOrgId || ''}
                    onChange={(v) => setField('parentOrgId', v || null)}
                    disabled={isMainOrg || !!editingOrg}
                    placeholder={isMainOrg ? t('organization.parentOrgPlaceholderMain') : t('organization.parentOrgPlaceholder')}
                    className="w-full"
                    options={[
                      { label: isMainOrg ? t('organization.parentOrgPlaceholderMain') : t('organization.parentOrgPlaceholder'), value: '' },
                      ...getAvailableParentOrgs().map(org => ({ label: org.orgName, value: org.id })),
                    ]}
                  />
                </Field>
              </div>

              <Field label={t('organization.description')}>
                <Textarea
                  value={form.description || ''}
                  onChange={v => setField('description', v)}
                  rows={2}
                  placeholder={t('organization.descriptionPlaceholder')}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label={t('organization.phone')} required hint={t('organization.phoneTooltip')} error={errors.phone}>
                  <PhoneInput
                    international
                    countryCallingCodeEditable={false}
                    defaultCountry="CA"
                    placeholder={t('organization.phonePlaceholder')}
                    className="PhoneInput"
                    value={form.phone || undefined}
                    onChange={(val) => setField('phone', val || '')}
                  />
                </Field>
                <Field label={t('organization.email')} error={errors.email}>
                  <TextInput
                    value={form.email || ''}
                    onChange={v => setField('email', v)}
                    placeholder={t('organization.emailPlaceholder')}
                  />
                </Field>
              </div>

              {/* Logo 上传（仅编辑 MAIN 组织时显示） */}
              {editingOrg && editingOrg.orgType === 'MAIN' && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">Logo</label>
                  <div className="flex items-center gap-4">
                    {currentLogoUrl ? (
                      <img
                        src={currentLogoUrl}
                        alt="Logo"
                        className="w-20 h-20 object-contain rounded-lg border border-slate-200"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs">
                        No Logo
                      </div>
                    )}
                    <div className="flex flex-col items-start gap-1">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) handleLogoUpload(f)
                          e.target.value = ''
                        }}
                      />
                      <Btn
                        variant="secondary"
                        size="sm"
                        icon={logoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadIcon className="w-3.5 h-3.5" />}
                        disabled={logoUploading}
                        onClick={() => logoInputRef.current?.click()}
                      >
                        {logoUploading ? 'Uploading...' : currentLogoUrl ? 'Change' : 'Upload'}
                      </Btn>
                      {currentLogoUrl && (
                        <Btn variant="link" size="sm" onClick={() => setLogoDeleteConfirm(true)} className="text-red-500! hover:text-red-600! px-0!">
                          删除 Logo
                        </Btn>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 子店/加盟店显示继承的 logo */}
              {editingOrg && editingOrg.orgType !== 'MAIN' && (() => {
                const parentOrg = organizations.find(o => o.id === editingOrg.parentOrgId)
                const parentLogo = (parentOrg?.themeSettings as any)?.logoUrl
                if (!parentLogo) return null
                return (
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Logo</label>
                    <div className="flex items-center gap-4">
                      <img
                        src={parentLogo}
                        alt="Logo"
                        className="w-20 h-20 object-contain rounded-lg border border-slate-200"
                      />
                      <Badge variant="blue">继承自 {parentOrg?.orgName}</Badge>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* 地址信息 */}
          {activeTab === 'address' && (
            <div className="space-y-4">
              <Field label={t('organization.location')} required error={errors.location}>
                <AddressAutocomplete
                  value={form.location || ''}
                  placeholder={t('organization.locationPlaceholder')}
                  onChange={(v) => setField('location', v)}
                  onSelect={handleAddressSelect}
                />
              </Field>

              {selectedAddress && (
                <AlertBox
                  type="success"
                  title={selectedAddress.display_name}
                  description={t('organization.coordinates', { lat: Number(selectedAddress.lat).toFixed(5), lon: Number(selectedAddress.lon).toFixed(5) })}
                />
              )}

              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-5">
                  <Field label="Street">
                    <TextInput value={form.street || ''} onChange={v => setField('street', v)} placeholder="e.g. 1696 Robson St" />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="Unit">
                    <TextInput value={form.unit || ''} onChange={v => setField('unit', v)} placeholder="e.g. 105" />
                  </Field>
                </div>
                <div className="col-span-5">
                  <Field label="City">
                    <TextInput value={form.city || ''} onChange={v => setField('city', v)} placeholder="e.g. Vancouver" />
                  </Field>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Province / State">
                  <TextInput value={form.province || ''} onChange={v => setField('province', v)} placeholder="e.g. BC" />
                </Field>
                <Field label="Postal Code">
                  <TextInput value={form.postalCode || ''} onChange={v => setField('postalCode', v)} placeholder="e.g. V6G 1C7" />
                </Field>
                <Field label="Country">
                  <TextInput value={form.country || ''} onChange={v => setField('country', v)} placeholder="e.g. Canada" />
                </Field>
              </div>

              <Field
                label={
                  <span className="inline-flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    {t('organization.timezone', '门店时区')}
                  </span>
                }
                hint={t('organization.timezoneTooltip', '设置门店所在时区，用于订单时间、营业日和报表的正确展示。未设置时使用设备本地时区。')}
              >
                <SelectInput
                  value={form.timezone || ''}
                  onChange={(v) => setField('timezone', v || undefined)}
                  placeholder={t('organization.timezonePlaceholder', '选择门店时区')}
                  className="w-full"
                  options={[
                    { label: t('organization.timezonePlaceholder', '选择门店时区'), value: '' },
                    ...TIMEZONE_OPTIONS,
                  ]}
                />
              </Field>
            </div>
          )}

          {/* 营业时间 */}
          {activeTab === 'hours' && (
            <div>
              {WEEKDAYS.map(day => (
                <DayEditor
                  key={day}
                  day={day}
                  state={dayStates[day]}
                  onChange={s => setDayStates(prev => ({ ...prev, [day]: s }))}
                  onCopy={() => {
                    const source = dayStates[day]
                    setDayStates(prev => {
                      const next = { ...prev }
                      for (const d of WEEKDAYS) {
                        if (d !== day) next[d] = { ...source, periods: source.periods.map(p => ({ ...p })) }
                      }
                      return next
                    })
                    toast.success(`已将 ${WEEKDAY_LABELS[day]} 的营业时间复制到其他天`)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* 删除组织确认 */}
      <ConfirmDialog
        open={!!deletingOrg}
        onOpenChange={(v) => { if (!v) setDeletingOrg(null) }}
        title={t('organization.delete')}
        description={t('organization.deleteConfirm') + ' ' + t('organization.deleteWarning')}
        confirmText={t('organization.delete')}
        cancelText={t('organization.cancel')}
        danger
        onConfirm={handleDeleteConfirm}
      />

      {/* 删除 Logo 确认 */}
      <ConfirmDialog
        open={logoDeleteConfirm}
        onOpenChange={setLogoDeleteConfirm}
        title="Delete Logo"
        description="Are you sure you want to remove the logo?"
        danger
        onConfirm={handleLogoDeleteConfirm}
      />
    </div>
  )
}

export default OrganizationManagement
