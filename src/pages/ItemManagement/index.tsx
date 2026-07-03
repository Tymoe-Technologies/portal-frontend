import React, { useState, useEffect } from 'react'
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
  const { isAuthenticated } = useAuthContext()

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })

  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [previewImageUrl, setPreviewImageUrl] = useState<string | undefined>(undefined)
  const [imageUploading, setImageUploading] = useState(false)

  // 表单状态
  const [form, setForm] = useState<ItemFormData>(EMPTY_FORM)
  const [nameError, setNameError] = useState('')

  // 确认框（删除图片 / 删除商品）
  const [confirm, setConfirm] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      loadItems()
      loadCategories()
    }
  }, [isAuthenticated, pagination.current, pagination.pageSize])

  const loadItems = async () => {
    setLoading(true)
    try {
      const response: PaginatedResponse<Item> = await itemManagementService.getItems({
        page: pagination.current,
        limit: pagination.pageSize,
        search: searchQuery || undefined,
      })
      setItems(response.data)
      setPagination(prev => ({ ...prev, total: response.total }))
    } catch (error) {
      console.error('Failed to load items:', error)
      toast.error('加载商品列表失败')
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
      toast.error('加载分类列表失败')
    }
  }

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      setLoading(true)
      try {
        const results = await itemManagementService.searchItems(searchQuery)
        setItems(results)
        setPagination(prev => ({ ...prev, total: results.length }))
        toast.success(`找到 ${results.length} 个匹配的商品`)
      } catch (error) {
        console.error('Failed to search items:', error)
        toast.error('搜索商品失败')
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
      toast.warning('请先保存商品，然后再上传图片')
      return
    }
    setImageUploading(true)
    try {
      const result = await itemManagementService.uploadItemImage(editingItem.id, file as any)
      setPreviewImageUrl(result.image.url)
      setEditingItem({ ...editingItem, imageUrl: result.image.url })
      toast.success('图片上传成功')
      loadItems()
    } catch (error: any) {
      console.error('Image upload failed:', error)
      toast.error(error?.response?.data?.error || '图片上传失败')
    } finally {
      setImageUploading(false)
    }
  }

  const handleImageDelete = () => {
    if (!editingItem) return
    setConfirm({
      title: '确认删除图片',
      description: '确定要删除这张商品图片吗？',
      onConfirm: async () => {
        try {
          await itemManagementService.deleteItemImage(editingItem.id)
          setPreviewImageUrl(undefined)
          setEditingItem({ ...editingItem, imageUrl: undefined })
          toast.success('图片删除成功')
          setConfirm(null)
          loadItems()
        } catch (error: any) {
          toast.error(error?.response?.data?.error || '图片删除失败')
        }
      },
    })
  }

  const handleDelete = (id: string) => {
    setConfirm({
      title: '确认删除',
      description: '确定要删除这个商品吗？此操作不可恢复。',
      onConfirm: async () => {
        try {
          await itemManagementService.deleteItem(id)
          toast.success('商品删除成功')
          setConfirm(null)
          loadItems()
        } catch (error) {
          toast.error('删除商品失败')
        }
      },
    })
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { setNameError('请输入商品名称'); return }
    setNameError('')
    try {
      if (editingItem) {
        const updatePayload: UpdateItemPayload = {
          name: form.name, description: form.description, basePrice: form.basePrice,
          categoryId: form.categoryId || undefined, isActive: form.isActive,
        }
        await itemManagementService.updateItem(editingItem.id, updatePayload)
        toast.success('商品更新成功')
      } else {
        const createPayload: CreateItemPayload = {
          name: form.name, description: form.description, basePrice: form.basePrice,
          categoryId: form.categoryId || '', isActive: form.isActive,
        }
        await itemManagementService.createItem(createPayload)
        toast.success('商品创建成功')
      }
      setModalVisible(false)
      loadItems()
    } catch (error) {
      console.error('Failed to save item:', error)
      toast.error(editingItem ? '更新商品失败' : '创建商品失败')
    }
  }

  const columns: Column<Item>[] = [
    {
      key: 'imageUrl', title: '图片', width: 80,
      render: (r) => r.imageUrl
        ? <img src={r.imageUrl} alt="商品图片" className="w-[50px] h-[50px] object-cover rounded" />
        : <div className="w-[50px] h-[50px] bg-slate-100 rounded flex items-center justify-center"><ImageIcon className="w-5 h-5 text-slate-300" /></div>,
    },
    { key: 'name', title: '商品名称', width: 200, render: (r) => r.name },
    { key: 'description', title: '描述', width: 250, render: (r) => <span className="block max-w-[250px] truncate">{r.description}</span> },
    { key: 'basePrice', title: '价格', width: 120, render: (r) => formatPrice(r.basePrice) },
    { key: 'category', title: '分类', width: 150, render: (r: any) => r.category?.name || '-' },
    {
      key: 'isActive', title: '状态', width: 100,
      render: (r) => <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 ${r.isActive ? 'bg-green-50 text-green-600 ring-green-200' : 'bg-red-50 text-red-600 ring-red-200'}`}>{r.isActive ? '活跃' : '停用'}</span>,
    },
    { key: 'createdAt', title: '创建时间', width: 180, render: (r: any) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : '-') },
    {
      key: 'actions', title: '操作', width: 150,
      render: (r) => (
        <div className="flex items-center gap-1">
          <Btn variant="link" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => handleEdit(r)}>编辑</Btn>
          <Btn variant="link" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => handleDelete(r.id)}>删除</Btn>
        </div>
      ),
    },
  ]

  const categoryOptions = [{ label: '（无分类）', value: '' }, ...categories.map(cat => ({ label: cat.name, value: cat.id }))]

  if (!isAuthenticated) {
    return <div className="p-6 text-center"><span className="text-slate-600">请先登录以使用商品管理功能</span></div>
  }

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
  const rangeStart = pagination.total === 0 ? 0 : (pagination.current - 1) * pagination.pageSize + 1
  const rangeEnd = Math.min(pagination.current * pagination.pageSize, pagination.total)

  return (
    <div className="p-6">
      <SectionCard>
        <h2 className="text-2xl font-semibold text-slate-900 mb-4">商品管理</h2>

        {/* 搜索和操作栏 */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex gap-2 max-w-md w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                placeholder="搜索商品名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                className="w-full text-sm bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
              />
            </div>
            <Btn variant="secondary" onClick={handleSearch}>搜索</Btn>
          </div>
          <div className="flex gap-2">
            <Btn variant="secondary" icon={<RotateCw className="w-3.5 h-3.5" />} loading={loading} onClick={loadItems}>刷新</Btn>
            <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleCreate}>添加商品</Btn>
          </div>
        </div>

        {/* 商品表格 */}
        <Table columns={columns} data={items} rowKey={(r) => r.id} loading={loading} />

        {/* 分页 */}
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>第 {rangeStart}-{rangeEnd} 条，共 {pagination.total} 条</span>
          <div className="flex items-center gap-2">
            <div className="w-28">
              <SelectInput value={String(pagination.pageSize)} onChange={(v) => setPagination(prev => ({ ...prev, current: 1, pageSize: Number(v) }))}
                options={[{ label: '10 条/页', value: '10' }, { label: '20 条/页', value: '20' }, { label: '50 条/页', value: '50' }]} />
            </div>
            <Btn variant="secondary" size="sm" disabled={pagination.current <= 1} onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}>上一页</Btn>
            <span>{pagination.current} / {totalPages}</span>
            <Btn variant="secondary" size="sm" disabled={pagination.current >= totalPages} onClick={() => setPagination(prev => ({ ...prev, current: prev.current + 1 }))}>下一页</Btn>
          </div>
        </div>
      </SectionCard>

      {/* 创建/编辑商品模态框 */}
      <Modal
        title={editingItem ? '编辑商品' : '创建商品'}
        open={modalVisible}
        onOpenChange={(o) => !o && setModalVisible(false)}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setModalVisible(false)}>取消</Btn>
            <Btn variant="primary" onClick={handleSubmit}>{editingItem ? '更新' : '创建'}</Btn>
          </div>
        }
      >
        <div className="space-y-4">
          <FormRow label="商品名称">
            <TextInput className="w-full" value={form.name} onChange={(v) => { setF('name', v); if (nameError) setNameError('') }} placeholder="请输入商品名称" />
          </FormRow>
          {nameError && <p className="text-sm text-red-500 -mt-2">{nameError}</p>}

          <FormRow label="商品描述">
            <Textarea className="w-full" rows={3} value={form.description} onChange={(v) => setF('description', v)} placeholder="请输入商品描述" />
          </FormRow>

          <div className="grid grid-cols-2 gap-4">
            <FormRow label="价格">
              <div className="relative w-full">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{getCurrencySymbol()}</span>
                <input type="number" min={0} step={0.01} value={form.basePrice}
                  onChange={(e) => setF('basePrice', Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full text-sm bg-white border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0" />
              </div>
            </FormRow>
            <FormRow label="状态">
              <div className="w-full"><SelectInput className="w-full" value={form.isActive ? 'true' : 'false'} onChange={(v) => setF('isActive', v === 'true')}
                options={[{ label: '活跃', value: 'true' }, { label: '停用', value: 'false' }]} /></div>
            </FormRow>
          </div>

          <FormRow label="商品分类">
            <div className="w-full"><SelectInput className="w-full" value={form.categoryId} onChange={(v) => setF('categoryId', String(v))} options={categoryOptions} placeholder="请选择分类" /></div>
          </FormRow>

          {/* 图片上传 - 仅在编辑模式显示 */}
          {editingItem ? (
            <FormRow label="商品图片">
              <div className="flex items-start gap-4">
                <ImageUpload url={previewImageUrl} loading={imageUploading} size={120} maxMB={5}
                  onPick={handleImageUpload} onRemove={handleImageDelete} />
                <div className="text-xs text-slate-400 space-y-0.5">
                  <div>支持 JPG、PNG、WebP 格式</div>
                  <div>图片大小不超过 5MB</div>
                  <div>建议尺寸 800x800 像素</div>
                </div>
              </div>
            </FormRow>
          ) : (
            <div className="px-4 py-3 bg-slate-50 rounded-md text-[13px] text-slate-500">💡 提示：保存商品后可以上传图片</div>
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
        confirmText="删除"
        onConfirm={() => confirm?.onConfirm()}
      />
    </div>
  )
}

export default ItemManagement
