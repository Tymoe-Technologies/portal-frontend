import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, Search, RefreshCw, User, KeyRound, Lock } from 'lucide-react'
import { useAuthContext } from '../../auth/AuthProvider'
import {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  resetAccountPin,
  resetAccountPassword,
  type Account,
  type AccountStatus,
  type CreateAccountRequest,
  type UpdateAccountRequest
} from '../../services/account'
import { getOrganizations, listPermissionSets, resetOwnPin, type Organization, type PermissionSet } from '../../services/auth'
import {
  SectionCard, Table, Btn, Badge, Modal, Field, TextInput, SelectInput, Checkbox,
  AlertBox, EmptyState, ConfirmDialog, toast, type Column
} from '@/components/ui-kit'

interface AccountFormData {
  orgId: string
  // 要不要开通 Portal 后台登录（username+password）；不开通就只能用 PIN 登 POS
  grantBackendLogin: boolean
  name: string
  email?: string
  phone?: string
  permissionSetId?: string | null
}

// 生成工号：SC + 6位随机数字
function generateStaffCode(): string {
  return 'SC' + Math.floor(100000 + Math.random() * 900000).toString()
}

// 生成4位PIN码
function generatePinCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

// 生成强密码：大小写字母+数字，12位
function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const all = upper + lower + digits
  let pwd = upper[Math.floor(Math.random() * upper.length)]
    + lower[Math.floor(Math.random() * lower.length)]
    + digits[Math.floor(Math.random() * digits.length)]
  for (let i = 3; i < 12; i++) {
    pwd += all[Math.floor(Math.random() * all.length)]
  }
  return pwd.split('').sort(() => Math.random() - 0.5).join('')
}

// 根据姓名生成登录名：首字母 + 6位随机数字
function generateUsername(name: string): string {
  const prefix = name.trim().slice(0, 2).toLowerCase().replace(/[^a-z]/g, '') || 'u'
  return prefix + Math.floor(100000 + Math.random() * 900000).toString()
}

