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

const KitchenTicketForm: React.FC<Props> = ({ config, onSave, saving }) => {
  const { t } = useTranslation()
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
      <p className="text-sm font-semibold text-slate-700 pb-1">{t('pages.printSettings.kitchenTicketForm.basicSettingsTitle')}</p>
      <FormRow label={t('pages.printSettings.kitchenTicketForm.languageLabel')}>
        <div className="w-40"><SelectInput value={language} onChange={setLanguage} className="w-full" options={getLangOptions(t)} /></div>
      </FormRow>

      <p className="text-sm font-semibold text-slate-700 pt-4 pb-1">{t('pages.printSettings.kitchenTicketForm.headerInfoTitle')}</p>
      <FormRow label={t('pages.printSettings.kitchenTicketForm.orderNumberLargeFontLabel')}><Switch checked={header.showOrderNumber} onCheckedChange={hSet('showOrderNumber')} /></FormRow>
      <FormRow label={t('pages.printSettings.kitchenTicketForm.orderTypeLabel')}><Switch checked={header.showOrderType} onCheckedChange={hSet('showOrderType')} /></FormRow>
      <FormRow label={t('pages.printSettings.kitchenTicketForm.tableNumberLabel')}><Switch checked={header.showTableNumber} onCheckedChange={hSet('showTableNumber')} /></FormRow>
      <FormRow label={t('pages.printSettings.kitchenTicketForm.timeLabel')}><Switch checked={header.showTime} onCheckedChange={hSet('showTime')} /></FormRow>
      <FormRow label={t('pages.printSettings.kitchenTicketForm.customerNameLabel')}><Switch checked={header.showCustomerName} onCheckedChange={hSet('showCustomerName')} /></FormRow>

      <p className="text-sm font-semibold text-slate-700 pt-4 pb-1">{t('pages.printSettings.kitchenTicketForm.itemInfoTitle')}</p>
      <FormRow label={t('pages.printSettings.kitchenTicketForm.showAttributesLabel')}><Switch checked={items.showAttributes} onCheckedChange={iSet('showAttributes')} /></FormRow>
      <FormRow label={t('pages.printSettings.kitchenTicketForm.showModifiersLabel')}><Switch checked={items.showModifiers} onCheckedChange={iSet('showModifiers')} /></FormRow>
      <FormRow label={t('pages.printSettings.kitchenTicketForm.showItemNotesLabel')}><Switch checked={items.showItemNotes} onCheckedChange={iSet('showItemNotes')} /></FormRow>
      <FormRow label={t('pages.printSettings.kitchenTicketForm.itemFontSizeLabel')}>
        <div className="w-40">
          <SelectInput
            value={items.fontSize}
            onChange={(v) => setItems(prev => ({ ...prev, fontSize: String(v) }))}
            className="w-full"
            options={[
              { label: t('pages.printSettings.kitchenTicketForm.fontSizeOptionNormal'), value: 'normal' },
              { label: t('pages.printSettings.kitchenTicketForm.fontSizeOptionLarge'), value: 'large' },
            ]}
          />
        </div>
      </FormRow>

      <p className="text-sm font-semibold text-slate-700 pt-4 pb-1">{t('pages.printSettings.kitchenTicketForm.footerInfoTitle')}</p>
      <FormRow label={t('pages.printSettings.kitchenTicketForm.orderNotesLabel')}><Switch checked={footer.showOrderNotes} onCheckedChange={(v) => setFooter({ showOrderNotes: v })} /></FormRow>

      <div className="pt-5">
        <Btn variant="primary" icon={<Save className="w-3.5 h-3.5" />} loading={saving} onClick={handleSave}>{t('pages.printSettings.customerReceiptForm.saveConfigBtn')}</Btn>
      </div>
    </div>
  )
}

export default KitchenTicketForm
