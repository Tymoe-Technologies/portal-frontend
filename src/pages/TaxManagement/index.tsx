import React, { useState, useEffect } from 'react'
import { Plus, RotateCcw, Pencil, Trash2, Store as StoreIcon, LayoutGrid } from 'lucide-react'
import { useAuthContext } from '../../auth/AuthProvider'
import { getOrganization } from '../../services/auth'
import {
  getStoreAvailableItems, getStoreTaxRates, createStoreTaxRate, updateStoreTaxRate,
  deleteStoreTaxRate, getStoreTaxRateItems, batchAssignStoreItemTaxRate,
  batchRemoveStoreItemTaxRate, type SimpleTaxRate,
} from '../../services/item-management'
import {
  PageHeader, SectionCard, Table, Badge, Btn, AlertBox, Spinner, EmptyState,
  Modal, ConfirmDialog, Field, TextInput, NumberInput, Transfer, type Column,
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

function getRegionDisplayName(regionCode: string): string {
  const names: Record<string, string> = {
    'CA-BC': '加拿大 - 不列颠哥伦比亚省',
    'CA-ON': '加拿大 - 安大略省',
    'CA-QC': '加拿大 - 魁北克省',
    'US-CA': '美国 - 加利福尼亚州',
    'US-NY': '美国 - 纽约州',
    'US-TX': '美国 - 德克萨斯州',
  }
  return names[regionCode] || regionCode
}

// 商品条目渲染（供 Transfer 使用）
const renderStoreItem = (item: StoreItem) => (
  <>
    <span className="truncate">{item.name}</span>
    {item.isLocal && <Badge variant="blue">本店</Badge>}
    <span className="text-xs text-slate-400 ml-auto shrink-0">${(item.basePrice / 100).toFixed(2)}</span>
  </>
)

const TaxManagement: React.FC = () => {
  const { organizations } = useAuthContext()
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
        if (!tenantId) { notify('warning', '请先选择一个组织'); setLoading(false); return }
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
        notify('error', `初始化失败: ${error.message}`)
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
      notify('error', '加载商品列表失败')
    } finally {
      setLoadingItems(false)
    }
  }

  // 创建税种
  const handleCreateTaxRate = async () => {
    const e: Record<string, string> = {}
    if (!createName.trim()) e.name = '请输入税种名称'
    if (Number.isNaN(createRate)) e.rate = '请输入税率'
    else if (createRate < 0 || createRate > 100) e.rate = '税率必须在 0-100 之间'
    setCreateErr(e)
    if (Object.keys(e).length) return

    setCreating(true)
    try {
      const result = await createStoreTaxRate({ name: createName, rate: createRate / 100, regionCode })
      notify('success', '税种创建成功')
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
      notify('error', `创建失败: ${error.message}`)
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
        if (itemIds.length === 0) { notify('warning', '没有找到商品'); setApplyModalVisible(false); return }
        const result = await batchAssignStoreItemTaxRate(itemIds, newTaxRateId)
        notify('success', `已将「${newTaxRateName}」应用到 ${result.succeeded} 个商品`)
      } else {
        if (selectedItemIds.length === 0) { notify('warning', '请选择至少一个商品'); return }
        const result = await batchAssignStoreItemTaxRate(selectedItemIds, newTaxRateId)
        notify('success', `已将「${newTaxRateName}」应用到 ${result.succeeded} 个商品`)
      }
      setApplyModalVisible(false)
    } catch (error: any) {
      notify('error', `应用失败: ${error.message}`)
    } finally {
      setApplyingScope(false)
    }
  }

  const handleSkipApply = () => {
    setApplyModalVisible(false)
    notify('info', '您可以稍后在税种列表中点击「应用到全部」或「管理商品」应用')
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
      notify('error', `加载商品数据失败: ${error.message}`)
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
      notify('success', `已更新「${managingTaxRate.name}」的商品关联`)
      setManageItemsModalVisible(false)
    } catch (error: any) {
      notify('error', `保存失败: ${error.message}`)
    } finally {
      setSavingItems(false)
    }
  }

  const handleDeleteTaxRate = async (taxRate: SimpleTaxRate) => {
    setDeleting(true)
    try {
      await deleteStoreTaxRate(taxRate.id)
      notify('success', `税种「${taxRate.name}」已删除`)
      await loadTaxRates(regionCode)
    } catch (error: any) {
      notify('error', `删除失败: ${error.message}`)
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
    if (!editName.trim()) e.name = '请输入税种名称'
    if (Number.isNaN(editRate)) e.rate = '请输入税率'
    else if (editRate < 0 || editRate > 100) e.rate = '税率必须在 0-100 之间'
    setEditErr(e)
    if (Object.keys(e).length) return

    setUpdating(true)
    try {
      await updateStoreTaxRate(editing.id, { name: editName, rate: editRate / 100 })
      notify('success', '税种更新成功')
      setEditing(null)
      await loadTaxRates(regionCode)
    } catch (error: any) {
      notify('error', `更新失败: ${error.message}`)
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
      if (itemIds.length === 0) { notify('warning', '没有找到商品'); return }
      const result = await batchAssignStoreItemTaxRate(itemIds, taxRate.id)
      if (result.failed > 0) notify('warning', `应用完成: 成功 ${result.succeeded} 个, 失败 ${result.failed} 个`)
      else notify('success', `成功将「${taxRate.name}」应用到 ${result.succeeded} 个商品`)
    } catch (error: any) {
      notify('error', `应用失败: ${error.message}`)
    } finally {
      setApplying(false)
      setApplyAllTarget(null)
    }
  }

  const columns: Column<SimpleTaxRate>[] = [
    { key: 'name', title: '税种名称', width: 180, render: r => <span className="font-medium text-slate-800">{r.name}</span> },
    { key: 'rate', title: '税率', width: 110, render: r => <Badge variant="blue">{(r.rate * 100).toFixed(2)}%</Badge> },
    {
      key: 'actions', title: '操作',
      render: r => (
        <div className="flex items-center gap-1 flex-wrap">
          <Btn variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openEdit(r)}>编辑</Btn>
          <Btn variant="ghost" size="sm" icon={<LayoutGrid className="w-3.5 h-3.5" />} onClick={() => handleManageItems(r)}>管理商品</Btn>
          <Btn variant="ghost" size="sm" icon={<StoreIcon className="w-3.5 h-3.5" />} onClick={() => setApplyAllTarget(r)}>应用到全部</Btn>
          <button title="删除" onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  if (loading) return <Spinner className="py-24" />

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <PageHeader
        title="税务管理"
        description={<>当前税务地区：<Badge variant="green">{getRegionDisplayName(regionCode)}</Badge></>}
        actions={
          <>
            <Btn variant="secondary" icon={<RotateCcw className="w-3.5 h-3.5" />} loading={loadingTaxRates} onClick={() => loadTaxRates(regionCode)}>刷新</Btn>
            <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => { setCreateName(''); setCreateRate(NaN); setCreateErr({}); setCreateOpen(true) }}>添加税种</Btn>
          </>
        }
      />

      <div className="space-y-4">
        {flash && <AlertBox type={flash.type} title={flash.msg} />}

        {!tenantId ? (
          <SectionCard><EmptyState title="请先在顶部选择一个组织" /></SectionCard>
        ) : (
          <>
            <SectionCard title="已配置的税种" bodyClassName="p-0">
              <div className="p-4">
                {loadingTaxRates ? (
                  <Spinner />
                ) : taxRates.length === 0 ? (
                  <EmptyState
                    title="暂无税种配置"
                    action={<Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreateOpen(true)}>创建第一个税种</Btn>}
                  />
                ) : (
                  <Table columns={columns} data={taxRates} rowKey={r => r.id} />
                )}
              </div>
            </SectionCard>

            <SectionCard title="税率参考">
              <p className="text-sm text-slate-500 mb-3">以下是常见地区的税率参考，请根据实际情况配置：</p>
              <div className="flex flex-wrap gap-2">
                <Badge>BC省: GST 5% + PST 7%</Badge>
                <Badge>安大略省: HST 13%</Badge>
                <Badge>魁北克省: GST 5% + QST 9.975%</Badge>
                <Badge>加州: 7.25% ~ 10.25%</Badge>
              </div>
            </SectionCard>
          </>
        )}
      </div>

      {/* 创建税种弹窗 */}
      <Modal
        open={createOpen}
        onOpenChange={v => !v && setCreateOpen(false)}
        title="创建新税种"
        footer={<><Btn variant="secondary" onClick={() => setCreateOpen(false)}>取消</Btn><Btn variant="primary" loading={creating} onClick={handleCreateTaxRate}>创建</Btn></>}
      >
        <div className="space-y-4">
          <AlertBox type="info" title="输入税种名称和税率即可创建，创建后可应用到全部或特定商品。" />
          <Field label="税种名称" required error={createErr.name}>
            <TextInput value={createName} onChange={setCreateName} placeholder="例如: GST, PST, HST" />
          </Field>
          <Field label="税率" required error={createErr.rate}>
            <NumberInput value={createRate} onChange={setCreateRate} min={0} max={100} suffix="%" className="w-full" />
          </Field>
        </div>
      </Modal>

      {/* 编辑税种弹窗 */}
      <Modal
        open={!!editing}
        onOpenChange={v => !v && setEditing(null)}
        title="编辑税种"
        footer={<><Btn variant="secondary" onClick={() => setEditing(null)}>取消</Btn><Btn variant="primary" loading={updating} onClick={handleSaveEdit}>保存</Btn></>}
      >
        <div className="space-y-4">
          <Field label="税种名称" required error={editErr.name}>
            <TextInput value={editName} onChange={setEditName} placeholder="例如: GST, PST, HST" />
          </Field>
          <Field label="税率" required error={editErr.rate}>
            <NumberInput value={editRate} onChange={setEditRate} min={0} max={100} suffix="%" className="w-full" />
          </Field>
        </div>
      </Modal>

      {/* 应用范围选择弹窗 */}
      <Modal
        open={applyModalVisible}
        onOpenChange={v => !v && handleSkipApply()}
        title={`应用税种「${newTaxRateName}」`}
        size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={handleSkipApply}>稍后再说</Btn>
            <Btn variant="primary" loading={applyingScope} onClick={handleApplyScope}>
              {applyScope === 'all' ? '应用到全店' : `应用到 ${selectedItemIds.length} 个商品`}
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          <AlertBox type="info" title="选择税种应用范围" description="可应用到全店所有商品，或选择特定商品。" />
          <div className="grid grid-cols-2 gap-3">
            {([['all', <StoreIcon className="w-4 h-4" />, '全店所有商品', `${allItems.length} 个商品`], ['selected', <LayoutGrid className="w-4 h-4" />, '选择特定商品', '手动挑选']] as const).map(([val, icon, label, hint]) => (
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
                titles={['可选商品', '已选商品']}
              />
            )
          )}
        </div>
      </Modal>

      {/* 管理关联商品弹窗 */}
      <Modal
        open={manageItemsModalVisible}
        onOpenChange={v => !v && setManageItemsModalVisible(false)}
        title={`管理「${managingTaxRate?.name || ''}」关联的商品`}
        size="lg"
        footer={<><Btn variant="secondary" onClick={() => setManageItemsModalVisible(false)}>取消</Btn><Btn variant="primary" loading={savingItems} onClick={handleSaveItemAssignments}>保存修改</Btn></>}
      >
        <div className="space-y-4">
          <AlertBox type="info" title="管理税种关联的商品" description="左侧未关联、右侧已关联，点击条目即可移动。" />
          {loadingLinkedItems ? (
            <Spinner />
          ) : (
            <>
              <p className="text-sm text-slate-500">
                当前已关联 <span className="font-semibold text-slate-800">{manageSelectedItemIds.length}</span> 个商品（共 {allItems.length} 个可选）
              </p>
              <Transfer
                items={allItems}
                value={manageSelectedItemIds}
                onChange={setManageSelectedItemIds}
                getKey={i => i.id}
                getLabel={i => i.name}
                renderItem={renderStoreItem}
                titles={['未关联商品', '已关联商品']}
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
        title="确认删除"
        description={`确定要删除税种「${deleteTarget?.name ?? ''}」吗？`}
        confirmText="删除"
        danger
        loading={deleting}
        onConfirm={() => deleteTarget && handleDeleteTaxRate(deleteTarget)}
      />

      {/* 应用到全部确认 */}
      <ConfirmDialog
        open={!!applyAllTarget}
        onOpenChange={v => !v && setApplyAllTarget(null)}
        title="确认应用"
        description={`将「${applyAllTarget?.name ?? ''}」应用到所有商品？`}
        confirmText="确认"
        loading={applying}
        onConfirm={() => applyAllTarget && handleApplyToAllItems(applyAllTarget)}
      />
    </div>
  )
}

export default TaxManagement