const AccountManagement: React.FC = () => {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuthContext()

  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])

  const [modalVisible, setModalVisible] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  // 受控表单
  const [form, setForm] = useState<AccountFormData>({ orgId: '', grantBackendLogin: false, name: '', email: '', phone: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof AccountFormData, string>>>({})
  const setF = (patch: Partial<AccountFormData>) => setForm(prev => ({ ...prev, ...patch }))

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrgId, setSelectedOrgId] = useState<string>(localStorage.getItem('organization_id') || '')
  const [statusFilter, setStatusFilter] = useState<AccountStatus | ''>('')

  // 删除确认
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null)

  // 重置登录凭证：一个入口，弹窗里 PIN 和密码分开两个按钮各自触发，不是一次性都重置。
  // 生成的新值只在这次响应里出现一次，展示给管理员之后不会再显示
  const [resettingCredsAccount, setResettingCredsAccount] = useState<Account | null>(null)
  const [resetCredsResult, setResetCredsResult] = useState<{ pinSent?: boolean; passwordSent?: boolean }>({})
  const [pinLoading, setPinLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)

  // 权限集（供员工账号分配）
  const [permissionSets, setPermissionSets] = useState<PermissionSet[]>([])

  useEffect(() => {
    if (isAuthenticated) {
      loadOrganizations()
      const currentOrgId = localStorage.getItem('organization_id')
      if (currentOrgId) setSelectedOrgId(currentOrgId)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (selectedOrgId) {
      loadAccounts()
      listPermissionSets(selectedOrgId).then(setPermissionSets).catch(() => setPermissionSets([]))
    }
  }, [selectedOrgId])

  useEffect(() => {
    let filtered = accounts
    if (searchQuery) {
      filtered = filtered.filter(account =>
        account.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.accountCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    if (statusFilter) {
      filtered = filtered.filter(account => account.status === statusFilter)
    }
    setFilteredAccounts(filtered)
  }, [accounts, searchQuery, statusFilter])

  useEffect(() => {
    const handleOrganizationChange = (event: CustomEvent) => {
      setSelectedOrgId(event.detail.orgId)
    }
    window.addEventListener('organizationChanged', handleOrganizationChange as EventListener)
    return () => window.removeEventListener('organizationChanged', handleOrganizationChange as EventListener)
  }, [])

  const loadOrganizations = async () => {
    try {
      setLoading(true)
      const orgs = await getOrganizations({})
      setOrganizations(orgs || [])
      if (orgs && orgs.length === 1) setSelectedOrgId(orgs[0].id)
    } catch {
      toast.error(t('pages.accounts.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const loadAccounts = async () => {
    if (!selectedOrgId) return
    try {
      setLoading(true)
      const response = await getAccounts({ orgId: selectedOrgId })
      setAccounts(response.data || [])
    } catch {
      toast.error(t('pages.accounts.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const openModal = (account?: Account) => {
    setEditingAccount(account || null)
    setErrors({})
    if (account) {
      setForm({
        orgId: account.orgId,
        grantBackendLogin: !!account.username,
        name: account.name,
        email: account.email || '',
        phone: account.phone || '',
        permissionSetId: account.permissionSetId ?? null,
      })
    } else {
      setForm({ orgId: selectedOrgId || '', grantBackendLogin: false, name: '', email: '', phone: '', permissionSetId: null })
    }
    setModalVisible(true)
  }

  const closeModal = () => {
    setModalVisible(false)
    setEditingAccount(null)
    setErrors({})
  }

  const validate = (): boolean => {
    const next: Partial<Record<keyof AccountFormData, string>> = {}
    if (!form.orgId) next.orgId = t('pages.accounts.selectOrgRequired')
    if (!form.name?.trim()) next.name = t('pages.accounts.nameRequired')
    // 邮箱一直是必填的：PIN 码只在创建这一刻明文出现一次，必须靠邮件通知本人，
    // 不填邮箱这个 PIN 就没有任何渠道能让本人知道
    if (!form.email?.trim()) {
      next.email = t('pages.accounts.emailRequired')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = t('pages.accounts.emailInvalid')
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    try {
      setLoading(true)

      if (editingAccount) {
        const updateData: UpdateAccountRequest = {
          username: editingAccount.username,
          status: editingAccount.status,
          permissionSetId: form.permissionSetId ?? null,
        }
        await updateAccount(editingAccount.id, updateData)
        toast.success(t('pages.accounts.updateSuccess'))
      } else {
        const createData: CreateAccountRequest = {
          orgId: form.orgId,
          grantBackendLogin: form.grantBackendLogin,
          name: form.name,
          // 开通后台登录才需要用户名+密码，否则只用 PIN
          username: form.grantBackendLogin ? generateUsername(form.name) : undefined,
          password: form.grantBackendLogin ? generatePassword() : undefined,
          accountCode: generateStaffCode(),
          pinCode: generatePinCode(),
          email: form.email,
          phone: form.phone,
          permissionSetId: form.permissionSetId || null,
        }
        await createAccount(createData)
        toast.success(
          form.email
            ? t('pages.accounts.createSuccessWithEmail', { email: form.email })
            : t('pages.accounts.createSuccess')
        )
      }

      closeModal()
      loadAccounts()
    } catch (error: any) {
      const errorMsg = error.message || (editingAccount ? t('pages.accounts.updateFailed') : t('pages.accounts.createFailed'))
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingAccount) return
    try {
      setLoading(true)
      const response = await deleteAccount(deletingAccount.id)
      if (response.deletedCount && response.deletedCount > 1) {
        toast.success(t('pages.accounts.deletedCount', { count: response.deletedCount }))
      } else {
        toast.success(t('pages.accounts.deleteSuccess'))
      }
      setDeletingAccount(null)
      loadAccounts()
    } catch (error: any) {
      toast.error(error.message || t('pages.accounts.deleteFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleResetPinOnly = async () => {
    if (!resettingCredsAccount) return
    try {
      setPinLoading(true)
      // PIN 现在完全由后端生成（含碰撞重试）并直接发邮件给本人，前端不再生成/展示明文
      // 主账户这一行是组织所有者 User，不是 Account 记录，走独立的自助重置接口
      if (resettingCredsAccount.isOwner) {
        await resetOwnPin()
      } else {
        await resetAccountPin(resettingCredsAccount.id)
      }
      setResetCredsResult(prev => ({ ...prev, pinSent: true }))
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || error.message || t('pages.accounts.resetCredsFailed'))
    } finally {
      setPinLoading(false)
    }
  }

  const handleResetPasswordOnly = async () => {
    if (!resettingCredsAccount) return
    try {
      setPasswordLoading(true)
      await resetAccountPassword(resettingCredsAccount.id)
      setResetCredsResult(prev => ({ ...prev, passwordSent: true }))
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || error.message || t('pages.accounts.resetCredsFailed'))
    } finally {
      setPasswordLoading(false)
    }
  }

  const closeResetCredsDialog = () => {
    setResettingCredsAccount(null)
    setResetCredsResult({})
  }

  const getStatusVariant = (status: AccountStatus): 'green' | 'gold' | 'red' => {
    switch (status) {
      case 'ACTIVE': return 'green'
      case 'SUSPENDED': return 'gold'
      default: return 'red'
    }
  }

  const columns: Column<Account>[] = [
    { key: 'name', title: t('pages.accounts.name'), width: 120, render: (r) => r.name || '-' },
    { key: 'accountCode', title: t('pages.accounts.accountCode'), width: 130, render: (r) => r.accountCode },
    { key: 'username', title: t('pages.accounts.username'), width: 140, render: (r) => r.username || '-' },
    {
      key: 'accountType',
      title: t('pages.accounts.loginMethod'),
      width: 110,
      render: (r) => (
        r.isOwner ? (
          <Badge variant="gold" icon={<User size={12} />}>{t('pages.accounts.ownerLabel')}</Badge>
        ) : (
          <Badge variant={r.username ? 'blue' : 'green'}>
            {r.username ? t('pages.accounts.loginMethodBackend') : t('pages.accounts.loginMethodPinOnly')}
          </Badge>
        )
      )
    },
    { key: 'email', title: t('pages.accounts.email'), width: 180, render: (r) => r.email || '-' },
    { key: 'phone', title: t('pages.accounts.phone'), width: 140, render: (r) => r.phone || '-' },
    {
      key: 'status',
      title: t('pages.accounts.status'),
      width: 90,
      render: (r) => (
        <Badge variant={getStatusVariant(r.status)}>
          {t(`pages.accounts.status${r.status.charAt(0) + r.status.slice(1).toLowerCase()}`)}
        </Badge>
      )
    },
    {
      key: 'lastLoginAt',
      title: t('pages.accounts.lastLoginAt'),
      width: 170,
      render: (r) => r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleString() : '-'
    },
    {
      key: 'actions',
      title: t('pages.accounts.actions'),
      width: 120,
      render: (record) => (
        record.isOwner ? (
          <div className="flex items-center gap-1">
            <Btn variant="ghost" size="sm" icon={<KeyRound size={14} />} title={t('pages.accounts.resetCreds')} onClick={() => setResettingCredsAccount(record)} />
            <span className="text-xs text-slate-400">{t('pages.accounts.ownerRowHint')}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Btn variant="ghost" size="sm" icon={<Pencil size={14} />} title={t('pages.accounts.edit')} onClick={() => openModal(record)} />
            {/* 一个按钮重置这个账号的登录凭证：PIN 一定重置，开通了后台登录（有 username）的话密码也一起重置 */}
            <Btn variant="ghost" size="sm" icon={<KeyRound size={14} />} title={t('pages.accounts.resetCreds')} onClick={() => setResettingCredsAccount(record)} />
            <Btn variant="ghost" size="sm" icon={<Trash2 size={14} className="text-red-500" />} title={t('pages.accounts.delete')} onClick={() => setDeletingAccount(record)} />
          </div>
        )
      )
    }
  ]

  const emailRequired = true

  return (
    <div className="p-6">
      <SectionCard>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-2xl font-semibold text-slate-800">{t('pages.accounts.title')}</h2>
            <div className="flex items-center gap-2">
              <Btn variant="secondary" icon={<RefreshCw size={16} />} onClick={loadAccounts} disabled={!selectedOrgId}>
                {t('pages.accounts.refresh')}
              </Btn>
              <Btn variant="primary" icon={<Plus size={16} />} onClick={() => openModal()} disabled={!selectedOrgId}>
                {t('pages.accounts.create')}
              </Btn>
            </div>
          </div>

          <AlertBox
            type="info"
            title={t('pages.accounts.permissionTitle')}
            description={
              <ul className="mb-0 list-disc pl-5">
                <li>{t('pages.accounts.permissionUser')}</li>
                <li>{t('pages.accounts.permissionEmployee')}</li>
              </ul>
            }
          />

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-60">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <TextInput placeholder={t('pages.accounts.search')} value={searchQuery} onChange={setSearchQuery} className="pl-9!" />
            </div>
            <div className="w-32">
              <SelectInput
                placeholder={t('pages.accounts.status')}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as AccountStatus | '')}
                options={[
                  { value: 'ACTIVE', label: t('pages.accounts.statusActive') },
                  { value: 'SUSPENDED', label: t('pages.accounts.statusSuspended') }
                ]}
              />
            </div>
          </div>

          {!selectedOrgId ? (
            <EmptyState title={t('pages.accounts.noOrgSelectedHint')} />
          ) : (
            <Table
              columns={columns}
              data={filteredAccounts}
              rowKey={(r) => r.id}
              loading={loading}
              empty={
                <EmptyState
                  title={searchQuery || statusFilter
                    ? t('pages.accounts.noResultsDescription')
                    : t('pages.accounts.emptyDescription')}
                  action={!searchQuery && !statusFilter
                    ? <Btn variant="primary" icon={<Plus size={16} />} onClick={() => openModal()}>{t('pages.accounts.emptyButton')}</Btn>
                    : undefined}
                />
              }
            />
          )}
        </div>
      </SectionCard>

      <Modal
        open={modalVisible}
        onOpenChange={(o) => { if (!o) closeModal() }}
        size="md"
        title={editingAccount ? t('pages.accounts.edit') : t('pages.accounts.create')}
        footer={
          <>
            <Btn variant="secondary" onClick={closeModal}>{t('pages.accounts.cancel')}</Btn>
            <Btn variant="primary" loading={loading} onClick={handleSubmit}>{t('pages.accounts.save')}</Btn>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t('pages.accounts.selectOrg')} required error={errors.orgId}>
            <SelectInput
              placeholder={t('pages.accounts.selectOrgPlaceholder')}
              value={form.orgId}
              onChange={(v) => setF({ orgId: v })}
              disabled={!!editingAccount}
              options={organizations.map(org => ({ value: org.id, label: org.orgName }))}
            />
          </Field>

          {!editingAccount && (
            <Field label={t('pages.accounts.grantBackendLogin')} hint={t('pages.accounts.grantBackendLoginHint')}>
              <Checkbox
                checked={form.grantBackendLogin}
                onCheckedChange={(v) => setF({ grantBackendLogin: v })}
                label={t('pages.accounts.grantBackendLoginLabel')}
              />
            </Field>
          )}

          <Field label={t('pages.accounts.name')} required error={errors.name}>
            <TextInput placeholder={t('pages.accounts.namePlaceholder')} value={form.name} onChange={(v) => setF({ name: v })} />
          </Field>

          <Field
            label={t('pages.accounts.email')}
            required={emailRequired}
            error={errors.email}
            hint={t('pages.accounts.emailTooltipRequired')}
          >
            <TextInput placeholder={t('pages.accounts.emailPlaceholder')} value={form.email || ''} onChange={(v) => setF({ email: v })} />
          </Field>

          <Field label={t('pages.accounts.phone')}>
            <TextInput placeholder={t('pages.accounts.phonePlaceholder')} value={form.phone || ''} onChange={(v) => setF({ phone: v })} />
          </Field>

          <Field label={t('pages.accounts.permissionSet')} hint={t('pages.accounts.permissionSetHint')}>
            <SelectInput
              placeholder={t('pages.accounts.permissionSetPlaceholder')}
              value={form.permissionSetId || ''}
              onChange={(v) => setF({ permissionSetId: v || null })}
              options={permissionSets.map(set => ({ value: set.id, label: set.name }))}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deletingAccount}
        onOpenChange={(o) => { if (!o) setDeletingAccount(null) }}
        title={t('pages.accounts.deleteConfirm')}
        description={t('pages.accounts.deleteWarning')}
        confirmText={t('pages.accounts.confirm')}
        cancelText={t('pages.accounts.cancel')}
        danger
        onConfirm={handleDelete}
      />

      <Modal
        open={!!resettingCredsAccount}
        onOpenChange={(o) => { if (!o) closeResetCredsDialog() }}
        size="sm"
        title={t('pages.accounts.resetCreds')}
        footer={<Btn variant="secondary" onClick={closeResetCredsDialog}>{t('pages.accounts.close')}</Btn>}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {t('pages.accounts.resetCredsIntro', { name: resettingCredsAccount?.name || resettingCredsAccount?.accountCode })}
          </p>

          {/* PIN：单独一行，自己的按钮/结果——新 PIN 直接发邮件给本人，不在这里显示明文 */}
          <div className="border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-700">{t('pages.accounts.pinCode')}</span>
              <Btn variant="secondary" size="sm" loading={pinLoading} onClick={handleResetPinOnly} disabled={resetCredsResult.pinSent}>
                {t('pages.accounts.resetPinAction')}
              </Btn>
            </div>
            {resetCredsResult.pinSent && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <KeyRound className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-600">{t('pages.accounts.resetCredsSentToEmail', { email: resettingCredsAccount?.email })}</span>
              </div>
            )}
          </div>

          {/* 密码：只有开通了后台登录（有 username）的账号才显示这一行；新密码直接发邮件给本人 */}
          {resettingCredsAccount?.username && (
            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-700">{t('pages.accounts.password')}</span>
                <Btn variant="secondary" size="sm" loading={passwordLoading} onClick={handleResetPasswordOnly} disabled={resetCredsResult.passwordSent}>
                  {t('pages.accounts.resetPasswordAction')}
                </Btn>
              </div>
              {resetCredsResult.passwordSent && (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <Lock className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600">{t('pages.accounts.resetCredsSentToEmail', { email: resettingCredsAccount?.email })}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default AccountManagement
