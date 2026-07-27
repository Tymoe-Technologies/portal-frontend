import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, Search, RotateCw, Image as ImageIcon } from 'lucide-react'
import { useAuthContext } from '../../auth/AuthProvider'
import {
  itemManagementService,
  type Item,
  type Category,
  type CreateItemPayload,
  type UpdateItemPayload,
  type PaginatedResponse,
} from '../../services/item-management'
import { formatPrice, fromMinorUnit } from '../../utils/priceConverter'
import { getCurrencySymbol } from '../../config/currencyConfig'
import {
  SectionCard, Btn, Table, type Column, Modal, TextInput, Textarea, SelectInput,
  ImageUpload, ConfirmDialog, FormRow, toast,
} from '@/components/ui-kit'

interface ItemFormData {
  name: string
  description: string
  basePrice: number
  categoryId: string
  isActive: boolean
}

const EMPTY_FORM: ItemFormData = { name: '', description: '', basePrice: 0, categoryId: '', isActive: true }

const ItemManagement: React.FC = () => {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuthContext()

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })

  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [previewImageUrl, setPreviewImageUrl] = useState<string | undefined>(undefined)
  const [imageUploading, setImageUploading] = useState(false)

  // 表单状态
  const [form, setForm] = useState<ItemFormData>(EMPTY_FORM)
  const [nameError, setNameError] = useState('')

  // 确认框（删除图片 / 删除商品）
  const [confirm, setConfirm] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      // 有搜索词时走搜索，否则拉列表；两条路径都会带上当前状态筛选
      searchQuery.trim() ? handleSearch() : loadItems()
      loadCategories()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, pagination.current, pagination.pageSize, statusFilter])

  const loadItems = async () => {
    setLoading(true)
    try {
      const response: PaginatedResponse<Item> = await itemManagementService.getItems({
        page: pagination.current,
        limit: pagination.pageSize,
        search: searchQuery || undefined,
        // all=显示全部（含未激活），active/inactive=按状态过滤
        ...(statusFilter === 'all' ? { includeInactive: true } : { isActive: statusFilter === 'active' }),
      })
      setItems(response.data)
      setPagination(prev => ({ ...prev, total: response.total }))
    } catch (error) {
      console.error('Failed to load items:', error)
      toast.error(t('pages.itemManagement.loadItemsFailed'))
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const categoryList = await itemManagementService.getCategories()
      setCategories(categoryList)
    } catch (error) {
      console.error('Failed to load categories:', error)
      toast.error(t('pages.itemManagement.loadCategoriesFailed'))
    }
  }

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      setLoading(true)
      try {
        const results = await itemManagementService.searchItems(
          searchQuery,
          statusFilter === 'all' ? { includeInactive: true } : { isActive: statusFilter === 'active' },
        )
        setItems(results)
        setPagination(prev => ({ ...prev, total: results.length }))
        toast.success(t('pages.itemManagement.foundMatchingCount', { count: results.length }))
      } catch (error) {
        console.error('Failed to search items:', error)
        toast.error(t('pages.itemManagement.searchFailed'))
      } finally {
        setLoading(false)
      }
    } else {
      loadItems()
    }
  }

  const setF = <K extends keyof ItemFormData>(k: K, v: ItemFormData[K]) => setForm(prev => ({ ...prev, [k]: v }))

  const handleCreate = () => {
    setEditingItem(null)
    setForm(EMPTY_FORM)
    setNameError('')
    setPreviewImageUrl(undefined)
    setModalVisible(true)
  }

  const handleEdit = (item: Item) => {
    setEditingItem(item)
    setForm({
      name: item.name,
      description: item.description || '',
      basePrice: fromMinorUnit(item.basePrice), // 分 → 元
      categoryId: item.categoryId || '',
      isActive: item.isActive,
    })
    setNameError('')
    setPreviewImageUrl(item.imageUrl)
    setModalVisible(true)
  }

  const handleImageUpload = async (file: File) => {
    if (!editingItem) {
      toast.warning(t('pages.itemManagement.pleaseSaveFirst'))
      return
    }
    setImageUploading(true)
    try {
      const result = await itemManagementService.uploadItemImage(editingItem.id, file as any)
      setPreviewImageUrl(result.image.url)
      setEditingItem({ ...editingItem, imageUrl: result.image.url })
      toast.success(t('pages.itemManagement.imageUploadSuccess'))
      loadItems()
    } catch (error: any) {
      console.error('Image upload failed:', error)
      toast.error(error?.response?.data?.error || t('pages.itemManagement.imageUploadFailed'))
    } finally {
      setImageUploading(false)
    }
  }

  const handleImageDelete = () => {
    if (!editingItem) return
    setConfirm({
      title: t('pages.itemManagement.confirmDeleteImageTitle'),
      description: t('pages.itemManagement.confirmDeleteImageDesc'),
      onConfirm: async () => {
        try {
          await itemManagementService.deleteItemImage(editingItem.id)
          setPreviewImageUrl(undefined)
          setEditingItem({ ...editingItem, imageUrl: undefined })
          toast.success(t('pages.itemManagement.imageDeleteSuccess'))
          setConfirm(null)
          loadItems()
        } catch (error: any) {
          toast.error(error?.response?.data?.error || t('pages.itemManagement.imageDeleteFailed'))
        }
      },
    })
  }

  const handleDelete = (id: string) => {
    setConfirm({
      title: t('pages.itemManagement.confirmDeleteTitle'),
      description: t('pages.itemManagement.confirmDeleteDesc'),
      onConfirm: async () => {
        try {
          await itemManagementService.deleteItem(id)
          toast.success(t('pages.itemManagement.itemDeleteSuccess'))
          setConfirm(null)
          loadItems()
        } catch (error) {
          toast.error(t('pages.itemManagement.itemDeleteFailed'))
        }
      },
    })
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { setNameError(t('pages.itemManagement.pleaseEnterName')); return }
    setNameError('')
    try {
      if (editingItem) {
        const updatePayload: UpdateItemPayload = {
          name: form.name, description: form.description, basePrice: form.basePrice,
          categoryId: form.categoryId || undefined, isActive: form.isActive,
        }
        await itemManagementService.updateItem(editingItem.id, updatePayload)
        toast.success(t('pages.itemManagement.itemUpdateSuccess'))
      } else {
        const createPayload: CreateItemPayload = {
          name: form.name, description: form.description, basePrice: form.basePrice,
          categoryId: form.categoryId || '', isActive: form.isActive,
        }
        await itemManagementService.createItem(createPayload)
        toast.success(t('pages.itemManagement.itemCreateSuccess'))
      }
      setModalVisible(false)
      loadItems()
    } catch (error) {
      console.error('Failed to save item:', error)
      toast.error(editingItem ? t('pages.itemManagement.updateFailed') : t('pages.itemManagement.createFailed'))
    }
  }

  const columns: Column<Item>[] = [
    {
      key: 'imageUrl', title: t('pages.itemManagement.colImage'), width: 80,
      render: (r) => r.imageUrl
        ? <img src={r.imageUrl} alt={t('pages.itemManagement.colImage')} className="w-[50px] h-[50px] object-cover rounded" />
        : <div className="w-[50px] h-[50px] bg-slate-100 rounded flex items-center justify-center"><ImageIcon className="w-5 h-5 text-slate-300" /></div>,
    },
    { key: 'name', title: t('pages.itemManagement.colName'), width: 200, render: (r) => r.name },
    { key: 'description', title: t('pages.itemManagement.colDescription'), width: 250, render: (r) => <span className="block max-w-[250px] truncate">{r.description}</span> },
    { key: 'basePrice', title: t('pages.itemManagement.colPrice'), width: 120, render: (r) => formatPrice(r.basePrice) },
    { key: 'category', title: t('pages.itemManagement.colCategory'), width: 150, render: (r: any) => r.category?.name || '-' },
    {
      key: 'isActive', title: t('pages.itemManagement.colStatus'), width: 100,
      render: (r) => <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 ${r.isActive ? 'bg-green-50 text-green-600 ring-green-200' : 'bg-red-50 text-red-600 ring-red-200'}`}>{r.isActive ? t('pages.itemManagement.statusActive') : t('pages.itemManagement.statusInactive')}</span>,
    },
    { key: 'createdAt', title: t('pages.itemManagement.colCreatedAt'), width: 180, render: (r: any) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : '-') },
    {
      key: 'actions', title: t('pages.itemManagement.colActions'), width: 150,
      render: (r) => (
        <div className="flex items-center gap-1">
          <Btn variant="link" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => handleEdit(r)}>{t('pages.itemManagement.editBtn')}</Btn>
          <Btn variant="link" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => handleDelete(r.id)}>{t('pages.itemManagement.deleteBtn')}</Btn>
        </div>
      ),
    },
  ]

  const categoryOptions = [{ label: t('pages.itemManagement.noCategoryOption'), value: '' }, ...categories.map(cat => ({ label: cat.name, value: cat.id }))]

  if (!isAuthenticated) {
    return <div className="p-6 text-center"><span className="text-slate-600">{t('pages.itemManagement.pleaseLoginFirst')}</span></div>
  }

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
  const rangeStart = pagination.total === 0 ? 0 : (pagination.current - 1) * pagination.pageSize + 1
  const rangeEnd = Math.min(pagination.current * pagination.pageSize, pagination.total)

  return (
    <div className="p-6">
      <SectionCard>
        <h2 className="text-2xl font-semibold text-slate-900 mb-4">{t('pages.itemManagement.pageTitle')}</h2>

        {/* 搜索和操作栏 */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex gap-2 max-w-md w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                placeholder={t('pages.itemManagement.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                className="w-full text-sm bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
              />
            </div>
            <Btn variant="secondary" onClick={handleSearch}>{t('pages.itemManagement.searchBtn')}</Btn>
          </div>
          <div className="flex gap-2">
            <SelectInput
              className="w-32"
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v as 'all' | 'active' | 'inactive'); setPagination(prev => ({ ...prev, current: 1 })) }}
              options={[
                { label: t('pages.itemManagement.statusAll'), value: 'all' },
                { label: t('pages.itemManagement.statusActive'), value: 'active' },
                { label: t('pages.itemManagement.statusInactive'), value: 'inactive' },
              ]}
            />
            <Btn variant="secondary" icon={<RotateCw className="w-3.5 h-3.5" />} loading={loading} onClick={loadItems}>{t('common.refresh')}</Btn>
            <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleCreate}>{t('pages.itemManagement.addItemBtn')}</Btn>
          </div>
        </div>

        {/* 商品表格 */}
        <Table columns={columns} data={items} rowKey={(r) => r.id} loading={loading} />

        {/* 分页 */}
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>{t('pages.itemManagement.paginationInfo', { start: rangeStart, end: rangeEnd, total: pagination.total })}</span>
          <div className="flex items-center gap-2">
            <div className="w-28">
              <SelectInput value={String(pagination.pageSize)} onChange={(v) => setPagination(prev => ({ ...prev, current: 1, pageSize: Number(v) }))}
                options={[
                  { label: t('pages.itemManagement.perPage10'), value: '10' },
                  { label: t('pages.itemManagement.perPage20'), value: '20' },
                  { label: t('pages.itemManagement.perPage50'), value: '50' },
                ]} />
            </div>
            <Btn variant="secondary" size="sm" disabled={pagination.current <= 1} onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}>{t('pages.itemManagement.prevPage')}</Btn>
            <span>{pagination.current} / {totalPages}</span>
            <Btn variant="secondary" size="sm" disabled={pagination.current >= totalPages} onClick={() => setPagination(prev => ({ ...prev, current: prev.current + 1 }))}>{t('pages.itemManagement.nextPage')}</Btn>
          </div>
        </div>
      </SectionCard>

      {/* 创建/编辑商品模态框 */}
      <Modal
        title={editingItem ? t('pages.itemManagement.editItemModalTitle') : t('pages.itemManagement.createItemModalTitle')}
        open={modalVisible}
        onOpenChange={(o) => !o && setModalVisible(false)}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setModalVisible(false)}>{t('common.cancel')}</Btn>
            <Btn variant="primary" onClick={handleSubmit}>{editingItem ? t('pages.itemManagement.updateBtn') : t('common.create')}</Btn>
          </div>
        }
      >
        <div className="space-y-4">
          <FormRow label={t('pages.itemManagement.itemNameLabel')}>
            <TextInput className="w-full" value={form.name} onChange={(v) => { setF('name', v); if (nameError) setNameError('') }} placeholder={t('pages.itemManagement.itemNamePlaceholder')} />
          </FormRow>
          {nameError && <p className="text-sm text-red-500 -mt-2">{nameError}</p>}

          <FormRow label={t('pages.itemManagement.itemDescLabel')}>
            <Textarea className="w-full" rows={3} value={form.description} onChange={(v) => setF('description', v)} placeholder={t('pages.itemManagement.itemDescPlaceholder')} />
          </FormRow>

          <div className="grid grid-cols-2 gap-4">
            <FormRow label={t('pages.itemManagement.priceLabel')}>
              <div className="relative w-full">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{getCurrencySymbol()}</span>
                <input type="number" min={0} step={0.01} value={form.basePrice}
                  onChange={(e) => setF('basePrice', Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full text-sm bg-white border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0" />
              </div>
            </FormRow>
            <FormRow label={t('pages.itemManagement.statusLabel')}>
              <div className="w-full"><SelectInput className="w-full" value={form.isActive ? 'true' : 'false'} onChange={(v) => setF('isActive', v === 'true')}
                options={[{ label: t('pages.itemManagement.statusActive'), value: 'true' }, { label: t('pages.itemManagement.statusInactive'), value: 'false' }]} /></div>
            </FormRow>
          </div>

          <FormRow label={t('pages.itemManagement.itemCategoryLabel')}>
            <div className="w-full"><SelectInput className="w-full" value={form.categoryId} onChange={(v) => setF('categoryId', String(v))} options={categoryOptions} placeholder={t('pages.itemManagement.categoryPlaceholder')} /></div>
          </FormRow>

          {/* 图片上传 - 仅在编辑模式显示 */}
          {editingItem ? (
            <FormRow label={t('pages.itemManagement.itemImageLabel')}>
              <div className="flex items-start gap-4">
                <ImageUpload url={previewImageUrl} loading={imageUploading} size={120} maxMB={5}
                  onPick={handleImageUpload} onRemove={handleImageDelete} />
                <div className="text-xs text-slate-400 space-y-0.5">
                  <div>{t('pages.itemManagement.imageFormatHint')}</div>
                  <div>{t('pages.itemManagement.imageSizeHint')}</div>
                  <div>{t('pages.itemManagement.imageDimensionHint')}</div>
                </div>
              </div>
            </FormRow>
          ) : (
            <div className="px-4 py-3 bg-slate-50 rounded-md text-[13px] text-slate-500">{t('pages.itemManagement.saveFirstHint')}</div>
          )}
        </div>
      </Modal>

      {/* 确认框 */}
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title ?? ''}
        description={confirm?.description}
        danger
        confirmText={t('pages.itemManagement.deleteBtn')}
        onConfirm={() => confirm?.onConfirm()}
      />
    </div>
  )
}

export default ItemManagement
