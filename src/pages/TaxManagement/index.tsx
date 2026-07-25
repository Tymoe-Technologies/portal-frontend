import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, RotateCcw, Pencil, Trash2, Store as StoreIcon, LayoutGrid } from 'lucide-react'
import { useAuthContext } from '../../auth/AuthProvider'
import { canEditModule } from '../../auth/permissions'
import { getOrganization } from '../../services/auth'
import {
  getStoreAvailableItems, getStoreTaxRates, createStoreTaxRate, updateStoreTaxRate,
  deleteStoreTaxRate, getStoreTaxRateItems, batchAssignStoreItemTaxRate,
  batchRemoveStoreItemTaxRate, type SimpleTaxRate,
} from '../../services/item-management'
import {
  PageHeader, SectionCard, Table, Badge, Btn, AlertBox, Spinner, EmptyState,
  Modal, ConfirmDialog, Field, TextInput, NumberInput, Transfer, Tooltip, type Column,
} from '../../components/ui-kit'

type StoreItem = { id: string; name: string; basePrice: number; isActive: boolean; isLocal?: boolean }

// 从地址解析税务地区
function parseAddressToRegion(address: string): string | null {
  if (!address) return null
  const a = address.toUpperCase()
  if (a.includes('BRITISH COLUMBIA') || a.includes('VANCOUVER') || a.includes(', BC')) return 'CA-BC'
  if (a.includes('ONTARIO') || a.includes('TORONTO') || a.includes(', ON')) return 'CA-ON'
  if (a.includes('QUEBEC') || a.includes('MONTREAL') || a.includes(', QC')) return 'CA-QC'
  if (a.includes('CALIFORNIA') || a.includes('LOS ANGELES') || a.includes(', CA,')) return 'US-CA'
  if (a.includes('NEW YORK') || a.includes('MANHATTAN') || a.includes(', NY')) return 'US-NY'
  return null
}

function useRegionDisplayName() {
  const { t } = useTranslation()
  const names: Record<string, string> = {
    'CA-BC': t('pages.taxManagement.regionCaBc'),
    'CA-ON': t('pages.taxManagement.regionCaOn'),
    'CA-QC': t('pages.taxManagement.regionCaQc'),
    'US-CA': t('pages.taxManagement.regionUsCa'),
    'US-NY': t('pages.taxManagement.regionUsNy'),
    'US-TX': t('pages.taxManagement.regionUsTx'),
  }
  return (regionCode: string) => names[regionCode] || regionCode
}

// 商品条目渲染（供 Transfer 使用）
function useRenderStoreItem() {
  const { t } = useTranslation()
  return (item: StoreItem) => (
    <>
      <span className="truncate">{item.name}</span>
      {item.isLocal && <Badge variant="blue">{t('pages.taxManagement.localBadge')}</Badge>}
      <span className="text-xs text-slate-400 ml-auto shrink-0">${(item.basePrice / 100).toFixed(2)}</span>
    </>
  )
}

