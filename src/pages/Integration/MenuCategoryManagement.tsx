import React, { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, LayoutGrid } from 'lucide-react'
import { uberService, MenuCategory, MenuCategoryItem } from '@/services/uber'
import { itemManagementService } from '@/services/item-management'
import {
  SectionCard, Btn, Table, type Column, Modal, Drawer, TextInput, NumberInput,
  Checkbox, EmptyState, Spinner, ConfirmDialog, FormRow, toast,
} from '@/components/ui-kit'

interface MenuCategoryManagementProps {
  integrationId: string
  tenantId: string
}

interface POSItem {
  id: string
  name: string
  categoryId?: string
  categoryName?: string
}

/**
 * 菜单分类管理组件（简化版）
 * 允许用户为 Uber 创建分类并配置商品
 */
const MenuCategoryManagement: React.FC<MenuCategoryManagementProps> = ({ integrationId, tenantId: propTenantId }) => {
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | null>(null)
  const [categoryItems, setCategoryItems] = useState<MenuCategoryItem[]>([])
  const [posItems, setPosItems] = useState<POSItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // 分类表单
  const [fName, setFName] = useState('')
  const [fOrder, setFOrder] = useState(0)
  const [fError, setFError] = useState('')

  const tenantId = propTenantId || localStorage.getItem('organization_id') || ''

  const loadCategories = async () => {
    try {
      setLoading(true)
      const data = await uberService.getMenuCategories(integrationId)
      setCategories(data)
    } catch (error: any) {
      toast.error(error.message || '加载分类失败')
    } finally {
      setLoading(false)
    }
  }

  const loadPosItems = async () => {
    try {
      setItemsLoading(true)
      const items = await itemManagementService.getItems(tenantId)
      setPosItems(items || [])
    } catch (error: any) {
      toast.error(error.message || '加载商品失败')
    } finally {
      setItemsLoading(false)
    }
  }

  const loadCategoryItems = async (categoryId: string) => {
    try {
      setItemsLoading(true)
      const items = await uberService.getMenuCategoryItems(categoryId)
      setCategoryItems(items)
      setSelectedItems(items.map(item => item.posItemId))
    } catch (error: any) {
      toast.error(error.message || '加载分类商品失败')
    } finally {
      setItemsLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
    loadPosItems()
  }, [integrationId])

  const handleOpenModal = (category?: MenuCategory) => {
    setEditingCategory(category || null)
    setFName(category?.name || '')
    setFOrder(category?.displayOrder ?? 0)
    setFError('')
    setModalVisible(true)
  }

  const handleSaveCategory = async () => {
    if (!fName.trim()) { setFError('请输入分类名称'); return }
    setFError('')
    try {
      if (editingCategory) {
        await uberService.updateMenuCategory(editingCategory.id, fName, fOrder)
        toast.success('更新成功')
      } else {
        await uberService.createMenuCategory(integrationId, fName, fOrder)
        toast.success('创建成功')
      }
      setModalVisible(false)
      loadCategories()
    } catch (error: any) {
      toast.error(error.message || '保存失败')
    }
  }

  const handleDeleteCategory = async () => {
    if (!deleteId) return
    try {
      await uberService.deleteMenuCategory(deleteId)
      toast.success('删除成功')
      setDeleteId(null)
      loadCategories()
    } catch (error: any) {
      toast.error(error.message || '删除失败')
    }
  }

  const handleOpenItemsDrawer = async (category: MenuCategory) => {
    setSelectedCategory(category)
    await loadCategoryItems(category.id)
    setDrawerVisible(true)
  }

  const handleAddItems = async () => {
    if (!selectedCategory || selectedItems.length === 0) {
      toast.warning('请选择商品')
      return
    }
    try {
      const existingItemIds = categoryItems.map(item => item.posItemId)
      const newItemIds = selectedItems.filter(id => !existingItemIds.includes(id))
      for (const itemId of newItemIds) {
        const item = posItems.find(p => p.id === itemId)
        await uberService.addItemToMenuCategory(selectedCategory.id, itemId, item?.name, categoryItems.length + newItemIds.indexOf(itemId))
      }
      toast.success(`添加了 ${newItemIds.length} 个商品`)
      await loadCategoryItems(selectedCategory.id)
      setSelectedItems([])
    } catch (error: any) {
      toast.error(error.message || '添加失败')
    }
  }

  const handleRemoveItem = async (itemId: string) => {
    try {
      await uberService.removeItemFromMenuCategory(itemId)
      toast.success('移除成功')
      await loadCategoryItems(selectedCategory!.id)
    } catch (error: any) {
      toast.error(error.message || '移除失败')
    }
  }

  const columns: Column<MenuCategory>[] = [
    { key: 'name', title: '分类名称', width: 200, render: (r) => r.name },
    { key: 'itemCount', title: '商品数', width: 100, render: (r: any) => <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 bg-blue-50 text-blue-600 ring-blue-200">{r.itemCount}</span> },
    { key: 'displayOrder', title: '显示顺序', width: 100, render: (r) => r.displayOrder },
    {
      key: 'actions', title: '操作', width: 240,
      render: (r) => (
        <div className="flex items-center gap-1">
          <Btn variant="link" icon={<LayoutGrid className="w-3.5 h-3.5" />} onClick={() => handleOpenItemsDrawer(r)}>配置商品</Btn>
          <Btn variant="link" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => handleOpenModal(r)}>编辑</Btn>
          <Btn variant="link" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setDeleteId(r.id)}>删除</Btn>
        </div>
      ),
    },
  ]

  // 可添加的商品（尚未在分类中）
  const availableItems = posItems.filter(item => !categoryItems.find(ci => ci.posItemId === item.id))
  const toggleItem = (id: string) => setSelectedItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  return (
    <div className="p-6">
      <SectionCard
        title="菜单分类管理"
        action={<Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => handleOpenModal()}>创建分类</Btn>}
      >
        {categories.length === 0 ? (
          <EmptyState title="还没有创建任何分类" description="点击「创建分类」按钮开始。" />
        ) : (
          <Table columns={columns} data={categories} rowKey={(r) => r.id} loading={loading} />
        )}
      </SectionCard>

      {/* 分类编辑模态框 */}
      <Modal
        title={editingCategory ? '编辑分类' : '创建分类'}
        open={modalVisible}
        onOpenChange={(o) => !o && setModalVisible(false)}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setModalVisible(false)}>取消</Btn>
            <Btn variant="primary" onClick={handleSaveCategory}>保存</Btn>
          </div>
        }
      >
        <div className="space-y-4">
          <FormRow label="分类名称">
            <TextInput className="w-full" value={fName} onChange={(v) => { setFName(v); if (fError) setFError('') }} placeholder="例如：热销商品、新品上市" />
          </FormRow>
          <FormRow label="显示顺序">
            <NumberInput value={fOrder} onChange={setFOrder} min={0} />
          </FormRow>
          {fError && <p className="text-sm text-red-500">{fError}</p>}
        </div>
      </Modal>

      {/* 分类商品管理抽屉 */}
      <Drawer
        title={selectedCategory ? `管理分类：${selectedCategory.name}` : '管理分类商品'}
        width={600}
        open={drawerVisible}
        onOpenChange={setDrawerVisible}
      >
        {selectedCategory && (
          <div>
            {/* 已添加的商品列表 */}
            <div className="mb-6">
              <h4 className="text-base font-semibold text-slate-800 mb-2">已添加的商品 ({categoryItems.length})</h4>
              {categoryItems.length === 0 ? (
                <EmptyState title="暂无商品" />
              ) : (
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {categoryItems.map(item => (
                    <li key={item.id} className="flex items-center justify-between px-3 py-2.5">
                      <div>
                        <div className="text-slate-700 text-sm">{item.posItemName || item.posItemId}</div>
                        <div className="text-xs text-slate-400">显示顺序: {item.displayOrder}</div>
                      </div>
                      <Btn variant="link" onClick={() => handleRemoveItem(item.id)}>移除</Btn>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 添加商品 */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-base font-semibold text-slate-800 mb-2">添加商品</h4>
              {itemsLoading ? (
                <Spinner className="w-6 h-6 text-slate-400" />
              ) : availableItems.length === 0 ? (
                <p className="text-sm text-slate-400">没有可添加的商品</p>
              ) : (
                <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 mb-4">
                  {availableItems.map(item => (
                    <label key={item.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50">
                      <Checkbox checked={selectedItems.includes(item.id)} onCheckedChange={() => toggleItem(item.id)} />
                      <span className="text-sm text-slate-700">{item.name}</span>
                    </label>
                  ))}
                </div>
              )}
              <Btn variant="primary" className="w-full" disabled={selectedItems.length === 0} onClick={handleAddItems}>添加选中的商品</Btn>
            </div>
          </div>
        )}
      </Drawer>

      {/* 删除确认 */}
      <ConfirmDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)} title="确定删除？" danger confirmText="删除" onConfirm={handleDeleteCategory} />
    </div>
  )
}

export default MenuCategoryManagement
