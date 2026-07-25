import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, RefreshCw, ShieldCheck } from 'lucide-react'
import { useAuthContext } from '../../auth/AuthProvider'
import {
  getPermissionCatalog,
  listPermissionSets,
  createPermissionSet,
  updatePermissionSet,
  deletePermissionSet,
  getOrganizations,
  type PermissionCatalogModule,
  type PermissionSet,
} from '../../services/auth'
import {
  SectionCard, Table, Btn, Modal, Field, TextInput,
  Checkbox, EmptyState, ConfirmDialog, toast, type Column,
} from '@/components/ui-kit'

// 权限模块的逻辑分组：跟 auth-service src/config/permissionCatalog.ts 里的模块一一对应，
// 只是把 22 个模块按业务域分组展示，弹窗里不再是一坨平铺的列表
const MODULE_GROUPS: { key: string; modules: string[] }[] = [
  { key: 'storeOperations', modules: ['devices', 'printSettings', 'menuAvailability'] },
  { key: 'menuAndCatalog', modules: ['menuCatalog', 'recipesSupplies', 'multiMenu', 'menuPricingCosts', 'taxSettings'] },
  { key: 'ordersSales', modules: ['orders', 'salesChannels', 'reports'] },
  { key: 'financial', modules: ['payments', 'giftCards', 'refunds', 'financialReports'] },
  { key: 'bookings', modules: ['bookings', 'bookingSetup'] },
  { key: 'loyaltyMembers', modules: ['members', 'loyaltyRewards', 'loyaltyProgram'] },
  { key: 'delivery', modules: ['uberOperations', 'uberIntegration'] },
  { key: 'employeesConfig', modules: ['accounts', 'settings'] },
]

