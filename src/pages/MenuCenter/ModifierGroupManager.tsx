import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { LOCALE_LABELS } from '../../services/brand-locale'
import {
  itemManagementService,
  type ModifierGroup,
  type ModifierOption,
  type CreateModifierGroupPayload,
  type CreateModifierOptionPayload,
} from '../../services/item-management'
import {
  SectionCard, Table, Badge, Btn, Modal, Spinner, EmptyState, ConfirmDialog,
  Switch, Field, TextInput, Textarea, toast, Tooltip, type Column,
} from '@/components/ui-kit'

interface ModifierGroupManagerProps {
  onClose?: () => void
  readOnly?: boolean
  isMain?: boolean
  additionalLocales?: string[]
}

const inputCls = 'w-full text-sm border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:outline-2 focus:outline-slate-900 disabled:bg-slate-50 disabled:text-slate-400'

const normalizeOptions = (options: any[] = []): ModifierOption[] =>
  options.map(option => ({
    ...option,
    defaultPrice: typeof option.defaultPrice === 'string' ? parseFloat(option.defaultPrice) || 0 : option.defaultPrice || 0,
    displayOrder: option.displayOrder ?? 0,
    cost: option.cost !== null && option.cost !== undefined
      ? (typeof option.cost === 'string' ? parseFloat(option.cost) : option.cost)
      : undefined,
  }))

