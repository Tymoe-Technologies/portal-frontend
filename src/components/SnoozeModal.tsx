import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { Clock, Sunrise, CalendarClock, PowerOff, Check } from 'lucide-react'
import { Modal, Btn, FormRow, DatePicker, TimeInput, toast } from '@/components/ui-kit'
import { computeNextBusinessOpenTime, computeDurationFromNow, type BusinessHours } from '@/utils/businessHours'

type Preset = '1h' | '3h' | 'nextOpen' | 'permanent' | 'custom'

export interface AvailabilityPayload {
  isAvailable: boolean
  /** ISO 时间 = 下架至该时刻；null = 不设到期时间（配合 isAvailable=false 即为永久下架，配合 true 即为立即恢复） */
  unavailableUntil: string | null
}

export interface SnoozeModalProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** 弹窗标题里展示的名称（商品名/选项名） */
  targetName: string
  /** 门店手动开关的当前状态（store_menu_items.is_available / store_modifier_availability.is_available） */
  currentIsAvailable: boolean
  /** 当前下架到期时间（is_available=true 时才有意义） */
  currentUnavailableUntil?: string | null
  /** 门店营业时间数据，缺失时“今日营业结束”预设不可用 */
  businessHours?: BusinessHours | null
  timezone?: string | null
  /** 确认回调：统一下发 isAvailable + unavailableUntil，一次调用覆盖“上下架开关”与“定时下架”两种语义 */
  onConfirm: (payload: AvailabilityPayload) => Promise<void>
}

/**
 * 门店级可用性控制弹窗：上下架开关 + 定时下架合并成一个入口。
 * 下架时选择 1小时 / 3小时 / 今日营业结束（定时，到点自动恢复）/ 永久下架（需手动恢复）；
 * 已下架时可一键恢复。通用组件，商品和 modifier 选项共用。
 */
