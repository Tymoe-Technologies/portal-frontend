/**
 * 门店营业时间工具：根据 businessHours（按星期存储的营业时段）+ IANA 时区，
 * 计算“下一个营业开始时刻”的绝对时间戳，供“临时下架至今日营业结束”预设使用。
 *
 * 语义：不看今天是否还有未开始的时段，直接跳过今天，找下一个营业日的开始时刻
 * （对应产品需求：“下架到 end of day，第二天营业时间自动恢复”）。
 *
 * 数据结构与 OrganizationManagement 页面保持一致：
 *   businessHours = { monday: DayHours, ..., sunday: DayHours }
 *   DayHours = { closed: boolean, periods: [{ open: "09:00", close: "22:00", nextDay?: boolean }] }
 */

export interface DayPeriod {
  open: string   // "HH:mm"
  close: string  // "HH:mm"
  nextDay?: boolean
}

export interface DayHours {
  closed: boolean
  periods: DayPeriod[]
}

export type BusinessHours = Partial<Record<
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
  DayHours
>>

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

/** 目标时区在给定时刻的 UTC 偏移量（分钟，东区为正） */
function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = dtf.formatToParts(date).reduce((acc, p) => {
    acc[p.type] = p.value
    return acc
  }, {} as Record<string, string>)
  const asUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  )
  return (asUTC - date.getTime()) / 60000
}

/** 把某时区下的 "YYYY-MM-DD" + "HH:mm" 挂钟时间换算成绝对 UTC 时间戳 */
function zonedWallTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00Z`)
  const offsetMinutes = getTimeZoneOffsetMinutes(naiveUtc, timeZone)
  return new Date(naiveUtc.getTime() - offsetMinutes * 60000)
}

/** 取某个时刻在目标时区下的日历日期（YYYY-MM-DD）与星期索引（0=周日） */
function getZonedDateParts(date: Date, timeZone: string): { dateStr: string; weekday: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  })
  const parts = dtf.formatToParts(date).reduce((acc, p) => {
    acc[p.type] = p.value
    return acc
  }, {} as Record<string, string>)
  const dateStr = `${parts.year}-${parts.month}-${parts.day}`
  const weekdayIndex = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.weekday as string] ?? 0
  return { dateStr, weekday: weekdayIndex }
}

/**
 * 计算“下一个营业开始时刻”（跳过今天，从明天起最多找 7 天）。
 * 找不到（一周都打烊）时返回 null，调用方应回退到自定义时间输入。
 */
export function computeNextBusinessOpenTime(
  businessHours: BusinessHours | null | undefined,
  timezone: string | null | undefined,
  from: Date = new Date(),
): Date | null {
  if (!businessHours) return null
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone

  const { dateStr: fromDateStr } = getZonedDateParts(from, tz)
  const [fy, fm, fd] = fromDateStr.split('-').map(Number)

  for (let offset = 1; offset <= 7; offset++) {
    // 用 UTC 日期运算推进日历天数（只用来算星期几和日期字符串，不涉及具体时刻，跨 DST 也安全）
    const candidateUtcDate = new Date(Date.UTC(fy, fm - 1, fd + offset))
    const weekday = candidateUtcDate.getUTCDay()
    const dayName = WEEKDAY_NAMES[weekday]
    const y = candidateUtcDate.getUTCFullYear()
    const m = String(candidateUtcDate.getUTCMonth() + 1).padStart(2, '0')
    const d = String(candidateUtcDate.getUTCDate()).padStart(2, '0')
    const candidateDateStr = `${y}-${m}-${d}`

    const dayHours = businessHours[dayName]
    if (!dayHours || dayHours.closed || !dayHours.periods?.length) continue

    const firstPeriod = [...dayHours.periods].sort((a, b) => a.open.localeCompare(b.open))[0]
    if (!firstPeriod?.open) continue

    return zonedWallTimeToUtc(candidateDateStr, firstPeriod.open, tz)
  }

  return null
}

/** 固定时长预设：从现在起 N 分钟后 */
export function computeDurationFromNow(minutes: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + minutes * 60000)
}
