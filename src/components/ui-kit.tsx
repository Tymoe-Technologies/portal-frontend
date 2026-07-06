// ─── 全站共享设计组件 kit（slate 手写风格，逐步替换 antd 的唯一来源） ─────────────
//
// 统一视觉语言：白底卡片 + slate 配色 + rounded-xl。
// 底层仅依赖 Radix(Switch/Dialog/AlertDialog)+ Tailwind,不引入 antd。

import React from 'react'
import { createPortal } from 'react-dom'
import * as RadixSwitch from '@radix-ui/react-switch'
import * as Dialog from '@radix-ui/react-dialog'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as RadixSelect from '@radix-ui/react-select'
import clsx from 'clsx'
import {
  Loader2, Info, AlertTriangle, CheckCircle2, X, ChevronRight, ChevronLeft,
  Image as ImageIcon, Trash2, Check, ChevronsUpDown, Calendar as CalendarIcon, ArrowRight, Clock,
} from 'lucide-react'

// ─── 徽章 ───────────────────────────────────────────────────────────────────────

export function Badge({ children, variant = 'default', icon }: {
  children: React.ReactNode
  variant?: 'default' | 'gold' | 'blue' | 'green' | 'red'
  icon?: React.ReactNode
}) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ring-1',
      variant === 'gold'  && 'bg-amber-50 text-amber-700 ring-amber-200',
      variant === 'blue'  && 'bg-blue-50 text-blue-700 ring-blue-200',
      variant === 'green' && 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      variant === 'red'   && 'bg-red-50 text-red-700 ring-red-200',
      variant === 'default' && 'bg-slate-100 text-slate-600 ring-slate-200',
    )}>
      {icon}{children}
    </span>
  )
}

// ─── 按钮 ───────────────────────────────────────────────────────────────────────

export function Btn({
  children, variant = 'primary', size = 'md', loading = false,
  disabled = false, onClick, type = 'button', icon, className,
}: {
  children?: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'link' | 'danger'
  size?: 'sm' | 'md'
  loading?: boolean
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all duration-150 cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        // text-*! 后缀 important：antd reset 的无 layer `button{color:inherit}` 会盖掉文字色，
        // important 才能钉死（与 antd 的临时隔离边界，antd 清完即可移除）。
        // 主色走 brand token（global.css @theme），改一处即可全站换主色。
        variant === 'primary'   && 'bg-brand text-white! hover:bg-brand-hover px-3.5 py-2 text-sm focus-visible:outline-brand',
        variant === 'secondary' && 'bg-white text-slate-700! ring-1 ring-slate-300 hover:bg-slate-50 px-3.5 py-2 text-sm focus-visible:outline-slate-400',
        variant === 'ghost'     && 'text-slate-600! hover:bg-slate-100 px-3 py-1.5 text-sm focus-visible:outline-slate-400',
        variant === 'danger'    && 'bg-red-500 text-white! hover:bg-red-600 px-3.5 py-2 text-sm focus-visible:outline-red-500',
        variant === 'link'      && 'text-slate-600! hover:text-slate-900 underline-offset-4 hover:underline text-sm',
        size === 'sm' && variant !== 'link' && 'text-xs px-2.5 py-1.5',
        className,
      )}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </button>
  )
}

// ─── 开关 ───────────────────────────────────────────────────────────────────────

