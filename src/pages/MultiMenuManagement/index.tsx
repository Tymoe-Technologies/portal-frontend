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
  PageHeader, SectionCard, Badge, Btn, SwitchOrStatus, TextInput, Textarea, Field,
  AlertBox, Spinner, EmptyState, Modal, Drawer, ConfirmDialog, Tooltip,
} from '@/components/ui-kit'
import { useAuthContext } from '@/auth/AuthProvider'
import { canEditModule } from '@/auth/permissions'

const DAY_LABEL_KEYS = ['dayShortSun', 'dayShortMon', 'dayShortTue', 'dayShortWed', 'dayShortThu', 'dayShortFri', 'dayShortSat'] as const

const fmtPrice = (cents: number | null | undefined) =>
  cents != null ? (cents / 100).toFixed(2) : '—'

function scheduleText(schedules: MenuSchedule[], t: (key: string) => string): string {
  if (!schedules.length) return t('pages.multiMenu.noSchedule')
  return schedules.map(s => {
    const days = [...s.days].sort().map(d => t(`pages.multiMenu.${DAY_LABEL_KEYS[d]}`)).join(' ')
    return `${days}  ${s.startTime}–${s.endTime}`
  }).join('　|　')
}

type ScheduleRow = { days: number[]; startTime: string; endTime: string }

// ─── 时间调度编辑 ───────────────────────────────────────────────────
const ScheduleEditor: React.FC<{
  schedules: ScheduleRow[]
  onChange: (v: ScheduleRow[]) => void
}> = ({ schedules, onChange }) => {
  const { t } = useTranslation()
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
              {DAY_LABEL_KEYS.map((key, d) => (
                <button
                  key={d}
                  onClick={() => toggleDay(i, d)}
                  className={clsx('px-2 py-0.5 rounded-md text-xs cursor-pointer transition-colors',
                    s.days.includes(d) ? 'bg-slate-900 text-white!' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}
                >
                  {t(`pages.multiMenu.${key}`)}
                </button>
              ))}
            </div>
            <button onClick={() => remove(i)} className="p-1 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input type="time" step={900} value={s.startTime} onChange={e => update(i, 'startTime', e.target.value || '00:00')} className={timeCls} />
            <span className="text-xs text-slate-400">{t('pages.multiMenu.until')}</span>
            <input type="time" step={900} value={s.endTime} onChange={e => update(i, 'endTime', e.target.value || '23:59')} className={timeCls} />
            {s.startTime > s.endTime && <Badge variant="gold">{t('pages.multiMenu.crossMidnight')}</Badge>}
          </div>
        </div>
      ))}
      <button onClick={add} className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors cursor-pointer inline-flex items-center justify-center gap-1">
        <Plus className="w-3.5 h-3.5" />{t('pages.multiMenu.addTimeSlot')}
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
  const { t } = useTranslation()
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
      title={t('pages.multiMenu.addItemsModalTitle')}
      footer={
        <>
          <Btn variant="secondary" onClick={onCancel}>{t('pages.multiMenu.cancel')}</Btn>
          <Btn variant="primary" disabled={selected.size === 0} onClick={() => onSelect([...selected].map(id => ({ catalogItemId: id, priceOverride: null })))}>
            {t('pages.multiMenu.addCount', { count: selected.size })}
          </Btn>
        </>
      }
    >
      <div className="space-y-2">
        <TextInput value={search} onChange={setSearch} placeholder={t('pages.multiMenu.searchItemsPlaceholder')} />
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
            {filtered.length === 0 && <EmptyState title={t('pages.multiMenu.noMatchingItems')} />}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── 主页面 ────────────────────────────────────────────────────────
