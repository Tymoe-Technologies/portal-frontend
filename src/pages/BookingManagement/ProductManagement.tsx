import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, ArrowLeftRight, LayoutGrid } from 'lucide-react'
import { resourcesApi, assignmentsApi } from '@/services/booking'
import type { BookableResource, ProductConfig } from '@/types/booking'
import {
  Modal, TextInput, Textarea, SelectInput, Switch, ImageUpload, Btn, Spinner,
  EmptyState, ConfirmDialog, FormRow, NumberInput, toast,
} from '@/components/ui-kit'

interface ProductResource extends BookableResource {
  resourceType: 'PRODUCT'
}

interface FormState {
  name: string
  description: string
  durationMinutes: number
  price: number
  maxGroupSize: number
  requiresPerson: boolean
  requiresSpace: boolean
  depositEnabled: boolean
  depositAmount: number
}

const EMPTY_FORM: FormState = {
  name: '', description: '', durationMinutes: 60, price: 0, maxGroupSize: 1,
  requiresPerson: false, requiresSpace: false, depositEnabled: false, depositAmount: 0,
}

// 美元小数输入（step 0.01）
function DollarInput({ value, onChange, placeholder, className }: { value: number | null; onChange: (v: number | null) => void; placeholder?: string; className?: string }) {
  return (
    <div className={`relative ${className ?? ''}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
      <input
        type="number" min={0} step={0.01}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-full text-sm bg-white border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
      />
    </div>
  )
}

export default function ProductManagement() {
  const [products, setProducts] = useState<ProductResource[]>([])
  const [persons, setPersons] = useState<BookableResource[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [nameError, setNameError] = useState('')
  // 关联人员列表（含各自的价格覆盖）
  const [personAssignments, setPersonAssignments] = useState<{ resourceId: string; name: string; priceOverride: number | null }[]>([])

  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(prev => ({ ...prev, [k]: v }))

  // 加载服务列表
  const loadProducts = async () => {
    setLoading(true)
    try {
      const resources = await resourcesApi.list({ type: 'PRODUCT' })
      setProducts(resources as ProductResource[])
    } catch {
      toast.error('加载服务列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载人员列表（用于关联选择）
  const loadPersons = async () => {
    try {
      const resources = await resourcesApi.list({ type: 'PERSON' })
      setPersons(resources)
    } catch {
      // 静默失败
    }
  }

  useEffect(() => {
    loadProducts()
    loadPersons()
  }, [])

  const handlePickImage = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      setImageUrl(reader.result as string)
      setImageFile(file)
    }
    reader.readAsDataURL(file)
  }

  // 打开新增弹窗
  const openCreate = () => {
    setEditingId(null)
    setImageUrl(undefined)
    setImageFile(null)
    setForm(EMPTY_FORM)
    setNameError('')
    setPersonAssignments([])
    setModal(true)
  }

  // 打开编辑弹窗（同时加载 assignments）
  const openEdit = async (product: ProductResource) => {
    setEditingId(product.id)
    const cfg = (product.config ?? {}) as ProductConfig
    setImageUrl(product.imageUrl)
    setImageFile(null)
    setNameError('')
    setForm({
      name: product.name || '',
      description: product.description || '',
      durationMinutes: cfg.durationMinutes ?? 60,
      price: (cfg.price ?? 0) / 100,
      maxGroupSize: cfg.maxGroupSize ?? 1,
      requiresPerson: cfg.requiresPerson ?? false,
      requiresSpace: cfg.requiresSpace ?? false,
      depositEnabled: cfg.depositEnabled ?? false,
      depositAmount: (cfg.depositAmount ?? 0) / 100,
    })

    // 从 assignments API 读取已关联的人员（含价格覆盖）
    setPersonAssignments([])
    try {
      const assignments = await assignmentsApi.list(product.id)
      setPersonAssignments(
        assignments.map(a => ({
          resourceId: a.resourceId,
          name: a.resource.name,
          // DB 存分，展示用元（÷100）
          priceOverride: a.priceOverride != null ? a.priceOverride / 100 : null,
        }))
      )
    } catch {
      // 静默失败，保持空
    }

    setModal(true)
  }

  // 保存
  const handleSave = async () => {
    if (!form.name.trim()) { setNameError('请输入服务名称'); return }
    setNameError('')
    setSaving(true)
    try {
      const data = {
        resourceType: 'PRODUCT',
        name: form.name,
        description: form.description,
        config: {
          durationMinutes: form.durationMinutes,
          price: Math.round((form.price ?? 0) * 100),        // 存分
          maxGroupSize: form.maxGroupSize ?? 1,
          requiresPerson: form.requiresPerson ?? false,
          requiresSpace: form.requiresSpace ?? false,
          depositEnabled: form.depositEnabled ?? false,
          depositAmount: form.depositEnabled ? Math.round((form.depositAmount ?? 0) * 100) : 0,
        },
      }

      let resource: ProductResource
      if (editingId) {
        resource = await resourcesApi.update(editingId, data) as ProductResource
      } else {
        resource = await resourcesApi.create(data) as ProductResource
      }

      // 同步关联人员（全量替换，含价格覆盖）
      try {
        await assignmentsApi.sync(
          resource.id,
          personAssignments.map(a => ({
            resourceId: a.resourceId,
            // 用户输入是元，存 DB 时转为分
            priceOverride: a.priceOverride != null ? Math.round(a.priceOverride * 100) : null,
          })),
        )
      } catch {
        toast.warning('人员关联同步失败，请稍后重试')
      }

      if (imageFile) {
        try {
          const result = await resourcesApi.uploadImage(resource.id, imageFile)
          resource = result.resource as ProductResource
        } catch {
          toast.error('图片上传失败')
        }
      }

      setProducts(prev => {
        const idx = prev.findIndex(p => p.id === resource.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = resource
          return next
        }
        return [...prev, resource]
      })

      toast.success(editingId ? '服务已更新' : '服务已添加')
      setModal(false)
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 切换上架状态
  const handleToggleStatus = async (product: ProductResource) => {
    if (togglingId) return
    const next = product.status === 'AVAILABLE' ? 'MAINTENANCE' : 'AVAILABLE'
    setTogglingId(product.id)
    try {
      const updated = await resourcesApi.update(product.id, { status: next }) as ProductResource
      setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))
    } catch {
      toast.error('状态更新失败')
    } finally {
      setTogglingId(null)
    }
  }

  // 删除
  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await resourcesApi.delete(deleteId)
      setProducts(prev => prev.filter(p => p.id !== deleteId))
      toast.success('服务已删除')
      setDeleteId(null)
    } catch {
      toast.error('删除失败')
    }
  }

  // 格式化时长显示
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} 分钟`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`
  }

  const renderCard = (product: ProductResource) => {
    const cfg = (product.config ?? {}) as ProductConfig
    const isAvailable = product.status === 'AVAILABLE'
    const toggling = togglingId === product.id

    return (
      <div key={product.id} className="bg-white border border-slate-100 rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow-lg transition-shadow">
        {/* 图片区域：4/3 固定比例 */}
        <div className="aspect-[4/3] bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 relative w-full">
          {product.imageUrl ? (
            <>
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
              {cfg.price != null && (
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-end px-3 pt-5 pb-2.5"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.18) 60%, transparent 100%)' }}>
                  <span className="text-white text-[15px] font-bold leading-none" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                    <span className="text-[11px] font-medium mr-px opacity-90">$</span>{((cfg.price ?? 0) / 100).toFixed(2)}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center">
                <LayoutGrid className="w-6 h-6 text-slate-300" />
              </div>
              {cfg.price != null && (
                <div className="absolute top-2.5 right-2.5 bg-slate-900 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  <span className="text-[10px] font-medium mr-px opacity-75">$</span>{((cfg.price ?? 0) / 100).toFixed(2)}
                </div>
              )}
            </>
          )}
        </div>

        {/* 信息区域 */}
        <div className="px-4 pt-3.5 pb-4 flex-1 flex flex-col">
          <div className="mb-2">
            <div className="text-[15px] font-semibold text-slate-900 leading-snug">{product.name}</div>
          </div>

          {product.description && (
            <div className="text-[13px] text-slate-600 leading-relaxed mb-2.5 line-clamp-2">{product.description}</div>
          )}

          {/* 标签行 */}
          <div className="flex gap-1.5 flex-wrap mb-2.5">
            {cfg.durationMinutes && (
              <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{formatDuration(cfg.durationMinutes)}</span>
            )}
            {cfg.requiresPerson && (
              <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">需指定人员</span>
            )}
            {cfg.depositEnabled && (
              <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">押金 ${((cfg.depositAmount ?? 0) / 100).toFixed(2)}</span>
            )}
          </div>

          {/* 底部操作 */}
          <div className="mt-auto flex gap-1.5 pt-3 border-t border-slate-100">
            <button
              onClick={() => handleToggleStatus(product)}
              disabled={toggling}
              className={`flex-1 h-8 rounded-md border flex items-center justify-center gap-1.5 text-xs transition-colors disabled:opacity-60 cursor-pointer ${
                isAvailable ? 'border-green-200 bg-green-50 text-green-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-green-50'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAvailable ? 'bg-green-500' : 'bg-slate-300'}`} />
              <span>{toggling ? '更新中' : isAvailable ? '上架中' : '已下架'}</span>
              <ArrowLeftRight className="w-2.5 h-2.5 opacity-40" />
            </button>

            <button onClick={() => openEdit(product)}
              className="w-8 h-8 rounded-md border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer shrink-0">
              <Pencil className="w-3 h-3" />
            </button>

            <button onClick={() => setDeleteId(product.id)}
              className="w-8 h-8 rounded-md border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors cursor-pointer shrink-0">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="mb-5">
        <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>添加服务</Btn>
      </div>

      {loading ? (
        <div className="text-center py-16"><Spinner className="w-8 h-8 mx-auto text-slate-400" /></div>
      ) : products.length === 0 ? (
        <EmptyState icon={<LayoutGrid className="w-8 h-8" />} title="暂无服务" description="点击上方按钮添加" />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 240px))' }}>
          {products.map(renderCard)}
        </div>
      )}

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingId ? '编辑服务' : '添加服务'}
        open={modal}
        onOpenChange={(o) => !o && setModal(false)}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setModal(false)}>取消</Btn>
            <Btn variant="primary" loading={saving} onClick={handleSave}>{editingId ? '保存' : '添加'}</Btn>
          </div>
        }
      >
        <div className="space-y-4">
          {/* 基本信息 */}
          <FormRow label="服务名称">
            <TextInput className="w-full" value={form.name} onChange={(v) => { setF('name', v); if (nameError) setNameError('') }} placeholder="如：精剪、全套护肤、瑜伽私教" />
          </FormRow>
          {nameError && <p className="text-sm text-red-500 -mt-2">{nameError}</p>}

          <FormRow label="介绍">
            <Textarea className="w-full" rows={3} value={form.description} onChange={(v) => setF('description', v)} placeholder="服务内容简介" />
          </FormRow>

          <FormRow label="封面图片">
            <ImageUpload url={imageUrl} size={100} maxMB={2} onPick={handlePickImage} onRemove={() => { setImageUrl(undefined); setImageFile(null) }} />
          </FormRow>

          <div className="border-t border-slate-100" />

          {/* 时长 & 价格 */}
          <div className="grid grid-cols-2 gap-4">
            <FormRow label="时长（分钟）">
              <NumberInput className="w-full" value={form.durationMinutes} onChange={(v) => setF('durationMinutes', v)} min={5} suffix="分钟" />
            </FormRow>
            <FormRow label="价格">
              <DollarInput value={form.price} onChange={(v) => setF('price', v ?? 0)} placeholder="0.00" className="w-full" />
            </FormRow>
          </div>

          <FormRow label="最大人数" hint="1 人为一对一，>1 为团课">
            <NumberInput className="w-full" value={form.maxGroupSize} onChange={(v) => setF('maxGroupSize', v)} min={1} />
          </FormRow>

          <div className="border-t border-slate-100" />

          {/* 人员 & 空间关联 */}
          <div className="grid grid-cols-2 gap-4">
            <FormRow label="需要指定人员"><Switch checked={form.requiresPerson} onCheckedChange={(v) => setF('requiresPerson', v)} /></FormRow>
            <FormRow label="需要空间"><Switch checked={form.requiresSpace} onCheckedChange={(v) => setF('requiresSpace', v)} /></FormRow>
          </div>

          {form.requiresPerson && (
            <FormRow label="关联人员" hint="留空价格表示使用服务默认价格">
              <div className="w-full">
                {/* 已添加的人员列表（含价格覆盖） */}
                {personAssignments.length > 0 && (
                  <div className="mb-2 flex flex-col gap-1.5">
                    {personAssignments.map(a => (
                      <div key={a.resourceId} className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                        <span className="flex-1 text-[13px] text-slate-800">{a.name}</span>
                        <DollarInput
                          value={a.priceOverride}
                          onChange={(val) => setPersonAssignments(prev => prev.map(p => p.resourceId === a.resourceId ? { ...p, priceOverride: val } : p))}
                          placeholder="默认价"
                          className="w-36"
                        />
                        <button
                          type="button"
                          onClick={() => setPersonAssignments(prev => prev.filter(p => p.resourceId !== a.resourceId))}
                          className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 添加人员下拉 */}
                <SelectInput
                  className="w-full"
                  placeholder="添加人员..."
                  value=""
                  onChange={(id) => {
                    if (!id) return
                    const person = persons.find(p => p.id === id)
                    if (!person) return
                    setPersonAssignments(prev => [...prev, { resourceId: String(id), name: person.name, priceOverride: null }])
                  }}
                  options={persons.filter(p => !personAssignments.some(a => a.resourceId === p.id)).map(p => ({ label: p.name, value: p.id }))}
                />
              </div>
            </FormRow>
          )}

          <div className="border-t border-slate-100" />

          {/* 押金 */}
          <div className="grid grid-cols-2 gap-4">
            <FormRow label="启用押金"><Switch checked={form.depositEnabled} onCheckedChange={(v) => setF('depositEnabled', v)} /></FormRow>
            {form.depositEnabled && (
              <FormRow label="押金金额">
                <DollarInput value={form.depositAmount} onChange={(v) => setF('depositAmount', v ?? 0)} placeholder="0.00" className="w-full" />
              </FormRow>
            )}
          </div>
        </div>
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="确认删除该服务？"
        danger
        confirmText="删除"
        onConfirm={handleDelete}
      />
    </div>
  )
}