export function Switch({ checked, onCheckedChange, disabled }: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={clsx(
        'relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer shrink-0',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900',
        checked ? 'bg-slate-900' : 'bg-slate-200',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <RadixSwitch.Thumb className="block w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 translate-x-0.5 data-[state=checked]:translate-x-[22px]" />
    </RadixSwitch.Root>
  )
}

// ─── 复选框（原生 + slate 强调色） ───────────────────────────────────────────────

export function Checkbox({ checked, onCheckedChange, label, disabled }: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  label?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <label className={clsx('inline-flex items-center gap-2 text-sm text-slate-700 select-none', disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer')}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onCheckedChange(e.target.checked)}
        className="w-4 h-4 accent-slate-900 cursor-pointer"
      />
      {label}
    </label>
  )
}

// ─── 滑块（原生 range + slate 强调色） ───────────────────────────────────────────

export function Slider({ value, onChange, min = 0, max = 100, step = 1, disabled }: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full accent-slate-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    />
  )
}

// ─── 提示框 ─────────────────────────────────────────────────────────────────────

export function AlertBox({ type = 'info', title, description, action }: {
  type?: 'info' | 'warning' | 'success' | 'error'
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  const styles = {
    info:    { wrap: 'bg-blue-50 border-blue-200',   icon: <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />,          text: 'text-blue-800',    sub: 'text-blue-600' },
    warning: { wrap: 'bg-amber-50 border-amber-200', icon: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />, text: 'text-amber-800',   sub: 'text-amber-700' },
    error:   { wrap: 'bg-red-50 border-red-200',     icon: <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />,   text: 'text-red-800',     sub: 'text-red-700' },
    success: { wrap: 'bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />, text: 'text-emerald-800', sub: 'text-emerald-700' },
  }[type]

  return (
    <div className={clsx('flex items-start gap-3 rounded-xl border px-4 py-3', styles.wrap)}>
      {styles.icon}
      <div className="flex-1 min-w-0">
        <p className={clsx('text-sm font-medium', styles.text)}>{title}</p>
        {description && <div className={clsx('text-sm mt-0.5', styles.sub)}>{description}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// ─── 全局 Toast（单例，替代 antd message；无需 Provider，只需挂一次 ToastHost） ──

type ToastType = 'success' | 'error' | 'warning' | 'info'
interface ToastItem { id: number; type: ToastType; msg: React.ReactNode }

let toastList: ToastItem[] = []
let toastListeners: Array<(l: ToastItem[]) => void> = []
let toastSeq = 0
const emitToasts = () => toastListeners.forEach(l => l([...toastList]))
function pushToast(type: ToastType, msg: React.ReactNode) {
  const id = ++toastSeq
  toastList = [...toastList, { id, type, msg }]
  emitToasts()
  setTimeout(() => { toastList = toastList.filter(t => t.id !== id); emitToasts() }, type === 'error' ? 5000 : 3000)
}

/** 全局提示：toast.success('已保存') 等，任意位置可调用 */
export const toast = {
  success: (m: React.ReactNode) => pushToast('success', m),
  error: (m: React.ReactNode) => pushToast('error', m),
  warning: (m: React.ReactNode) => pushToast('warning', m),
  info: (m: React.ReactNode) => pushToast('info', m),
}

/** 挂在应用根部一次即可（如 BaseLayout） */
export function ToastHost() {
  const [list, setList] = React.useState<ToastItem[]>([])
  React.useEffect(() => {
    toastListeners.push(setList)
    return () => { toastListeners = toastListeners.filter(l => l !== setList) }
  }, [])

  const styles: Record<ToastType, { wrap: string; icon: React.ReactNode }> = {
    success: { wrap: 'border-emerald-200 text-emerald-800', icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" /> },
    error:   { wrap: 'border-red-200 text-red-800',         icon: <AlertTriangle className="w-4 h-4 text-red-500" /> },
    warning: { wrap: 'border-amber-200 text-amber-800',     icon: <AlertTriangle className="w-4 h-4 text-amber-500" /> },
    info:    { wrap: 'border-blue-200 text-blue-800',       icon: <Info className="w-4 h-4 text-blue-500" /> },
  }

  return createPortal(
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      {list.map(t => (
        <div key={t.id} className={clsx('pointer-events-auto flex items-center gap-2 rounded-lg border bg-white px-3.5 py-2 text-sm font-medium shadow-lg', styles[t.type].wrap)}>
          {styles[t.type].icon}
          <span>{t.msg}</span>
        </div>
      ))}
    </div>,
    document.body,
  )
}

// ─── 图片上传（单图，点击选择 + 预览 + 删除；替代 antd Upload/Image） ─────────────

export function ImageUpload({ url, loading, onPick, onRemove, accept = '.jpg,.jpeg,.png,.webp', maxMB = 5, size = 120, hint }: {
  url?: string
  loading?: boolean
  onPick: (file: File) => void
  onRemove: () => void
  accept?: string
  maxMB?: number
  size?: number
  hint?: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const validate = (file: File): boolean => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.error('只支持 JPG、PNG、WebP 格式的图片'); return false }
    if (file.size / 1024 / 1024 >= maxMB) { toast.error(`图片大小不能超过 ${maxMB}MB`); return false }
    return true
  }
  return (
    <div>
      {url ? (
        <div className="relative rounded-md overflow-hidden border border-slate-200" style={{ width: size, height: size }}>
          <img src={url} alt="" className="object-cover" style={{ width: size, height: size }} />
          <button
            onClick={onRemove}
            disabled={loading}
            className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-md bg-white/80 text-red-500 hover:bg-white transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="flex flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-slate-400 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          style={{ width: size, height: size }}
        >
          {loading
            ? <Loader2 className="w-6 h-6 animate-spin" />
            : <><ImageIcon className="w-6 h-6 mb-1.5" /><span className="text-xs text-slate-500">上传图片</span></>}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f && validate(f)) onPick(f); e.target.value = '' }}
      />
      {hint && <p className="text-xs text-slate-400 mt-2">{hint}</p>}
    </div>
  )
}

// ─── 卡片 ───────────────────────────────────────────────────────────────────────

export function SectionCard({ title, description, action, children, bodyClassName }: {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  bodyClassName?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200">
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100">
          <div className="min-w-0">
            {title && <p className="text-sm font-semibold text-slate-900">{title}</p>}
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={clsx('px-5 py-4', bodyClassName)}>{children}</div>
    </div>
  )
}

// ─── 表单行（label + 控件左右布局） ─────────────────────────────────────────────

export function FormRow({ label, hint, children }: {
  label: React.ReactNode
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-700">{label}</div>
        {hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// ─── 竖向表单项（label 在上，控件在下，占满宽度） ────────────────────────────────

export function Field({ label, hint, error, required, children }: {
  label: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error
        ? <p className="text-xs text-red-600">{error}</p>
        : hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
    </div>
  )
}

// ─── 输入控件 ───────────────────────────────────────────────────────────────────

const inputBase =
  'text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 w-full ' +
  'placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400 ' +
  'focus:outline-2 focus:outline-slate-900 focus:outline-offset-0'

export function TextInput({ value, onChange, placeholder, disabled, pattern, maxLength, type = 'text', className }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  pattern?: string
  maxLength?: number
  type?: string
  className?: string
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      pattern={pattern}
      maxLength={maxLength}
      type={type}
      className={clsx(inputBase, className)}
    />
  )
}

export function Textarea({ value, onChange, placeholder, disabled, rows = 3, className }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  rows?: number
  className?: string
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      className={clsx(inputBase, 'resize-y', className)}
    />
  )
}

export function NumberInput({ value, onChange, min, max, suffix, disabled, className }: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  suffix?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={Number.isNaN(value) ? '' : value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        className={clsx(
          'text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 w-24',
          'disabled:bg-slate-50 disabled:text-slate-400',
          'focus:outline-2 focus:outline-slate-900 focus:outline-offset-0',
          className,
        )}
      />
      {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
    </div>
  )
}

// ─── 日期选择器（自绘弹出日历，替代原生 input[type=date] 的浏览器默认样式） ────────

function fmtDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function parseDate(v?: string) {
  if (!v) return null
  const [y, m, d] = v.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}
// 展示用短格式：同年省略年份（6月30日），跨年份补上（2025年12月31日）
function fmtDisplay(d: Date) {
  const y = d.getFullYear()
  const now = new Date()
  return y === now.getFullYear() ? `${d.getMonth() + 1}月${d.getDate()}日` : `${y}年${d.getMonth() + 1}月${d.getDate()}日`
}
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
// 与 inputBase 同源的时间输入样式（原生 time 控件的图标/弹层浏览器不可控，但边框/圆角/焦点态统一）
const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

// 自绘时间输入（HH:mm 双列滚动选择，替代原生 input[type=time] 的系统级弹层——那个弹层不可能被 CSS 统一样式）
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

export function TimeInput({ value, onChange, className }: {
  value: string // 'HH:mm'
  onChange: (v: string) => void
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const [hh, mm] = (value || '00:00').split(':')

  React.useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div ref={rootRef} className={clsx('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 tabular-nums',
          'hover:border-slate-300 transition-colors cursor-pointer',
          'focus:outline-2 focus:outline-slate-900 focus:outline-offset-0',
        )}
      >
        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        {hh}:{mm}
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 flex rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {[{ list: HOURS, active: hh, pick: (v: string) => onChange(`${v}:${mm}`) },
            { list: MINUTES, active: mm, pick: (v: string) => onChange(`${hh}:${v}`) }].map((col, ci) => (
            <div key={ci} className={clsx('w-14 h-40 overflow-y-auto py-1', ci === 0 && 'border-r border-slate-100')}>
              {col.list.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => col.pick(v)}
                  className={clsx(
                    'w-full text-center text-sm py-1.5 cursor-pointer tabular-nums',
                    v === col.active ? 'bg-slate-900 text-white!' : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
function monthCells(year: number, month: number): (Date | null)[] {
  const startOffset = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ]
}

export function DatePicker({ value, onChange, min, max, placeholder, disabled, className }: {
  value: string // 'YYYY-MM-DD'
  onChange: (v: string) => void
  min?: string
  max?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const selected = parseDate(value)
  const [viewDate, setViewDate] = React.useState(() => selected ?? new Date())
  const rootRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  React.useEffect(() => { if (open) setViewDate(selected ?? new Date()) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const minD = parseDate(min)
  const maxD = parseDate(max)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const cells = monthCells(year, month)

  const isDisabled = (d: Date) => (minD && d < minD) || (maxD && d > maxD)
  const today = new Date()

  return (
    <div ref={rootRef} className={clsx('relative inline-block', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700',
          'hover:border-slate-300 transition-colors cursor-pointer',
          'focus:outline-2 focus:outline-slate-900 focus:outline-offset-0',
          'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
        )}
      >
        <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" />
        <span className={clsx(!value && 'text-slate-400')}>{value || placeholder || '选择日期'}</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white shadow-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-500 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-slate-900">{year} 年 {month + 1} 月</span>
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-500 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {WEEKDAY_LABELS.map(w => (
              <span key={w} className="text-xs text-slate-400 py-1">{w}</span>
            ))}
            {cells.map((d, i) => {
              if (!d) return <span key={i} />
              const disabledDay = isDisabled(d)
              const active = selected && isSameDay(d, selected)
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabledDay}
                  onClick={() => { onChange(fmtDate(d)); setOpen(false) }}
                  className={clsx(
                    'w-8 h-8 mx-auto text-sm rounded-lg transition-colors cursor-pointer',
                    disabledDay && 'text-slate-300 cursor-not-allowed',
                    !disabledDay && !active && 'text-slate-700 hover:bg-slate-100',
                    active && 'bg-slate-900 text-white!',
                    !active && isSameDay(d, today) && 'font-semibold',
                  )}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// 日期区间选择器（单次打开、双月面板，直接点起始日再点结束日；替代"开两个日历分别选"）
// showTime=true 时在同一面板内加入起始/结束时间，选完日期后不自动关闭，点"确定"才关闭
export function DateRangePicker({
  startValue, endValue, onChange, min, max, disabled, className,
  showTime, startTime, endTime, onTimeChange,
}: {
  startValue: string // 'YYYY-MM-DD'
  endValue: string // 'YYYY-MM-DD'
  onChange: (start: string, end: string) => void
  min?: string
  max?: string
  disabled?: boolean
  className?: string
  showTime?: boolean
  startTime?: string // 'HH:mm'
  endTime?: string // 'HH:mm'
  onTimeChange?: (startTime: string, endTime: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const start = parseDate(startValue)
  const end = parseDate(endValue)
  // 未选择时间时展示默认值，而不是空白
  const startTimeValue = startTime || '00:00'
  const endTimeValue = endTime || '23:59'
  // pickingEnd=true 表示已点了起始日，等待点结束日；此时 draftStart 为本次选择的起点（未必等于 start）
  const [pickingEnd, setPickingEnd] = React.useState(false)
  const [draftStart, setDraftStart] = React.useState<Date | null>(null)
  const [hoverDate, setHoverDate] = React.useState<Date | null>(null)
  const [leftView, setLeftView] = React.useState(() => start ?? new Date())
  const rootRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  React.useEffect(() => {
    if (open) {
      setLeftView(start ?? new Date())
      setPickingEnd(false)
      setDraftStart(null)
      setHoverDate(null)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const minD = parseDate(min)
  const maxD = parseDate(max)
  const isDisabled = (d: Date) => (minD && d < minD) || (maxD && d > maxD)
  const today = new Date()

  const rangeStart = pickingEnd ? draftStart : start
  const rangeEndForDisplay = pickingEnd ? (hoverDate ?? draftStart) : end
  const inRange = (d: Date) => {
    if (!rangeStart || !rangeEndForDisplay) return false
    const lo = rangeStart <= rangeEndForDisplay ? rangeStart : rangeEndForDisplay
    const hi = rangeStart <= rangeEndForDisplay ? rangeEndForDisplay : rangeStart
    return d >= lo && d <= hi
  }

  const handlePick = (d: Date) => {
    if (!pickingEnd) {
      setDraftStart(d)
      setPickingEnd(true)
      return
    }
    const lo = draftStart && draftStart <= d ? draftStart : d
    const hi = draftStart && draftStart <= d ? d : draftStart!
    onChange(fmtDate(lo), fmtDate(hi))
    setPickingEnd(false)
    setDraftStart(null)
    // 带时间选择时先不关闭，等用户调整完时间点"确定"
    if (!showTime) setOpen(false)
  }

  const renderMonth = (year: number, month: number, onPrev: () => void, onNext: () => void) => {
    const cells = monthCells(year, month)
    return (
      <div className="w-56">
        <div className="flex items-center justify-between mb-2">
          <button type="button" onClick={onPrev} className="p-1 rounded-md hover:bg-slate-100 text-slate-500 cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-slate-900">{year} 年 {month + 1} 月</span>
          <button type="button" onClick={onNext} className="p-1 rounded-md hover:bg-slate-100 text-slate-500 cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {WEEKDAY_LABELS.map(w => (
            <span key={w} className="text-xs text-slate-400 py-1">{w}</span>
          ))}
          {cells.map((d, i) => {
            if (!d) return <span key={i} />
            const disabledDay = isDisabled(d)
            const isEdge = (rangeStart && isSameDay(d, rangeStart)) || (rangeEndForDisplay && isSameDay(d, rangeEndForDisplay))
            const within = inRange(d)
            return (
              <button
                key={i}
                type="button"
                disabled={disabledDay}
                onMouseEnter={() => pickingEnd && setHoverDate(d)}
                onClick={() => handlePick(d)}
                className={clsx(
                  'w-8 h-8 mx-auto text-sm transition-colors cursor-pointer',
                  disabledDay && 'text-slate-300 cursor-not-allowed',
                  !disabledDay && !within && 'text-slate-700 hover:bg-slate-100 rounded-lg',
                  within && !isEdge && 'bg-slate-100 text-slate-700',
                  isEdge && 'bg-slate-900 text-white! rounded-lg',
                  !isEdge && isSameDay(d, today) && 'font-semibold',
                )}
              >
                {d.getDate()}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const leftYear = leftView.getFullYear()
  const leftMonth = leftView.getMonth()
  const rightDate = new Date(leftYear, leftMonth + 1, 1)

  return (
    <div ref={rootRef} className={clsx('relative inline-block', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'inline-flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white pl-3 pr-3.5 py-2 text-sm',
          'hover:border-slate-300 transition-colors cursor-pointer',
          'focus:outline-2 focus:outline-slate-900 focus:outline-offset-0',
          'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
        )}
      >
        <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" />
        {start && end ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="font-medium text-slate-900 tabular-nums">
              {fmtDisplay(start)}{showTime ? ` ${startTimeValue}` : ''}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span className="font-medium text-slate-900 tabular-nums">
              {fmtDisplay(end)}{showTime ? ` ${endTimeValue}` : ''}
            </span>
          </span>
        ) : (
          <span className="text-slate-400">选择日期区间</span>
        )}
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1.5 rounded-xl border border-slate-200 bg-white shadow-lg p-3"
          onMouseLeave={() => setHoverDate(null)}
        >
          <div className="flex gap-4">
            {renderMonth(leftYear, leftMonth,
              () => setLeftView(new Date(leftYear, leftMonth - 1, 1)),
              () => setLeftView(new Date(leftYear, leftMonth + 1, 1)))}
            {renderMonth(rightDate.getFullYear(), rightDate.getMonth(),
              () => setLeftView(new Date(leftYear, leftMonth - 1, 1)),
              () => setLeftView(new Date(leftYear, leftMonth + 1, 1)))}
          </div>
          {pickingEnd && (
            <p className="text-xs text-slate-400 mt-1">已选起始日，请点击结束日</p>
          )}
          {showTime && start && end && (
            <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="shrink-0">{fmtDisplay(start)}</span>
                <TimeInput value={startTimeValue} onChange={(v) => onTimeChange?.(v, endTimeValue)} />
                <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                <span className="shrink-0">{fmtDisplay(end)}</span>
                <TimeInput value={endTimeValue} onChange={(v) => onTimeChange?.(startTimeValue, v)} />
              </div>
              <Btn size="sm" onClick={() => setOpen(false)}>确定</Btn>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// 下拉选择（基于 Radix Select，统一 slate 样式；替代原生 <select>）
// 空值('' / null)用 sentinel 承载，保留“请选择/清空”这类可再次选中的占位项
const SELECT_EMPTY = '__ui_select_empty__'
export function SelectInput({ value, onChange, options, disabled, className, placeholder }: {
  value: string | number
  onChange: (v: any) => void
  options: { label: string; value: string | number }[]
  disabled?: boolean
  className?: string
  placeholder?: string
}) {
  const toStr = (v: string | number) => (v === '' || v == null ? SELECT_EMPTY : String(v))
  const handleChange = (v: string) => {
    if (v === SELECT_EMPTY) { onChange(''); return }
    const opt = options.find(o => String(o.value) === v)
    onChange(opt ? opt.value : v)
  }
  return (
    <RadixSelect.Root value={toStr(value)} onValueChange={handleChange} disabled={disabled}>
      <RadixSelect.Trigger
        className={clsx(
          'group inline-flex min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700',
          'hover:border-slate-300 transition-colors cursor-pointer',
          'focus:outline-none focus-visible:outline-2 focus-visible:outline-slate-900 data-[state=open]:border-slate-400',
          'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
          '[&>span:first-child]:truncate',
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronsUpDown className="w-4 h-4 text-slate-400 group-hover:text-slate-500 shrink-0" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          className="z-[60] min-w-[var(--radix-select-trigger-width)] max-h-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg p-1"
        >
          <RadixSelect.Viewport>
            {options.map(o => (
              <RadixSelect.Item
                key={String(o.value)}
                value={toStr(o.value)}
                className={clsx(
                  'relative flex items-center rounded-lg pl-8 pr-3 py-2 text-sm text-slate-700 select-none cursor-pointer outline-none',
                  'data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900',
                  'data-[state=checked]:font-medium data-[state=checked]:text-slate-900',
                )}
              >
                <RadixSelect.ItemIndicator className="absolute left-2 inline-flex items-center">
                  <Check className="w-4 h-4 text-slate-900" />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}

// ─── 页头 ───────────────────────────────────────────────────────────────────────

export function PageHeader({ title, description, badges, actions, onBack }: {
  title: React.ReactNode
  description?: React.ReactNode
  badges?: React.ReactNode
  actions?: React.ReactNode
  onBack?: () => void
}) {
  return (
    <div className="mb-6">
      {onBack && (
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 transition-colors cursor-pointer mb-3"
        >
          ← 返回
        </button>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
            {badges}
          </div>
          {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

// ─── 加载态 ─────────────────────────────────────────────────────────────────────

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center justify-center py-20', className)}>
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  )
}

// ─── 空状态 ─────────────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, description, action }: {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6">
      {icon && <div className="text-slate-300 mb-3">{icon}</div>}
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ─── 轻量表格 ───────────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string
  title: React.ReactNode
  width?: number | string
  align?: 'left' | 'center' | 'right'
  render: (row: T, index: number) => React.ReactNode
}

export function Table<T>({ columns, data, rowKey, empty, expandable, loading }: {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T, index: number) => string
  empty?: React.ReactNode
  loading?: boolean
  expandable?: {
    rowExpandable?: (row: T) => boolean
    render: (row: T) => React.ReactNode
  }
}) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const toggle = (key: string) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })
  const totalCols = columns.length + (expandable ? 1 : 0)

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {expandable && <th className="w-10" />}
            {columns.map(col => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={clsx(
                  'px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wide whitespace-nowrap',
                  col.align === 'center' && 'text-center',
                  col.align === 'right' && 'text-right',
                  (!col.align || col.align === 'left') && 'text-left',
                )}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={totalCols} className="px-4 py-10 text-center">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400 inline" />
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={totalCols} className="px-4 py-10 text-center text-sm text-slate-400">
                {empty ?? '暂无数据'}
              </td>
            </tr>
          ) : (
            data.map((row, i) => {
              const key = rowKey(row, i)
              const canExpand = expandable && (expandable.rowExpandable ? expandable.rowExpandable(row) : true)
              const isOpen = expanded.has(key)
              return (
                <React.Fragment key={key}>
                  <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                    {expandable && (
                      <td className="pl-3 pr-0 align-middle">
                        {canExpand && (
                          <button
                            onClick={() => toggle(key)}
                            className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
                          >
                            <ChevronRight className={clsx('w-4 h-4 transition-transform', isOpen && 'rotate-90')} />
                          </button>
                        )}
                      </td>
                    )}
                    {columns.map(col => (
                      <td
                        key={col.key}
                        className={clsx(
                          'px-4 py-3 text-slate-700 align-middle',
                          col.align === 'center' && 'text-center',
                          col.align === 'right' && 'text-right',
                        )}
                      >
                        {col.render(row, i)}
                      </td>
                    ))}
                  </tr>
                  {expandable && canExpand && isOpen && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={totalCols} className="px-4 py-3">
                        {expandable.render(row)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── 进度条 ─────────────────────────────────────────────────────────────────────

export function ProgressBar({ percent, tone = 'default' }: {
  percent: number
  tone?: 'default' | 'warning' | 'danger'
}) {
  const pct = Math.max(0, Math.min(100, percent))
  return (
    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
      <div
        className={clsx(
          'h-full rounded-full transition-all',
          tone === 'danger' && 'bg-red-500',
          tone === 'warning' && 'bg-amber-500',
          tone === 'default' && 'bg-slate-900',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ─── 统计卡片 ───────────────────────────────────────────────────────────────────

export function StatCard({ title, value, icon, tone = 'default' }: {
  title: React.ReactNode
  value: React.ReactNode
  icon?: React.ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center gap-4">
      {icon && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{title}</p>
        <p className={clsx('text-xl font-semibold mt-0.5', tone === 'danger' ? 'text-red-600' : 'text-slate-900')}>
          {value}
        </p>
      </div>
    </div>
  )
}

// ─── 标签页 ─────────────────────────────────────────────────────────────────────

export function Tabs({ items, value, onChange }: {
  items: { key: string; label: React.ReactNode; icon?: React.ReactNode }[]
  value: string
  onChange: (key: string) => void
}) {
  return (
    <div className="flex items-center gap-1 border-b border-slate-200">
      {items.map(item => {
        const active = item.key === value
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={clsx(
              'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer',
              active
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200',
            )}
          >
            {item.icon}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── 穿梭框（点击移动，双面板 + 搜索；替代 antd Transfer） ──────────────────────

export function Transfer<T>({ items, value, onChange, getKey, getLabel, renderItem, titles = ['可选', '已选'], height = 300 }: {
  items: T[]
  value: string[]
  onChange: (keys: string[]) => void
  getKey: (item: T) => string
  getLabel: (item: T) => string
  renderItem?: (item: T) => React.ReactNode
  titles?: [string, string]
  height?: number
}) {
  const [lq, setLq] = React.useState('')
  const [rq, setRq] = React.useState('')
  const valueSet = new Set(value)
  const left = items.filter(i => !valueSet.has(getKey(i)))
  const right = items.filter(i => valueSet.has(getKey(i)))
  const match = (i: T, q: string) => getLabel(i).toLowerCase().includes(q.toLowerCase())

  const Panel = ({ title, data, q, setQ, onPick, moveAll, moveAllLabel }: {
    title: string; data: T[]; q: string; setQ: (v: string) => void
    onPick: (k: string) => void; moveAll: () => void; moveAllLabel: string
  }) => (
    <div className="flex-1 min-w-0 rounded-lg border border-slate-200 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
        <span className="text-xs font-medium text-slate-600">{title} · {data.length}</span>
        {data.length > 0 && (
          <button onClick={moveAll} className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer">{moveAllLabel}</button>
        )}
      </div>
      <div className="p-2 border-b border-slate-100">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="搜索…"
          className="w-full text-xs bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 placeholder:text-slate-400 focus:outline-2 focus:outline-slate-900"
        />
      </div>
      <div className="overflow-y-auto sidebar-scroll" style={{ height }}>
        {data.length === 0
          ? <div className="text-center text-xs text-slate-400 py-6">无</div>
          : data.map(item => (
            <button
              key={getKey(item)}
              onClick={() => onPick(getKey(item))}
              className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
            >
              {renderItem ? renderItem(item) : getLabel(item)}
            </button>
          ))}
      </div>
    </div>
  )

  return (
    <div className="flex gap-3 items-stretch">
      <Panel
        title={titles[0]} data={left.filter(i => match(i, lq))} q={lq} setQ={setLq}
        onPick={k => onChange([...value, k])} moveAllLabel="全部移入 →"
        moveAll={() => onChange([...new Set([...value, ...left.map(getKey)])])}
      />
      <Panel
        title={titles[1]} data={right.filter(i => match(i, rq))} q={rq} setQ={setRq}
        onPick={k => onChange(value.filter(x => x !== k))} moveAllLabel="← 全部移出"
        moveAll={() => onChange([])}
      />
    </div>
  )
}

// ─── 确认弹窗（基于 Radix AlertDialog，替代 antd Popconfirm） ────────────────────

export function ConfirmDialog({ open, onOpenChange, title, description, confirmText = '确认', cancelText = '取消', danger, loading, onConfirm }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  confirmText?: string
  cancelText?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <AlertDialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-md bg-white rounded-xl border border-slate-200 shadow-xl p-6">
          <AlertDialog.Title className="text-base font-semibold text-slate-900">{title}</AlertDialog.Title>
          {description && <AlertDialog.Description className="mt-2 text-sm text-slate-500">{description}</AlertDialog.Description>}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Btn variant="secondary">{cancelText}</Btn>
            </AlertDialog.Cancel>
            <Btn variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmText}</Btn>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

// ─── 侧滑抽屉（基于 Radix Dialog，右侧滑入；替代 antd Drawer） ──────────────────

export function Drawer({ open, onOpenChange, title, description, children, footer, width = 480 }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  width?: number
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content
          style={{ width }}
          className="fixed z-50 top-0 right-0 h-full max-w-[calc(100vw-2rem)] bg-white border-l border-slate-200 shadow-xl flex flex-col"
        >
          {(title || description) && (
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="min-w-0">
                {title && <Dialog.Title className="text-base font-semibold text-slate-900">{title}</Dialog.Title>}
                {description && <Dialog.Description className="text-sm text-slate-500 mt-1">{description}</Dialog.Description>}
              </div>
              <Dialog.Close className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0">
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 shrink-0">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── 弹窗（基于 Radix Dialog） ──────────────────────────────────────────────────

export function Modal({ open, onOpenChange, title, description, children, footer, size = 'md' }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const maxW = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-5xl' }[size]
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className={clsx(
            'fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)]',
            'bg-white rounded-xl border border-slate-200 shadow-xl flex flex-col max-h-[calc(100vh-4rem)]',
            maxW,
          )}
        >
          {(title || description) && (
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3 border-b border-slate-100">
              <div className="min-w-0">
                {title && <Dialog.Title className="text-base font-semibold text-slate-900">{title}</Dialog.Title>}
                {description && <Dialog.Description className="text-sm text-slate-500 mt-1">{description}</Dialog.Description>}
              </div>
              <Dialog.Close className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0">
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>
          )}
          <div className="px-6 py-4 overflow-y-auto">{children}</div>
          {footer && (
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">{footer}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