const MultiMenuManagement: React.FC = () => {
  const { t } = useTranslation()
  const { role, permissions } = useAuthContext()
  const canEdit = canEditModule('multiMenu', role, permissions)
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
      notify('error', t('pages.multiMenu.loadFailed'))
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
    if (!menuName.trim()) { setMenuErr(t('pages.multiMenu.menuNameRequired')); return }
    setSavingMenu(true)
    try {
      if (menuDrawer.menu) {
        await updateMenu(menuDrawer.menu.id, { name: menuName, description: menuDesc })
        await replaceSchedules(menuDrawer.menu.id, scheduleRows)
      } else {
        await createMenu({ name: menuName, description: menuDesc, schedules: scheduleRows } as any)
      }
      notify('success', t('pages.multiMenu.saved'))
      setMenuDrawer({ open: false })
      load()
    } catch (e: any) {
      notify('error', e?.response?.data?.error ?? t('pages.multiMenu.saveFailed'))
    } finally {
      setSavingMenu(false)
    }
  }

  const handleToggle = async (menu: StoreMenu, isActive: boolean) => {
    try {
      await updateMenu(menu.id, { isActive })
      setMenus(prev => prev.map(m => m.id === menu.id ? { ...m, isActive } : m))
      if (selected?.id === menu.id) setSelected(prev => prev ? { ...prev, isActive } : prev)
    } catch { notify('error', t('pages.multiMenu.actionFailed')) }
  }

  const handleDeleteMenu = async (menu: StoreMenu) => {
    try {
      await deleteMenu(menu.id)
      notify('success', t('pages.multiMenu.deleted'))
      if (selected?.id === menu.id) setSelected(null)
      load()
    } catch { notify('error', t('pages.multiMenu.deleteFailed')) }
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
    if (!sectionName.trim()) { setSectionErr(t('pages.multiMenu.sectionNameRequired')); return }
    try {
      const payload = { name: sectionName, description: sectionDesc }
      section ? await updateSection(menuId, section.id, payload) : await createSection(menuId, payload)
      notify('success', t('pages.multiMenu.saved'))
      setSectionModal({ open: false })
      load()
    } catch { notify('error', t('pages.multiMenu.saveFailed')) }
  }

  const handleDeleteSection = async (menuId: string, sectionId: string) => {
    try {
      await deleteSection(menuId, sectionId)
      notify('success', t('pages.multiMenu.deleted'))
      load()
    } catch { notify('error', t('pages.multiMenu.deleteFailed')) }
    finally { setDeleteSectionTarget(null) }
  }

  // ─── 商品操作 ─────────────────────────────────────────────────

  const handleAddItems = async (items: Array<{ catalogItemId: string; priceOverride: null }>) => {
    if (!selected || !itemPicker.section) return
    try {
      await addItemsToSection(selected.id, itemPicker.section.id, items)
      notify('success', t('pages.multiMenu.itemsAdded', { count: items.length }))
      setItemPicker({ open: false })
      load()
    } catch (e: any) {
      notify('error', e?.response?.data?.error ?? t('pages.multiMenu.addItemsFailed'))
    }
  }

  const handleRemoveItem = async (sectionId: string, itemId: string) => {
    if (!selected) return
    try {
      await removeSectionItem(selected.id, sectionId, itemId)
      load()
    } catch { notify('error', t('pages.multiMenu.removeItemFailed')) }
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
            {canEdit && <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>{t('pages.multiMenu.newMenu')}</Btn>}
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
              <EmptyState title={t('pages.multiMenu.noMenus')} action={canEdit ? <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>{t('pages.multiMenu.newMenu')}</Btn> : undefined} />
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
                        {!menu.isActive && <Badge>{t('pages.multiMenu.inactive')}</Badge>}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span className="truncate">{scheduleText(menu.schedules, t)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <SwitchOrStatus
                        checked={menu.isActive}
                        editable={canEdit}
                        onCheckedChange={v => handleToggle(menu, v)}
                        onLabel={t('pages.multiMenu.active')}
                        offLabel={t('pages.multiMenu.inactive')}
                      />
                      {canEdit && (
                        <>
                          <Tooltip label={t('pages.multiMenu.edit')}>
                            <button onClick={() => openEdit(menu)} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer">
                              <Pencil className="w-4 h-4" />
                            </button>
                          </Tooltip>
                          <Tooltip label={t('pages.multiMenu.delete')}>
                            <button onClick={() => setDeleteMenuTarget(menu)} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </Tooltip>
                        </>
                      )}
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
            <SectionCard><EmptyState title={t('pages.multiMenu.selectMenuHint')} /></SectionCard>
          ) : (
            <SectionCard
              title={selected.name}
              action={canEdit ? <Btn variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => openSectionCreate(selected.id)}>{t('pages.multiMenu.addSection')}</Btn> : undefined}
            >
              {selected.sections.length === 0 ? (
                <EmptyState title={t('pages.multiMenu.noSections')} action={canEdit ? <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => openSectionCreate(selected.id)}>{t('pages.multiMenu.addFirstSection')}</Btn> : undefined} />
              ) : (
                <div className="space-y-3">
                  {selected.sections.map(section => (
                    <div key={section.id} className="rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/60">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-700 text-sm">{section.name}</span>
                          <Badge>{t('pages.multiMenu.itemsCountUnit', { count: section.items.length })}</Badge>
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-1">
                            <Tooltip label={t('pages.multiMenu.editSection')}>
                              <button onClick={() => openSectionEdit(selected.id, section)} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer">
                                <Pencil className="w-4 h-4" />
                              </button>
                            </Tooltip>
                            <Tooltip label={t('pages.multiMenu.deleteSection')}>
                              <button onClick={() => setDeleteSectionTarget({ menuId: selected.id, section })} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </Tooltip>
                          </div>
                        )}
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
                                {canEdit && (
                                  <Tooltip label={t('pages.multiMenu.removeItem')}>
                                    <button onClick={() => setRemoveItemTarget({ sectionId: section.id, itemId: item.id })} className="p-1 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer shrink-0">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </Tooltip>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {canEdit && (
                          <button onClick={() => setItemPicker({ section, open: true })} className="w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors cursor-pointer inline-flex items-center justify-center gap-1">
                            <Plus className="w-3.5 h-3.5" />{t('pages.multiMenu.addItems')}
                          </button>
                        )}
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
        title={menuDrawer.menu ? t('pages.multiMenu.editMenuTitle') : t('pages.multiMenu.newMenuTitle')}
        width={500}
        footer={<><Btn variant="secondary" onClick={() => setMenuDrawer({ open: false })}>{t('pages.multiMenu.cancel')}</Btn><Btn variant="primary" loading={savingMenu} onClick={handleSaveMenu}>{t('pages.multiMenu.save')}</Btn></>}
      >
        <div className="space-y-4">
          <Field label={t('pages.multiMenu.menuNameLabel')} required error={menuErr}>
            <TextInput value={menuName} onChange={setMenuName} placeholder={t('pages.multiMenu.menuNamePlaceholder')} />
          </Field>
          <Field label={t('pages.multiMenu.descriptionOptionalLabel')}>
            <Textarea value={menuDesc} onChange={setMenuDesc} rows={2} />
          </Field>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">{t('pages.multiMenu.scheduleLabel')}</p>
            <p className="text-xs text-slate-400 mb-2">{t('pages.multiMenu.scheduleHint')}</p>
            <ScheduleEditor schedules={scheduleRows} onChange={setScheduleRows} />
          </div>
        </div>
      </Drawer>

      {/* 分区 Modal */}
      <Modal
        open={sectionModal.open}
        onOpenChange={v => !v && setSectionModal({ open: false })}
        title={sectionModal.section ? t('pages.multiMenu.editSectionTitle') : t('pages.multiMenu.newSectionTitle')}
        footer={<><Btn variant="secondary" onClick={() => setSectionModal({ open: false })}>{t('pages.multiMenu.cancel')}</Btn><Btn variant="primary" onClick={handleSaveSection}>{t('pages.multiMenu.save')}</Btn></>}
      >
        <div className="space-y-4">
          <Field label={t('pages.multiMenu.sectionNameLabel')} required error={sectionErr}>
            <TextInput value={sectionName} onChange={setSectionName} placeholder={t('pages.multiMenu.sectionNamePlaceholder')} />
          </Field>
          <Field label={t('pages.multiMenu.descriptionOptionalLabel')}>
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
        title={t('pages.multiMenu.confirmDeleteTitle')}
        description={t('pages.multiMenu.confirmDeleteDescription')}
        confirmText={t('pages.multiMenu.delete')}
        danger
        onConfirm={() => deleteMenuTarget && handleDeleteMenu(deleteMenuTarget)}
      />
      <ConfirmDialog
        open={!!deleteSectionTarget}
        onOpenChange={v => !v && setDeleteSectionTarget(null)}
        title={t('pages.multiMenu.confirmDeleteSectionTitle')}
        confirmText={t('pages.multiMenu.delete')}
        danger
        onConfirm={() => deleteSectionTarget && handleDeleteSection(deleteSectionTarget.menuId, deleteSectionTarget.section.id)}
      />
      <ConfirmDialog
        open={!!removeItemTarget}
        onOpenChange={v => !v && setRemoveItemTarget(null)}
        title={t('pages.multiMenu.confirmRemoveTitle')}
        confirmText={t('pages.multiMenu.removeItem')}
        danger
        onConfirm={() => removeItemTarget && handleRemoveItem(removeItemTarget.sectionId, removeItemTarget.itemId)}
      />
    </div>
  )
}

export default MultiMenuManagement