export const ModifierGroupManager: React.FC<ModifierGroupManagerProps> = ({ readOnly = false, isMain = false, additionalLocales = [] }) => {
  const { t } = useTranslation()
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([])
  const [modifierGroupOptions, setModifierGroupOptions] = useState<Record<string, ModifierOption[]>>({})
  const [loading, setLoading] = useState(false)

  // 弹窗
  const [modalVisible, setModalVisible] = useState(false)
  const [optionModalVisible, setOptionModalVisible] = useState(false)
  const [manageOptionsModalVisible, setManageOptionsModalVisible] = useState(false)
  const [managingGroup, setManagingGroup] = useState<ModifierGroup | null>(null)
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null)
  const [editingOption, setEditingOption] = useState<ModifierOption | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [editingValues, setEditingValues] = useState<Record<string, any>>({})

  // 确认
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<ModifierGroup | null>(null)
  const [deleteOptionTarget, setDeleteOptionTarget] = useState<ModifierOption | null>(null)

  // 组表单
  const [gDisplayName, setGDisplayName] = useState('')
  const [gName, setGName] = useState('')
  const [gI18n, setGI18n] = useState<Record<string, string>>({})
  const [gDescription, setGDescription] = useState('')
  const [gIsLocal, setGIsLocal] = useState(false)
  const [gIsActive, setGIsActive] = useState(true)
  const [gErr, setGErr] = useState('')

  // 选项表单
  const [oDisplayName, setODisplayName] = useState('')
  const [oName, setOName] = useState('')
  const [oI18n, setOI18n] = useState<Record<string, string>>({})
  const [oCode, setOCode] = useState('')
  const [oDefaultPrice, setODefaultPrice] = useState<number>(NaN)
  const [oErr, setOErr] = useState('')

  const loadModifierGroups = async () => {
    setLoading(true)
    try {
      const activeGroups = await itemManagementService.getModifierGroups({ isActive: true })
      const normalizedGroups = activeGroups.map(group => ({ ...group, options: normalizeOptions(group.options || []) as any }))
      setModifierGroups(normalizedGroups)
      const cache: Record<string, ModifierOption[]> = {}
      normalizedGroups.forEach(group => { cache[group.id] = (group.options || []) as ModifierOption[] })
      setModifierGroupOptions(cache)
    } catch {
      toast.error(t('pages.menuCenter.modifierGroupManager.loadGroupsFailed'))
      setModifierGroups([])
    } finally {
      setLoading(false)
    }
  }

  const loadOptions = async (groupId: string) => {
    try {
      const groups = await itemManagementService.getModifierGroups()
      const group = groups.find(g => g.id === groupId)
      if (group && group.options) {
        const opts = normalizeOptions(group.options)
        setModifierGroupOptions(prev => ({ ...prev, [groupId]: opts }))
        if (managingGroup && managingGroup.id === groupId) setManagingGroup(group)
        return opts
      }
      setModifierGroupOptions(prev => ({ ...prev, [groupId]: [] }))
      return []
    } catch {
      toast.error(t('pages.menuCenter.modifierGroupManager.loadOptionsFailed'))
      setModifierGroupOptions(prev => ({ ...prev, [groupId]: [] }))
      return []
    }
  }

  useEffect(() => { loadModifierGroups() }, [])

  // ── 组 ─────────────────────────────────────────────────────

  const handleCreateGroup = () => {
    setEditingGroup(null)
    setGDisplayName(''); setGName(''); setGI18n({}); setGDescription(''); setGIsLocal(false); setGIsActive(true); setGErr('')
    setModalVisible(true)
  }

  const handleEditGroup = async (group: ModifierGroup) => {
    setEditingGroup(group)
    await loadOptions(group.id)
    setGDisplayName(group.displayName || '')
    setGName(group.name || '')
    setGI18n(group.displayNameI18n ?? {})
    setGDescription(group.description || '')
    setGIsActive(group.isActive)
    setGErr('')
    setModalVisible(true)
  }

  const handleGroupSubmit = async () => {
    if (!gDisplayName.trim()) { setGErr(t('pages.menuCenter.modifierGroupManager.nameRequired')); return }
    const i18n = Object.fromEntries(Object.entries(gI18n).filter(([, v]) => v))
    try {
      if (editingGroup) {
        const payload: any = {
          displayName: gDisplayName,
          ...(Object.keys(i18n).length > 0 && { display_name_i18n: i18n }),
          description: gDescription,
          isActive: gIsActive,
        }
        await itemManagementService.updateModifierGroup(editingGroup.id, payload)
        toast.success(t('pages.menuCenter.modifierGroupManager.groupUpdateSuccess'))
      } else {
        const payload: CreateModifierGroupPayload = {
          name: gDisplayName,
          displayName: gDisplayName,
          ...(Object.keys(i18n).length > 0 && { display_name_i18n: i18n }),
          description: gDescription,
          isActive: gIsActive,
          isLocal: gIsLocal,
        } as any
        await itemManagementService.createModifierGroup(payload)
        toast.success(t('pages.menuCenter.modifierGroupManager.groupCreateSuccess'))
      }
      setModalVisible(false)
      setEditingGroup(null)
      await loadModifierGroups()
    } catch {
      toast.error(editingGroup
        ? t('pages.menuCenter.modifierGroupManager.groupUpdateFailed')
        : t('pages.menuCenter.modifierGroupManager.groupCreateFailed'))
    }
  }

  const handleDeleteGroup = async (group: ModifierGroup) => {
    try {
      await itemManagementService.deleteModifierGroup(group.id)
      toast.success(t('pages.menuCenter.modifierGroupManager.groupDeleteSuccess'))
      loadModifierGroups()
      setModifierGroupOptions(prev => { const u = { ...prev }; delete u[group.id]; return u })
    } catch (error: any) {
      toast.error(error?.response?.data?.error || error?.message || t('pages.menuCenter.modifierGroupManager.groupDeleteFailed'))
    } finally {
      setDeleteGroupTarget(null)
    }
  }

  // ── 选项 ───────────────────────────────────────────────────

  const openCreateOption = (groupId: string) => {
    setSelectedGroupId(groupId)
    setEditingOption(null)
    setODisplayName(''); setOName(''); setOI18n({}); setOCode(''); setODefaultPrice(NaN); setOErr('')
    setOptionModalVisible(true)
  }

  const handleEditOption = (groupId: string, option: ModifierOption) => {
    setEditingOption(option)
    setSelectedGroupId(groupId)
    setODisplayName(option.displayName || '')
    setOName(option.name || '')
    setOI18n(option.displayNameI18n ?? {})
    setOCode(option.code || '')
    setODefaultPrice(typeof option.defaultPrice === 'string' ? parseFloat(option.defaultPrice) : (option.defaultPrice ?? NaN))
    setOErr('')
    setOptionModalVisible(true)
  }

  const handleOptionSubmit = async () => {
    if (!selectedGroupId) return
    if (!oDisplayName.trim()) { setOErr(t('pages.menuCenter.modifierGroupManager.optionDisplayNameRequired')); return }
    const i18n = Object.fromEntries(Object.entries(oI18n).filter(([, v]) => v))
    const price = Number.isNaN(oDefaultPrice) ? undefined : oDefaultPrice
    try {
      if (editingOption) {
        await itemManagementService.updateModifierOption(selectedGroupId, editingOption.id, {
          displayName: oDisplayName,
          ...(Object.keys(i18n).length > 0 && { display_name_i18n: i18n }),
          code: oCode || undefined,
          defaultPrice: price,
        } as any)
        toast.success(t('pages.menuCenter.modifierGroupManager.optionUpdateSuccess'))
      } else {
        const currentGroup = modifierGroups.find(g => g.id === selectedGroupId)
        const existingOptions = currentGroup?.options || []
        const nextDisplayOrder = existingOptions.reduce((max, opt) => Math.max(max, opt.displayOrder ?? 0), -1) + 1
        await itemManagementService.createModifierOption(selectedGroupId, {
          displayName: oDisplayName,
          code: oCode || undefined,
          defaultPrice: price,
          displayOrder: nextDisplayOrder,
          ...(Object.keys(i18n).length > 0 && { display_name_i18n: i18n }),
        } as any)
        toast.success(t('pages.menuCenter.modifierGroupManager.optionCreateSuccess'))
      }
      setOptionModalVisible(false)
      setEditingOption(null)
      await new Promise(r => setTimeout(r, 300))
      const freshGroups = await itemManagementService.getModifierGroups({ isActive: true })
      const updatedGroup = freshGroups.find(g => g.id === selectedGroupId)
      if (updatedGroup) {
        const opts = normalizeOptions(updatedGroup.options || [])
        setModifierGroups(prev => prev.map(g => g.id === selectedGroupId ? { ...updatedGroup, options: opts as any } : g))
        setModifierGroupOptions(prev => ({ ...prev, [selectedGroupId]: opts }))
        if (managingGroup && managingGroup.id === selectedGroupId) setManagingGroup({ ...updatedGroup, options: opts as any })
      }
    } catch {
      toast.error(t('pages.menuCenter.modifierGroupManager.optionSaveFailed'))
    }
  }

  const handleManageOptions = async (group: ModifierGroup) => {
    const cachedOptions = group.options || modifierGroupOptions[group.id] || []
    setManagingGroup({ ...group, options: cachedOptions as any })
    setManageOptionsModalVisible(true)
    try {
      const freshGroups = await itemManagementService.getModifierGroups({ isActive: true })
      const updatedGroup = freshGroups.find(g => g.id === group.id)
      if (updatedGroup) {
        const opts = normalizeOptions(updatedGroup.options || [])
        setModifierGroupOptions(prev => ({ ...prev, [group.id]: opts }))
        setManagingGroup({ ...updatedGroup, options: opts as any })
        setModifierGroups(prev => prev.map(g => g.id === group.id ? { ...updatedGroup, options: opts as any } : g))
      }
    } catch { /* 保留缓存 */ }
  }

  const handleDeleteOption = async (option: ModifierOption) => {
    if (!managingGroup) return
    try {
      await itemManagementService.deleteModifierOption(managingGroup.id, option.id)
      toast.success(t('pages.menuCenter.modifierGroupManager.optionDeleteSuccess'))
      await handleManageOptions(managingGroup)
    } catch (error: any) {
      toast.error(error?.response?.data?.error || error?.message || t('pages.menuCenter.modifierGroupManager.optionDeleteFailed'))
    } finally {
      setDeleteOptionTarget(null)
    }
  }

  // 内联失焦保存
  const clearEdit = (key: string) => setEditingValues(prev => { const s = { ...prev }; delete s[key]; return s })
  const saveOptionField = async (record: ModifierOption, patch: Partial<ModifierOption>, editKey: string) => {
    if (!managingGroup) return
    try {
      await itemManagementService.updateModifierOption(managingGroup.id, record.id, {
        displayName: record.displayName, code: record.code, defaultPrice: record.defaultPrice, cost: record.cost,
        ...patch,
      } as any)
      toast.success(t('pages.menuCenter.modifierGroupManager.optionUpdatedInline'))
      clearEdit(editKey)
      const updatedOptions = (managingGroup.options || []).map(opt => opt.id === record.id ? { ...opt, ...patch } : opt)
      const updatedGroup = { ...managingGroup, options: updatedOptions as any }
      setManagingGroup(updatedGroup)
      setModifierGroupOptions(prev => ({ ...prev, [managingGroup.id]: updatedOptions as any }))
      setModifierGroups(prev => prev.map(g => g.id === managingGroup.id ? updatedGroup : g))
    } catch {
      toast.error(t('pages.menuCenter.modifierGroupManager.optionUpdateFailedInline'))
      clearEdit(editKey)
    }
  }

  // ── 主表列 ─────────────────────────────────────────────────

  const columns: Column<ModifierGroup>[] = [
    { key: 'name', title: t('pages.menuCenter.modifierGroupManager.columnName'), width: 110, render: r => <span className="text-slate-600 truncate">{r.name}</span> },
    { key: 'displayName', title: t('pages.menuCenter.modifierGroupManager.columnDisplayName'), render: r => <span className="text-slate-800">{r.displayName}</span> },
    { key: 'scope', title: t('pages.menuCenter.modifierGroupManager.columnScope'), width: 80, align: 'center', render: r => r.storeId == null ? <Badge variant="blue">{t('pages.menuCenter.modifierGroupManager.scopeBrand')}</Badge> : <Badge variant="gold">{t('pages.menuCenter.modifierGroupManager.scopeStore')}</Badge> },
    { key: 'isActive', title: t('pages.menuCenter.modifierGroupManager.columnStatus'), width: 80, align: 'center', render: r => <Badge variant={r.isActive ? 'green' : 'red'}>{r.isActive ? t('pages.menuCenter.modifierGroupManager.statusActive') : t('pages.menuCenter.modifierGroupManager.statusInactive')}</Badge> },
    {
      key: 'options', title: t('pages.menuCenter.modifierGroupManager.columnOptions'), width: 130, align: 'center',
      render: r => (
        <div className="flex flex-col items-center gap-1">
          <Badge variant="blue">{t('pages.menuCenter.modifierGroupManager.optionsCount', { count: r.options?.length ?? 0 })}</Badge>
          <Btn variant={readOnly ? 'secondary' : 'primary'} size="sm" onClick={() => handleManageOptions(r)}>{readOnly ? t('pages.menuCenter.modifierGroupManager.viewAction') : t('pages.menuCenter.modifierGroupManager.editAction')}</Btn>
        </div>
      ),
    },
    {
      key: 'actions', title: t('pages.menuCenter.modifierGroupManager.columnActions'), width: 120,
      render: r => readOnly ? null : (
        <div className="flex items-center gap-1">
          <Btn variant="ghost" size="sm" onClick={() => handleEditGroup(r)}>{t('pages.menuCenter.modifierGroupManager.editAction')}</Btn>
          <Tooltip label={t('pages.menuCenter.modifierGroupManager.deleteAction')}>
            <button onClick={() => setDeleteGroupTarget(r)} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer">
              <Trash2 className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      ),
    },
  ]

  const manageOptions = (managingGroup?.options || (managingGroup ? modifierGroupOptions[managingGroup.id] : []) || []).filter(o => o && o.id)

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <SectionCard
        title={t('pages.menuCenter.modifierGroupManager.pageTitle')}
        action={
          <div className="flex items-center gap-2">
            <Btn variant="secondary" size="sm" icon={<RotateCcw className="w-3.5 h-3.5" />} loading={loading} onClick={loadModifierGroups}>{t('pages.menuCenter.modifierGroupManager.refreshAction')}</Btn>
            {!readOnly && <Btn variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleCreateGroup}>{t('pages.menuCenter.modifierGroupManager.createGroupAction')}</Btn>}
          </div>
        }
        bodyClassName="p-0"
      >
        <div className="p-4">
          {loading ? (
            <Spinner />
          ) : modifierGroups.length === 0 ? (
            <EmptyState title={t('pages.menuCenter.modifierGroupManager.emptyGroupsTitle')} action={!readOnly ? <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleCreateGroup}>{t('pages.menuCenter.modifierGroupManager.createFirstGroupAction')}</Btn> : undefined} />
          ) : (
            <Table columns={columns} data={modifierGroups} rowKey={r => r.id} />
          )}
        </div>
      </SectionCard>

      {/* 组编辑弹窗 */}
      <Modal
        open={modalVisible}
        onOpenChange={v => !v && setModalVisible(false)}
        title={editingGroup ? t('pages.menuCenter.modifierGroupManager.editGroupModalTitle') : t('pages.menuCenter.modifierGroupManager.createGroupModalTitle')}
        size="lg"
        footer={<><Btn variant="secondary" onClick={() => setModalVisible(false)}>{t('pages.menuCenter.modifierGroupManager.cancelAction')}</Btn><Btn variant="primary" onClick={handleGroupSubmit}>{editingGroup ? t('pages.menuCenter.modifierGroupManager.updateAction') : t('pages.menuCenter.modifierGroupManager.createAction')}</Btn></>}
      >
        <div className="space-y-4">
          <Field label={t('pages.menuCenter.modifierGroupManager.groupNameLabel')} required error={gErr} hint={t('pages.menuCenter.modifierGroupManager.groupNameHint')}>
            <TextInput value={gDisplayName} onChange={setGDisplayName} placeholder={t('pages.menuCenter.modifierGroupManager.groupNamePlaceholder')} />
          </Field>
          {additionalLocales.map(locale => (
            <Field key={locale} label={t('pages.menuCenter.modifierGroupManager.groupNameLocaleLabel', { locale: LOCALE_LABELS[locale] ?? locale })}>
              <TextInput value={gI18n[locale] ?? ''} onChange={v => setGI18n(prev => ({ ...prev, [locale]: v }))} placeholder={t('pages.menuCenter.modifierGroupManager.optionalPlaceholder')} />
            </Field>
          ))}
          {editingGroup && (
            <Field label={t('pages.menuCenter.modifierGroupManager.systemIdLabel')} hint={t('pages.menuCenter.modifierGroupManager.systemIdHint')}>
              <TextInput value={gName} onChange={() => {}} disabled />
            </Field>
          )}
          <Field label={t('pages.menuCenter.modifierGroupManager.descriptionLabel')}>
            <Textarea value={gDescription} onChange={setGDescription} rows={3} placeholder={t('pages.menuCenter.modifierGroupManager.descriptionPlaceholder')} />
          </Field>
          {isMain && !editingGroup && (
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-700">{t('pages.menuCenter.modifierGroupManager.scopeLabel')}</div>
                <div className="text-xs text-slate-400 mt-0.5">{gIsLocal ? t('pages.menuCenter.modifierGroupManager.scopeStoreOnlyHint') : t('pages.menuCenter.modifierGroupManager.scopeBrandHint')}</div>
              </div>
              <Switch checked={gIsLocal} onCheckedChange={setGIsLocal} />
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-slate-700">{t('pages.menuCenter.modifierGroupManager.activeStatusLabel')}</span>
            <Switch checked={gIsActive} onCheckedChange={setGIsActive} />
          </div>
        </div>
      </Modal>

      {/* 管理选项弹窗 */}
      <Modal
        open={manageOptionsModalVisible}
        onOpenChange={v => !v && setManageOptionsModalVisible(false)}
        title={managingGroup ? t('pages.menuCenter.modifierGroupManager.manageOptionsModalTitle', { name: managingGroup.displayName }) : t('pages.menuCenter.modifierGroupManager.manageOptionsModalTitleDefault')}
        size="lg"
      >
        <div className="space-y-3">
          {!readOnly && (
            <Btn variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => managingGroup && openCreateOption(managingGroup.id)}>{t('pages.menuCenter.modifierGroupManager.addOptionAction')}</Btn>
          )}
          {manageOptions.length === 0 ? (
            <EmptyState title={t('pages.menuCenter.modifierGroupManager.emptyOptionsTitle')} />
          ) : (
            <Table
              data={manageOptions}
              rowKey={o => o.id}
              columns={[
                { key: 'name', title: t('pages.menuCenter.modifierGroupManager.optionValueColumn'), width: 100, render: (o: ModifierOption) => <span className="font-mono text-xs text-slate-600">{o.name || '-'}</span> },
                {
                  key: 'displayName', title: t('pages.menuCenter.modifierGroupManager.optionDisplayNameColumn'), width: 150,
                  render: (o: ModifierOption) => {
                    const key = `${o.id}_displayName`
                    const val = editingValues[key] !== undefined ? editingValues[key] : o.displayName
                    return <input className={inputCls} value={val} disabled={readOnly}
                      onChange={e => setEditingValues(p => ({ ...p, [key]: e.target.value }))}
                      onBlur={() => { if (!readOnly && val !== o.displayName) saveOptionField(o, { displayName: val }, key) }} />
                  },
                },
                {
                  key: 'code', title: t('pages.menuCenter.modifierGroupManager.printCodeColumn'), width: 120,
                  render: (o: ModifierOption) => {
                    const key = `${o.id}_code`
                    const val = editingValues[key] !== undefined ? editingValues[key] : (o.code || '')
                    return <input className={inputCls} value={val} placeholder={t('pages.menuCenter.modifierGroupManager.printCodePlaceholder')} maxLength={20} disabled={readOnly}
                      onChange={e => setEditingValues(p => ({ ...p, [key]: e.target.value }))}
                      onBlur={() => { if (!readOnly && val !== (o.code || '')) saveOptionField(o, { code: val || undefined }, key) }} />
                  },
                },
                {
                  key: 'defaultPrice', title: t('pages.menuCenter.modifierGroupManager.defaultPriceColumn'), width: 120,
                  render: (o: ModifierOption) => {
                    const key = `${o.id}_defaultPrice`
                    const base = typeof o.defaultPrice === 'number' ? o.defaultPrice : 0
                    const val = editingValues[key] !== undefined ? editingValues[key] : base
                    return <input type="number" min={0} step="0.01" className={inputCls} value={val} disabled={readOnly}
                      onChange={e => setEditingValues(p => ({ ...p, [key]: Number(e.target.value) || 0 }))}
                      onBlur={() => { if (!readOnly && val !== base) saveOptionField(o, { defaultPrice: val }, key) }} />
                  },
                },
                {
                  key: 'actions', title: t('pages.menuCenter.modifierGroupManager.columnActions'), width: 110,
                  render: (o: ModifierOption) => readOnly ? null : (
                    <div className="flex items-center gap-1">
                      <Btn variant="ghost" size="sm" onClick={() => managingGroup && handleEditOption(managingGroup.id, o)}>{t('pages.menuCenter.modifierGroupManager.editAction')}</Btn>
                      <Tooltip label={t('pages.menuCenter.modifierGroupManager.deleteAction')}>
                        <button onClick={() => setDeleteOptionTarget(o)} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </div>
      </Modal>

      {/* 选项编辑弹窗 */}
      <Modal
        open={optionModalVisible}
        onOpenChange={v => { if (!v) { setOptionModalVisible(false); setEditingOption(null) } }}
        title={editingOption ? t('pages.menuCenter.modifierGroupManager.editOptionModalTitle') : t('pages.menuCenter.modifierGroupManager.addOptionModalTitle')}
        footer={<><Btn variant="secondary" onClick={() => { setOptionModalVisible(false); setEditingOption(null) }}>{t('pages.menuCenter.modifierGroupManager.cancelAction')}</Btn><Btn variant="primary" onClick={handleOptionSubmit}>{editingOption ? t('pages.menuCenter.modifierGroupManager.updateAction') : t('pages.menuCenter.modifierGroupManager.createAction')}</Btn></>}
      >
        <div className="space-y-4">
          <Field label={t('pages.menuCenter.modifierGroupManager.optionDisplayNameLabel')} required error={oErr} hint={t('pages.menuCenter.modifierGroupManager.optionDisplayNameHint')}>
            <TextInput value={oDisplayName} onChange={setODisplayName} placeholder={t('pages.menuCenter.modifierGroupManager.optionDisplayNamePlaceholder')} />
          </Field>
          {additionalLocales.map(locale => (
            <Field key={locale} label={t('pages.menuCenter.modifierGroupManager.optionDisplayNameLocaleLabel', { locale: LOCALE_LABELS[locale] ?? locale })}>
              <TextInput value={oI18n[locale] ?? ''} onChange={v => setOI18n(prev => ({ ...prev, [locale]: v }))} placeholder={t('pages.menuCenter.modifierGroupManager.optionalPlaceholder')} />
            </Field>
          ))}
          <Field label={t('pages.menuCenter.modifierGroupManager.optionCodeLabel')} hint={t('pages.menuCenter.modifierGroupManager.optionCodeHint')}>
            <TextInput value={oCode} onChange={setOCode} placeholder={t('pages.menuCenter.modifierGroupManager.optionCodePlaceholder')} maxLength={20} />
          </Field>
          {editingOption && (
            <Field label={t('pages.menuCenter.modifierGroupManager.systemNameLabel')} hint={t('pages.menuCenter.modifierGroupManager.systemNameHint')}>
              <TextInput value={oName} onChange={() => {}} disabled />
            </Field>
          )}
          <Field label={t('pages.menuCenter.modifierGroupManager.defaultPriceLabel')}>
            <input type="number" min={0} step="0.01" className={inputCls} placeholder="0.00"
              value={Number.isNaN(oDefaultPrice) ? '' : oDefaultPrice}
              onChange={e => setODefaultPrice(e.target.value === '' ? NaN : Number(e.target.value))} />
          </Field>
        </div>
      </Modal>

      {/* 确认 */}
      <ConfirmDialog
        open={!!deleteGroupTarget}
        onOpenChange={v => !v && setDeleteGroupTarget(null)}
        title={t('pages.menuCenter.modifierGroupManager.confirmDeleteTitle')}
        description={t('pages.menuCenter.modifierGroupManager.confirmDeleteGroupDescription')}
        confirmText={t('pages.menuCenter.modifierGroupManager.deleteConfirmText')}
        danger
        onConfirm={() => deleteGroupTarget && handleDeleteGroup(deleteGroupTarget)}
      />
      <ConfirmDialog
        open={!!deleteOptionTarget}
        onOpenChange={v => !v && setDeleteOptionTarget(null)}
        title={t('pages.menuCenter.modifierGroupManager.confirmDeleteTitle')}
        description={t('pages.menuCenter.modifierGroupManager.confirmDeleteOptionDescription')}
        confirmText={t('pages.menuCenter.modifierGroupManager.deleteConfirmText')}
        danger
        onConfirm={() => deleteOptionTarget && handleDeleteOption(deleteOptionTarget)}
      />
    </div>
  )
}

export default ModifierGroupManager
