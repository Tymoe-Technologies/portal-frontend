import React, { useMemo, useState } from 'react'
import { Plus, Trash2, Search, GripVertical } from 'lucide-react'
import type { ComboItemGroup, Item, CreateComboItemPayload } from '@/services/item-management'
import { fromMinorUnit, toMinorUnit } from '@/utils/priceConverter'
import { Modal, Btn, Checkbox, SelectInput, EmptyState, ConfirmDialog, toast } from '@/components/ui-kit'

interface ComboItemGroupsConfigProps {
  groups: ComboItemGroup[]
  onGroupsChange: (groups: ComboItemGroup[]) => void
  comboItems: CreateComboItemPayload[]
  onComboItemsChange: (items: CreateComboItemPayload[]) => void
  allItems: Item[]
}

const inputCls = 'text-sm border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:outline-2 focus:outline-slate-900'

export const ComboItemGroupsConfig: React.FC<ComboItemGroupsConfigProps> = ({
  groups, onGroupsChange, comboItems, onComboItemsChange, allItems,
}) => {
  const [modalGroupId, setModalGroupId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [tempItemConfig, setTempItemConfig] = useState<Record<string, { selected: boolean; additionalPrice: number }>>({})
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingPrice, setEditingPrice] = useState<number>(0)
  const [deleteGroupIndex, setDeleteGroupIndex] = useState<number | null>(null)

  const handleAddGroup = () => {
    const newGroup: ComboItemGroup = {
      id: `group-${Date.now()}`,
      name: '',
      selectionType: 'single',
      minSelections: 1,
      maxSelections: 1,
      sortOrder: groups.length,
    }
    onGroupsChange([...groups, newGroup])
  }

  const handleUpdateGroup = (index: number, updates: Partial<ComboItemGroup>) => {
    const newGroups = [...groups]
    newGroups[index] = { ...newGroups[index], ...updates }
    if (updates.selectionType === 'single') {
      newGroups[index].minSelections = 1
      newGroups[index].maxSelections = 1
    }
    onGroupsChange(newGroups)
  }

  const confirmDeleteGroup = (index: number) => {
    const groupId = groups[index].id
    const updatedItems = comboItems.map(item => item.groupId === groupId ? { ...item, groupId: undefined } : item)
    onComboItemsChange(updatedItems)
    onGroupsChange(groups.filter((_, i) => i !== index))
    toast.success('分组已删除')
    setDeleteGroupIndex(null)
  }

  const getGroupItems = (groupId: string) => comboItems.filter(item => item.groupId === groupId)
  const getItemName = (itemId: string) => allItems.find(i => i.id === itemId)?.name || '未知商品'
  const getItemBasePrice = (itemId: string) => allItems.find(i => i.id === itemId)?.basePrice || 0

  const handleOpenModal = (groupId: string) => {
    const init: Record<string, { selected: boolean; additionalPrice: number }> = {}
    allItems.forEach(item => {
      const comboItem = comboItems.find(ci => ci.itemId === item.id)
      init[item.id] = { selected: comboItem?.groupId === groupId, additionalPrice: comboItem?.additionalPrice || 0 }
    })
    setTempItemConfig(init)
    setModalGroupId(groupId)
    setSearchText('')
  }

  const handleModalConfirm = () => {
    const updatedItems: CreateComboItemPayload[] = []
    const processedItemIds = new Set<string>()

    Object.entries(tempItemConfig).forEach(([itemId, cfg]) => {
      processedItemIds.add(itemId)
      const existingItem = comboItems.find(ci => ci.itemId === itemId)
      if (cfg.selected) {
        if (existingItem) {
          updatedItems.push({ ...existingItem, groupId: modalGroupId! })
        } else {
          updatedItems.push({ itemId, quantity: 1, isRequired: false, sortOrder: updatedItems.length, groupId: modalGroupId!, additionalPrice: 0 })
        }
      } else if (existingItem) {
        if (existingItem.groupId === modalGroupId) updatedItems.push({ ...existingItem, groupId: undefined })
        else updatedItems.push(existingItem)
      }
    })

    comboItems.forEach(item => { if (!processedItemIds.has(item.itemId)) updatedItems.push(item) })
    onComboItemsChange(updatedItems)

    const currentGroup = groups.find(g => g.id === modalGroupId)
    if (currentGroup && currentGroup.selectionType === 'multiple') {
      const groupItemCount = updatedItems.filter(item => item.groupId === modalGroupId).length
      if (groupItemCount > 0 && currentGroup.maxSelections > groupItemCount) {
        onGroupsChange(groups.map(g => g.id === modalGroupId ? { ...g, maxSelections: groupItemCount, minSelections: groupItemCount } : g))
      }
    }

    setModalGroupId(null)
    toast.success('商品已更新')
  }

  const filteredItems = useMemo(
    () => allItems
      .filter(item => item.name.toLowerCase().includes(searchText.toLowerCase()))
      .map(item => {
        const existingComboItem = comboItems.find(ci => ci.itemId === item.id)
        return (existingComboItem || { itemId: item.id, quantity: 1, isRequired: false, sortOrder: comboItems.length, additionalPrice: 0 }) as CreateComboItemPayload
      }),
    [allItems, comboItems, searchText]
  )

  const editingGroup = groups.find(g => g.id === modalGroupId)

  const commitPrice = (itemId: string) => {
    onComboItemsChange(comboItems.map(ci => ci.itemId === itemId ? { ...ci, additionalPrice: toMinorUnit(editingPrice) } : ci))
    setEditingItemId(null)
  }

  const removeFromGroup = (itemId: string, groupId: string) => {
    const updatedItems = comboItems.map(ci => ci.itemId === itemId ? { ...ci, groupId: undefined } : ci)
    onComboItemsChange(updatedItems)
    const currentGroup = groups.find(g => g.id === groupId)
    if (currentGroup && currentGroup.selectionType === 'multiple') {
      const remainingCount = updatedItems.filter(item => item.groupId === groupId).length
      if (remainingCount > 0 && currentGroup.maxSelections > remainingCount) {
        onGroupsChange(groups.map(g => g.id === groupId ? { ...g, maxSelections: remainingCount, minSelections: remainingCount } : g))
      }
    }
  }

  return (
    <div>
      {/* 分组列表 */}
      {groups.map((group, index) => {
        const groupItemCount = getGroupItems(group.id).length
        return (
          <div key={group.id} className="rounded-lg border border-slate-200 mb-3">
            {/* 头部 */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/60 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <GripVertical className="w-4 h-4 text-slate-300 cursor-move" />
                <input
                  className={`${inputCls} w-48`}
                  placeholder="分组名称，如：主食选择"
                  value={group.name}
                  onChange={e => handleUpdateGroup(index, { name: e.target.value })}
                />
                <SelectInput
                  value={group.selectionType}
                  onChange={v => handleUpdateGroup(index, { selectionType: v })}
                  options={[
                    { label: '单选（N选1）', value: 'single' },
                    { label: '多选（N选M）', value: 'multiple' },
                  ]}
                  className="py-1"
                />
                {group.selectionType === 'multiple' && (
                  groupItemCount === 0 ? (
                    <span className="text-xs text-slate-400">请先添加商品</span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className="font-medium text-slate-600">{groupItemCount}选</span>
                      <input
                        type="number" min={1} max={groupItemCount} value={group.maxSelections}
                        onChange={e => { const nv = Math.min(Number(e.target.value) || 1, groupItemCount); handleUpdateGroup(index, { maxSelections: nv, minSelections: nv }) }}
                        className={`${inputCls} w-16`}
                      />
                      <span className="text-slate-500 font-medium">(顾客必选{group.maxSelections || 1}项)</span>
                    </span>
                  )
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Btn variant="primary" size="sm" onClick={() => handleOpenModal(group.id)}>添加商品</Btn>
                <button title="删除分组" onClick={() => setDeleteGroupIndex(index)} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 分组内商品 */}
            <div className="p-3">
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-2 min-h-[60px]">
                {groupItemCount === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-4">点击右上角“添加商品”来配置此分组</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {getGroupItems(group.id).map(comboItem => (
                      <div key={comboItem.itemId} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1">
                        <span className="text-sm text-slate-700">{getItemName(comboItem.itemId)}</span>
                        {editingItemId === comboItem.itemId ? (
                          <span className="flex items-center gap-1.5">
                            <input
                              type="number" min={0} step={0.01} autoFocus value={editingPrice}
                              onChange={e => setEditingPrice(Number(e.target.value) || 0)}
                              onKeyDown={e => { if (e.key === 'Enter') commitPrice(comboItem.itemId) }}
                              className={`${inputCls} w-20`}
                            />
                            <button onClick={() => commitPrice(comboItem.itemId)} className="text-xs text-slate-700 hover:underline cursor-pointer">确定</button>
                            <button onClick={() => setEditingItemId(null)} className="text-xs text-slate-400 hover:underline cursor-pointer">取消</button>
                          </span>
                        ) : (
                          <>
                            <span
                              className={`text-xs cursor-pointer ${comboItem.additionalPrice ? 'text-emerald-600' : 'text-slate-400'}`}
                              title="点击编辑额外费用"
                              onClick={() => { setEditingItemId(comboItem.itemId); setEditingPrice(fromMinorUnit(comboItem.additionalPrice || 0)) }}
                            >
                              {comboItem.additionalPrice ? `+${fromMinorUnit(comboItem.additionalPrice).toFixed(2)}` : '+0.00'}
                            </span>
                            <button onClick={() => removeFromGroup(comboItem.itemId, group.id)} className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* 添加分组按钮 */}
      <button onClick={handleAddGroup} className="w-full rounded-lg border border-dashed border-slate-300 py-2 mb-4 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors cursor-pointer inline-flex items-center justify-center gap-1">
        <Plus className="w-3.5 h-3.5" />添加商品分组
      </button>

      {/* 商品管理弹窗 */}
      <Modal
        open={modalGroupId !== null}
        onOpenChange={v => !v && setModalGroupId(null)}
        title={editingGroup ? `“${editingGroup.name}” 分组商品` : '添加商品'}
        size="lg"
        footer={<><Btn variant="secondary" onClick={() => setModalGroupId(null)}>取消</Btn><Btn variant="primary" onClick={handleModalConfirm}>确认添加</Btn></>}
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              placeholder="搜索商品名称..." value={searchText} onChange={e => setSearchText(e.target.value)}
              className="w-full text-sm bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-700 placeholder:text-slate-400 focus:outline-2 focus:outline-slate-900"
            />
          </div>

          <div className="max-h-96 overflow-y-auto sidebar-scroll divide-y divide-slate-100">
            {filteredItems.length === 0 ? (
              <EmptyState title="无匹配商品" />
            ) : filteredItems.map(comboItem => {
              const itemName = getItemName(comboItem.itemId)
              const itemPrice = getItemBasePrice(comboItem.itemId)
              const cfg = tempItemConfig[comboItem.itemId]
              const existingComboItem = comboItems.find(ci => ci.itemId === comboItem.itemId)
              const isInOtherGroup = existingComboItem?.groupId && existingComboItem.groupId !== modalGroupId
                ? groups.find(g => g.id === existingComboItem.groupId)?.name || '未命名分组'
                : null
              return (
                <div key={comboItem.itemId} className={`flex items-center gap-3 py-3 ${isInOtherGroup ? 'opacity-70' : ''}`}>
                  <Checkbox
                    checked={cfg?.selected || false}
                    onCheckedChange={c => setTempItemConfig({ ...tempItemConfig, [comboItem.itemId]: { ...cfg, selected: c } })}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 text-sm truncate">{itemName}</div>
                    {isInOtherGroup && <div className="text-xs text-slate-400">已在“{isInOtherGroup}”分组</div>}
                  </div>
                  <div className="text-xs text-slate-500 shrink-0">原价: {fromMinorUnit(itemPrice).toFixed(2)}</div>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>

      {/* 删除分组确认 */}
      <ConfirmDialog
        open={deleteGroupIndex !== null}
        onOpenChange={v => !v && setDeleteGroupIndex(null)}
        title="删除分组"
        description="确定要删除这个分组吗？分组内的商品将不再关联任何分组。"
        confirmText="删除"
        danger
        onConfirm={() => deleteGroupIndex !== null && confirmDeleteGroup(deleteGroupIndex)}
      />
    </div>
  )
}

export default ComboItemGroupsConfig
