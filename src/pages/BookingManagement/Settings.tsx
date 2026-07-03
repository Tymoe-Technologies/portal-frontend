import { useEffect, useState } from 'react'
import { Calendar, Save, Undo2, DollarSign } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { settingsApi } from '@/services/booking'
import type { BookingSettings } from '@/types/booking'
import { SectionCard, Btn, Switch, NumberInput, Spinner, toast } from '@/components/ui-kit'
import BookingPageLayout from './BookingPageLayout'

interface FormState {
  advanceBookingDays: number
  minAdvanceHours: number
  requireCustomerPhone: boolean
  requireCustomerEmail: boolean
  depositEnabled: boolean
  depositAmount: number
}

const EMPTY: FormState = {
  advanceBookingDays: 30, minAdvanceHours: 0,
  requireCustomerPhone: false, requireCustomerEmail: false,
  depositEnabled: false, depositAmount: 0,
}

export default function BookingSettingsPage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<BookingSettings | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)

  useEffect(() => {
    loadSettings()
  }, [])

  const toState = (data: BookingSettings): FormState => ({
    advanceBookingDays: data?.advanceBookingDays ?? 30,
    minAdvanceHours: data?.minAdvanceHours ?? 0,
    requireCustomerPhone: data?.requireCustomerPhone ?? false,
    requireCustomerEmail: data?.requireCustomerEmail ?? false,
    depositEnabled: data?.depositEnabled ?? false,
    depositAmount: data?.depositAmount != null ? data.depositAmount / 100 : 0,
  })

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await settingsApi.get()
      setSettings(data)
      if (data) setForm(toState(data))
    } catch {
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    try {
      setSaving(true)
      const payload: Partial<BookingSettings> = {
        advanceBookingDays: form.advanceBookingDays,
        minAdvanceHours: form.minAdvanceHours,
        requireCustomerPhone: form.requireCustomerPhone,
        requireCustomerEmail: form.requireCustomerEmail,
        depositEnabled: form.depositEnabled,
        depositAmount: form.depositAmount != null ? Math.round(form.depositAmount * 100) : undefined,
      }
      await settingsApi.update(payload)
      toast.success(t('common.saveSuccess'))
    } catch {
      toast.error(t('common.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (settings) setForm(toState(settings))
  }

  return (
    <BookingPageLayout>
      {loading ? (
        <div className="py-16 text-center"><Spinner className="w-8 h-8 mx-auto text-slate-400" /></div>
      ) : (
        <div className="max-w-xl">
          {/* 页头 */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="m-0 text-xl font-semibold text-slate-800">{t('pages.booking.settings.title')}</h2>
              {settings && <p className="text-[13px] text-slate-400 mt-0.5">各资源类型的专属设置在对应管理页面中配置</p>}
            </div>
            <div className="flex gap-2">
              <Btn variant="secondary" icon={<Undo2 className="w-3.5 h-3.5" />} onClick={handleReset}>{t('common.reset')}</Btn>
              <Btn variant="primary" icon={<Save className="w-3.5 h-3.5" />} onClick={handleSave} loading={saving}>{t('common.save')}</Btn>
            </div>
          </div>

          {/* 预约规则 */}
          <div className="mb-4">
            <SectionCard title={<span className="inline-flex items-center gap-2"><Calendar className="w-4 h-4" />{t('pages.booking.settings.bookingRules')}</span>}>
              <div className="flex gap-4 mb-2">
                <div className="flex-1">
                  <div className="text-sm text-slate-600 mb-1.5">最多提前预约（天）</div>
                  <NumberInput className="w-full" value={form.advanceBookingDays} onChange={(v) => set('advanceBookingDays', v)} min={1} max={90} />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-slate-600 mb-1.5">最少提前时间（小时）</div>
                  <NumberInput className="w-full" value={form.minAdvanceHours} onChange={(v) => set('minAdvanceHours', v)} min={0} max={72} />
                </div>
              </div>
              <SettingToggle label="要求客户手机号" description="创建预约时必须填写手机号"
                checked={form.requireCustomerPhone} onChange={(v) => set('requireCustomerPhone', v)} />
              <SettingToggle label="要求客户邮箱" description="创建预约时必须填写邮箱"
                checked={form.requireCustomerEmail} onChange={(v) => set('requireCustomerEmail', v)} />
            </SectionCard>
          </div>

          {/* 押金配置 */}
          <SectionCard title={<span className="inline-flex items-center gap-2"><DollarSign className="w-4 h-4" />{t('pages.booking.settings.depositConfig')}</span>}>
            <SettingToggle label={t('pages.booking.settings.depositEnabled')} description={t('pages.booking.settings.depositEnabledDesc')}
              checked={form.depositEnabled} onChange={(v) => set('depositEnabled', v)} />
            <div className="pt-3">
              <div className="text-sm text-slate-600 mb-1.5">{t('pages.booking.settings.depositAmount')}</div>
              <NumberInput value={form.depositAmount} onChange={(v) => set('depositAmount', v)} min={0} suffix="元" />
            </div>
          </SectionCard>
        </div>
      )}
    </BookingPageLayout>
  )
}

function SettingToggle({ label, description, checked, onChange }: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-slate-100 last:border-b-0">
      <div>
        <div className="text-sm font-medium text-slate-700">{label}</div>
        <div className="text-xs text-slate-400 mt-0.5">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