export function SnoozeModal({
  open, onOpenChange, targetName, currentIsAvailable, currentUnavailableUntil, businessHours, timezone, onConfirm,
}: SnoozeModalProps) {
  const { t } = useTranslation()
  const [preset, setPreset] = useState<Preset>('1h')
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('12:00')
  const [submitting, setSubmitting] = useState(false)

  const nextOpenTime = computeNextBusinessOpenTime(businessHours, timezone)
  const isSnoozed = currentIsAvailable && !!currentUnavailableUntil && new Date(currentUnavailableUntil).getTime() > Date.now()
  const isPermanentlyOff = !currentIsAvailable
  const isCurrentlyDown = isSnoozed || isPermanentlyOff

  const handleConfirm = async () => {
    let payload: AvailabilityPayload
    if (preset === 'permanent') {
      payload = { isAvailable: false, unavailableUntil: null }
    } else {
      let until: Date
      if (preset === '1h') until = computeDurationFromNow(60)
      else if (preset === '3h') until = computeDurationFromNow(180)
      else if (preset === 'nextOpen') {
        if (!nextOpenTime) { toast.error(t('components.snoozeModal.noBusinessHours')); return }
        until = nextOpenTime
      } else {
        if (!customDate) { toast.error(t('components.snoozeModal.pickCustomTime')); return }
        until = new Date(`${customDate}T${customTime}:00`)
        if (until.getTime() <= Date.now()) { toast.error(t('components.snoozeModal.customTimeMustBeFuture')); return }
      }
      payload = { isAvailable: true, unavailableUntil: until.toISOString() }
    }

    setSubmitting(true)
    try {
      await onConfirm(payload)
      toast.success(t('components.snoozeModal.snoozeSuccess'))
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message || t('components.snoozeModal.snoozeFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleResumeNow = async () => {
    setSubmitting(true)
    try {
      await onConfirm({ isAvailable: true, unavailableUntil: null })
      toast.success(t('components.snoozeModal.resumeSuccess'))
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message || t('components.snoozeModal.resumeFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const timedOptions: Array<{ key: Preset; icon: ReactNode; label: string; hint: string; disabled?: boolean }> = [
    { key: '1h', icon: <Clock className="w-4 h-4" />, label: t('components.snoozeModal.preset1h'), hint: t('components.snoozeModal.autoResumeHint') },
    { key: '3h', icon: <Clock className="w-4 h-4" />, label: t('components.snoozeModal.preset3h'), hint: t('components.snoozeModal.autoResumeHint') },
    {
      key: 'nextOpen', icon: <Sunrise className="w-4 h-4" />, label: t('components.snoozeModal.presetNextOpen'),
      hint: nextOpenTime ? t('components.snoozeModal.nextOpenHint', { time: nextOpenTime.toLocaleString() }) : t('components.snoozeModal.noBusinessHours'),
      disabled: !nextOpenTime,
    },
    { key: 'custom', icon: <CalendarClock className="w-4 h-4" />, label: t('components.snoozeModal.presetCustom'), hint: t('components.snoozeModal.autoResumeHint') },
  ]

  const description = isPermanentlyOff
    ? t('components.snoozeModal.currentlyPermanentlyOff')
    : isSnoozed
      ? t('components.snoozeModal.currentlySnoozedUntil', { time: new Date(currentUnavailableUntil!).toLocaleString() })
      : t('components.snoozeModal.description')

  const renderOptionRow = (opt: { key: Preset; icon: ReactNode; label: string; hint: string; disabled?: boolean }, danger?: boolean) => {
    const selected = preset === opt.key
    return (
      <button
        key={opt.key}
        type="button"
        disabled={opt.disabled}
        onClick={() => setPreset(opt.key)}
        className={clsx(
          'w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40',
          selected
            ? (danger ? 'border-red-300 bg-red-50' : 'border-slate-900 bg-slate-50')
            : 'border-slate-200 bg-white hover:border-slate-300',
        )}
      >
        <span className={selected ? (danger ? 'text-red-600' : 'text-slate-900') : 'text-slate-400'}>{opt.icon}</span>
        <span className="min-w-0 flex-1">
          <span className={clsx('block text-sm font-medium', selected ? (danger ? 'text-red-700' : 'text-slate-900') : 'text-slate-700')}>{opt.label}</span>
          <span className="block text-xs text-slate-400 mt-0.5 truncate">{opt.hint}</span>
        </span>
        {selected && <Check className={clsx('w-4 h-4 shrink-0', danger ? 'text-red-600' : 'text-slate-900')} />}
      </button>
    )
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('components.snoozeModal.title', { name: targetName })}
      description={description}
      footer={
        <>
          {isCurrentlyDown && (
            <Btn variant="secondary" onClick={handleResumeNow} loading={submitting}>
              {t('components.snoozeModal.resumeNowBtn')}
            </Btn>
          )}
          <Btn variant="primary" onClick={handleConfirm} loading={submitting}>
            {t('components.snoozeModal.confirmBtn')}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {timedOptions.map(opt => renderOptionRow(opt))}
        </div>

        <div className="flex items-center gap-2 py-1">
          <span className="flex-1 h-px bg-slate-100" />
          <span className="text-xs text-slate-400">{t('components.snoozeModal.orDivider')}</span>
          <span className="flex-1 h-px bg-slate-100" />
        </div>

        {renderOptionRow(
          { key: 'permanent', icon: <PowerOff className="w-4 h-4" />, label: t('components.snoozeModal.presetPermanent'), hint: t('components.snoozeModal.permanentHint') },
          true,
        )}

        {preset === 'custom' && (
          <FormRow label={t('components.snoozeModal.customTimeLabel')}>
            <div className="flex items-center gap-2">
              <DatePicker value={customDate} onChange={setCustomDate} min={new Date().toISOString().slice(0, 10)} />
              <TimeInput value={customTime} onChange={setCustomTime} />
            </div>
          </FormRow>
        )}
      </div>
    </Modal>
  )
}
