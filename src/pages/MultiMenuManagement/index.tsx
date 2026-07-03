/**
 * MultiMenuManagement - 多菜单管理
 * 布局：左栏菜单列表 + 右侧详情（分区 & 商品）
 */

import React, { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { Clock, Trash2, Pencil, Plus, RotateCcw } from 'lucide-react'
import {
  createMenu, createSection, deleteMenu, deleteSection,
  getMenus, replaceSchedules, updateMenu, updateSection,
  addItemsToSection, removeSectionItem,
  type MenuSchedule, type MenuSection, type StoreMenu,
} from '@/services/multi-menu'
import { itemManagementService } from '@/services/item-management'
import {
  PageHeader, SectionCard, Badge, Btn, Switch, TextInput, Textarea, Field,
  AlertBox, Spinner, EmptyState, Modal, Drawer, ConfirmDialog,
} from '@/components/ui-kit'

const DAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const fmtPrice = (cents: number | null | undefined) =>
  cents != null ? (cents / 100).toFixed(2) : '—'

function scheduleText(schedules: MenuSchedule[]): string {
  if (!schedules.length) return '无调度'
  return schedules.map(s => {
    const days = [...s.days].sort().map(d => DAY_LABELS[d]).join(' ')
    return `${days}  ${s.startTime}–${s.endTime}`
  }).join('　|　')
}

type ScheduleRow = { days: number[]; startTime: string; endTime: string }

// ─── 时间调度编辑 ───────────────────────────────────────────────────
const ScheduleEditor: React.FC<{
  schedules: ScheduleRow[]
  onChange: (v: ScheduleRow[]) => void
}> = ({ schedules, onChange }) => {
  const add = () => onChange([...schedules, { days: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '22:00' }])
  const remove = (i: number) => onChange(schedules.filter((_, idx) => idx !== i))
  const update = (i: number, key: keyof ScheduleRow, val: any) =>
    onChange(schedules.map((s, idx) => idx === i ? { ...s, [key]: val } : s))
  const toggleDay = (i: number, d: number) => {
    const days = schedules[i].days.includes(d) ? schedules[i].days.filter(x => x !== d) : [...schedules[i].days, d]
    update(i, 'days', days)
  }

  const timeCls = 'text-sm border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:outline-2 focus:outline-slate-900'

  return (
    <div className="space-y-2">
      {schedules.map((s, i) => (
        <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {DAY_LABELS.map((label, d) => (
                <button
                  key={d}
                  onClick={() => toggleDay(i, d)}
                  className={clsx('px-2 py-0.5 rounded-md text-xs cursor-pointer transition-colors',
                    s.days.includes(d) ? 'bg-slate-900 text-white!' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}
                >
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => remove(i)} className="p-1 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input type="time" step={900} value={s.startTime} onChange={e => update(i, 'startTime', e.target.value || '00:00')} className={timeCls} />
            <span className="text-xs text-slate-400">至</span>
            <input type="time" step={900} value={s.endTime} onChange={e => update(i, 'endTime', e.target.value || '23:59')} className={timeCls} />
            {s.startTime > s.endTime && <Badge variant="gold">跨午夜</Badge>}
          </div>
        </div>
      ))}
      <button onClick={add} className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors cursor-pointer inline-flex items-center justify-center gap-1">
        <Plus className="w-3.5 h-3.5" />添加时间段
      </button>
    </div>
  )
}

// ─── 商品选择弹窗 ───────────────────────────────────────────────────
const ItemPicker: React.FC<{
  open: boolean
  existingIds: Set<string>
  onSelect: (items: Array<{ catalogItemId: string; priceOverride: null }>) => void
  onCancel: () => void
}> = ({ open, existingIds, onSelect, onCancel }) => {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    setSelected(new Set())
    setSearch('')
    setLoading(true)
    itemManagementService.getItems({ isActive: true, limit: 500 })
      .then(res => setItems(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  const filtered = items.filter(i => !search || i.name?.toLowerCase().includes(search.toLowerCase()))
  const toggle = (id: string) => {
    if (existingIds.has(id)) return
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <Modal
      open={open}
      onOpenChange={v => !v && onCancel()}
      title="添加商品"
      footer={
        <>
          <Btn variant="secondary" onClick={onCancel}>取消</Btn>
          <Btn variant="primary" disabled={selected.size === 0} onClick={() => onSelect([...selected].map(id => ({ catalogItemId: id, priceOverride: null })))}>
            添加 {selected.size} 个
          </Btn>
        </>
      }
    >
      <div className="space-y-2">
        <TextInput value={search} onChange={setSearch} placeholder="搜索商品名称" />
        {loading ? <Spinner /> : (
          <div className="max-h-80 overflow-y-auto sidebar-scroll">
            {filtered.map(item => {
              const inSection = existingIds.has(item.id)
              const checked = selected.has(item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  disabled={inSection}
                  className={clsx('w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm cursor-pointer',
                    inSection ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50', checked && 'bg-slate-100')}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <input type="checkbox" readOnly checked={checked} disabled={inSection} className="accent-slate-900" />
                    <span className="truncate text-slate-700">{item.name}</span>
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">{fmtPrice(item.basePrice)}</span>
                </button>
              )
            })}
            {filtered.length === 0 && <EmptyState title="无匹配商品" />}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── 主页面 ────────────────────────────────────────────────────────
const MultiMenuManagement: React.FC = () => {
  const { t } = useTranslation()
  const [menus, setMenus] = useState<StoreMenu[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<StoreMenu | null>(null)

  const [flash, setFlash] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const notify = (type: 'success' | 'error', msg: string) => {
    setFlash({ type, msg }); setTimeout(() => setFlash(null), type === 'success' ? 2500 : 5000)
  }

  // 菜单 Drawer
  const [menuDrawer, setMenuDrawer] = useState<{ menu?: StoreMenu; open: boolean }>({ open: false })
  const [menuName, setMenuName] = useState('')
  const [menuDesc, setMenuDesc] = useState('')
  const [menuErr, setMenuErr] = useState('')
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([])
  const [savingMenu, setSavingMenu] = useState(false)

  // 分区 Modal
  const [sectionModal, setSectionModal] = useState<{ menuId?: string; section?: MenuSection; open: boolean }>({ open: false })
  const [sectionName, setSectionName] = useState('')
  const [sectionDesc, setSectionDesc] = useState('')
  const [sectionErr, setSectionErr] = useState('')

  // 商品选择
  const [itemPicker, setItemPicker] = useState<{ section?: MenuSection; open: boolean }>({ open: false })

  // 确认
  const [deleteMenuTarget, setDeleteMenuTarget] = useState<StoreMenu | null>(null)
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<{ menuId: string; section: MenuSection } | null>(null)
  const [removeItemTarget, setRemoveItemTarget] = useState<{ sectionId: string; itemId: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getMenus()
      setMenus(data)
      setSelected(prev => prev ? (data.find(m => m.id === prev.id) ?? null) : null)
    } catch {
      notify('error', '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ─── 菜单操作 ─────────────────────────────────────────────────

  const openCreate = () => {
    setMenuName(''); setMenuDesc(''); setMenuErr(''); setScheduleRows([])
    setMenuDrawer({ open: true })
  }

  const openEdit = (menu: StoreMenu) => {
    setMenuName(menu.name); setMenuDesc(menu.description ?? ''); setMenuErr('')
    setScheduleRows(menu.schedules.map(s => ({ days: s.days, startTime: s.startTime, endTime: s.endTime })))
    setMenuDrawer({ menu, open: true })
  }

  const handleSaveMenu = async () => {
    if (!menuName.trim()) { setMenuErr('请输入菜单名称'); return }
    setSavingMenu(true)
    try {
      if (menuDrawer.menu) {
        await updateMenu(menuDrawer.menu.id, { name: menuName, description: menuDesc })
        await replaceSchedules(menuDrawer.menu.id, scheduleRows)
      } else {
        await createMenu({ name: menuName, description: menuDesc, schedules: scheduleRows } as any)
      }
      notify('success', '已保存')
      setMenuDrawer({ open: false })
      load()
    } catch (e: any) {
      notify('error', e?.response?.data?.error ?? '保存失败')
    } finally {
      setSavingMenu(false)
    }
  }

  const handleToggle = async (menu: StoreMenu, isActive: boolean) => {
    try {
      await updateMenu(menu.id, { isActive })
      setMenus(prev => prev.map(m => m.id === menu.id ? { ...m, isActive } : m))
      if (selected?.id === menu.id) setSelected(prev => prev ? { ...prev, isActive } : prev)
    } catch { notify('error', '操作失败') }
  }

  const handleDeleteMenu = async (menu: StoreMenu) => {
    try {
      await deleteMenu(menu.id)
      notify('success', '已删除')
      if (selected?.id === menu.id) setSelected(null)
      load()
    } catch { notify('error', '删除失败') }
    finally { setDeleteMenuTarget(null) }
  }

  // ─── 分区操作 ─────────────────────────────────────────────────

  const openSectionCreate = (menuId: string) => {
    setSectionName(''); setSectionDesc(''); setSectionErr('')
    setSectionModal({ menuId, open: true })
  }
  const openSectionEdit = (menuId: string, section: MenuSection) => {
    setSectionName(section.name); setSectionDesc(section.description ?? ''); setSectionErr('')
    setSectionModal({ menuId, section, open: true })
  }

  const handleSaveSection = async () => {
    const { menuId, section } = sectionModal
    if (!menuId) return
    if (!sectionName.trim()) { setSectionErr('请输入分区名称'); return }
    try {
      const payload = { name: sectionName, description: sectionDesc }
      section ? await updateSection(menuId, section.id, payload) : await createSection(menuId, payload)
      notify('success', '已保存')
      setSectionModal({ open: false })
      load()
    } catch { notify('error', '保存失败') }
  }

  const handleDeleteSection = async (menuId: string, sectionId: string) => {
    try {
      await deleteSection(menuId, sectionId)
      notify('success', '已删除')
      load()
    } catch { notify('error', '删除失败') }
    finally { setDeleteSectionTarget(null) }
  }

  // ─── 商品操作 ─────────────────────────────────────────────────

  const handleAddItems = async (items: Array<{ catalogItemId: string; priceOverride: null }>) => {
    if (!selected || !itemPicker.section) return
    try {
      await addItemsToSection(selected.id, itemPicker.section.id, items)
      notify('success', `已添加 ${items.length} 个商品`)
      setItemPicker({ open: false })
      load()
    } catch (e: any) {
      notify('error', e?.response?.data?.error ?? '添加失败')
    }
  }

  const handleRemoveItem = async (sectionId: string, itemId: string) => {
    if (!selected) return
    try {
      await removeSectionItem(selected.id, sectionId, itemId)
      load()
    } catch { notify('error', '移除失败') }
    finally { setRemoveItemTarget(null) }
  }

  // ─── 渲染 ─────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <PageHeader
        title={t('pages.multiMenu.title')}
        description={t('pages.multiMenu.subtitle')}
        actions={
          <>
            <Btn variant="secondary" icon={<RotateCcw className="w-3.5 h-3.5" />} loading={loading} onClick={load} />
            <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>新建菜单</Btn>
          </>
        }
      />

      {flash && <div className="mb-4"><AlertBox type={flash.type} title={flash.msg} /></div>}

      <div className="flex flex-col md:flex-row gap-4 items-start">
        {/* 左栏：菜单列表 */}
        <div className="w-full md:w-80 shrink-0">
          {loading && menus.length === 0 ? (
            <Spinner />
          ) : menus.length === 0 ? (
            <SectionCard>
              <EmptyState title="暂无菜单" action={<Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>新建菜单</Btn>} />
            </SectionCard>
          ) : (
            <div className="space-y-2">
              {menus.map(menu => (
                <div
                  key={menu.id}
                  onClick={() => setSelected(menu)}
                  className={clsx('rounded-xl border p-3 cursor-pointer transition-all',
                    selected?.id === menu.id ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800 truncate">{menu.name}</span>
                        {!menu.isActive && <Badge>停用</Badge>}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span className="truncate">{scheduleText(menu.schedules)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <Switch checked={menu.isActive} onCheckedChange={v => handleToggle(menu, v)} />
                      <button title="编辑" onClick={() => openEdit(menu)} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button title="删除" onClick={() => setDeleteMenuTarget(menu)} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右侧：选中菜单的分区 & 商品 */}
        <div className="flex-1 min-w-0 w-full">
          {!selected ? (
            <SectionCard><EmptyState title="选择左侧菜单查看分区和商品" /></SectionCard>
          ) : (
            <SectionCard
              title={selected.name}
              action={<Btn variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => openSectionCreate(selected.id)}>添加分区</Btn>}
            >
              {selected.sections.length === 0 ? (
                <EmptyState title="暂无分区" action={<Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => openSectionCreate(selected.id)}>添加第一个分区</Btn>} />
              ) : (
                <div className="space-y-3">
                  {selected.sections.map(section => (
                    <div key={section.id} className="rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/60">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-700 text-sm">{section.name}</span>
                          <Badge>{section.items.length} 件</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <button title="编辑分区" onClick={() => openSectionEdit(selected.id, section)} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button title="删除分区" onClick={() => setDeleteSectionTarget({ menuId: selected.id, section })} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="p-3">
                        {section.items.length > 0 && (
                          <div className="divide-y divide-slate-100 mb-2">
                            {section.items.map(item => (
                              <div key={item.id} className="flex items-center justify-between gap-2 py-1.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm text-slate-700 truncate">{item.catalogItem?.name ?? item.catalogItemId}</span>
                                  <span className="text-xs shrink-0">
                                    {item.priceOverride != null
                                      ? <span className="text-amber-600">{fmtPrice(item.priceOverride)}</span>
                                      : <span className="text-slate-400">{fmtPrice(item.catalogItem?.basePrice)}</span>}
                                  </span>
                                </div>
                                <button title="移除" onClick={() => setRemoveItemTarget({ sectionId: section.id, itemId: item.id })} className="p-1 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer shrink-0">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <button onClick={() => setItemPicker({ section, open: true })} className="w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors cursor-pointer inline-flex items-center justify-center gap-1">
                          <Plus className="w-3.5 h-3.5" />添加商品
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}
        </div>
      </div>

      {/* 菜单创建/编辑 Drawer */}
      <Drawer
        open={menuDrawer.open}
        onOpenChange={v => !v && setMenuDrawer({ open: false })}
        title={menuDrawer.menu ? '编辑菜单' : '新建菜单'}
        width={500}
        footer={<><Btn variant="secondary" onClick={() => setMenuDrawer({ open: false })}>取消</Btn><Btn variant="primary" loading={savingMenu} onClick={handleSaveMenu}>保存</Btn></>}
      >
        <div className="space-y-4">
          <Field label="菜单名称" required error={menuErr}>
            <TextInput value={menuName} onChange={setMenuName} placeholder="例：早餐菜单、午餐菜单" />
          </Field>
          <Field label="描述（可选）">
            <Textarea value={menuDesc} onChange={setMenuDesc} rows={2} />
          </Field>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">时间调度</p>
            <p className="text-xs text-slate-400 mb-2">设定的时间段内自动激活，支持跨午夜。不设置则永不自动激活。</p>
            <ScheduleEditor schedules={scheduleRows} onChange={setScheduleRows} />
          </div>
        </div>
      </Drawer>

      {/* 分区 Modal */}
      <Modal
        open={sectionModal.open}
        onOpenChange={v => !v && setSectionModal({ open: false })}
        title={sectionModal.section ? '编辑分区' : '新建分区'}
        footer={<><Btn variant="secondary" onClick={() => setSectionModal({ open: false })}>取消</Btn><Btn variant="primary" onClick={handleSaveSection}>保存</Btn></>}
      >
        <div className="space-y-4">
          <Field label="分区名称" required error={sectionErr}>
            <TextInput value={sectionName} onChange={setSectionName} placeholder="例：早餐、主食、饮品" />
          </Field>
          <Field label="描述（可选）">
            <Textarea value={sectionDesc} onChange={setSectionDesc} rows={2} />
          </Field>
        </div>
      </Modal>

      {/* 商品选择弹窗 */}
      <ItemPicker
        open={itemPicker.open}
        existingIds={new Set(itemPicker.section?.items.map(i => i.catalogItemId) ?? [])}
        onSelect={handleAddItems}
        onCancel={() => setItemPicker({ open: false })}
      />

      {/* 确认弹窗 */}
      <ConfirmDialog
        open={!!deleteMenuTarget}
        onOpenChange={v => !v && setDeleteMenuTarget(null)}
        title="确认删除？"
        description="删除后不可恢复。"
        confirmText="删除"
        danger
        onConfirm={() => deleteMenuTarget && handleDeleteMenu(deleteMenuTarget)}
      />
      <ConfirmDialog
        open={!!deleteSectionTarget}
        onOpenChange={v => !v && setDeleteSectionTarget(null)}
        title="确认删除此分区？"
        confirmText="删除"
        danger
        onConfirm={() => deleteSectionTarget && handleDeleteSection(deleteSectionTarget.menuId, deleteSectionTarget.section.id)}
      />
      <ConfirmDialog
        open={!!removeItemTarget}
        onOpenChange={v => !v && setRemoveItemTarget(null)}
        title="确认移除？"
        confirmText="移除"
        danger
        onConfirm={() => removeItemTarget && handleRemoveItem(removeItemTarget.sectionId, removeItemTarget.itemId)}
      />
    </div>
  )
}

export default MultiMenuManagement
