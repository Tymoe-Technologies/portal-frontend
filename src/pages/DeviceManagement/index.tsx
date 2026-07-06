import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  RefreshCw,
  Smartphone,
  Monitor,
  Tablet,
  Info,
  Copy,
  Check,
  RotateCw,
} from 'lucide-react'
import {
  Btn,
  SectionCard,
  Table,
  Badge,
  Modal,
  ConfirmDialog,
  AlertBox,
  EmptyState,
  Field,
  TextInput,
  SelectInput,
  toast,
  type Column,
} from '@/components/ui-kit'
import { useAuthContext } from '../../auth/AuthProvider'
import {
  getDevices,
  createDevice,
  updateDevice,
  updateActivationCode,
  deleteDevice,
  getDeviceSession,
  type Device,
  type DeviceType,
  type DeviceStatus,
  type CreateDeviceRequest,
  type UpdateDeviceRequest,
  type UpdateActivationCodeRequest,
  type DeviceSessionResponse,
} from '../../services/device'
import { getOrganizations, type Organization } from '../../services/auth'

interface DeviceFormData {
  orgId: string
  deviceType: DeviceType | ''
  deviceName: string
}

interface DeviceFormErrors {
  orgId?: string
  deviceType?: string
  deviceName?: string
}

interface UpdateCodeFormData {
  orgId: string
  deviceType: DeviceType | ''
  currentActivationCode: string
  newDeviceName: string
}

interface UpdateCodeFormErrors {
  currentActivationCode?: string
}

// 新激活码信息（替代命令式 Modal.success）
interface NewCodeInfo {
  deviceId: string
  newActivationCode: string
}

