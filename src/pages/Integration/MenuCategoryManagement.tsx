import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      toast.error(error.message || t('pages.menuCategoryManagement.loadCategoriesFailed'))
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
      toast.error(error.message || t('pages.menuCategoryManagement.loadItemsFailed'))
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
      toast.error(error.message || t('pages.menuCategoryManagement.loadCategoryItemsFailed'))
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
    if (!fName.trim()) { setFError(t('pages.menuCategoryManagement.pleaseEnterCategoryName')); return }
    setFError('')
    try {
      if (editingCategory) {
        await uberService.updateMenuCategory(editingCategory.id, fName, fOrder)
        toast.success(t('pages.menuCategoryManagement.updateSuccess'))
      } else {
        await uberService.createMenuCategory(integrationId, fName, fOrder)
        toast.success(t('pages.menuCategoryManagement.createSuccess'))
      }
      setModalVisible(false)
      loadCategories()
    } catch (error: any) {
      toast.error(error.message || t('pages.menuCategoryManagement.saveFailed'))
    }
  }

  const handleDeleteCategory = async () => {
    if (!deleteId) return
    try {
      await uberService.deleteMenuCategory(deleteId)
      toast.success(t('pages.menuCategoryManagement.deleteSuccess'))
      setDeleteId(null)
      loadCategories()
    } catch (error: any) {
      toast.error(error.message || t('pages.menuCategoryManagement.deleteFailed'))
    }
  }

  const handleOpenItemsDrawer = async (category: MenuCategory) => {
    setSelectedCategory(category)
    await loadCategoryItems(category.id)
    setDrawerVisible(true)
  }

  const handleAddItems = async () => {
    if (!selectedCategory || selectedItems.length === 0) {
      toast.warning(t('pages.menuCategoryManagement.pleaseSelectItems'))
      return
    }
    try {
      const existingItemIds = categoryItems.map(item => item.posItemId)
      const newItemIds = selectedItems.filter(id => !existingItemIds.includes(id))
      for (const itemId of newItemIds) {
        const item = posItems.find(p => p.id === itemId)
        await uberService.addItemToMenuCategory(selectedCategory.id, itemId, item?.name, categoryItems.length + newItemIds.indexOf(itemId))
      }
      toast.success(t('pages.menuCategoryManagement.addedItemsCount', { count: newItemIds.length }))
      await loadCategoryItems(selectedCategory.id)
      setSelectedItems([])
    } catch (error: any) {
      toast.error(error.message || t('pages.menuCategoryManagement.addItemsFailed'))
    }
  }

  const handleRemoveItem = async (itemId: string) => {
    try {
      await uberService.removeItemFromMenuCategory(itemId)
      toast.success(t('pages.menuCategoryManagement.removeSuccess'))
      await loadCategoryItems(selectedCategory!.id)
    } catch (error: any) {
      toast.error(error.message || t('pages.menuCategoryManagement.removeFailed'))
    }
  }

  const columns: Column<MenuCategory>[] = [
    { key: 'name', title: t('pages.menuCategoryManagement.columnCategoryName'), width: 200, render: (r) => r.name },
    { key: 'itemCount', title: t('pages.menuCategoryManagement.columnItemCount'), width: 100, render: (r: any) => <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 bg-blue-50 text-blue-600 ring-blue-200">{r.itemCount}</span> },
    { key: 'displayOrder', title: t('pages.menuCategoryManagement.columnDisplayOrder'), width: 100, render: (r) => r.displayOrder },
    {
      key: 'actions', title: t('pages.menuCategoryManagement.columnActions'), width: 240,
      render: (r) => (
        <div className="flex items-center gap-1">
          <Btn variant="link" icon={<LayoutGrid className="w-3.5 h-3.5" />} onClick={() => handleOpenItemsDrawer(r)}>{t('pages.menuCategoryManagement.configureItemsBtn')}</Btn>
          <Btn variant="link" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => handleOpenModal(r)}>{t('pages.menuCategoryManagement.editBtn')}</Btn>
          <Btn variant="link" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setDeleteId(r.id)}>{t('pages.menuCategoryManagement.deleteBtn')}</Btn>
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
        title={t('pages.menuCategoryManagement.pageTitle')}
        action={<Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => handleOpenModal()}>{t('pages.menuCategoryManagement.createCategoryBtn')}</Btn>}
      >
        {categories.length === 0 ? (
          <EmptyState title={t('pages.menuCategoryManagement.emptyCategoriesTitle')} description={t('pages.menuCategoryManagement.emptyCategoriesDescription')} />
        ) : (
          <Table columns={columns} data={categories} rowKey={(r) => r.id} loading={loading} />
        )}
      </SectionCard>

      {/* 分类编辑模态框 */}
      <Modal
        title={editingCategory ? t('pages.menuCategoryManagement.editCategoryModalTitle') : t('pages.menuCategoryManagement.createCategoryModalTitle')}
        open={modalVisible}
        onOpenChange={(o) => !o && setModalVisible(false)}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setModalVisible(false)}>{t('pages.menuCategoryManagement.cancelBtn')}</Btn>
            <Btn variant="primary" onClick={handleSaveCategory}>{t('pages.menuCategoryManagement.saveBtn')}</Btn>
          </div>
        }
      >
        <div className="space-y-4">
          <FormRow label={t('pages.menuCategoryManagement.categoryNameLabel')}>
            <TextInput className="w-full" value={fName} onChange={(v) => { setFName(v); if (fError) setFError('') }} placeholder={t('pages.menuCategoryManagement.categoryNamePlaceholder')} />
          </FormRow>
          <FormRow label={t('pages.menuCategoryManagement.displayOrderLabel')}>
            <NumberInput value={fOrder} onChange={setFOrder} min={0} />
          </FormRow>
          {fError && <p className="text-sm text-red-500">{fError}</p>}
        </div>
      </Modal>

      {/* 分类商品管理抽屉 */}
      <Drawer
        title={selectedCategory ? t('pages.menuCategoryManagement.manageCategoryDrawerTitle', { name: selectedCategory.name }) : t('pages.menuCategoryManagement.manageCategoryDrawerTitleDefault')}
        width={600}
        open={drawerVisible}
        onOpenChange={setDrawerVisible}
      >
        {selectedCategory && (
          <div>
            {/* 已添加的商品列表 */}
            <div className="mb-6">
              <h4 className="text-base font-semibold text-slate-800 mb-2">{t('pages.menuCategoryManagement.addedItemsTitle', { count: categoryItems.length })}</h4>
              {categoryItems.length === 0 ? (
                <EmptyState title={t('pages.menuCategoryManagement.emptyItemsTitle')} />
              ) : (
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {categoryItems.map(item => (
                    <li key={item.id} className="flex items-center justify-between px-3 py-2.5">
                      <div>
                        <div className="text-slate-700 text-sm">{item.posItemName || item.posItemId}</div>
                        <div className="text-xs text-slate-400">{t('pages.menuCategoryManagement.itemDisplayOrderLabel', { order: item.displayOrder })}</div>
                      </div>
                      <Btn variant="link" onClick={() => handleRemoveItem(item.id)}>{t('pages.menuCategoryManagement.removeBtn')}</Btn>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 添加商品 */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-base font-semibold text-slate-800 mb-2">{t('pages.menuCategoryManagement.addItemsTitle')}</h4>
              {itemsLoading ? (
                <Spinner className="w-6 h-6 text-slate-400" />
              ) : availableItems.length === 0 ? (
                <p className="text-sm text-slate-400">{t('pages.menuCategoryManagement.noAvailableItems')}</p>
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
              <Btn variant="primary" className="w-full" disabled={selectedItems.length === 0} onClick={handleAddItems}>{t('pages.menuCategoryManagement.addSelectedItemsBtn')}</Btn>
            </div>
          </div>
        )}
      </Drawer>

      {/* 删除确认 */}
      <ConfirmDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)} title={t('pages.menuCategoryManagement.confirmDeleteTitle')} danger confirmText={t('pages.menuCategoryManagement.confirmDeleteBtn')} onConfirm={handleDeleteCategory} />
    </div>
  )
}

export default MenuCategoryManagement
