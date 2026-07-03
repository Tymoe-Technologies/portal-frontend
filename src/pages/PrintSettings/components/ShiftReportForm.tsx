import React, { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { FormRow, SelectInput, Switch, Btn } from '@/components/ui-kit'

interface Props {
  config: Record<string, any>
  onSave: (config: Record<string, any>) => void
  saving: boolean
}

const LANG_OPTIONS = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en' },
  { label: '繁體中文', value: 'zh-TW' },
]

const ShiftReportForm: React.FC<Props> = ({ config, onSave, saving }) => {
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
      <FormRow label="语言">
        <div className="w-40"><SelectInput value={language} onChange={setLanguage} className="w-full" options={LANG_OPTIONS} /></div>
      </FormRow>
      <p className="text-sm font-semibold text-slate-700 pt-4 pb-1">报表内容</p>
      <FormRow label="收银员信息"><Switch checked={s.showCashierInfo} onCheckedChange={set('showCashierInfo')} /></FormRow>
      <FormRow label="班次时间"><Switch checked={s.showShiftTime} onCheckedChange={set('showShiftTime')} /></FormRow>
      <FormRow label="订单统计"><Switch checked={s.showOrderSummary} onCheckedChange={set('showOrderSummary')} /></FormRow>
      <FormRow label="收款明细"><Switch checked={s.showRevenueBreakdown} onCheckedChange={set('showRevenueBreakdown')} /></FormRow>
      <FormRow label="支付方式明细"><Switch checked={s.showPaymentBreakdown} onCheckedChange={set('showPaymentBreakdown')} /></FormRow>
      <FormRow label="钱箱统计"><Switch checked={s.showCashDrawer} onCheckedChange={set('showCashDrawer')} /></FormRow>
      <div className="pt-5">
        <Btn variant="primary" icon={<Save className="w-3.5 h-3.5" />} loading={saving} onClick={handleSave}>保存配置</Btn>
      </div>
    </div>
  )
}

export default ShiftReportForm