const DeviceManagement: React.FC = () => {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuthContext()

  // 状态管理
  const [loading, setLoading] = useState(false)
  const [devices, setDevices] = useState<Device[]>([])
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])

  // 模态框状态
  const [modalVisible, setModalVisible] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [updateCodeModalVisible, setUpdateCodeModalVisible] = useState(false)
  const [updatingDevice, setUpdatingDevice] = useState<Device | null>(null)
  const [activationInfoModalVisible, setActivationInfoModalVisible] = useState(false)
  const [createdDeviceInfo, setCreatedDeviceInfo] = useState<Device | null>(null)
  const [sessionModalVisible, setSessionModalVisible] = useState(false)
  const [sessionInfo, setSessionInfo] = useState<DeviceSessionResponse['data'] | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)
  // 新激活码结果弹窗（替代命令式 Modal.success）
  const [newCodeInfo, setNewCodeInfo] = useState<NewCodeInfo | null>(null)
  // 删除确认弹窗
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null)

  // 表单状态（受控）
  const [form, setForm] = useState<DeviceFormData>({ orgId: '', deviceType: '', deviceName: '' })
  const [formErrors, setFormErrors] = useState<DeviceFormErrors>({})
  const [updateCodeForm, setUpdateCodeForm] = useState<UpdateCodeFormData>({
    orgId: '',
    deviceType: '',
    currentActivationCode: '',
    newDeviceName: '',
  })
  const [updateCodeErrors, setUpdateCodeErrors] = useState<UpdateCodeFormErrors>({})

  // 搜索和筛选状态
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrgId, setSelectedOrgId] = useState<string>(localStorage.getItem('organization_id') || '')
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<DeviceType | ''>('')
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | ''>('')

  // 复制状态
  const [copiedField, setCopiedField] = useState<string>('')

  // 初始化数据
  useEffect(() => {
    if (isAuthenticated) {
      loadOrganizations()
      // 如果已有选中的组织，立即加载设备
      const currentOrgId = localStorage.getItem('organization_id')
      if (currentOrgId) {
        setSelectedOrgId(currentOrgId)
      }
    }
  }, [isAuthenticated])

  // 当选择组织时加载设备
  useEffect(() => {
    if (selectedOrgId) {
      loadDevices()
    }
  }, [selectedOrgId])

  // 筛选设备列表
  useEffect(() => {
    let filtered = devices

    // 按搜索关键词筛选
    if (searchQuery) {
      filtered = filtered.filter(device =>
        device.deviceName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.id?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // 按设备类型筛选
    if (deviceTypeFilter) {
      filtered = filtered.filter(device => device.deviceType === deviceTypeFilter)
    }

    // 按状态筛选
    if (statusFilter) {
      filtered = filtered.filter(device => device.status === statusFilter)
    }

    setFilteredDevices(filtered)
  }, [devices, searchQuery, deviceTypeFilter, statusFilter])

  // 监听组织切换事件
  useEffect(() => {
    const handleOrganizationChange = (event: CustomEvent) => {
      console.log('🔄 [DEVICE MANAGEMENT] Organization changed, reloading data...', event.detail)
      const newOrgId = event.detail.orgId
      setSelectedOrgId(newOrgId)
    }

    window.addEventListener('organizationChanged', handleOrganizationChange as EventListener)

    return () => {
      window.removeEventListener('organizationChanged', handleOrganizationChange as EventListener)
    }
  }, [])

  // 加载组织列表
  const loadOrganizations = async () => {
    try {
      setLoading(true)
      const organizations = await getOrganizations({})
      setOrganizations(organizations || [])

      // 如果只有一个组织，自动选择
      if (organizations && organizations.length === 1) {
        setSelectedOrgId(organizations[0].id)
      }
    } catch (error: any) {
      console.error('Failed to load organizations:', error)
      toast.error(t('pages.devices.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 加载设备列表
  const loadDevices = async () => {
    if (!selectedOrgId) return

    try {
      setLoading(true)
      console.log('🔍 [DEVICE DEBUG] Loading devices for orgId:', selectedOrgId)
      const response = await getDevices({ orgId: selectedOrgId })
      console.log('✅ [DEVICE DEBUG] Devices loaded successfully:', response)
      setDevices(response.data || [])
      // 静默加载，不显示成功消息
    } catch (error: any) {
      console.error('❌ [DEVICE DEBUG] Failed to load devices:', {
        error,
        message: error.message,
        response: error.response,
        orgId: selectedOrgId,
      })
      toast.error(error.message || t('pages.devices.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 打开创建/编辑模态框
  const openModal = (device?: Device) => {
    setEditingDevice(device || null)
    setFormErrors({})
    if (device) {
      setForm({
        orgId: device.orgId,
        deviceType: device.deviceType,
        deviceName: device.deviceName,
      })
    } else {
      setForm({
        orgId: selectedOrgId || '',
        deviceType: '',
        deviceName: '',
      })
    }
    setModalVisible(true)
  }

  // 关闭模态框
  const closeModal = () => {
    setModalVisible(false)
    setEditingDevice(null)
    setForm({ orgId: '', deviceType: '', deviceName: '' })
    setFormErrors({})
  }

  // 打开更新激活码模态框
  const openUpdateCodeModal = (device: Device) => {
    setUpdatingDevice(device)
    setUpdateCodeForm({
      orgId: device.orgId,
      deviceType: device.deviceType,
      currentActivationCode: '',
      newDeviceName: device.deviceName || '',
    })
    setUpdateCodeErrors({})
    setUpdateCodeModalVisible(true)
  }

  // 关闭更新激活码模态框
  const closeUpdateCodeModal = () => {
    setUpdateCodeModalVisible(false)
    setUpdatingDevice(null)
    setUpdateCodeForm({ orgId: '', deviceType: '', currentActivationCode: '', newDeviceName: '' })
    setUpdateCodeErrors({})
  }

  // 校验创建/编辑表单
  const validateForm = (): boolean => {
    const errors: DeviceFormErrors = {}
    if (!form.orgId) {
      errors.orgId = t('pages.devices.selectOrgRequired')
    }
    if (!form.deviceType) {
      errors.deviceType = t('pages.devices.deviceTypeRequired')
    }
    if (!form.deviceName) {
      errors.deviceName = t('pages.devices.deviceNameRequired')
    } else if (form.deviceName.length < 1 || form.deviceName.length > 100) {
      errors.deviceName = t('pages.devices.deviceNameLength')
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // 处理表单提交
  const handleSubmit = async () => {
    if (!validateForm()) return

    try {
      setLoading(true)

      if (editingDevice) {
        // 更新设备
        const updateData: UpdateDeviceRequest = {
          deviceName: form.deviceName,
        }
        const deviceId = editingDevice.deviceId || editingDevice.id || ''
        await updateDevice(deviceId, updateData)
        toast.success(t('pages.devices.updateSuccess'))
      } else {
        // 创建设备
        const createData: CreateDeviceRequest = {
          orgId: form.orgId,
          deviceType: form.deviceType as DeviceType,
          deviceName: form.deviceName,
        }
        const response = await createDevice(createData)
        toast.success(t('pages.devices.createSuccess'))

        // 显示激活信息
        setCreatedDeviceInfo(response.data)
        setActivationInfoModalVisible(true)
      }

      closeModal()
      loadDevices()
    } catch (error: any) {
      console.error('Failed to save device:', error)
      const errorMsg = error.message || (editingDevice ? t('pages.devices.updateFailed') : t('pages.devices.createFailed'))
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  // 处理更新激活码
  const handleUpdateCode = async () => {
    if (!updatingDevice) return

    // 校验
    if (!updateCodeForm.currentActivationCode) {
      setUpdateCodeErrors({ currentActivationCode: t('pages.devices.currentActivationCodeRequired') })
      return
    }

    try {
      setLoading(true)

      const updateData: UpdateActivationCodeRequest = {
        orgId: updateCodeForm.orgId,
        deviceType: updateCodeForm.deviceType as DeviceType,
        currentActivationCode: updateCodeForm.currentActivationCode,
        newDeviceName: updateCodeForm.newDeviceName,
      }

      const deviceId = updatingDevice.deviceId || updatingDevice.id || ''
      const response = await updateActivationCode(deviceId, updateData)
      toast.success(t('pages.devices.updateCodeSuccess'))

      // 显示新激活码（受控弹窗，替代命令式 Modal.success）
      setNewCodeInfo({
        deviceId: response.data.deviceId,
        newActivationCode: response.data.newActivationCode,
      })

      closeUpdateCodeModal()
      loadDevices()
    } catch (error: any) {
      console.error('Failed to update activation code:', error)
      toast.error(error.message || t('pages.devices.updateCodeFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 查看设备会话状态
  const handleViewSession = async (device: Device) => {
    const deviceId = device.deviceId || device.id || ''
    try {
      setSessionLoading(true)
      setSessionModalVisible(true)
      const response = await getDeviceSession(deviceId)
      setSessionInfo(response.data)
    } catch (error: any) {
      console.error('Failed to get device session:', error)
      toast.error(error.message || t('pages.devices.getSessionFailed'))
      setSessionModalVisible(false)
    } finally {
      setSessionLoading(false)
    }
  }

  // 处理删除
  const handleDelete = async (device: Device) => {
    try {
      setLoading(true)
      const deviceId = device.deviceId || device.id || ''
      await deleteDevice(deviceId)
      toast.success(t('pages.devices.deleteSuccess'))
      setDeletingDevice(null)
      loadDevices()
    } catch (error: any) {
      console.error('Failed to delete device:', error)
      toast.error(error.message || t('pages.devices.deleteFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 复制到剪贴板
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast.success(t('pages.devices.copySuccess'))
      setTimeout(() => setCopiedField(''), 2000)
    } catch (error) {
      toast.error(t('pages.devices.copyFailed'))
    }
  }

  // 获取设备类型图标
  const getDeviceTypeIcon = (type: DeviceType) => {
    switch (type) {
      case 'POS':
        return <Monitor className="w-3.5 h-3.5" />
      case 'KIOSK':
        return <Smartphone className="w-3.5 h-3.5" />
      case 'TABLET':
        return <Tablet className="w-3.5 h-3.5" />
      case 'DISPLAY':
        return <Monitor className="w-3.5 h-3.5" />
      default:
        return <Monitor className="w-3.5 h-3.5" />
    }
  }

  // 获取设备类型标签样式（严禁紫色，一律 slate + 语义色）
  const getDeviceTypeVariant = (type: DeviceType): 'default' | 'gold' | 'blue' | 'green' | 'red' => {
    switch (type) {
      case 'POS':
        return 'blue'
      case 'KIOSK':
        return 'green'
      case 'TABLET':
        return 'default'
      case 'DISPLAY':
        return 'gold'
      default:
        return 'default'
    }
  }

  // 获取状态标签样式
  const getStatusVariant = (status: DeviceStatus): 'default' | 'gold' | 'blue' | 'green' | 'red' => {
    switch (status) {
      case 'ACTIVE':
        return 'green'
      case 'PENDING':
        return 'gold'
      case 'DELETED':
        return 'red'
      default:
        return 'default'
    }
  }

  // 格式化日期
  const formatDate = (date?: string) =>
    date
      ? new Date(date).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-'

  const deviceTypeLabel = (type: DeviceType) =>
    t(`pages.devices.type${type.charAt(0) + type.slice(1).toLowerCase()}`)

  const statusLabel = (status: DeviceStatus) =>
    t(`pages.devices.status${status.charAt(0) + status.slice(1).toLowerCase()}`)

  // 表格列定义
  const columns: Column<Device>[] = [
    {
      key: 'deviceName',
      title: t('pages.devices.deviceName'),
      width: 120,
      render: (record) => (
        <span title={record.deviceName} className="block truncate max-w-[120px]">
          {record.deviceName || '-'}
        </span>
      ),
    },
    {
      key: 'deviceType',
      title: t('pages.devices.deviceType'),
      width: 110,
      render: (record) => (
        <Badge variant={getDeviceTypeVariant(record.deviceType)} icon={getDeviceTypeIcon(record.deviceType)}>
          {deviceTypeLabel(record.deviceType)}
        </Badge>
      ),
    },
    {
      key: 'status',
      title: t('pages.devices.status'),
      width: 90,
      render: (record) => (
        <Badge variant={getStatusVariant(record.status)}>{statusLabel(record.status)}</Badge>
      ),
    },
    {
      key: 'id',
      title: t('pages.devices.deviceId'),
      width: 140,
      render: (record) => {
        const deviceId = record.deviceId || record.id || ''
        return (
          <div className="flex items-center gap-1">
            <code
              title={deviceId}
              className="text-[11px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5"
            >
              {deviceId.substring(0, 8)}...
            </code>
            <button
              type="button"
              title={copiedField === deviceId ? t('pages.devices.copied') : t('pages.devices.copy')}
              onClick={() => copyToClipboard(deviceId, deviceId)}
              className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
            >
              {copiedField === deviceId ? (
                <Check className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )
      },
    },
    {
      key: 'activatedAt',
      title: t('pages.devices.activatedAt'),
      width: 155,
      render: (record) => formatDate(record.activatedAt),
    },
    {
      key: 'lastActiveAt',
      title: t('pages.devices.lastActiveAt'),
      width: 155,
      render: (record) => formatDate(record.lastActiveAt),
    },
    {
      key: 'createdAt',
      title: t('pages.devices.createdAt'),
      width: 155,
      render: (record) => formatDate(record.createdAt),
    },
    {
      key: 'actions',
      title: t('pages.devices.actions'),
      width: 150,
      render: (record) => (
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title={t('pages.devices.edit')}
            onClick={() => openModal(record)}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <Pencil className="w-4 h-4" />
          </button>
          {record.status === 'ACTIVE' && (
            <>
              <button
                type="button"
                title={t('pages.devices.viewSession')}
                onClick={() => handleViewSession(record)}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <Info className="w-4 h-4" />
              </button>
              <button
                type="button"
                title={t('pages.devices.updateCode')}
                onClick={() => openUpdateCodeModal(record)}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            type="button"
            title={t('pages.devices.delete')}
            onClick={() => setDeletingDevice(record)}
            className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  const orgOptions = organizations.map(org => ({ label: org.orgName, value: org.id }))
  const deviceTypeOptions = [
    { label: t('pages.devices.typePos'), value: 'POS' },
    { label: t('pages.devices.typeKiosk'), value: 'KIOSK' },
    { label: t('pages.devices.typeTablet'), value: 'TABLET' },
    { label: t('pages.devices.typeDisplay'), value: 'DISPLAY' },
  ]

  return (
    <div className="p-6">
      <SectionCard>
        <div className="flex flex-col gap-6">
          {/* 标题和操作栏 */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900 m-0">{t('pages.devices.title')}</h2>
            <div className="flex items-center gap-2">
              <Btn
                variant="secondary"
                icon={<RefreshCw className="w-4 h-4" />}
                onClick={loadDevices}
                disabled={!selectedOrgId}
              >
                {t('pages.devices.refresh')}
              </Btn>
              <Btn
                variant="primary"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => openModal()}
                disabled={!selectedOrgId}
              >
                {t('pages.devices.create')}
              </Btn>
            </div>
          </div>

          {/* 设备类型说明 */}
          <AlertBox
            type="info"
            title={t('pages.devices.deviceTypeTooltip')}
            description={t('pages.devices.validityPeriod')}
          />

          {/* 筛选栏 */}
          <div className="flex flex-wrap items-center gap-3">
            <SelectInput
              className="w-[300px]"
              placeholder={t('pages.devices.selectOrgPlaceholder')}
              value={selectedOrgId}
              onChange={(v) => setSelectedOrgId(v)}
              options={orgOptions}
            />
            <div className="relative w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                placeholder={t('pages.devices.search')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-700 placeholder:text-slate-400 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
              />
            </div>
            <SelectInput
              className="w-[150px]"
              placeholder={t('pages.devices.deviceType')}
              value={deviceTypeFilter}
              onChange={(v) => setDeviceTypeFilter(v as DeviceType | '')}
              options={[
                { label: t('pages.devices.typePos'), value: 'POS' },
                { label: t('pages.devices.typeKiosk'), value: 'KIOSK' },
                { label: t('pages.devices.typeTablet'), value: 'TABLET' },
                { label: t('pages.devices.typeDisplay'), value: 'DISPLAY' },
              ]}
            />
            <SelectInput
              className="w-[120px]"
              placeholder={t('pages.devices.status')}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as DeviceStatus | '')}
              options={[
                { label: t('pages.devices.statusPending'), value: 'PENDING' },
                { label: t('pages.devices.statusActive'), value: 'ACTIVE' },
              ]}
            />
          </div>

          {/* 表格 */}
          {!selectedOrgId ? (
            <EmptyState title={t('pages.devices.selectOrgPlaceholder')} />
          ) : (
            <Table
              columns={columns}
              data={filteredDevices}
              rowKey={(row) => row.id}
              loading={loading}
              empty={
                <EmptyState
                  title={
                    searchQuery || deviceTypeFilter || statusFilter
                      ? t('pages.devices.noResultsDescription')
                      : t('pages.devices.emptyDescription')
                  }
                  action={
                    !searchQuery && !deviceTypeFilter && !statusFilter ? (
                      <Btn variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => openModal()}>
                        {t('pages.devices.emptyButton')}
                      </Btn>
                    ) : undefined
                  }
                />
              }
            />
          )}
        </div>
      </SectionCard>

      {/* 创建/编辑模态框 */}
      <Modal
        title={editingDevice ? t('pages.devices.edit') : t('pages.devices.create')}
        open={modalVisible}
        onOpenChange={(o) => { if (!o) closeModal() }}
        size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={closeModal}>{t('pages.devices.cancel')}</Btn>
            <Btn variant="primary" loading={loading} onClick={handleSubmit}>{t('pages.devices.save')}</Btn>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={t('pages.devices.selectOrg')} required error={formErrors.orgId}>
            <SelectInput
              placeholder={t('pages.devices.selectOrgPlaceholder')}
              value={form.orgId}
              onChange={(v) => setForm(f => ({ ...f, orgId: v }))}
              options={orgOptions}
              disabled={!!editingDevice}
              className="w-full"
            />
          </Field>

          <Field
            label={t('pages.devices.selectDeviceType')}
            required
            error={formErrors.deviceType}
            hint={t('pages.devices.deviceTypeTooltip')}
          >
            <SelectInput
              placeholder={t('pages.devices.selectDeviceTypePlaceholder')}
              value={form.deviceType}
              onChange={(v) => setForm(f => ({ ...f, deviceType: v as DeviceType }))}
              options={deviceTypeOptions}
              disabled={!!editingDevice}
              className="w-full"
            />
          </Field>

          <Field label={t('pages.devices.deviceName')} required error={formErrors.deviceName}>
            <TextInput
              placeholder={t('pages.devices.deviceNamePlaceholder')}
              value={form.deviceName}
              onChange={(v) => setForm(f => ({ ...f, deviceName: v }))}
              maxLength={100}
            />
          </Field>

          {!editingDevice && (
            <AlertBox type="warning" title={t('pages.devices.activationWarning')} />
          )}
        </div>
      </Modal>

      {/* 更新激活码模态框 */}
      <Modal
        title={t('pages.devices.updateCode')}
        open={updateCodeModalVisible}
        onOpenChange={(o) => { if (!o) closeUpdateCodeModal() }}
        size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={closeUpdateCodeModal}>{t('pages.devices.cancel')}</Btn>
            <Btn variant="primary" loading={loading} onClick={handleUpdateCode}>{t('pages.devices.confirm')}</Btn>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <AlertBox type="warning" title={t('pages.devices.updateCodeWarning')} />

          <Field label={t('pages.devices.selectOrg')}>
            <SelectInput
              value={updateCodeForm.orgId}
              onChange={() => {}}
              options={orgOptions}
              disabled
              className="w-full"
            />
          </Field>

          <Field label={t('pages.devices.selectDeviceType')}>
            <SelectInput
              value={updateCodeForm.deviceType}
              onChange={() => {}}
              options={deviceTypeOptions}
              disabled
              className="w-full"
            />
          </Field>

          <Field
            label={t('pages.devices.currentActivationCode')}
            required
            error={updateCodeErrors.currentActivationCode}
          >
            <TextInput
              type="password"
              placeholder={t('pages.devices.currentActivationCodePlaceholder')}
              value={updateCodeForm.currentActivationCode}
              onChange={(v) => setUpdateCodeForm(f => ({ ...f, currentActivationCode: v }))}
            />
          </Field>

          <Field label={t('pages.devices.newDeviceName')}>
            <TextInput
              placeholder={t('pages.devices.newDeviceNamePlaceholder')}
              value={updateCodeForm.newDeviceName}
              onChange={(v) => setUpdateCodeForm(f => ({ ...f, newDeviceName: v }))}
            />
          </Field>
        </div>
      </Modal>

      {/* 新激活码结果弹窗（替代命令式 Modal.success） */}
      <Modal
        title={t('pages.devices.newCodeGenerated')}
        open={!!newCodeInfo}
        onOpenChange={(o) => { if (!o) setNewCodeInfo(null) }}
        size="lg"
        footer={<Btn variant="primary" onClick={() => setNewCodeInfo(null)}>{t('pages.devices.confirm')}</Btn>}
      >
        {newCodeInfo && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-700">
              <span className="font-semibold">{t('pages.devices.deviceId')}: </span>
              <code className="bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">{newCodeInfo.deviceId}</code>
            </p>
            <p className="text-sm text-slate-700">
              <span className="font-semibold">{t('pages.devices.activationCode')}: </span>
              <code className="bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">{newCodeInfo.newActivationCode}</code>
            </p>
            <AlertBox type="warning" title={t('pages.devices.updateCodeWarning')} />
          </div>
        )}
      </Modal>

      {/* 激活信息模态框 */}
      <Modal
        title={
          <span className="inline-flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-500" />
            <span>{t('pages.devices.activationInfo')}</span>
          </span>
        }
        open={activationInfoModalVisible}
        onOpenChange={(o) => { if (!o) setActivationInfoModalVisible(false) }}
        size="xl"
        footer={
          <Btn variant="primary" onClick={() => setActivationInfoModalVisible(false)}>
            {t('pages.devices.confirm')}
          </Btn>
        }
      >
        {createdDeviceInfo && (
          <div className="flex flex-col gap-6">
            <AlertBox
              type="warning"
              title={t('pages.devices.deviceCreated')}
              description={
                <span className="font-semibold text-red-500">
                  ⚠️ {t('pages.devices.activationCodeOnlyOnce')}
                </span>
              }
            />

            <div className="bg-slate-50 rounded-lg p-4 border-2 border-dashed border-amber-400">
              <p className="text-sm text-slate-700 mb-2">
                <span className="font-semibold">{t('pages.devices.deviceId')}: </span>
                <code className="text-sm bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">
                  {createdDeviceInfo.deviceId || createdDeviceInfo.id}
                </code>
              </p>
              <p className="text-sm text-slate-700 mb-2">
                <span className="font-semibold text-red-500">{t('pages.devices.activationCode')}: </span>
                <code className="text-sm bg-red-50 text-red-500 font-bold rounded px-1.5 py-0.5">
                  {createdDeviceInfo.activationCode}
                </code>
              </p>
              <p className="text-sm text-slate-700 mb-2">
                <span className="font-semibold">{t('pages.devices.deviceName')}: </span>
                <span>{createdDeviceInfo.deviceName}</span>
              </p>
              <p className="text-sm text-slate-700 mb-0 flex items-center gap-2">
                <span className="font-semibold">{t('pages.devices.deviceType')}: </span>
                <Badge
                  variant={getDeviceTypeVariant(createdDeviceInfo.deviceType)}
                  icon={getDeviceTypeIcon(createdDeviceInfo.deviceType)}
                >
                  {deviceTypeLabel(createdDeviceInfo.deviceType)}
                </Badge>
              </p>
            </div>

            <div className="border-t border-slate-100" />

            <div>
              <h5 className="text-sm font-semibold text-slate-900 mb-2">{t('pages.devices.activationSteps')}</h5>
              <ol className="list-decimal pl-5 text-sm text-slate-700 space-y-2">
                <li>{t('pages.devices.step1')}</li>
                <li>{t('pages.devices.step2')}</li>
                <li>{t('pages.devices.step3')}</li>
                <li>{t('pages.devices.step4')}</li>
              </ol>
            </div>

            <AlertBox
              type="error"
              title={t('pages.devices.activationWarning')}
              description={
                <span className="font-semibold text-red-700">
                  🔒 {t('pages.devices.activationCodeSecurityNote')}
                </span>
              }
            />
          </div>
        )}
      </Modal>

      {/* 设备会话状态模态框 */}
      <Modal
        title={
          <span className="inline-flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-500" />
            <span>{t('pages.devices.sessionStatus')}</span>
          </span>
        }
        open={sessionModalVisible}
        onOpenChange={(o) => { if (!o) setSessionModalVisible(false) }}
        size="lg"
        footer={
          <Btn variant="primary" onClick={() => setSessionModalVisible(false)}>
            {t('pages.devices.close')}
          </Btn>
        }
      >
        {sessionLoading ? (
          <div className="text-center py-10">
            <RotateCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <div className="mt-4 text-sm text-slate-600">{t('pages.devices.loading')}</div>
          </div>
        ) : sessionInfo ? (
          <div className="flex flex-col gap-6">
            {sessionInfo.sessionExists ? (
              <>
                <AlertBox type="success" title={t('pages.devices.sessionActive')} />
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-700 mb-2">
                    <span className="font-semibold">{t('pages.devices.deviceId')}: </span>
                    <code className="bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">{sessionInfo.deviceId}</code>
                  </p>
                  <p className="text-sm text-slate-700 mb-2 flex items-center gap-2">
                    <span className="font-semibold">{t('pages.devices.sessionStatus')}: </span>
                    <Badge variant="green">{sessionInfo.sessionStatus || 'ACTIVE'}</Badge>
                  </p>
                  {sessionInfo.activatedAt && (
                    <p className="text-sm text-slate-700 mb-2">
                      <span className="font-semibold">{t('pages.devices.activatedAt')}: </span>
                      <span>{new Date(sessionInfo.activatedAt).toLocaleString('zh-CN')}</span>
                    </p>
                  )}
                  {sessionInfo.lastActiveAt && (
                    <p className="text-sm text-slate-700 mb-0">
                      <span className="font-semibold">{t('pages.devices.lastActiveAt')}: </span>
                      <span>{new Date(sessionInfo.lastActiveAt).toLocaleString('zh-CN')}</span>
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <AlertBox
                  type="warning"
                  title={t('pages.devices.sessionNotActive')}
                  description={sessionInfo.message || t('pages.devices.deviceNotActivated')}
                />
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-700 mb-0">
                    <span className="font-semibold">{t('pages.devices.deviceId')}: </span>
                    <code className="bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">{sessionInfo.deviceId}</code>
                  </p>
                </div>
              </>
            )}
          </div>
        ) : null}
      </Modal>

      {/* 删除确认弹窗（替代 Popconfirm） */}
      <ConfirmDialog
        open={!!deletingDevice}
        onOpenChange={(o) => { if (!o) setDeletingDevice(null) }}
        title={t('pages.devices.deleteConfirm')}
        description={t('pages.devices.deleteWarning')}
        confirmText={t('pages.devices.confirm')}
        cancelText={t('pages.devices.cancel')}
        danger
        loading={loading}
        onConfirm={() => { if (deletingDevice) handleDelete(deletingDevice) }}
      />
    </div>
  )
}

export default DeviceManagement