const PermissionSets: React.FC = () => {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuthContext()

  const [loading, setLoading] = useState(false)
  const [selectedOrgId, setSelectedOrgId] = useState<string>(localStorage.getItem('organization_id') || '')
  const [catalog, setCatalog] = useState<PermissionCatalogModule[]>([])
  const [sets, setSets] = useState<PermissionSet[]>([])

  const [modalVisible, setModalVisible] = useState(false)
  const [editingSet, setEditingSet] = useState<PermissionSet | null>(null)
  const [name, setName] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [nameError, setNameError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingSet, setDeletingSet] = useState<PermissionSet | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    (async () => {
      try {
        const [orgs, catalogData] = await Promise.all([
          getOrganizations(),
          getPermissionCatalog(),
        ])
        setCatalog(catalogData.modules)
        if (!selectedOrgId && orgs.length > 0) setSelectedOrgId(orgs[0].id)
      } catch (error) {
        console.error('Failed to load permission catalog:', error)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const loadSets = async (orgId: string) => {
    if (!orgId) return
    setLoading(true)
    try {
      const data = await listPermissionSets(orgId)
      setSets(data)
    } catch (error) {
      console.error('Failed to load permission sets:', error)
      toast.error(t('permissionSets.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedOrgId) loadSets(selectedOrgId)
  }, [selectedOrgId])

  // 组织切换统一由右上角的全局切换器控制，这里只监听同步，不再提供页面内的切换入口
  useEffect(() => {
    const handleOrganizationChange = (event: CustomEvent) => {
      setSelectedOrgId(event.detail.orgId)
    }
    window.addEventListener('organizationChanged', handleOrganizationChange as EventListener)
    return () => window.removeEventListener('organizationChanged', handleOrganizationChange as EventListener)
  }, [])

  const moduleLabel = (module: string) => t(`permissionSets.modules.${module}`, module)
  const moduleDescription = (module: string) => t(`permissionSets.moduleDescriptions.${module}`, '')
  const actionLabel = (action: string) => t(`permissionSets.actions.${action}`, action)
  const groupLabel = (group: string) => t(`permissionSets.groups.${group}`, group)

  const catalogByModule = new Map(catalog.map(c => [c.module, c.actions]))

  const permissionsInGroup = (moduleKeys: string[]): string[] =>
    moduleKeys.flatMap(m => (catalogByModule.get(m) ?? []).map(action => `${m}.${action}`))

  // 目录里出现的所有权限位（跨全部分组），用于顶部的"全选/取消全选"
  const allCatalogPermissions = catalog.flatMap(c => c.actions.map(action => `${c.module}.${action}`))
  const allSelected = allCatalogPermissions.length > 0 && allCatalogPermissions.every(p => selectedPermissions.includes(p))
  const toggleSelectAll = () => setSelectedPermissions(allSelected ? [] : allCatalogPermissions)

  const toggleGroup = (moduleKeys: string[], checked: boolean) => {
    const groupPermissions = permissionsInGroup(moduleKeys)
    setSelectedPermissions(prev => checked
      ? Array.from(new Set([...prev, ...groupPermissions]))
      : prev.filter(p => !groupPermissions.includes(p)))
  }

  const handleCreate = () => {
    setEditingSet(null)
    setName('')
    setSelectedPermissions([])
    setNameError('')
    setModalVisible(true)
  }

  const handleEdit = (set: PermissionSet) => {
    setEditingSet(set)
    setName(set.name)
    setSelectedPermissions(set.permissions)
    setNameError('')
    setModalVisible(true)
  }

  const togglePermission = (permission: string, checked: boolean) => {
    setSelectedPermissions(prev => {
      if (!checked) {
        // 取消 view 时，同模块的 edit 也一起取消——没有查看权限却保留编辑权限是无效状态
        const next = prev.filter(p => p !== permission)
        if (permission.endsWith('.view')) {
          const editBit = permission.replace(/\.view$/, '.edit')
          return next.filter(p => p !== editBit)
        }
        return next
      }
      // 勾选 edit 时自动带上同模块的 view——没有查看权限却能编辑没有意义，
      // 后端 requireModulePermission 也是按方法推断 view/edit，两者本来就该成对出现
      const next = new Set(prev)
      next.add(permission)
      if (permission.endsWith('.edit')) {
        next.add(permission.replace(/\.edit$/, '.view'))
      }
      return Array.from(next)
    })
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setNameError(t('permissionSets.nameRequired'))
      return
    }
    setNameError('')
    setSubmitting(true)
    try {
      if (editingSet) {
        await updatePermissionSet(editingSet.id, { name: name.trim(), permissions: selectedPermissions })
        toast.success(t('permissionSets.updateSuccess'))
      } else {
        await createPermissionSet(selectedOrgId, { name: name.trim(), permissions: selectedPermissions })
        toast.success(t('permissionSets.createSuccess'))
      }
      setModalVisible(false)
      loadSets(selectedOrgId)
    } catch (error) {
      console.error('Failed to save permission set:', error)
      toast.error(editingSet ? t('permissionSets.updateFailed') : t('permissionSets.createFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingSet) return
    try {
      await deletePermissionSet(deletingSet.id)
      toast.success(t('permissionSets.deleteSuccess'))
      setDeletingSet(null)
      loadSets(selectedOrgId)
    } catch (error) {
      console.error('Failed to delete permission set:', error)
      toast.error(t('permissionSets.deleteFailed'))
    }
  }

  const columns: Column<PermissionSet>[] = [
    { key: 'name', title: t('permissionSets.colName'), width: 200, render: (row) => row.name },
    {
      key: 'permissions',
      title: t('permissionSets.colPermissions'),
      render: (row) => (
        <span className="text-sm text-slate-600">
          {row.permissions.length === 0 ? '-' : row.permissions.map(p => {
            const [module, action] = p.split('.')
            return `${moduleLabel(module)} (${actionLabel(action)})`
          }).join(', ')}
        </span>
      ),
    },
    {
      key: 'actions',
      title: t('common.actions'),
      width: 140,
      render: (row) => (
        <div className="flex items-center gap-1">
          <Btn variant="link" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => handleEdit(row)}>
            {t('common.edit')}
          </Btn>
          <Btn variant="link" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setDeletingSet(row)} className="text-red-500! hover:text-red-600!">
            {t('common.delete')}
          </Btn>
        </div>
      ),
    },
  ]

  if (!isAuthenticated) {
    return <div className="p-6 text-center"><span className="text-slate-600">{t('organization.pleaseLoginFirst')}</span></div>
  }

  return (
    <div className="p-6">
      <SectionCard>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">{t('permissionSets.title')}</h2>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2 ml-auto">
            <Btn variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={() => loadSets(selectedOrgId)} loading={loading}>
              {t('organization.refresh')}
            </Btn>
            <Btn variant="primary" icon={<Plus className="w-4 h-4" />} onClick={handleCreate}>
              {t('permissionSets.create')}
            </Btn>
          </div>
        </div>

        {sets.length > 0 ? (
          <Table columns={columns} data={sets} rowKey={(row) => row.id} loading={loading} />
        ) : (
          <EmptyState icon={<ShieldCheck className="w-10 h-10" />} title={t('permissionSets.empty')} />
        )}
      </SectionCard>

      <Modal
        title={editingSet ? t('permissionSets.editTitle') : t('permissionSets.createTitle')}
        open={modalVisible}
        onOpenChange={setModalVisible}
        size="xl"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setModalVisible(false)}>{t('organization.cancel')}</Btn>
            <Btn variant="primary" loading={submitting} onClick={handleSubmit}>{t('organization.save')}</Btn>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t('permissionSets.name')} required error={nameError}>
            <TextInput value={name} onChange={setName} placeholder={t('permissionSets.namePlaceholder')} />
          </Field>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-slate-600">{t('permissionSets.permissionsLabel')}</div>
              <Btn variant="link" size="sm" onClick={toggleSelectAll}>
                {allSelected ? t('permissionSets.deselectAll') : t('permissionSets.selectAllTop')}
              </Btn>
            </div>
            <div className="space-y-3">
              {MODULE_GROUPS.map(({ key: groupKey, modules }) => {
                const visibleModules = modules.filter(m => catalogByModule.has(m))
                if (visibleModules.length === 0) return null
                const groupPermissions = permissionsInGroup(visibleModules)
                const allChecked = groupPermissions.length > 0 && groupPermissions.every(p => selectedPermissions.includes(p))

                return (
                  <div key={groupKey} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                      <span className="text-sm font-semibold text-slate-800">{groupLabel(groupKey)}</span>
                      <Checkbox
                        checked={allChecked}
                        onCheckedChange={(checked) => toggleGroup(visibleModules, checked)}
                        label={t('permissionSets.selectAll')}
                      />
                    </div>
                    <div className="divide-y divide-slate-100">
                      {visibleModules.map(module => {
                        const description = moduleDescription(module)
                        return (
                          <div key={module} className="flex items-center justify-between px-4 py-2.5 gap-4">
                            <div className="min-w-0">
                              <div className="text-sm text-slate-700">{moduleLabel(module)}</div>
                              {description && (
                                <div className="text-xs text-slate-400 mt-0.5">{description}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              {(catalogByModule.get(module) ?? []).map(action => {
                                const permKey = `${module}.${action}`
                                return (
                                  <Checkbox
                                    key={permKey}
                                    checked={selectedPermissions.includes(permKey)}
                                    onCheckedChange={(checked) => togglePermission(permKey, checked)}
                                    label={actionLabel(action)}
                                  />
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deletingSet}
        onOpenChange={(v) => { if (!v) setDeletingSet(null) }}
        title={t('permissionSets.delete')}
        description={t('permissionSets.deleteConfirm', { name: deletingSet?.name })}
        confirmText={t('permissionSets.delete')}
        cancelText={t('organization.cancel')}
        danger
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}

export default PermissionSets
