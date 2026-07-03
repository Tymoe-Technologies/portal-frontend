import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, User, ArrowLeftRight, X } from 'lucide-react'
import { resourcesApi } from '@/services/booking'
import type { BookableResource } from '@/types/booking'
import {
  Modal, TextInput, Textarea, SelectInput, ImageUpload, Btn, Spinner, EmptyState,
  ConfirmDialog, FormRow, toast,
} from '@/components/ui-kit'

interface PersonResource extends BookableResource {
  resourceType: 'PERSON'
}

// 性别选项
const GENDER_OPTIONS = [
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
  { label: '非二元性别', value: 'non-binary' },
  { label: '不公开', value: 'not-specified' },
]
const GENDER_LABEL: Record<string, string> = {
  male: '男', female: '女', 'non-binary': '非二元', 'not-specified': '不公开',
}

// 标签输入（回车添加，替代 antd Select tags 模式）
function TagsInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('')
  const add = () => {
    const v = input.trim()
    if (v && !value.includes(v)) onChange([...value, v])
    setInput('')
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus-within:outline-2 focus-within:outline-slate-900">
      {value.map(tag => (
        <span key={tag} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
          {tag}
          <button onClick={() => onChange(value.filter(t => t !== tag))} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-3 h-3" /></button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        onBlur={add}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[100px] text-sm outline-none bg-transparent text-slate-700 py-0.5"
      />
    </div>
  )
}

export default function PersonManagement() {
  const [persons, setPersons] = useState<PersonResource[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // 表单字段
  const [fName, setFName] = useState('')
  const [fDescription, setFDescription] = useState('')
  const [fTitle, setFTitle] = useState('')
  const [fSkills, setFSkills] = useState<string[]>([])
  const [fGender, setFGender] = useState('')
  const [fStaffId, setFStaffId] = useState('')
  const [nameError, setNameError] = useState('')

  // 加载人员列表
  const loadPersons = async () => {
    setLoading(true)
    try {
      const resources = await resourcesApi.list({ type: 'PERSON' })
      setPersons(resources as PersonResource[])
    } catch (error) {
      toast.error('加载人员列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPersons()
  }, [])

  // 选择图片：读取预览，保存时上传
  const handlePickImage = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      setImageUrl(reader.result as string)
      setImageFile(file)
      toast.success('图片已选择，保存时将上传')
    }
    reader.readAsDataURL(file)
  }

  // 打开新增模态框
  const openCreate = () => {
    setEditingId(null)
    setImageUrl(undefined)
    setImageFile(null)
    setFName(''); setFDescription(''); setFTitle(''); setFSkills([]); setFGender(''); setFStaffId('')
    setNameError('')
    setModal(true)
  }

  // 打开编辑模态框
  const openEdit = (person: PersonResource) => {
    setEditingId(person.id)
    const cfg = (person.config ?? {}) as any
    setImageUrl(person.imageUrl)
    setImageFile(null)
    setFName(person.name || '')
    setFDescription(person.description || '')
    setFTitle(cfg.title || '')
    setFSkills(cfg.skills || [])
    setFGender(cfg.gender || '')
    setFStaffId(person.staffId || '')
    setNameError('')
    setModal(true)
  }

  // 保存（新增或编辑）
  const handleSave = async () => {
    if (!fName.trim()) { setNameError('请输入名字'); return }
    setNameError('')
    setSaving(true)
    try {
      const data = {
        resourceType: 'PERSON',
        name: fName,
        description: fDescription,
        staffId: fStaffId || null,
        config: { skills: fSkills || [], gender: fGender || null, title: fTitle || null },
      }

      let resource: PersonResource
      if (editingId) {
        resource = await resourcesApi.update(editingId, data) as PersonResource
      } else {
        resource = await resourcesApi.create(data) as PersonResource
      }

      // 上传图片（如果选择了新图片）
      if (imageFile) {
        try {
          const uploadResult = await resourcesApi.uploadImage(resource.id, imageFile)
          resource = uploadResult.resource
        } catch (uploadError) {
          toast.error('图片上传失败')
        }
      }

      setPersons(prev => {
        const index = prev.findIndex(p => p.id === resource.id)
        if (index >= 0) {
          const newPersons = [...prev]
          newPersons[index] = resource
          return newPersons
        }
        return [...prev, resource]
      })

      toast.success(editingId ? '人员已更新' : '人员已添加')
      setModal(false)
    } catch (error) {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 切换接单状态
  const handleToggleStatus = async (person: PersonResource) => {
    if (togglingId) return
    const nextStatus = person.status === 'AVAILABLE' ? 'MAINTENANCE' : 'AVAILABLE'
    setTogglingId(person.id)
    try {
      const updated = await resourcesApi.update(person.id, { status: nextStatus }) as PersonResource
      setPersons(prev => prev.map(p => p.id === updated.id ? updated : p))
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
      setPersons(prev => prev.filter(p => p.id !== deleteId))
      toast.success('人员已删除')
      setDeleteId(null)
    } catch (error) {
      toast.error('删除失败')
    }
  }

  // 渲染单个人员卡片
  const renderPersonCard = (person: PersonResource) => {
    const cfg = (person.config ?? {}) as any
    const skills: string[] = cfg.skills || []
    const gender: string | undefined = cfg.gender
    const title: string | undefined = cfg.title
    const isAvailable = person.status === 'AVAILABLE'
    const toggling = togglingId === person.id

    return (
      <div key={person.id} className="bg-white border border-slate-100 rounded-xl overflow-hidden h-full flex flex-col hover:shadow-md transition-shadow">
        {/* 头像区域 */}
        <div className="h-44 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
          {person.imageUrl ? (
            <img src={person.imageUrl} alt={person.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-[72px] h-[72px] rounded-full bg-slate-100 flex items-center justify-center">
              <User className="w-8 h-8 text-slate-300" />
            </div>
          )}
        </div>

        {/* 信息区域 */}
        <div className="px-4 pt-3.5 pb-4 flex-1 flex flex-col">
          <div className="mb-2.5">
            <div className="text-[15px] font-semibold text-slate-900 leading-snug">{person.name}</div>
            {title && <div className="text-xs text-slate-400 mt-0.5">{title}</div>}
          </div>

          {person.description && (
            <div className="text-[13px] text-slate-600 leading-relaxed mb-2.5 line-clamp-2">{person.description}</div>
          )}

          {skills.length > 0 && (
            <div className="flex gap-1 flex-wrap mb-2.5">
              {skills.slice(0, 4).map(skill => (
                <span key={skill} className="text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{skill}</span>
              ))}
              {skills.length > 4 && <span className="text-[11px] text-slate-400 px-1 py-0.5">+{skills.length - 4}</span>}
            </div>
          )}

          {gender && <div className="text-xs text-slate-400 mb-2.5">{GENDER_LABEL[gender]}</div>}

          {/* 底部操作 */}
          <div className="mt-auto flex gap-1.5 pt-3 border-t border-slate-100">
            <button
              onClick={() => handleToggleStatus(person)}
              disabled={toggling}
              className={`flex-1 h-8 rounded-md border flex items-center justify-center gap-1.5 text-xs transition-colors disabled:opacity-60 cursor-pointer ${
                isAvailable ? 'border-green-200 bg-green-50 text-green-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-green-50'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAvailable ? 'bg-green-500' : 'bg-slate-300'}`} />
              <span>{toggling ? '更新中' : isAvailable ? '接单中' : '已暂停'}</span>
              <ArrowLeftRight className="w-2.5 h-2.5 opacity-40" />
            </button>

            <button onClick={() => openEdit(person)}
              className="w-8 h-8 rounded-md border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer shrink-0">
              <Pencil className="w-3 h-3" />
            </button>

            <button onClick={() => setDeleteId(person.id)}
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
        <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>添加人员</Btn>
      </div>

      {loading ? (
        <div className="text-center py-16"><Spinner className="w-8 h-8 mx-auto text-slate-400" /></div>
      ) : persons.length === 0 ? (
        <EmptyState icon={<User className="w-8 h-8" />} title="暂无人员" description="点击上方按钮添加" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {persons.map(renderPersonCard)}
        </div>
      )}

      {/* 编辑模态框 */}
      <Modal
        title={editingId ? '编辑人员' : '添加人员'}
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
          <FormRow label="名字">
            <TextInput className="w-full" value={fName} onChange={(v) => { setFName(v); if (nameError) setNameError('') }} placeholder="如：张师傅" />
          </FormRow>
          {nameError && <p className="text-sm text-red-500 -mt-2">{nameError}</p>}

          <FormRow label="介绍">
            <Textarea className="w-full" rows={3} value={fDescription} onChange={setFDescription} placeholder="如：资深理发师，擅长烫染" />
          </FormRow>

          <FormRow label="职称">
            <TextInput className="w-full" value={fTitle} onChange={setFTitle} placeholder="如：首席设计师" />
          </FormRow>

          <FormRow label="头像">
            <ImageUpload
              url={imageUrl}
              size={100}
              maxMB={2}
              onPick={handlePickImage}
              onRemove={() => { setImageUrl(undefined); setImageFile(null) }}
            />
          </FormRow>

          <FormRow label="技能">
            <TagsInput value={fSkills} onChange={setFSkills} placeholder="添加技能后回车（如：烫、染、剪）" />
          </FormRow>

          <FormRow label="性别">
            <div className="w-52"><SelectInput className="w-full" value={fGender} onChange={(v) => setFGender(String(v))} options={GENDER_OPTIONS} placeholder="选择性别（可选）" /></div>
          </FormRow>

          <FormRow label="关联员工账号" hint="关联后该员工可在员工中心查看自己的预约">
            <TextInput className="w-full" value={fStaffId} onChange={setFStaffId} placeholder="员工 ID（从 auth-service，可选）" />
          </FormRow>
        </div>
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="确认删除该人员？"
        danger
        confirmText="删除"
        onConfirm={handleDelete}
      />
    </div>
  )
}
