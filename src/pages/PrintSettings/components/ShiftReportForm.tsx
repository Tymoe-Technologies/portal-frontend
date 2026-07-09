import React, { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FormRow, SelectInput, Switch, Btn } from '@/components/ui-kit'

interface Props {
  config: Record<string, any>
  onSave: (config: Record<string, any>) => void
  saving: boolean
}

// 语言选项依赖 t()，改为函数按需生成
const getLangOptions = (t: (key: string) => string) => [
  { label: t('pages.printSettings.customerReceiptForm.langOptionZhCN'), value: 'zh-CN' },
  { label: t('pages.printSettings.customerReceiptForm.langOptionEn'), value: 'en' },
  { label: t('pages.printSettings.customerReceiptForm.langOptionZhTW'), value: 'zh-TW' },
]

const ShiftReportForm: React.FC<Props> = ({ config, onSave, saving }) => {
  const { t } = useTranslation()
  const [language, setLanguage] = useState('zh-CN')
  const [s, setS] = useState({
    showCashierInfo: true, showShiftTime: true, showOrderSummary: true,
    showRevenueBreakdown: true, showPaymentBreakdown: true, showCashDrawer: true,
  })

  useEffect(() => {
    const sections = config.sections || {}
    setLanguage(config.language || 'zh-CN')
    setS({
      showCashierInfo: sections.showCashierInfo ?? true,
      showShiftTime: sections.showShiftTime ?? true,
      showOrderSummary: sections.showOrderSummary ?? true,
      showRevenueBreakdown: sections.showRevenueBreakdown ?? true,
      showPaymentBreakdown: sections.showPaymentBreakdown ?? true,
      showCashDrawer: sections.showCashDrawer ?? true,
    })
  }, [config])

  const set = (k: keyof typeof s) => (v: boolean) => setS(prev => ({ ...prev, [k]: v }))
  const handleSave = () => onSave({ paperWidth: 80, language, sections: s })

  return (
    <div className="max-w-md">
      <FormRow label={t('pages.printSettings.shiftReportForm.languageLabel')}>
        <div className="w-40"><SelectInput value={language} onChange={setLanguage} className="w-full" options={getLangOptions(t)} /></div>
      </FormRow>
      <p className="text-sm font-semibold text-slate-700 pt-4 pb-1">{t('pages.printSettings.shiftReportForm.reportContentTitle')}</p>
      <FormRow label={t('pages.printSettings.shiftReportForm.showCashierInfoLabel')}><Switch checked={s.showCashierInfo} onCheckedChange={set('showCashierInfo')} /></FormRow>
      <FormRow label={t('pages.printSettings.shiftReportForm.showShiftTimeLabel')}><Switch checked={s.showShiftTime} onCheckedChange={set('showShiftTime')} /></FormRow>
      <FormRow label={t('pages.printSettings.shiftReportForm.showOrderSummaryLabel')}><Switch checked={s.showOrderSummary} onCheckedChange={set('showOrderSummary')} /></FormRow>
      <FormRow label={t('pages.printSettings.shiftReportForm.showRevenueBreakdownLabel')}><Switch checked={s.showRevenueBreakdown} onCheckedChange={set('showRevenueBreakdown')} /></FormRow>
      <FormRow label={t('pages.printSettings.shiftReportForm.showPaymentBreakdownLabel')}><Switch checked={s.showPaymentBreakdown} onCheckedChange={set('showPaymentBreakdown')} /></FormRow>
      <FormRow label={t('pages.printSettings.shiftReportForm.showCashDrawerLabel')}><Switch checked={s.showCashDrawer} onCheckedChange={set('showCashDrawer')} /></FormRow>
      <div className="pt-5">
        <Btn variant="primary" icon={<Save className="w-3.5 h-3.5" />} loading={saving} onClick={handleSave}>{t('pages.printSettings.customerReceiptForm.saveConfigBtn')}</Btn>
      </div>
    </div>
  )
}

export default ShiftReportForm
