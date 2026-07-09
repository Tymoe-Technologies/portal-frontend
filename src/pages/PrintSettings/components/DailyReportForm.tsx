import React, { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FormRow, SelectInput, Switch, NumberInput, Btn } from '@/components/ui-kit'

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

const DailyReportForm: React.FC<Props> = ({ config, onSave, saving }) => {
  const { t } = useTranslation()
  const [language, setLanguage] = useState('zh-CN')
  const [s, setS] = useState({
    showOrderSummary: true, showRevenueBreakdown: true, showPaymentBreakdown: true,
    showRefundSummary: true, showTopItems: true, showCategoryBreakdown: false,
  })
  const [topItemsCount, setTopItemsCount] = useState(10)

  useEffect(() => {
    const sections = config.sections || {}
    setLanguage(config.language || 'zh-CN')
    setS({
      showOrderSummary: sections.showOrderSummary ?? true,
      showRevenueBreakdown: sections.showRevenueBreakdown ?? true,
      showPaymentBreakdown: sections.showPaymentBreakdown ?? true,
      showRefundSummary: sections.showRefundSummary ?? true,
      showTopItems: sections.showTopItems ?? true,
      showCategoryBreakdown: sections.showCategoryBreakdown ?? false,
    })
    setTopItemsCount(sections.topItemsCount ?? 10)
  }, [config])

  const set = (k: keyof typeof s) => (v: boolean) => setS(prev => ({ ...prev, [k]: v }))
  const handleSave = () => onSave({ paperWidth: 80, language, sections: { ...s, topItemsCount } })

  return (
    <div className="max-w-md">
      <FormRow label={t('pages.printSettings.dailyReportForm.languageLabel')}>
        <div className="w-40"><SelectInput value={language} onChange={setLanguage} className="w-full" options={getLangOptions(t)} /></div>
      </FormRow>
      <p className="text-sm font-semibold text-slate-700 pt-4 pb-1">{t('pages.printSettings.dailyReportForm.reportContentTitle')}</p>
      <FormRow label={t('pages.printSettings.dailyReportForm.showOrderSummaryLabel')}><Switch checked={s.showOrderSummary} onCheckedChange={set('showOrderSummary')} /></FormRow>
      <FormRow label={t('pages.printSettings.dailyReportForm.showRevenueBreakdownLabel')}><Switch checked={s.showRevenueBreakdown} onCheckedChange={set('showRevenueBreakdown')} /></FormRow>
      <FormRow label={t('pages.printSettings.dailyReportForm.showPaymentBreakdownLabel')}><Switch checked={s.showPaymentBreakdown} onCheckedChange={set('showPaymentBreakdown')} /></FormRow>
      <FormRow label={t('pages.printSettings.dailyReportForm.showRefundSummaryLabel')}><Switch checked={s.showRefundSummary} onCheckedChange={set('showRefundSummary')} /></FormRow>
      <FormRow label={t('pages.printSettings.dailyReportForm.showTopItemsLabel')}><Switch checked={s.showTopItems} onCheckedChange={set('showTopItems')} /></FormRow>
      <FormRow label={t('pages.printSettings.dailyReportForm.topItemsCountLabel')}><NumberInput value={topItemsCount} onChange={setTopItemsCount} min={5} max={50} /></FormRow>
      <FormRow label={t('pages.printSettings.dailyReportForm.showCategoryBreakdownLabel')}><Switch checked={s.showCategoryBreakdown} onCheckedChange={set('showCategoryBreakdown')} /></FormRow>
      <div className="pt-5">
        <Btn variant="primary" icon={<Save className="w-3.5 h-3.5" />} loading={saving} onClick={handleSave}>{t('pages.printSettings.customerReceiptForm.saveConfigBtn')}</Btn>
      </div>
    </div>
  )
}

export default DailyReportForm
