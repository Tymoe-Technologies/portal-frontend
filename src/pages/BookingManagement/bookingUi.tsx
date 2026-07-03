import type { BookingStatus } from '@/types/booking'

// 预约状态 → Tailwind 徽章配色（严禁紫色，NO_SHOW/COMPLETED 归 slate）
const STATUS_BADGE_CLASS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-600 ring-amber-200',
  CONFIRMED: 'bg-green-50 text-green-600 ring-green-200',
  CANCELLED: 'bg-red-50 text-red-600 ring-red-200',
  COMPLETED: 'bg-slate-100 text-slate-600 ring-slate-200',
  NO_SHOW: 'bg-slate-100 text-slate-500 ring-slate-200',
  FAILED: 'bg-red-50 text-red-600 ring-red-200',
}

export function StatusBadge({ status, children }: { status: BookingStatus | string; children: React.ReactNode }) {
  const cls = STATUS_BADGE_CLASS[status] || 'bg-slate-100 text-slate-600 ring-slate-200'
  return (
    <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 ${cls}`}>
      {children}
    </span>
  )
}
