import { useEffect, useRef, useState, useCallback } from 'react'
import { Plus, Trash2, Pencil, X, Star, Settings } from 'lucide-react'
import { floorPlanApi, settingsApi } from '@/services/booking'
import type { FloorPlan, BookableResource, TableConfig, OperatingPeriod, TableSettingsConfig } from '@/types/booking'
import {
  TextInput, NumberInput, SelectInput, Switch, Btn, Spinner, Modal, Drawer, ConfirmDialog, toast,
} from '@/components/ui-kit'

// ─── 星期选择器 ──────────────────────────────────────────────────────
const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] // index = dayOfWeek (0=Sun)

function DaySelector({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const toggle = (day: number) => {
    if (value.includes(day)) onChange(value.filter(d => d !== day))
    else onChange([...value, day].sort())
  }

  return (
    <div className="flex gap-1">
      {DAY_LABELS.map((label, day) => {
        const active = value.includes(day)
        const isWeekend = day === 0 || day === 6
        return (
          <div
            key={day}
            onClick={() => toggle(day)}
            className={`w-[30px] h-[26px] rounded flex items-center justify-center text-xs cursor-pointer select-none transition-colors border ${
              active ? 'bg-slate-900 border-slate-900 text-white font-semibold'
                : `bg-white border-slate-200 font-normal ${isWeekend ? 'text-red-500' : 'text-slate-700'}`
            }`}
          >
            {label}
          </div>
        )
      })}
    </div>
  )
}

// ─── 根据容量计算桌位尺寸 ──────────────────────────────────────────
function calcTableSize(shape: string, maxCapacity: number): { w: number; h: number } {
  const minCap = Math.max(2, maxCapacity || 2)
  if (shape === 'round') {
    const d = Math.min(130, Math.max(70, 50 + (minCap - 2) * 6))
    return { w: d, h: d }
  } else if (shape === 'square') {
    return { w: 72, h: 72 }
  } else {
    const w = Math.min(150, 80 + (minCap - 2) * 8)
    return { w, h: 64 }
  }
}

function getRotatedBoundingSize(width: number, height: number, rotation: number) {
  const normalizedRotation = ((rotation % 360) + 360) % 360
  const rad = normalizedRotation * Math.PI / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  return { w: width * cos + height * sin, h: width * sin + height * cos }
}

function getTableGeometry(table: BookableResource) {
  const cfg = (table.config ?? {}) as TableConfig
  const shape = cfg.shape ?? 'square'
  const rotation = cfg.rotation ?? 0
  const { w, h } = calcTableSize(shape, cfg.maxCapacity ?? 4)
  const bbox = getRotatedBoundingSize(w, h, rotation)
  const centerX = table.posX ?? 100
  const centerY = table.posY ?? 100
  return {
    shape, rotation, width: w, height: h,
    bboxWidth: bbox.w, bboxHeight: bbox.h,
    centerX, centerY,
    left: centerX - bbox.w / 2, right: centerX + bbox.w / 2,
    top: centerY - bbox.h / 2, bottom: centerY + bbox.h / 2,
  }
}

// ─── 桌位视觉组件 ────────────────────────────────────────────────────
function TableShape({ table, selected, onPointerDown }: {
  table: BookableResource
  selected: boolean
  onPointerDown: (e: React.PointerEvent) => void
}) {
  const cfg = (table.config ?? {}) as TableConfig
  const geometry = getTableGeometry(table)
  const { rotation, width: w, height: h } = geometry

  const isRound = geometry.shape === 'round'
  const borderRadius = isRound ? '50%' : geometry.shape === 'long' ? 8 : 6

  const statusColor: Record<string, string> = {
    AVAILABLE: '#52c41a', OCCUPIED: '#fa8c16', MAINTENANCE: '#bfbfbf',
  }
  const border = selected ? '2.5px solid #0f172a' : `2px solid ${statusColor[table.status] ?? '#d9d9d9'}`

  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute',
        left: geometry.centerX - w / 2,
        top: geometry.centerY - h / 2,
        width: w, height: h, borderRadius, border,
        background: selected ? '#f1f5f9' : '#fff',
        boxShadow: selected ? '0 0 0 3px rgba(15,23,42,0.15)' : '0 2px 8px rgba(0,0,0,0.08)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        cursor: 'grab', userSelect: 'none',
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transition: 'box-shadow 0.15s, border 0.15s, transform 0.2s',
        zIndex: selected ? 10 : 1, gap: 2,
      }}
    >
      {/* 文字反向旋转，保持正方向 */}
      <div style={{ transform: rotation ? `rotate(-${rotation}deg)` : undefined, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#262626', lineHeight: 1.2, textAlign: 'center', padding: '0 4px' }}>{table.name}</span>
        <span style={{ fontSize: 11, color: '#8c8c8c' }}>{cfg.minCapacity ?? 1}–{cfg.maxCapacity ?? 4}人</span>
      </div>
    </div>
  )
}

