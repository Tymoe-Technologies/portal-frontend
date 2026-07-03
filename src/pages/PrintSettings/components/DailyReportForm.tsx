import React, { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { FormRow, SelectInput, Switch, NumberInput, Btn } from '@/components/ui-kit'

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

const DailyReportForm: React.FC<Props> = ({ config, onSave, saving }) => {
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
      <FormRow label="语言">
        <div className="w-40"><SelectInput value={language} onChange={setLanguage} className="w-full" options={LANG_OPTIONS} /></div>
      </FormRow>
      <p className="text-sm font-semibold text-slate-700 pt-4 pb-1">报表内容</p>
      <FormRow label="订单汇总"><Switch checked={s.showOrderSummary} onCheckedChange={set('showOrderSummary')} /></FormRow>
      <FormRow label="营业额明细"><Switch checked={s.showRevenueBreakdown} onCheckedChange={set('showRevenueBreakdown')} /></FormRow>
      <FormRow label="支付方式明细"><Switch checked={s.showPaymentBreakdown} onCheckedChange={set('showPaymentBreakdown')} /></FormRow>
      <FormRow label="退款信息"><Switch checked={s.showRefundSummary} onCheckedChange={set('showRefundSummary')} /></FormRow>
      <FormRow label="热销商品"><Switch checked={s.showTopItems} onCheckedChange={set('showTopItems')} /></FormRow>
      <FormRow label="热销商品数量"><NumberInput value={topItemsCount} onChange={setTopItemsCount} min={5} max={50} /></FormRow>
      <FormRow label="分类销售统计"><Switch checked={s.showCategoryBreakdown} onCheckedChange={set('showCategoryBreakdown')} /></FormRow>
      <div className="pt-5">
        <Btn variant="primary" icon={<Save className="w-3.5 h-3.5" />} loading={saving} onClick={handleSave}>保存配置</Btn>
      </div>
    </div>
  )
}

export default DailyReportForm
