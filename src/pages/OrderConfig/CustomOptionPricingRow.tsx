import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Pencil, Trash2, Info, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Btn, Badge, Modal, Field, Spinner, ConfirmDialog, toast } from '@/components/ui-kit'
import { getCurrencySymbol } from '../../config/currencyConfig'
import {
  batchSaveCustomOptionSourcePrices,
  deleteCustomOptionSourcePrice,
  type CustomOptionPriceData
} from '../../services/channel-pricing'
import { itemManagementService } from '../../services/item-management'

interface CustomOptionPricingRowProps {
  itemId: string
  itemName: string
  sourceCode: string
}

interface CustomOptionPriceRow extends CustomOptionPriceData {
  key: string
  modified?: boolean
  newSourcePrice?: number
}

/**
 * 自定义选项定价行组件
 * 集成在商品定价卡片中，可展开/收起显示商品的自定义选项价格
 */
const CustomOptionPricingRow: React.FC<CustomOptionPricingRowProps> = ({
  itemId,
  itemName,
  sourceCode
}) => {
  const { t } = useTranslation()
  const tk = (key: string) => t(`pages.orderConfig.${key}`)

  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [customOptionPrices, setCustomOptionPrices] = useState<CustomOptionPriceRow[]>([])
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingPrice, setEditingPrice] = useState<CustomOptionPriceRow | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [editError, setEditError] = useState<string | undefined>()
  const [deletingRow, setDeletingRow] = useState<CustomOptionPriceRow | null>(null)
  const [hasModifiers, setHasModifiers] = useState<boolean | null>(null)

  // 展开时加载数据
  useEffect(() => {
    if (expanded && itemId && sourceCode) {
      loadCustomOptionPrices()
    }
  }, [expanded, itemId, sourceCode])

  const loadCustomOptionPrices = async () => {
    try {
      setLoading(true)

      // 首先检查商品是否有关联的自定义选项组
      const itemModifiers = await itemManagementService.getItemModifiers(itemId)

      if (!itemModifiers || itemModifiers.length === 0) {
        setHasModifiers(false)
        setCustomOptionPrices([])
        setLoading(false)
        return
      }

      setHasModifiers(true)

      // 使用价格计算API获取完整的自定义选项及其价格
      const allOptions: Array<{ optionId: string; quantity: number }> = []
      for (const modifierGroup of itemModifiers) {
        if (modifierGroup.group && modifierGroup.group.options) {
          for (const option of modifierGroup.group.options) {
            allOptions.push({ optionId: option.id, quantity: 1 })
          }
        }
      }

      if (allOptions.length === 0) {
        setCustomOptionPrices([])
        setLoading(false)
        return
      }

      // 为每个选项单独调用价格计算API（包括默认价、商品价、渠道价）
      const priceCalculations = await Promise.all(
        allOptions.map(async (option) => {
          try {
            const { calculatePrice } = await import('../../services/channel-pricing')
            const result = await calculatePrice({ itemId, sourceCode, customOptions: [option] })
            return result.customOptions[0]
          } catch (error) {
            return null
          }
        })
      )

      const validPrices = priceCalculations.filter(p => p !== null)

      if (validPrices.length > 0) {
        const rows: CustomOptionPriceRow[] = validPrices.map((price, index) => {
          // 从自定义选项选项中查找组名
          let groupName = ''
          let optionName = price.optionName || ''

          for (const modifierGroup of itemModifiers) {
            if (modifierGroup.group && modifierGroup.group.options) {
              const foundOption = modifierGroup.group.options.find(opt => opt.id === price.optionId)
              if (foundOption) {
                groupName = modifierGroup.group.displayName || modifierGroup.group.name
                optionName = foundOption.displayName || foundOption.name
                break
              }
            }
          }

          // 根据 priceSource 确定价格来源
          let defaultPrice = price.unitPrice
          let itemPrice: number | undefined
          let sourcePrice: number | undefined

          if (price.priceSource === 'default') {
            defaultPrice = price.unitPrice
          } else if (price.priceSource === 'item') {
            itemPrice = price.unitPrice
            defaultPrice = price.unitPrice
          } else if (price.priceSource === 'source') {
            sourcePrice = price.unitPrice
            defaultPrice = price.unitPrice
          }

          return {
            itemId,
            itemName,
            customOptionId: price.optionId,
            optionName,
            groupName,
            defaultPrice,
            itemPrice,
            sourcePrice,
            finalPrice: price.unitPrice,
            priceSource: price.priceSource,
            key: `${itemId}-${price.optionId}-${index}`
          }
        })

        setCustomOptionPrices(rows)
      } else {
        setCustomOptionPrices([])
      }
    } catch (error) {
      toast.error(tk('loadCustomOptionPricesFailed'))
      setCustomOptionPrices([])
    } finally {
      setLoading(false)
    }
  }

  const handleEditPrice = (record: CustomOptionPriceRow) => {
    setEditingPrice(record)
    setEditValue(String(record.sourcePrice ?? record.finalPrice ?? ''))
    setEditError(undefined)
    setEditModalVisible(true)
  }

  const handleModalOk = () => {
    if (!editingPrice) return
    const newPrice = Number(editValue)
    if (editValue === '' || Number.isNaN(newPrice)) {
      setEditError(tk('enterPrice'))
      return
    }
    if (newPrice < 0) {
      setEditError('价格不能为负数')
      return
    }

    setCustomOptionPrices(prev => prev.map(item =>
      item.key === editingPrice.key
        ? { ...item, newSourcePrice: newPrice, modified: true }
        : item
    ))

    setEditModalVisible(false)
    setEditingPrice(null)
  }

  const handleDeletePrice = async () => {
    if (!deletingRow) return
    try {
      await deleteCustomOptionSourcePrice(sourceCode, deletingRow.itemId, deletingRow.customOptionId)
      toast.success(tk('deleteCustomOptionPriceSuccess'))
      setDeletingRow(null)
      loadCustomOptionPrices()
    } catch (error) {
      toast.error(tk('deleteCustomOptionPriceFailed'))
    }
  }

  const handleSaveAll = async () => {
    const modifiedPrices = customOptionPrices.filter(p => p.modified && p.newSourcePrice !== undefined)

    if (modifiedPrices.length === 0) {
      toast.info(tk('noChanges'))
      return
    }

    try {
      setSaving(true)
      const prices = modifiedPrices.map(p => ({
        itemId: p.itemId,
        customOptionId: p.customOptionId,
        price: p.newSourcePrice!
      }))

      await batchSaveCustomOptionSourcePrices(sourceCode, prices)
      toast.success(tk('saveCustomOptionPricesSuccess').replace('{{count}}', prices.length.toString()))
      await loadCustomOptionPrices()
    } catch (error) {
      toast.error(tk('saveCustomOptionPricesFailed'))
    } finally {
      setSaving(false)
    }
  }

  const priceSourceBadge = (source: string) => {
    const map: Record<string, { variant: 'green' | 'gold' | 'default'; text: string }> = {
      source: { variant: 'green', text: tk('priceSourceChannel') },
      item: { variant: 'gold', text: tk('priceSourceItem') },
      default: { variant: 'default', text: tk('priceSourceDefault') }
    }
    const cfg = map[source] || { variant: 'default' as const, text: source }
    return <Badge variant={cfg.variant}>{cfg.text}</Badge>
  }

  const modifiedCount = customOptionPrices.filter(p => p.modified).length

  return (
    <div className="mt-3">
      {/* 展开/收起按钮 */}
      <Btn
        variant="link"
        size="sm"
        icon={expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? tk('hideCustomOptions') : tk('viewCustomOptions')}
      </Btn>

      {/* 展开内容 */}
      {expanded && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          {/* 头部：标题和保存按钮 */}
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              <span className="font-medium text-slate-700">{tk('customOptionPricing')}</span>
              <span title={tk('customOptionPricingTip')}><Info size={14} className="text-slate-400" /></span>
            </span>
            {modifiedCount > 0 && (
              <Btn variant="primary" size="sm" icon={<Save size={14} />} loading={saving} onClick={handleSaveAll}>
                {tk('saveOptionPrices')} ({modifiedCount})
              </Btn>
            )}
          </div>

          {/* 自定义选项列表 */}
          {loading ? (
            <div className="py-6 text-center"><Spinner /></div>
          ) : hasModifiers === false ? (
            <div className="rounded border border-dashed border-slate-300 bg-white p-5 text-center">
              <Info size={32} className="mx-auto mb-2 text-slate-400" />
              <div>
                <span className="mb-1 block text-slate-400">{tk('noModifiersConfigured')}</span>
                <span className="text-xs text-slate-400">{tk('pleaseConfigureModifiersFirst')}</span>
              </div>
            </div>
          ) : customOptionPrices.length > 0 ? (
            <div className="max-h-[400px] overflow-y-auto">
              {customOptionPrices.map(option => (
                <div
                  key={option.key}
                  className={`mb-2 rounded bg-white p-3 ${option.modified ? 'border border-blue-400' : 'border border-slate-200'}`}
                >
                  <div className="flex items-start justify-between">
                    {/* 左侧：选项信息 */}
                    <div className="flex-1">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-slate-700">{option.groupName || '-'}</span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-700">{option.optionName || '-'}</span>
                          {option.modified && <Badge variant="gold">{t('pages.orderConfig.modified')}</Badge>}
                        </span>

                        {/* 价格优先级 */}
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="text-slate-400">{tk('defaultPrice')}: {option.defaultPrice?.toFixed(2) || '0.00'}</span>
                          {option.itemPrice !== undefined && option.itemPrice !== null && (
                            <span className="text-amber-600">{tk('itemLevelPrice')}: {option.itemPrice.toFixed(2)}</span>
                          )}
                          {(option.sourcePrice !== undefined && option.sourcePrice !== null) || option.modified ? (
                            <span className="text-green-600">{tk('channelPrice')}: {(option.newSourcePrice ?? option.sourcePrice ?? 0).toFixed(2)}</span>
                          ) : (
                            <span className="text-slate-400">{tk('channelPrice')}: {tk('notSet')}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 右侧：最终价格和操作 */}
                    <div className="flex flex-col items-end gap-1">
                      <span className="flex items-center gap-2">
                        <span className="text-base font-semibold text-slate-800">
                          {(option.modified && option.newSourcePrice !== undefined
                            ? option.newSourcePrice
                            : option.finalPrice
                          )?.toFixed(2) || '0.00'}
                        </span>
                        {priceSourceBadge(option.priceSource)}
                      </span>

                      <span className="flex items-center gap-1">
                        <Btn variant="link" size="sm" icon={<Pencil size={14} />} onClick={() => handleEditPrice(option)}>{tk('setChannelPrice')}</Btn>
                        {option.sourcePrice !== undefined && option.sourcePrice !== null && (
                          <Btn variant="ghost" size="sm" icon={<Trash2 size={14} className="text-red-500" />} onClick={() => setDeletingRow(option)} />
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded border border-dashed border-slate-300 bg-white p-5 text-center text-slate-400">
              {tk('noCustomOptionsData')}
            </div>
          )}
        </div>
      )}

      {/* 编辑价格模态框 */}
      <Modal
        open={editModalVisible}
        onOpenChange={(o) => { if (!o) { setEditModalVisible(false); setEditingPrice(null) } }}
        title={tk('setChannelPrice')}
        footer={
          <>
            <Btn variant="secondary" onClick={() => { setEditModalVisible(false); setEditingPrice(null) }}>{t('common.cancel')}</Btn>
            <Btn variant="primary" onClick={handleModalOk}>{t('common.confirm')}</Btn>
          </>
        }
      >
        {editingPrice && (
          <div className="space-y-4">
            <div>
              <span className="text-slate-400">{tk('optionGroup')}：</span>
              <span className="font-medium text-slate-700">{editingPrice.groupName}</span>
            </div>
            <div>
              <span className="text-slate-400">{tk('optionName')}：</span>
              <span className="font-medium text-slate-700">{editingPrice.optionName}</span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3">
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">{tk('defaultPrice')}: {editingPrice.defaultPrice?.toFixed(2) || '0.00'}</span>
                {editingPrice.itemPrice !== undefined && editingPrice.itemPrice !== null && (
                  <span className="text-amber-600">{tk('itemLevelPrice')}: {editingPrice.itemPrice.toFixed(2)}</span>
                )}
                {editingPrice.sourcePrice !== undefined && editingPrice.sourcePrice !== null && (
                  <span className="text-green-600">{tk('currentChannelPrice')}: {editingPrice.sourcePrice.toFixed(2)}</span>
                )}
              </div>
            </div>

            <Field label={tk('newChannelPrice')} required error={editError}>
              <div className="flex items-center rounded-lg border border-slate-200 bg-white px-3 focus-within:outline-2 focus-within:outline-slate-900">
                <span className="text-sm text-slate-400">{getCurrencySymbol()}</span>
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder={tk('enterPrice')}
                  className="w-full bg-transparent py-2 pl-2 text-sm text-slate-700 focus:outline-none"
                />
              </div>
            </Field>
          </div>
        )}
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deletingRow}
        onOpenChange={(o) => { if (!o) setDeletingRow(null) }}
        title={tk('deleteConfirmTitle')}
        description={tk('deleteCustomOptionPriceConfirm')}
        danger
        onConfirm={handleDeletePrice}
      />
    </div>
  )
}

export default CustomOptionPricingRow