// ─── 左侧工具栏：桌位形状 ────────────────────────────────────────────
function ShapeToolbar({ onAdd }: { onAdd: (shape: 'round' | 'square' | 'long') => void }) {
  const sz4round = calcTableSize('round', 4)
  const sz4square = calcTableSize('square', 4)
  const sz4long = calcTableSize('long', 4)

  const shapes: Array<{ key: 'round' | 'square' | 'long'; label: string; preview: React.ReactNode }> = [
    { key: 'round', label: '圆桌', preview: <div style={{ width: sz4round.w * 0.5, height: sz4round.h * 0.5, borderRadius: '50%', border: '2px solid #595959', background: '#fafafa' }} /> },
    { key: 'square', label: '方桌', preview: <div style={{ width: sz4square.w * 0.5, height: sz4square.h * 0.5, borderRadius: 4, border: '2px solid #595959', background: '#fafafa' }} /> },
    { key: 'long', label: '长桌', preview: <div style={{ width: sz4long.w * 0.5, height: sz4long.h * 0.5, borderRadius: 4, border: '2px solid #595959', background: '#fafafa' }} /> },
  ]

  return (
    <div className="w-[72px] bg-slate-50 border-r border-slate-100 flex flex-col items-center py-3 gap-2 shrink-0">
      <span className="text-[11px] text-slate-400 mb-1">添加</span>
      {shapes.map(s => (
        <div
          key={s.key}
          title={s.label}
          onClick={() => onAdd(s.key)}
          className="w-14 h-14 rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-slate-900 hover:bg-slate-100 transition-colors"
        >
          {s.preview}
          <span className="text-[10px] text-slate-600">{s.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── 右侧属性面板 ────────────────────────────────────────────────────
function TablePropertiesPanel({ table, floorPlanId, onChange, onDelete, onClose }: {
  table: BookableResource
  floorPlanId: string
  onChange: (updated: BookableResource) => void
  onDelete: () => void
  onClose?: () => void
}) {
  const cfg = (table.config ?? {}) as TableConfig
  const [localCfg, setLocalCfg] = useState<TableConfig>({
    minCapacity: cfg.minCapacity ?? 1, maxCapacity: cfg.maxCapacity ?? 4,
    shape: cfg.shape ?? 'square', location: cfg.location ?? 'indoor',
    combinable: cfg.combinable ?? false, rotation: cfg.rotation ?? 0,
  })
  const [localName, setLocalName] = useState(table.name)
  const [confirmDel, setConfirmDel] = useState(false)

  // 当选中不同桌位时重置本地状态
  useEffect(() => {
    const c = (table.config ?? {}) as TableConfig
    setLocalCfg({
      minCapacity: c.minCapacity ?? 1, maxCapacity: c.maxCapacity ?? 4,
      shape: c.shape ?? 'square', location: c.location ?? 'indoor',
      combinable: c.combinable ?? false, rotation: c.rotation ?? 0,
    })
    setLocalName(table.name)
  }, [table.id])

  // 自动保存：传入最新的 name 和 cfg 避免闭包过期问题
  const autoSave = async (name: string, cfg: TableConfig) => {
    try {
      const updated = await floorPlanApi.updateTable(floorPlanId, table.id, { name, config: cfg })
      onChange(updated)
    } catch {
      toast.error('保存失败')
    }
  }

  return (
    <div className="w-[260px] bg-white p-4 flex flex-col gap-3 overflow-y-auto rounded-lg shadow-xl border border-slate-100">
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-sm text-slate-800">桌位属性</span>
        {onClose && <X className="w-3.5 h-3.5 text-slate-400 cursor-pointer" onClick={onClose} />}
      </div>

      {/* 名称 */}
      <div>
        <div className="text-xs text-slate-400 mb-1">名称</div>
        <TextInput className="w-full" value={localName} onChange={setLocalName} />
        <input type="hidden" onBlur={() => autoSave(localName, localCfg)} />
      </div>

      {/* 形状 */}
      <div>
        <div className="text-xs text-slate-400 mb-1">形状</div>
        <SelectInput
          className="w-full"
          value={localCfg.shape ?? 'square'}
          onChange={v => { const newCfg = { ...localCfg, shape: v as TableConfig['shape'] }; setLocalCfg(newCfg); autoSave(localName, newCfg) }}
          options={[{ value: 'round', label: '圆桌' }, { value: 'square', label: '方桌' }, { value: 'long', label: '长桌' }]}
        />
      </div>

      {/* 旋转（仅长桌） */}
      {localCfg.shape === 'long' && (
        <div>
          <div className="text-xs text-slate-400 mb-1">旋转</div>
          <Btn variant="secondary" size="sm" className="w-full"
            onClick={() => { const newCfg = { ...localCfg, rotation: ((localCfg.rotation ?? 0) + 90) % 360 }; setLocalCfg(newCfg); autoSave(localName, newCfg) }}>
            旋转 90°（当前 {localCfg.rotation ?? 0}°）
          </Btn>
        </div>
      )}

      {/* 最小人数 */}
      <div onBlur={() => autoSave(localName, localCfg)}>
        <div className="text-xs text-slate-400 mb-1">最少人数</div>
        <NumberInput className="w-full" min={1} max={localCfg.maxCapacity} value={localCfg.minCapacity ?? 1}
          onChange={v => setLocalCfg(c => ({ ...c, minCapacity: v ?? 1 }))} />
      </div>

      {/* 最大人数 */}
      <div onBlur={() => autoSave(localName, localCfg)}>
        <div className="text-xs text-slate-400 mb-1">最大人数</div>
        <NumberInput className="w-full" min={localCfg.minCapacity} max={50} value={localCfg.maxCapacity ?? 4}
          onChange={v => setLocalCfg(c => ({ ...c, maxCapacity: v ?? 4 }))} />
      </div>

      {/* 区域 */}
      <div>
        <div className="text-xs text-slate-400 mb-1">区域</div>
        <SelectInput
          className="w-full"
          value={localCfg.location ?? 'indoor'}
          onChange={v => { const newCfg = { ...localCfg, location: v as TableConfig['location'] }; setLocalCfg(newCfg); autoSave(localName, newCfg) }}
          options={[{ value: 'indoor', label: '室内' }, { value: 'outdoor', label: '户外/露台' }, { value: 'window', label: '靠窗' }, { value: 'bar', label: '吧台' }]}
        />
      </div>

      {/* 可拼桌 */}
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-400">可拼桌</span>
        <Switch checked={!!localCfg.combinable}
          onCheckedChange={v => { const newCfg = { ...localCfg, combinable: v }; setLocalCfg(newCfg); autoSave(localName, newCfg) }} />
      </div>

      <Btn variant="danger" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} className="w-full" onClick={() => setConfirmDel(true)}>
        删除桌位
      </Btn>

      <ConfirmDialog open={confirmDel} onOpenChange={setConfirmDel} title="确认删除此桌位？"
        danger confirmText="删除" onConfirm={() => { setConfirmDel(false); onDelete() }} />
    </div>
  )
}

// ─── 主组件 ──────────────────────────────────────────────────────────
export default function FloorPlanEditor() {
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([])
  const [activePlanId, setActivePlanId] = useState<string | null>(null)
  const [tables, setTables] = useState<BookableResource[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [pendingPositions, setPendingPositions] = useState<Map<string, { x: number; y: number }>>(new Map())
  // 框选矩形（画布坐标）
  const [rubberRect, setRubberRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  // 新建平面图 modal
  const [newPlanModal, setNewPlanModal] = useState(false)
  const [newPlanName, setNewPlanName] = useState('')
  const [newPlanWidth, setNewPlanWidth] = useState(1200)
  const [newPlanHeight, setNewPlanHeight] = useState(800)
  const [newPlanError, setNewPlanError] = useState('')

  // 编辑平面图 modal
  const [editPlanModal, setEditPlanModal] = useState(false)
  const [editPlanId, setEditPlanId] = useState<string | null>(null)
  // 编辑模态框中宽高的临时输入值
  const [editWidth, setEditWidth] = useState<number>(1200)
  const [editHeight, setEditHeight] = useState<number>(800)

  // 删除平面图确认
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null)

  // 营业设置 Drawer
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSaving, setSavingSettings] = useState(false)
  const [periods, setPeriods] = useState<OperatingPeriod[]>([{ name: '', start: '09:00', end: '21:00' }])
  const [autoAccept, setAutoAccept] = useState(false)
  const [autoAcceptCutoff, setAutoAcceptCutoff] = useState(30)
  const [autoAssignSeat, setAutoAssignSeat] = useState(true)
  const [slotDuration, setSlotDuration] = useState(60)

  // 拖拽状态
  const dragging = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  // 框选状态
  const rubberBand = useRef<{ startX: number; startY: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // 编辑模式下的缩放
  const [zoom, setZoom] = useState(1)

  // 主页面画布自适应缩放
  const [viewScale, setViewScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  const activePlan = floorPlans.find(p => p.id === activePlanId)
  const editingFloorPlan = editPlanId ? floorPlans.find(p => p.id === editPlanId) : undefined
  // 单选时取出桌位（用于属性面板）
  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null
  const selectedTable = selectedId ? tables.find(t => t.id === selectedId) : undefined
  const propertiesPanelSide =
    selectedTable && editingFloorPlan
      ? ((selectedTable.posX ?? editingFloorPlan.width / 2) > editingFloorPlan.width * 0.6 ? 'left' : 'right')
      : 'right'

  // 计算画布缩放比例，使其完全显示在容器内
  useEffect(() => {
    if (!activePlan || !containerRef.current) return
    const calculateScale = () => {
      const container = containerRef.current
      if (!container) return
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight
      const scaleX = (containerWidth - 32) / activePlan.width
      const scaleY = (containerHeight - 32) / activePlan.height
      const scale = Math.min(scaleX, scaleY, 1)
      setViewScale(Math.max(scale, 0.1))
    }
    calculateScale()
    window.addEventListener('resize', calculateScale)
    return () => window.removeEventListener('resize', calculateScale)
  }, [activePlan])

  // ─── 加载平面图 ────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const plans = await floorPlanApi.list()
      setFloorPlans(plans ?? [])
      if (plans && plans.length > 0) {
        const defaultPlan = plans.find(p => p.isDefault) ?? plans[0]
        if (defaultPlan) {
          setActivePlanId(defaultPlan.id)
          setTables(defaultPlan.tables ?? [])
        }
      }
    } catch (error) {
      toast.error('加载平面图失败')
      setFloorPlans([])
      setTables([])
    } finally {
      setLoading(false)
    }
  }, [])

  // 加载营业设置
  const loadSettings = useCallback(async () => {
    try {
      const data = await settingsApi.get()
      const tc = data?.tableConfig
      if (tc?.operatingPeriods && tc.operatingPeriods.length > 0) {
        setPeriods(tc.operatingPeriods)
      } else if (data?.openTime && data?.closeTime) {
        setPeriods([{ name: '', start: data.openTime, end: data.closeTime }])
      }
      if (tc?.autoAccept !== undefined) setAutoAccept(tc.autoAccept)
      if (tc?.autoAcceptCutoffMinutes !== undefined) setAutoAcceptCutoff(tc.autoAcceptCutoffMinutes)
      if (tc?.autoAssignSeat !== undefined) setAutoAssignSeat(tc.autoAssignSeat)
      if (data?.slotDurationMinutes) setSlotDuration(data.slotDurationMinutes)
    } catch {
      // 静默失败，使用默认值
    }
  }, [])

  // 保存营业设置
  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      const tableConfig: TableSettingsConfig = {
        operatingPeriods: periods.filter(p => p.start && p.end),
        autoAccept,
        autoAcceptCutoffMinutes: autoAccept ? autoAcceptCutoff : undefined,
        autoAssignSeat,
      }
      await settingsApi.update({
        openTime: periods[0]?.start ?? '09:00',
        closeTime: periods[periods.length - 1]?.end ?? '21:00',
        slotDurationMinutes: slotDuration,
        tableConfig,
      })
      toast.success('设置已保存')
      setSettingsOpen(false)
    } catch {
      toast.error('保存失败')
    } finally {
      setSavingSettings(false)
    }
  }

  useEffect(() => { load(); loadSettings() }, [load, loadSettings])

  // 切换平面图时更新桌位
  const switchPlan = (planId: string) => {
    const plan = floorPlans.find(p => p.id === planId)
    if (plan) {
      setActivePlanId(planId)
      setTables(plan.tables ?? [])
      setSelectedIds(new Set())
      setPendingPositions(new Map())
    }
  }

  // ─── 拖拽逻辑（坐标计算需除以zoom，因为getBoundingClientRect返回缩放后的尺寸）──────
  const handleTablePointerDown = (e: React.PointerEvent, tableId: string) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const table = tables.find(t => t.id === tableId)
    if (!table || !canvasRef.current) return
    const canvasRect = canvasRef.current.getBoundingClientRect()
    dragging.current = {
      id: tableId,
      offsetX: (e.clientX - canvasRect.left) / zoom - (table.posX ?? 100),
      offsetY: (e.clientY - canvasRect.top) / zoom - (table.posY ?? 100),
    }
    setSelectedIds(new Set([tableId]))
  }

  // 点击画布空白区域：开始框选
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (!canvasRef.current) return
    const canvasRect = canvasRef.current.getBoundingClientRect()
    const x = (e.clientX - canvasRect.left) / zoom
    const y = (e.clientY - canvasRect.top) / zoom
    rubberBand.current = { startX: x, startY: y }
    canvasRef.current.setPointerCapture(e.pointerId)
    setRubberRect({ x, y, w: 0, h: 0 })
    setSelectedIds(new Set())
  }

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (!canvasRef.current) return

    // 拖拽桌位
    if (dragging.current) {
      const dragId = dragging.current.id
      const canvasRect = canvasRef.current.getBoundingClientRect()
      const plan = floorPlans.find(p => p.id === (editPlanId ?? activePlanId))
      const draggingTable = tables.find(t => t.id === dragId)
      const geometry = draggingTable ? getTableGeometry(draggingTable) : null
      const halfWidth = geometry ? geometry.bboxWidth / 2 : 40
      const halfHeight = geometry ? geometry.bboxHeight / 2 : 40
      const newX = Math.max(halfWidth, Math.min((e.clientX - canvasRect.left) / zoom - dragging.current.offsetX, (plan?.width ?? 1200) - halfWidth))
      const newY = Math.max(halfHeight, Math.min((e.clientY - canvasRect.top) / zoom - dragging.current.offsetY, (plan?.height ?? 800) - halfHeight))
      setTables(prev => prev.map(t => t.id === dragId ? { ...t, posX: newX, posY: newY } : t))
      setPendingPositions(prev => {
        const next = new Map(prev)
        next.set(dragId, { x: newX, y: newY })
        return next
      })
      return
    }

    // 框选：更新选框矩形
    if (rubberBand.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect()
      const x = (e.clientX - canvasRect.left) / zoom
      const y = (e.clientY - canvasRect.top) / zoom
      const { startX, startY } = rubberBand.current
      setRubberRect({ x: Math.min(x, startX), y: Math.min(y, startY), w: Math.abs(x - startX), h: Math.abs(y - startY) })
    }
  }

  const handleCanvasPointerUp = () => {
    // 结束桌位拖拽：自动保存坐标
    if (dragging.current) {
      const draggedId = dragging.current.id
      dragging.current = null
      setPendingPositions(prev => {
        const pos = prev.get(draggedId)
        if (!pos) return prev
        const planId = editPlanId ?? activePlanId
        if (!planId) return prev
        floorPlanApi.savePositions(planId, [{ id: draggedId, posX: Math.round(pos.x), posY: Math.round(pos.y) }]).catch(() => toast.error('位置保存失败'))
        const next = new Map(prev)
        next.delete(draggedId)
        return next
      })
      return
    }

    // 结束框选：计算框内桌位
    if (rubberBand.current && rubberRect) {
      rubberBand.current = null
      const { x, y, w, h } = rubberRect
      setRubberRect(null)
      if (w < 5 && h < 5) {
        setSelectedIds(new Set())
        return
      }
      const hits = tables.filter(t => {
        if (!t.isActive) return false
        const bounds = getTableGeometry(t)
        return !(bounds.right < x || bounds.left > x + w || bounds.bottom < y || bounds.top > y + h)
      })
      setSelectedIds(new Set(hits.map(t => t.id)))
    }
  }

  // ─── 对齐选中桌位 ──────────────────────────────────────────────────
  const alignTables = async (type: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => {
    const selected = tables.filter(t => selectedIds.has(t.id))
    if (selected.length < 2) return
    const getBounds = (t: BookableResource) => getTableGeometry(t)

    let newPositions: Array<{ id: string; posX: number; posY: number }>

    if (type === 'left') {
      const minLeft = Math.min(...selected.map(t => getBounds(t).left))
      newPositions = selected.map(t => { const b = getBounds(t); return { id: t.id, posX: minLeft + b.bboxWidth / 2, posY: t.posY ?? 100 } })
    } else if (type === 'right') {
      const maxRight = Math.max(...selected.map(t => getBounds(t).right))
      newPositions = selected.map(t => { const b = getBounds(t); return { id: t.id, posX: maxRight - b.bboxWidth / 2, posY: t.posY ?? 100 } })
    } else if (type === 'top') {
      const minTop = Math.min(...selected.map(t => getBounds(t).top))
      newPositions = selected.map(t => { const b = getBounds(t); return { id: t.id, posX: t.posX ?? 100, posY: minTop + b.bboxHeight / 2 } })
    } else if (type === 'bottom') {
      const maxBottom = Math.max(...selected.map(t => getBounds(t).bottom))
      newPositions = selected.map(t => { const b = getBounds(t); return { id: t.id, posX: t.posX ?? 100, posY: maxBottom - b.bboxHeight / 2 } })
    } else if (type === 'centerH') {
      const avgY = selected.reduce((sum, t) => sum + (t.posY ?? 100), 0) / selected.length
      newPositions = selected.map(t => ({ id: t.id, posX: t.posX ?? 100, posY: avgY }))
    } else {
      const avgX = selected.reduce((sum, t) => sum + (t.posX ?? 100), 0) / selected.length
      newPositions = selected.map(t => ({ id: t.id, posX: avgX, posY: t.posY ?? 100 }))
    }

    setTables(prev => prev.map(t => {
      const pos = newPositions.find(p => p.id === t.id)
      return pos ? { ...t, posX: pos.posX, posY: pos.posY } : t
    }))

    const planId = editPlanId ?? activePlanId
    if (!planId) return
    try {
      await floorPlanApi.savePositions(planId, newPositions)
    } catch {
      toast.error('对齐保存失败')
    }
  }

  // ─── 添加桌位 ──────────────────────────────────────────────────────
  const addTable = async (shape: 'round' | 'square' | 'long') => {
    if (!activePlanId) return
    const plan = floorPlans.find(p => p.id === activePlanId)
    const posX = Math.round((plan?.width ?? 1200) / 2)
    const posY = Math.round((plan?.height ?? 800) / 2)
    const tableNum = tables.length + 1
    try {
      const newTable = await floorPlanApi.addTable(activePlanId, {
        name: `T${tableNum}`, shape, minCapacity: 1, maxCapacity: shape === 'long' ? 8 : 4, posX, posY,
      })
      setTables(prev => [...prev, newTable])
      setSelectedIds(new Set([newTable.id]))
    } catch {
      toast.error('添加桌位失败')
    }
  }

  // ─── 删除桌位 ──────────────────────────────────────────────────────
  const deleteTable = async (tableId: string) => {
    if (!activePlanId) return
    try {
      await floorPlanApi.removeTable(activePlanId, tableId)
      setTables(prev => prev.filter(t => t.id !== tableId))
      setSelectedIds(new Set())
      toast.success('桌位已删除')
    } catch {
      toast.error('删除失败')
    }
  }

  // ─── 创建新平面图 ──────────────────────────────────────────────────
  const createFloorPlan = async () => {
    if (!newPlanName.trim()) { setNewPlanError('请输入区域名称'); return }
    setNewPlanError('')
    try {
      const plan = await floorPlanApi.create({ name: newPlanName, width: newPlanWidth, height: newPlanHeight })
      const updated = [...floorPlans, plan]
      setFloorPlans(updated)
      setActivePlanId(plan.id)
      setTables(plan.tables ?? [])
      setSelectedIds(new Set())
      setNewPlanModal(false)
      setNewPlanName(''); setNewPlanWidth(1200); setNewPlanHeight(800)
      toast.success(`"${plan.name}" 已创建`)
    } catch {
      toast.error('创建失败')
    }
  }

  // ─── 设置默认平面图 ────────────────────────────────────────────────
  const setDefault = async (planId: string) => {
    await floorPlanApi.setDefault(planId)
    setFloorPlans(prev => prev.map(p => ({ ...p, isDefault: p.id === planId })))
    toast.success('已设为默认')
  }

  // ─── 删除平面图 ────────────────────────────────────────────────────
  const deleteFloorPlan = async (planId: string) => {
    await floorPlanApi.delete(planId)
    const updated = floorPlans.filter(p => p.id !== planId)
    setFloorPlans(updated)
    if (activePlanId === planId) {
      const next = updated[0]
      if (next) {
        setActivePlanId(next.id)
        setTables(next.tables ?? [])
      } else {
        setActivePlanId(null)
        setTables([])
      }
    }
    toast.success('平面图已删除')
  }

  // 打开编辑区域弹窗
  const openEditPlan = async (planId: string) => {
    try {
      const latestPlan = await floorPlanApi.get(planId)
      setEditPlanId(latestPlan.id)
      setTables(latestPlan.tables ?? [])
      setSelectedIds(new Set())
      setZoom(1)
      setPendingPositions(new Map())
      setEditWidth(latestPlan.width)
      setEditHeight(latestPlan.height)
      setEditPlanModal(true)
    } catch (error) {
      toast.error('加载平面图失败')
    }
  }

  const closeEditPlan = () => {
    if (editPlanId) {
      setFloorPlans(prev => prev.map(p => p.id === editPlanId ? { ...p, tables } : p))
    }
    setEditPlanModal(false)
    setEditPlanId(null)
    setZoom(1)
    setSelectedIds(new Set())
  }

  // ─── 渲染 ──────────────────────────────────────────────────────────
  if (loading) {
    return <div className="mt-20 text-center"><Spinner className="w-8 h-8 mx-auto text-slate-400" /></div>
  }

  const propertiesPanel = selectedTable && editPlanId ? (
    <div
      key={selectedTable.id}
      style={{
        position: 'absolute', top: 16,
        left: propertiesPanelSide === 'left' ? 88 : undefined,
        right: propertiesPanelSide === 'right' ? 16 : undefined,
        zIndex: 1000,
      }}
    >
      <TablePropertiesPanel
        table={selectedTable}
        floorPlanId={editPlanId}
        onChange={updated => setTables(prev => prev.map(t => t.id === updated.id ? updated : t))}
        onDelete={() => deleteTable(selectedTable.id)}
        onClose={() => setSelectedIds(new Set())}
      />
    </div>
  ) : null

  return (
    <div className="flex flex-col h-full min-h-[600px]">

      {/* 顶部：平面图标签栏 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-white flex-wrap">
        {floorPlans.map(plan => {
          const isActive = plan.id === activePlanId
          return (
            <div
              key={plan.id}
              onClick={() => switchPlan(plan.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full cursor-pointer text-[13px] select-none transition-colors ${
                isActive ? 'bg-slate-900 text-white font-semibold' : 'bg-slate-100 text-slate-700 font-normal'
              }`}
            >
              {plan.isDefault && <Star className="w-3 h-3 fill-current" />}
              <span>{plan.name}</span>
              {isActive && (
                <div className="flex gap-1 ml-1" onClick={e => e.stopPropagation()}>
                  {!plan.isDefault && (
                    <Star className="w-3 h-3 cursor-pointer" title="设为默认" onClick={() => setDefault(plan.id)} />
                  )}
                  <Pencil className="w-3 h-3 cursor-pointer" title="编辑区域" onClick={() => openEditPlan(plan.id)} />
                  <Trash2 className="w-3 h-3 cursor-pointer text-red-300" title="删除区域" onClick={() => setDeletePlanId(plan.id)} />
                </div>
              )}
            </div>
          )
        })}

        <Btn variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setNewPlanModal(true)}>添加区域</Btn>

        <div className="ml-auto flex gap-2 items-center">
          <Btn variant="secondary" size="sm" icon={<Settings className="w-3.5 h-3.5" />} onClick={() => setSettingsOpen(true)}>营业设置</Btn>
          {/* 图例 */}
          <div className="flex gap-3 text-xs text-slate-400">
            <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style={{ background: '#52c41a' }} />空闲</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style={{ background: '#fa8c16' }} />已占</span>
          </div>
        </div>
      </div>

      {/* 主体 - 只读查看 */}
      <div className="flex flex-1 overflow-hidden">
        <div ref={containerRef} className="flex-1 overflow-hidden bg-slate-100 flex items-center justify-center">
          {activePlan ? (
            <div style={{ width: activePlan.width * viewScale, height: activePlan.height * viewScale, flexShrink: 0, position: 'relative' }}>
              <div
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: activePlan.width, height: activePlan.height,
                  background: '#fff',
                  backgroundImage: 'radial-gradient(circle, #e8e8e8 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                  borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                  cursor: 'default', transform: `scale(${viewScale})`, transformOrigin: 'top left',
                }}
              >
                {tables.filter(t => t.isActive).map(table => (
                  <TableShape key={table.id} table={table} selected={false} onPointerDown={() => {}} />
                ))}

                {tables.filter(t => t.isActive).length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-2 pointer-events-none">
                    <Settings className="w-10 h-10" />
                    <div className="text-sm">从左侧工具栏拖入桌位</div>
                    <div className="text-xs">点击桌位形状即可添加到画布</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
              <div className="text-sm">还没有平面图</div>
              <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setNewPlanModal(true)}>创建第一个区域</Btn>
            </div>
          )}
        </div>
      </div>

      {/* 编辑平面图 - 全屏编辑界面（自定义 overlay，画布需要大空间） */}
      {editPlanModal && editPlanId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <div className="absolute inset-0 bg-black/40" onClick={closeEditPlan} />
          <div className="relative bg-white rounded-xl border border-slate-200 shadow-xl flex flex-col overflow-hidden" style={{ width: '90vw', height: '85vh' }}>
            {/* 顶部：编辑区域名称和尺寸 */}
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex gap-4 items-center flex-wrap">
              <div className="flex gap-2 items-center flex-1 min-w-[300px]">
                <span className="text-xs text-slate-400 min-w-[60px]">区域名称:</span>
                <input
                  className="flex-1 text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
                  defaultValue={floorPlans.find(p => p.id === editPlanId)?.name}
                  onBlur={(e) => {
                    if (!editPlanId) return
                    const newName = e.target.value
                    const oldName = floorPlans.find(p => p.id === editPlanId)?.name
                    if (newName && newName !== oldName) {
                      floorPlanApi.update(editPlanId, { name: newName }).then(updated => {
                        setFloorPlans(prev => prev.map(p => p.id === editPlanId ? updated : p))
                      })
                    }
                  }}
                />
              </div>
              <div className="flex gap-2 items-center min-w-[250px]">
                <span className="text-xs text-slate-400">画布尺寸:</span>
                <div onBlur={() => {
                  if (!editPlanId || !editWidth) return
                  const oldWidth = floorPlans.find(p => p.id === editPlanId)?.width
                  if (editWidth !== oldWidth) floorPlanApi.update(editPlanId, { width: editWidth }).then(updated => setFloorPlans(prev => prev.map(p => p.id === editPlanId ? updated : p)))
                }}>
                  <NumberInput min={400} max={3000} value={editWidth} onChange={v => setEditWidth(v)} />
                </div>
                <span className="text-slate-400 text-xs">×</span>
                <div onBlur={() => {
                  if (!editPlanId || !editHeight) return
                  const oldHeight = floorPlans.find(p => p.id === editPlanId)?.height
                  if (editHeight !== oldHeight) floorPlanApi.update(editPlanId, { height: editHeight }).then(updated => setFloorPlans(prev => prev.map(p => p.id === editPlanId ? updated : p)))
                }}>
                  <NumberInput min={300} max={2000} value={editHeight} onChange={v => setEditHeight(v)} />
                </div>
                <span className="text-slate-400 text-xs">px</span>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                {/* 多选时显示对齐工具栏 */}
                {selectedIds.size >= 2 && (
                  <div className="flex gap-1 items-center px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">
                    <span className="text-xs text-slate-500 mr-1">已选 {selectedIds.size} 个</span>
                    <Btn variant="secondary" size="sm" onClick={() => alignTables('left')}>左</Btn>
                    <Btn variant="secondary" size="sm" onClick={() => alignTables('right')}>右</Btn>
                    <Btn variant="secondary" size="sm" onClick={() => alignTables('top')}>顶</Btn>
                    <Btn variant="secondary" size="sm" onClick={() => alignTables('bottom')}>底</Btn>
                    <Btn variant="secondary" size="sm" onClick={() => alignTables('centerH')}>水平居中</Btn>
                    <Btn variant="secondary" size="sm" onClick={() => alignTables('centerV')}>垂直居中</Btn>
                  </div>
                )}
                <Btn variant="secondary" size="sm" onClick={() => setZoom(z => Math.min(z + 0.2, 2))} disabled={zoom >= 2}>放大 {Math.round(zoom * 100)}%</Btn>
                <Btn variant="secondary" size="sm" onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))} disabled={zoom <= 0.5}>缩小</Btn>
                <Btn variant="primary" size="sm" onClick={closeEditPlan}>完成编辑</Btn>
              </div>
            </div>

            {/* 主编辑区域 */}
            <div className="relative flex flex-1 overflow-hidden min-w-0">
              {/* 左侧工具栏 */}
              <ShapeToolbar onAdd={addTable} />

              {/* 画布区域 */}
              <div className="flex-1 min-w-0 overflow-auto bg-slate-100">
                {floorPlans.find(p => p.id === editPlanId) ? (
                  <div
                    ref={canvasRef}
                    onPointerDown={handleCanvasPointerDown}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={handleCanvasPointerUp}
                    style={{
                      position: 'relative',
                      width: floorPlans.find(p => p.id === editPlanId)?.width ?? 1200,
                      height: floorPlans.find(p => p.id === editPlanId)?.height ?? 800,
                      background: '#fff',
                      backgroundImage: 'radial-gradient(circle, #e8e8e8 1px, transparent 1px)',
                      backgroundSize: '24px 24px',
                      margin: 16, borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                      cursor: 'default', transform: `scale(${zoom})`, transformOrigin: 'top left', transition: 'transform 0.2s',
                    }}
                  >
                    {tables.filter(t => t.isActive).map(table => (
                      <TableShape key={table.id} table={table} selected={selectedIds.has(table.id)} onPointerDown={e => handleTablePointerDown(e, table.id)} />
                    ))}

                    {/* 框选矩形 */}
                    {rubberRect && rubberRect.w > 2 && rubberRect.h > 2 && (
                      <div style={{
                        position: 'absolute', left: rubberRect.x, top: rubberRect.y, width: rubberRect.w, height: rubberRect.h,
                        border: '1.5px dashed #0f172a', background: 'rgba(15,23,42,0.06)', pointerEvents: 'none', zIndex: 200,
                      }} />
                    )}

                    {tables.filter(t => t.isActive).length === 0 && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-2 pointer-events-none">
                        <Settings className="w-10 h-10" />
                        <div className="text-sm">从左侧工具栏添加桌位</div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* 浮动属性面板，不占用画布布局 */}
              {propertiesPanel}
            </div>
          </div>
        </div>
      )}

      {/* 新建平面图 Modal */}
      <Modal
        title="添加区域"
        open={newPlanModal}
        onOpenChange={(o) => { if (!o) { setNewPlanModal(false); setNewPlanError('') } }}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => { setNewPlanModal(false); setNewPlanError('') }}>取消</Btn>
            <Btn variant="primary" onClick={createFloorPlan}>创建</Btn>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="text-sm text-slate-600 mb-1.5">区域名称</div>
            <TextInput className="w-full" value={newPlanName} onChange={(v) => { setNewPlanName(v); if (newPlanError) setNewPlanError('') }} placeholder="如：大厅、露台、VIP包厢" />
            {newPlanError && <p className="text-sm text-red-500 mt-1">{newPlanError}</p>}
          </div>
          <div>
            <div className="text-sm text-slate-600 mb-1.5">画布尺寸</div>
            <div className="flex gap-2 items-center">
              <NumberInput value={newPlanWidth} onChange={setNewPlanWidth} min={400} max={3000} suffix="px 宽" />
              <span className="text-slate-400">×</span>
              <NumberInput value={newPlanHeight} onChange={setNewPlanHeight} min={300} max={2000} suffix="px 高" />
            </div>
          </div>
        </div>
      </Modal>

      {/* 删除平面图确认 */}
      <ConfirmDialog
        open={!!deletePlanId}
        onOpenChange={(o) => !o && setDeletePlanId(null)}
        title="删除此平面图？"
        description="桌位将被清除。"
        danger
        confirmText="删除"
        onConfirm={() => { const id = deletePlanId!; setDeletePlanId(null); deleteFloorPlan(id) }}
      />

      {/* 营业设置 Drawer */}
      <Drawer
        title="餐桌营业设置"
        width={380}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        footer={
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setSettingsOpen(false)}>取消</Btn>
            <Btn variant="primary" loading={settingsSaving} onClick={saveSettings}>保存</Btn>
          </div>
        }
      >
        {/* 营业时段 */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-slate-700">营业时段</span>
            <Btn variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setPeriods(prev => [...prev, { name: '', start: '17:00', end: '21:00' }])}>添加时段</Btn>
          </div>
          {periods.map((period, index) => (
            <div key={index} className="mb-3 px-2.5 pt-2.5 pb-2 bg-slate-50 rounded-md border border-slate-100">
              {/* 第一行：名称 + 时间 + 删除 */}
              <div className="flex gap-1.5 items-end mb-2">
                <div className="flex-1">
                  <div className="text-[11px] text-slate-400 mb-0.5">时段名称（可选）</div>
                  <TextInput className="w-full" value={period.name ?? ''} placeholder="如：午餐、晚餐"
                    onChange={v => setPeriods(prev => prev.map((p, i) => i === index ? { ...p, name: v } : p))} />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 mb-0.5">开始</div>
                  <input type="time" step={900} value={period.start ?? ''}
                    onChange={e => setPeriods(prev => prev.map((p, i) => i === index ? { ...p, start: e.target.value } : p))}
                    className="text-sm bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0" />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 mb-0.5">结束</div>
                  <input type="time" step={900} value={period.end ?? ''}
                    onChange={e => setPeriods(prev => prev.map((p, i) => i === index ? { ...p, end: e.target.value } : p))}
                    className="text-sm bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0" />
                </div>
                <button
                  disabled={periods.length <= 1}
                  onClick={() => setPeriods(prev => prev.filter((_, i) => i !== index))}
                  className="h-9 w-9 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* 第二行：星期选择 */}
              <div>
                <div className="text-[11px] text-slate-400 mb-1">
                  适用星期
                  {(!period.days || period.days.length === 0) && <span className="ml-1.5 text-slate-600">每天</span>}
                </div>
                <DaySelector value={period.days ?? []} onChange={days => setPeriods(prev => prev.map((p, i) => i === index ? { ...p, days } : p))} />
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 my-3" />

        {/* 预约间隔 */}
        <div className="mb-4">
          <span className="font-semibold text-slate-700 block mb-1">预约间隔</span>
          <p className="text-xs text-slate-400 block mb-2">客人可选的时间粒度，如设 60 分钟则可选 11:00、12:00、13:00…</p>
          <NumberInput value={slotDuration} onChange={v => setSlotDuration(v ?? 60)} min={5} max={240} suffix="分钟" />
        </div>

        <div className="border-t border-slate-100 my-3" />

        {/* 自动接受预约 */}
        <div className="mb-3">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-sm text-slate-700">自动接受预约</div>
              <div className="text-xs text-slate-400">收到预约后自动确认，无需人工审核</div>
            </div>
            <Switch checked={autoAccept} onCheckedChange={setAutoAccept} />
          </div>
          {autoAccept && (
            <div className="mt-2.5 px-3 py-2.5 bg-slate-50 rounded-md">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-slate-700">营业结束前</span>
                <NumberInput value={autoAcceptCutoff} onChange={v => setAutoAcceptCutoff(v ?? 30)} min={0} max={480} />
                <span className="text-[13px] text-slate-700">分钟截止</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">例如 21:00 关门，设 60 分钟则 20:00 后不再自动接受当日预约</div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 my-3" />

        {/* 自动安排座位 */}
        <div className="flex justify-between items-center">
          <div>
            <div className="font-medium text-sm text-slate-700">自动安排座位</div>
            <div className="text-xs text-slate-400">根据人数自动分配餐桌，关闭后需人工指定</div>
          </div>
          <Switch checked={autoAssignSeat} onCheckedChange={setAutoAssignSeat} />
        </div>
      </Drawer>
    </div>
  )
}
