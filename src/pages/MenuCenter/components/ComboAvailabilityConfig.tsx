import React from 'react'
import clsx from 'clsx'
import type { ComboAvailabilityRules } from '@/services/item-management'
import { Checkbox } from '@/components/ui-kit'

const DAYS_OF_WEEK = [
  { value: 0, label: '周日', short: '日' },
  { value: 1, label: '周一', short: '一' },
  { value: 2, label: '周二', short: '二' },
  { value: 3, label: '周三', short: '三' },
  { value: 4, label: '周四', short: '四' },
  { value: 5, label: '周五', short: '五' },
  { value: 6, label: '周六', short: '六' },
]

interface ComboAvailabilityConfigProps {
  value?: ComboAvailabilityRules
  onChange?: (rules: ComboAvailabilityRules) => void
}

export const ComboAvailabilityConfig: React.FC<ComboAvailabilityConfigProps> = ({ value, onChange }) => {
  const rules = value || { enabled: false }

  const handleEnabledChange = (enabled: boolean) => {
    onChange?.({
      ...rules,
      enabled,
      ...(enabled && !rules.timeRange && !rules.daysOfWeek
        ? { timeRange: { start: '09:00', end: '21:00' } }
        : {}),
    })
  }

  const handleTimeRangeChange = (type: 'start' | 'end', time: string) => {
    if (!time) return
    onChange?.({
      ...rules,
      timeRange: { ...(rules.timeRange || { start: '00:00', end: '23:59' }), [type]: time },
    })
  }

  const handleTimeRangeToggle = (enabled: boolean) => {
    if (enabled) {
      onChange?.({ ...rules, timeRange: { start: '09:00', end: '21:00' } })
    } else {
      const { timeRange, ...rest } = rules
      onChange?.(rest as ComboAvailabilityRules)
    }
  }

  const handleDayToggle = (day: number, checked: boolean) => {
    const currentDays = rules.daysOfWeek || []
    const newDays = checked ? [...currentDays, day].sort() : currentDays.filter(d => d !== day)
    onChange?.({ ...rules, daysOfWeek: newDays.length > 0 ? newDays : undefined })
  }

  const handleDaysToggle = (enabled: boolean) => {
    if (enabled) {
      onChange?.({ ...rules, daysOfWeek: [1, 2, 3, 4, 5] })
    } else {
      const { daysOfWeek, ...rest } = rules
      onChange?.(rest as ComboAvailabilityRules)
    }
  }

  const selectWeekdays = () => onChange?.({ ...rules, daysOfWeek: [1, 2, 3, 4, 5] })
  const selectWeekends = () => onChange?.({ ...rules, daysOfWeek: [0, 6] })
  const selectAll = () => onChange?.({ ...rules, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] })

  const timeCls = 'text-sm border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:outline-2 focus:outline-slate-900'
  const quickCls = 'px-2 py-0.5 rounded-md text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer'

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="px-3 py-2 border-b border-slate-100 text-sm font-medium text-slate-700">时段限制（可选）</div>
      <div className="p-3 space-y-3">
        <Checkbox checked={!!rules.enabled} onCheckedChange={handleEnabledChange} label="启用时段限制" />

        {rules.enabled && (
          <>
            {/* 时间段 */}
            <div className="ml-6 space-y-2">
              <Checkbox checked={!!rules.timeRange} onCheckedChange={handleTimeRangeToggle} label="限制可用时间段" />
              {rules.timeRange && (
                <div className="ml-6 flex items-center gap-2">
                  <input type="time" step={900} value={rules.timeRange.start} onChange={e => handleTimeRangeChange('start', e.target.value)} className={timeCls} />
                  <span className="text-xs text-slate-400">至</span>
                  <input type="time" step={900} value={rules.timeRange.end} onChange={e => handleTimeRangeChange('end', e.target.value)} className={timeCls} />
                </div>
              )}
            </div>

            {/* 星期 */}
            <div className="ml-6 space-y-2">
              <Checkbox checked={!!rules.daysOfWeek?.length} onCheckedChange={handleDaysToggle} label="限制可用星期" />
              {rules.daysOfWeek !== undefined && (
                <div className="ml-6 space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {DAYS_OF_WEEK.map(day => {
                      const on = rules.daysOfWeek?.includes(day.value)
                      return (
                        <button
                          key={day.value}
                          onClick={() => handleDayToggle(day.value, !on)}
                          className={clsx('px-2 py-0.5 rounded-md text-xs cursor-pointer transition-colors',
                            on ? 'bg-slate-900 text-white!' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}
                        >
                          {day.label}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex gap-1.5">
                    <button className={quickCls} onClick={selectWeekdays}>工作日</button>
                    <button className={quickCls} onClick={selectWeekends}>周末</button>
                    <button className={quickCls} onClick={selectAll}>全选</button>
                  </div>
                </div>
              )}
            </div>

            {/* 预览 */}
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <span className="font-medium text-slate-700">可用时段预览：</span>
              <span className="text-slate-500">
                {rules.timeRange && <span>{rules.timeRange.start} - {rules.timeRange.end}</span>}
                {rules.daysOfWeek?.length ? (
                  <span>{' | '}{rules.daysOfWeek.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.short).join('、')}</span>
                ) : null}
                {!rules.timeRange && !rules.daysOfWeek?.length && (
                  <span className="text-red-500">请至少设置一项限制</span>
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ComboAvailabilityConfig