const TaxManagement: React.FC = () => {
  const { t } = useTranslation()
  const getRegionDisplayName = useRegionDisplayName()
  const renderStoreItem = useRenderStoreItem()
  const { organizations, role, permissions } = useAuthContext()
  const canEdit = canEditModule('taxSettings', role, permissions)
  const tenantId = localStorage.getItem('organization_id') || ''

  const [loading, setLoading] = useState(true)
  const [regionCode, setRegionCode] = useState('')
  const [taxRates, setTaxRates] = useState<SimpleTaxRate[]>([])
  const [loadingTaxRates, setLoadingTaxRates] = useState(false)

  const [flash, setFlash] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; msg: string } | null>(null)
  const notify = (type: 'success' | 'error' | 'warning' | 'info', msg: string) => {
    setFlash({ type, msg }); setTimeout(() => setFlash(null), type === 'success' ? 3000 : 5000)
  }

  // 创建
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createRate, setCreateRate] = useState<number>(NaN)
  const [createErr, setCreateErr] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false)

  // 编辑
  const [editing, setEditing] = useState<SimpleTaxRate | null>(null)
  const [editName, setEditName] = useState('')
  const [editRate, setEditRate] = useState<number>(NaN)
  const [editErr, setEditErr] = useState<Record<string, string>>({})
  const [updating, setUpdating] = useState(false)

  // 确认（删除 / 应用到全部）
  const [deleteTarget, setDeleteTarget] = useState<SimpleTaxRate | null>(null)
  const [applyAllTarget, setApplyAllTarget] = useState<SimpleTaxRate | null>(null)
  const [applying, setApplying] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 应用范围弹窗
  const [applyModalVisible, setApplyModalVisible] = useState(false)
  const [applyScope, setApplyScope] = useState<'all' | 'selected'>('all')
  const [newTaxRateId, setNewTaxRateId] = useState('')
  const [newTaxRateName, setNewTaxRateName] = useState('')
  const [allItems, setAllItems] = useState<StoreItem[]>([])
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [applyingScope, setApplyingScope] = useState(false)

  // 管理关联商品弹窗
  const [manageItemsModalVisible, setManageItemsModalVisible] = useState(false)
  const [managingTaxRate, setManagingTaxRate] = useState<SimpleTaxRate | null>(null)
  const [linkedItems, setLinkedItems] = useState<StoreItem[]>([])
  const [loadingLinkedItems, setLoadingLinkedItems] = useState(false)
  const [savingItems, setSavingItems] = useState(false)
  const [manageSelectedItemIds, setManageSelectedItemIds] = useState<string[]>([])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        if (!tenantId) { notify('warning', t('pages.taxManagement.selectOrgFirst')); setLoading(false); return }
        let location = ''
        const currentOrg = organizations.find(org => org.id === tenantId)
        if (currentOrg?.location) location = currentOrg.location
        else {
          const org = await getOrganization(tenantId, 'beverage')
          location = org.location || ''
        }
        const region = parseAddressToRegion(location) || 'CA-BC'
        setRegionCode(region)
        await loadTaxRates(region)
      } catch (error: any) {
        notify('error', t('pages.taxManagement.initFailed', { message: error.message }))
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [tenantId, organizations])

  const loadTaxRates = async (region: string) => {
    setLoadingTaxRates(true)
    try {
      setTaxRates(await getStoreTaxRates(region) || [])
    } catch {
      setTaxRates([])
    } finally {
      setLoadingTaxRates(false)
    }
  }

  const loadAllItems = async () => {
    setLoadingItems(true)
    try {
      setAllItems(await getStoreAvailableItems())
    } catch {
      notify('error', t('pages.taxManagement.loadItemsFailed'))
    } finally {
      setLoadingItems(false)
    }
  }

  // 创建税种
  const handleCreateTaxRate = async () => {
    const e: Record<string, string> = {}
    if (!createName.trim()) e.name = t('pages.taxManagement.pleaseEnterTaxName')
    if (Number.isNaN(createRate)) e.rate = t('pages.taxManagement.pleaseEnterTaxRate')
    else if (createRate < 0 || createRate > 100) e.rate = t('pages.taxManagement.taxRateRange')
    setCreateErr(e)
    if (Object.keys(e).length) return

    setCreating(true)
    try {
      const result = await createStoreTaxRate({ name: createName, rate: createRate / 100, regionCode })
      notify('success', t('pages.taxManagement.taxCreateSuccess'))
      setCreateOpen(false)
      setNewTaxRateId(result.id)
      setNewTaxRateName(createName)
      setApplyScope('all')
      setSelectedItemIds([])
      setCreateName(''); setCreateRate(NaN)
      await loadAllItems()
      setApplyModalVisible(true)
      await loadTaxRates(regionCode)
    } catch (error: any) {
      notify('error', t('pages.taxManagement.taxCreateFailed', { message: error.message }))
    } finally {
      setCreating(false)
    }
  }

  // 确认应用范围
  const handleApplyScope = async () => {
    if (!newTaxRateId) return
    setApplyingScope(true)
    try {
      if (applyScope === 'all') {
        const itemIds = allItems.map(i => i.id)
        if (itemIds.length === 0) { notify('warning', t('pages.taxManagement.noItemsFound')); setApplyModalVisible(false); return }
        const result = await batchAssignStoreItemTaxRate(itemIds, newTaxRateId)
        notify('success', t('pages.taxManagement.appliedToCount', { name: newTaxRateName, count: result.succeeded }))
      } else {
        if (selectedItemIds.length === 0) { notify('warning', t('pages.taxManagement.selectAtLeastOneItem')); return }
        const result = await batchAssignStoreItemTaxRate(selectedItemIds, newTaxRateId)
        notify('success', t('pages.taxManagement.appliedToCount', { name: newTaxRateName, count: result.succeeded }))
      }
      setApplyModalVisible(false)
    } catch (error: any) {
      notify('error', t('pages.taxManagement.applyFailed', { message: error.message }))
    } finally {
      setApplyingScope(false)
    }
  }

  const handleSkipApply = () => {
    setApplyModalVisible(false)
    notify('info', t('pages.taxManagement.skipApplyHint'))
  }

  // 管理关联商品
  const handleManageItems = async (taxRate: SimpleTaxRate) => {
    setManagingTaxRate(taxRate)
    setManageItemsModalVisible(true)
    setLoadingLinkedItems(true)
    try {
      const [linked, storeItems] = await Promise.all([
        getStoreTaxRateItems(taxRate.id),
        getStoreAvailableItems(),
      ])
      setLinkedItems(linked)
      setAllItems(storeItems)
      setManageSelectedItemIds(linked.map(i => i.id))
    } catch (error: any) {
      notify('error', t('pages.taxManagement.loadItemDataFailed', { message: error.message }))
    } finally {
      setLoadingLinkedItems(false)
    }
  }

  const handleSaveItemAssignments = async () => {
    if (!managingTaxRate) return
    setSavingItems(true)
    try {
      const originalItemIds = linkedItems.map(i => i.id)
      const itemsToRemove = originalItemIds.filter(id => !manageSelectedItemIds.includes(id))
      const itemsToAdd = manageSelectedItemIds.filter(id => !originalItemIds.includes(id))
      if (itemsToRemove.length > 0) await batchRemoveStoreItemTaxRate(itemsToRemove)
      if (itemsToAdd.length > 0) await batchAssignStoreItemTaxRate(itemsToAdd, managingTaxRate.id)
      notify('success', t('pages.taxManagement.updatedItemAssignments', { name: managingTaxRate.name }))
      setManageItemsModalVisible(false)
    } catch (error: any) {
      notify('error', t('pages.taxManagement.saveWithMsgFailed', { message: error.message }))
    } finally {
      setSavingItems(false)
    }
  }

  const handleDeleteTaxRate = async (taxRate: SimpleTaxRate) => {
    setDeleting(true)
    try {
      await deleteStoreTaxRate(taxRate.id)
      notify('success', t('pages.taxManagement.taxDeleted', { name: taxRate.name }))
      await loadTaxRates(regionCode)
    } catch (error: any) {
      notify('error', t('pages.taxManagement.deleteWithMsgFailed', { message: error.message }))
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const openEdit = (record: SimpleTaxRate) => {
    setEditing(record)
    setEditName(record.name)
    setEditRate(record.rate * 100)
    setEditErr({})
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    const e: Record<string, string> = {}
    if (!editName.trim()) e.name = t('pages.taxManagement.pleaseEnterTaxName')
    if (Number.isNaN(editRate)) e.rate = t('pages.taxManagement.pleaseEnterTaxRate')
    else if (editRate < 0 || editRate > 100) e.rate = t('pages.taxManagement.taxRateRange')
    setEditErr(e)
    if (Object.keys(e).length) return

    setUpdating(true)
    try {
      await updateStoreTaxRate(editing.id, { name: editName, rate: editRate / 100 })
      notify('success', t('pages.taxManagement.taxUpdateSuccess'))
      setEditing(null)
      await loadTaxRates(regionCode)
    } catch (error: any) {
      notify('error', t('pages.taxManagement.updateFailed', { message: error.message }))
    } finally {
      setUpdating(false)
    }
  }

  // 应用税种到所有商品（原 getItems 未定义，改用门店可用商品）
  const handleApplyToAllItems = async (taxRate: SimpleTaxRate) => {
    setApplying(true)
    try {
      const items = await getStoreAvailableItems()
      const itemIds = items.map(i => i.id)
      if (itemIds.length === 0) { notify('warning', t('pages.taxManagement.noItemsFound')); return }
      const result = await batchAssignStoreItemTaxRate(itemIds, taxRate.id)
      if (result.failed > 0) notify('warning', t('pages.taxManagement.applyCompletePartial', { succeeded: result.succeeded, failed: result.failed }))
      else notify('success', t('pages.taxManagement.applySuccessCount', { name: taxRate.name, count: result.succeeded }))
    } catch (error: any) {
      notify('error', t('pages.taxManagement.applyFailed', { message: error.message }))
    } finally {
      setApplying(false)
      setApplyAllTarget(null)
    }
  }

  const columns: Column<SimpleTaxRate>[] = [
    { key: 'name', title: t('pages.taxManagement.colTaxName'), width: 180, render: r => <span className="font-medium text-slate-800">{r.name}</span> },
    { key: 'rate', title: t('pages.taxManagement.colRate'), width: 110, render: r => <Badge variant="blue">{(r.rate * 100).toFixed(2)}%</Badge> },
    {
      key: 'actions', title: t('pages.taxManagement.colActions'),
      render: r => canEdit ? (
        <div className="flex items-center gap-1 flex-wrap">
          <Btn variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openEdit(r)}>{t('pages.taxManagement.editBtn')}</Btn>
          <Btn variant="ghost" size="sm" icon={<LayoutGrid className="w-3.5 h-3.5" />} onClick={() => handleManageItems(r)}>{t('pages.taxManagement.manageItemsBtn')}</Btn>
          <Btn variant="ghost" size="sm" icon={<StoreIcon className="w-3.5 h-3.5" />} onClick={() => setApplyAllTarget(r)}>{t('pages.taxManagement.applyToAllBtn')}</Btn>
          <Tooltip label={t('pages.taxManagement.deleteTooltip')}>
            <button onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer">
              <Trash2 className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      ) : null,
    },
  ]

  if (loading) return <Spinner className="py-24" />

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <PageHeader
        title={t('pages.taxManagement.pageTitle')}
        description={<>{t('pages.taxManagement.currentRegionLabel')}<Badge variant="green">{getRegionDisplayName(regionCode)}</Badge></>}
        actions={
          <>
            <Btn variant="secondary" icon={<RotateCcw className="w-3.5 h-3.5" />} loading={loadingTaxRates} onClick={() => loadTaxRates(regionCode)}>{t('common.refresh')}</Btn>
            {canEdit && <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => { setCreateName(''); setCreateRate(NaN); setCreateErr({}); setCreateOpen(true) }}>{t('pages.taxManagement.addTaxRateBtn')}</Btn>}
          </>
        }
      />

      <div className="space-y-4">
        {flash && <AlertBox type={flash.type} title={flash.msg} />}

        {!tenantId ? (
          <SectionCard><EmptyState title={t('pages.taxManagement.selectOrgFirst')} /></SectionCard>
        ) : (
          <>
            <SectionCard title={t('pages.taxManagement.configuredTaxRatesTitle')} bodyClassName="p-0">
              <div className="p-4">
                {loadingTaxRates ? (
                  <Spinner />
                ) : taxRates.length === 0 ? (
                  <EmptyState
                    title={t('pages.taxManagement.noTaxRatesConfigured')}
                    action={canEdit ? <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreateOpen(true)}>{t('pages.taxManagement.createFirstTaxRateBtn')}</Btn> : undefined}
                  />
                ) : (
                  <Table columns={columns} data={taxRates} rowKey={r => r.id} />
                )}
              </div>
            </SectionCard>

            <SectionCard title={t('pages.taxManagement.taxRateReferenceTitle')}>
              <p className="text-sm text-slate-500 mb-3">{t('pages.taxManagement.taxRateReferenceDesc')}</p>
              <div className="flex flex-wrap gap-2">
                <Badge>{t('pages.taxManagement.bcRate')}</Badge>
                <Badge>{t('pages.taxManagement.onRate')}</Badge>
                <Badge>{t('pages.taxManagement.qcRate')}</Badge>
                <Badge>{t('pages.taxManagement.caRate')}</Badge>
              </div>
            </SectionCard>
          </>
        )}
      </div>

      {/* 创建税种弹窗 */}
      <Modal
        open={createOpen}
        onOpenChange={v => !v && setCreateOpen(false)}
        title={t('pages.taxManagement.createTaxRateModalTitle')}
        footer={<><Btn variant="secondary" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Btn><Btn variant="primary" loading={creating} onClick={handleCreateTaxRate}>{t('common.create')}</Btn></>}
      >
        <div className="space-y-4">
          <AlertBox type="info" title={t('pages.taxManagement.createTaxRateHint')} />
          <Field label={t('pages.taxManagement.taxNameLabel')} required error={createErr.name}>
            <TextInput value={createName} onChange={setCreateName} placeholder={t('pages.taxManagement.taxNamePlaceholder')} />
          </Field>
          <Field label={t('pages.taxManagement.taxRateLabel')} required error={createErr.rate}>
            <NumberInput value={createRate} onChange={setCreateRate} min={0} max={100} suffix="%" className="w-full" />
          </Field>
        </div>
      </Modal>

      {/* 编辑税种弹窗 */}
      <Modal
        open={!!editing}
        onOpenChange={v => !v && setEditing(null)}
        title={t('pages.taxManagement.editTaxRateModalTitle')}
        footer={<><Btn variant="secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</Btn><Btn variant="primary" loading={updating} onClick={handleSaveEdit}>{t('common.save')}</Btn></>}
      >
        <div className="space-y-4">
          <Field label={t('pages.taxManagement.taxNameLabel')} required error={editErr.name}>
            <TextInput value={editName} onChange={setEditName} placeholder={t('pages.taxManagement.taxNamePlaceholder')} />
          </Field>
          <Field label={t('pages.taxManagement.taxRateLabel')} required error={editErr.rate}>
            <NumberInput value={editRate} onChange={setEditRate} min={0} max={100} suffix="%" className="w-full" />
          </Field>
        </div>
      </Modal>

      {/* 应用范围选择弹窗 */}
      <Modal
        open={applyModalVisible}
        onOpenChange={v => !v && handleSkipApply()}
        title={t('pages.taxManagement.applyTaxRateModalTitle', { name: newTaxRateName })}
        size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={handleSkipApply}>{t('pages.taxManagement.laterBtn')}</Btn>
            <Btn variant="primary" loading={applyingScope} onClick={handleApplyScope}>
              {applyScope === 'all' ? t('pages.taxManagement.applyToStoreBtn') : t('pages.taxManagement.applyToCountBtn', { count: selectedItemIds.length })}
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          <AlertBox type="info" title={t('pages.taxManagement.selectScopeHintTitle')} description={t('pages.taxManagement.selectScopeHintDesc')} />
          <div className="grid grid-cols-2 gap-3">
            {([
              ['all', <StoreIcon className="w-4 h-4" />, t('pages.taxManagement.allStoreItemsLabel'), t('pages.taxManagement.itemCountHint', { count: allItems.length })],
              ['selected', <LayoutGrid className="w-4 h-4" />, t('pages.taxManagement.selectSpecificItemsLabel'), t('pages.taxManagement.manualPickHint')],
            ] as const).map(([val, icon, label, hint]) => (
              <button
                key={val}
                onClick={() => setApplyScope(val)}
                className={`text-left rounded-lg border px-3.5 py-3 transition-all cursor-pointer ${applyScope === val ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <div className="flex items-center gap-2 text-slate-700">{icon}<span className="text-sm font-medium">{label}</span></div>
                <p className="text-xs text-slate-400 mt-1 pl-6">{hint}</p>
              </button>
            ))}
          </div>

          {applyScope === 'selected' && (
            loadingItems ? <Spinner /> : (
              <Transfer
                items={allItems}
                value={selectedItemIds}
                onChange={setSelectedItemIds}
                getKey={i => i.id}
                getLabel={i => i.name}
                renderItem={renderStoreItem}
                titles={[t('pages.taxManagement.availableItemsTitle'), t('pages.taxManagement.selectedItemsTitle')]}
              />
            )
          )}
        </div>
      </Modal>

      {/* 管理关联商品弹窗 */}
      <Modal
        open={manageItemsModalVisible}
        onOpenChange={v => !v && setManageItemsModalVisible(false)}
        title={t('pages.taxManagement.manageLinkedItemsModalTitle', { name: managingTaxRate?.name || '' })}
        size="lg"
        footer={<><Btn variant="secondary" onClick={() => setManageItemsModalVisible(false)}>{t('common.cancel')}</Btn><Btn variant="primary" loading={savingItems} onClick={handleSaveItemAssignments}>{t('common.save')}</Btn></>}
      >
        <div className="space-y-4">
          <AlertBox type="info" title={t('pages.taxManagement.manageLinkedItemsHintTitle')} description={t('pages.taxManagement.manageLinkedItemsHintDesc')} />
          {loadingLinkedItems ? (
            <Spinner />
          ) : (
            <>
              <p className="text-sm text-slate-500">
                {t('pages.taxManagement.currentlyLinkedCount', { linked: manageSelectedItemIds.length, total: allItems.length })}
              </p>
              <Transfer
                items={allItems}
                value={manageSelectedItemIds}
                onChange={setManageSelectedItemIds}
                getKey={i => i.id}
                getLabel={i => i.name}
                renderItem={renderStoreItem}
                titles={[t('pages.taxManagement.unlinkedItemsTitle'), t('pages.taxManagement.linkedItemsTitle')]}
                height={360}
              />
            </>
          )}
        </div>
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={v => !v && setDeleteTarget(null)}
        title={t('pages.taxManagement.confirmDeleteTitle')}
        description={t('pages.taxManagement.confirmDeleteTaxDesc', { name: deleteTarget?.name ?? '' })}
        confirmText={t('pages.taxManagement.deleteTooltip')}
        danger
        loading={deleting}
        onConfirm={() => deleteTarget && handleDeleteTaxRate(deleteTarget)}
      />

      {/* 应用到全部确认 */}
      <ConfirmDialog
        open={!!applyAllTarget}
        onOpenChange={v => !v && setApplyAllTarget(null)}
        title={t('pages.taxManagement.confirmApplyTitle')}
        description={t('pages.taxManagement.confirmApplyDesc', { name: applyAllTarget?.name ?? '' })}
        confirmText={t('common.confirm')}
        loading={applying}
        onConfirm={() => applyAllTarget && handleApplyToAllItems(applyAllTarget)}
      />
    </div>
  )
}

export default TaxManagement
