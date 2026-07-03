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

const KitchenTicketForm: React.FC<Props> = ({ config, onSave, saving }) => {
  const [language, setLanguage] = useState('zh-CN')
  const [header, setHeader] = useState({ showOrderNumber: true, showOrderType: true, showTableNumber: true, showTime: true, showCustomerName: false })
  const [items, setItems] = useState({ showAttributes: true, showModifiers: true, showItemNotes: true, fontSize: 'large' })
  const [footer, setFooter] = useState({ showOrderNotes: true })

  useEffect(() => {
    const sections = config.sections || {}
    setLanguage(config.language || 'zh-CN')
    setHeader({
      showOrderNumber: sections.header?.showOrderNumber ?? true,
      showOrderType: sections.header?.showOrderType ?? true,
      showTableNumber: sections.header?.showTableNumber ?? true,
      showTime: sections.header?.showTime ?? true,
      showCustomerName: sections.header?.showCustomerName ?? false,
    })
    setItems({
      showAttributes: sections.items?.showAttributes ?? true,
      showModifiers: sections.items?.showModifiers ?? true,
      showItemNotes: sections.items?.showItemNotes ?? true,
      fontSize: sections.items?.fontSize ?? 'large',
    })
    setFooter({ showOrderNotes: sections.footer?.showOrderNotes ?? true })
  }, [config])

  const hSet = (k: keyof typeof header) => (v: boolean) => setHeader(prev => ({ ...prev, [k]: v }))
  const iSet = (k: 'showAttributes' | 'showModifiers' | 'showItemNotes') => (v: boolean) => setItems(prev => ({ ...prev, [k]: v }))
  const handleSave = () => onSave({ paperWidth: 80, language, sections: { header, items, footer } })

  return (
    <div className="max-w-md">
      <p className="text-sm font-semibold text-slate-700 pb-1">基础设置</p>
      <FormRow label="语言">
        <div className="w-40"><SelectInput value={language} onChange={setLanguage} className="w-full" options={LANG_OPTIONS} /></div>
      </FormRow>

      <p className="text-sm font-semibold text-slate-700 pt-4 pb-1">头部信息</p>
      <FormRow label="订单号（大字体）"><Switch checked={header.showOrderNumber} onCheckedChange={hSet('showOrderNumber')} /></FormRow>
      <FormRow label="订单类型"><Switch checked={header.showOrderType} onCheckedChange={hSet('showOrderType')} /></FormRow>
      <FormRow label="桌号"><Switch checked={header.showTableNumber} onCheckedChange={hSet('showTableNumber')} /></FormRow>
      <FormRow label="时间"><Switch checked={header.showTime} onCheckedChange={hSet('showTime')} /></FormRow>
      <FormRow label="顾客姓名"><Switch checked={header.showCustomerName} onCheckedChange={hSet('showCustomerName')} /></FormRow>

      <p className="text-sm font-semibold text-slate-700 pt-4 pb-1">商品信息</p>
      <FormRow label="商品属性（规格）"><Switch checked={items.showAttributes} onCheckedChange={iSet('showAttributes')} /></FormRow>
      <FormRow label="加料/自定义选项"><Switch checked={items.showModifiers} onCheckedChange={iSet('showModifiers')} /></FormRow>
      <FormRow label="单品备注"><Switch checked={items.showItemNotes} onCheckedChange={iSet('showItemNotes')} /></FormRow>
      <FormRow label="商品字体大小">
        <div className="w-40">
          <SelectInput
            value={items.fontSize}
            onChange={(v) => setItems(prev => ({ ...prev, fontSize: String(v) }))}
            className="w-full"
            options={[{ label: '正常', value: 'normal' }, { label: '大号（推荐）', value: 'large' }]}
          />
        </div>
      </FormRow>

      <p className="text-sm font-semibold text-slate-700 pt-4 pb-1">底部信息</p>
      <FormRow label="订单备注"><Switch checked={footer.showOrderNotes} onCheckedChange={(v) => setFooter({ showOrderNotes: v })} /></FormRow>

      <div className="pt-5">
        <Btn variant="primary" icon={<Save className="w-3.5 h-3.5" />} loading={saving} onClick={handleSave}>保存配置</Btn>
      </div>
    </div>
  )
}

export default KitchenTicketForm
