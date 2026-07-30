import React, { useState, useEffect } from 'react'
import { Info, Save, RefreshCw, Pencil, Trash2, CheckCircle2, XCircle, DollarSign } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatPrice, fromMinorUnit, toMinorUnit } from '../../utils/priceConverter'
import { getCurrencySymbol } from '../../config/currencyConfig'
import {
  calculatePrice,
  batchSaveAllPrices,
  batchSaveCustomOptionSourcePrices,
  deleteCustomOptionSourcePrice,
  type CustomOptionPriceData
} from '../../services/channel-pricing'
import { itemManagementService } from '../../services/item-management'
import { Modal, SelectInput, Btn, Badge, AlertBox, Spinner, Table, toast, type Column } from '@/components/ui-kit'

interface ItemPricingModalProps {
  visible: boolean
  itemId: string
  itemName: string
  basePrice: number
  currentPrice?: number
  sourceCode: string
  sourceName: string
  /** 是否为外部渠道（非系统预置，如自取/堂食）。只有外部渠道才显示和编辑渠道 modifier 价格 */
  isExternalChannel?: boolean
  /** 是否为套餐（而不是商品）。套餐没有自己的自定义选项——子项通过关联的商品动态继承，
   * 不应该拿套餐ID去调"商品自定义选项"接口（会 404/报错），这种情况直接跳过整个自定义选项区块 */
  isCombo?: boolean
  onClose: () => void
  onSave: (newPrice: number) => void
}

interface CustomOptionPriceRow extends CustomOptionPriceData {
  key: string
  modified?: boolean
  newSourcePrice?: number
  groupDisplayName?: string
  optionDisplayName?: string
}

// 带货币前缀/后缀的数字输入，空值返回 undefined
function MoneyInput({ value, onChange, prefix, suffix, min, max, step, placeholder, autoFocus, align = 'left' }: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  prefix?: string
  suffix?: string
  min?: number
  max?: number
  step?: number
  placeholder?: string
  autoFocus?: boolean
  align?: 'left' | 'right'
}) {
  return (
    <div className="flex items-center rounded-lg border border-slate-200 bg-white px-3 focus-within:outline-2 focus-within:outline-slate-900">
      {prefix && <span className="text-sm text-slate-400">{prefix}</span>}
      <input
        type="number"
        min={min}
        max={max}
        step={step ?? 0.01}
        autoFocus={autoFocus}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        placeholder={placeholder}
        className={`w-full bg-transparent py-2 text-sm text-slate-700 focus:outline-none ${prefix ? 'pl-2' : ''} ${align === 'right' ? 'text-right' : ''}`}
      />
      {suffix && <span className="text-sm text-slate-400">{suffix}</span>}
    </div>
  )
}

/**
 * 商品定价详情模态框
 * 整合商品基础价格和自定义选项定价
 */
const ItemPricingModal: React.FC<ItemPricingModalProps> = ({
  visible,
  itemId,
  itemName,
  basePrice,
  currentPrice,
  sourceCode,
  sourceName,
  isExternalChannel = false,
  isCombo = false,
  onClose,
  onSave
}) => {
  const { t } = useTranslation()
  const tk = (key: string) => t(`pages.orderConfig.${key}`)

  // 商品基础价格
  const [itemPrice, setItemPrice] = useState<number | undefined>(currentPrice)
  const [itemPriceModified, setItemPriceModified] = useState(false)

  // 自定义选项
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [customOptionPrices, setCustomOptionPrices] = useState<CustomOptionPriceRow[]>([])
  const [hasModifiers, setHasModifiers] = useState<boolean | null>(null)
  const [editingKey, setEditingKey] = useState<string>('')

  // 批量定价工具
  const [batchPricingMode, setBatchPricingMode] = useState<'none' | 'percentage' | 'adjustment'>('none')
  const [batchPercentage, setBatchPercentage] = useState<number | undefined>(undefined)
  const [batchAdjustment, setBatchAdjustment] = useState<number | undefined>(undefined)

  // 初始化
  useEffect(() => {
    if (visible) {
      // currentPrice 是分单位，转换为元显示
      setItemPrice(currentPrice !== undefined ? fromMinorUnit(currentPrice) : undefined)
      setItemPriceModified(false)
      loadCustomOptionPrices()
    }
  }, [visible, itemId, sourceCode])

  // 加载自定义选项价格
  const loadCustomOptionPrices = async () => {
    // 套餐没有自己的自定义选项（子项通过关联的商品动态继承），itemId 在这里其实是 comboId，
    // 拿去调商品的 modifier 接口没有意义，会报错——直接跳过整个区块
    if (isCombo) {
      setHasModifiers(false)
      setCustomOptionPrices([])
      return
    }

    try {
      setLoading(true)

      const itemModifiers = await itemManagementService.getItemModifiers(itemId)

      if (!itemModifiers || itemModifiers.length === 0) {
        setHasModifiers(false)
        setCustomOptionPrices([])
        setLoading(false)
        return
      }

      setHasModifiers(true)

      const allOptions: Array<{
        optionId: string
        quantity: number
        groupId: string
        groupName: string
        groupDisplayName: string
        optionName: string
        optionDisplayName: string
      }> = []

      for (const modifierGroup of itemModifiers) {
        if (modifierGroup.group && modifierGroup.group.options) {
          for (const option of modifierGroup.group.options) {
            allOptions.push({
              optionId: option.id,
              quantity: 1,
              groupId: modifierGroup.group.id,
              groupName: modifierGroup.group.name,
              groupDisplayName: modifierGroup.group.displayName || modifierGroup.group.name,
              optionName: option.name,
              optionDisplayName: option.displayName || option.name
            })
          }
        }
      }

      if (allOptions.length === 0) {
        setCustomOptionPrices([])
        setLoading(false)
        return
      }

      // 批量调用价格计算API
      // 非外部渠道（如自取、堂食等系统预置渠道）不使用渠道级 modifier 价格
      try {
        const result = await calculatePrice({
          itemId,
          sourceCode: isExternalChannel ? sourceCode : 'default',
          customOptions: allOptions.map(opt => ({ optionId: opt.optionId, quantity: 1 }))
        })

        const rows: CustomOptionPriceRow[] = result.customOptions.map((priceData, index) => {
          const optionInfo = allOptions.find(opt => opt.optionId === priceData.optionId)

          let defaultPrice = priceData.unitPrice
          let itemPriceLevel: number | undefined
          let sourcePrice: number | undefined

          if (priceData.priceSource === 'item') {
            itemPriceLevel = priceData.unitPrice
          } else if (priceData.priceSource === 'source') {
            sourcePrice = priceData.unitPrice
          }

          return {
            itemId,
            itemName,
            customOptionId: priceData.optionId,
            optionName: priceData.optionName,
            groupName: optionInfo?.groupDisplayName || '',
            groupDisplayName: optionInfo?.groupDisplayName || '',
            optionDisplayName: optionInfo?.optionDisplayName || priceData.optionName,
            defaultPrice,
            itemPrice: itemPriceLevel,
            sourcePrice,
            finalPrice: priceData.unitPrice,
            priceSource: priceData.priceSource,
            key: `${itemId}-${priceData.optionId}-${index}`,
            modified: false
          }
        })

        setCustomOptionPrices(rows)
      } catch (error) {
        toast.error(tk('loadCustomOptionPricesFailed'))
        setCustomOptionPrices([])
      }
    } catch (error) {
      toast.error(tk('loadCustomOptionPricesFailed'))
      setCustomOptionPrices([])
    } finally {
      setLoading(false)
    }
  }

  const handleItemPriceChange = (value: number | undefined) => {
    setItemPrice(value)
    setItemPriceModified(true)
  }

  // 用户输入主单位（元），转换为副单位（分）存储
  const handleOptionPriceChange = (record: CustomOptionPriceRow, value: number | undefined) => {
    setCustomOptionPrices(prev => prev.map(item =>
      item.key === record.key
        ? { ...item, newSourcePrice: value !== undefined ? toMinorUnit(value) : undefined, modified: true }
        : item
    ))
  }

  // 应用批量定价
  const handleApplyBatchPricing = () => {
    if (batchPricingMode === 'none') {
      toast.warning(tk('selectPricingMethod'))
      return
    }

    if (batchPricingMode === 'percentage' && batchPercentage === undefined) {
      toast.warning(tk('enterPercentage'))
      return
    }

    if (batchPricingMode === 'adjustment' && batchAdjustment === undefined) {
      toast.warning(tk('enterAdjustment'))
      return
    }

    setCustomOptionPrices(prev => prev.map(item => {
      let newPrice: number
      if (batchPricingMode === 'percentage') {
        newPrice = item.finalPrice * (1 + (batchPercentage! / 100))
      } else {
        newPrice = item.finalPrice + toMinorUnit(batchAdjustment!)
      }
      newPrice = Math.max(0, newPrice)
      return { ...item, newSourcePrice: newPrice, modified: true }
    }))

    toast.success(tk('batchPricingApplied'))
  }

  const handleResetBatchPricing = () => {
    setBatchPricingMode('none')
    setBatchPercentage(undefined)
    setBatchAdjustment(undefined)
  }

  const handleDeleteOptionPrice = async (record: CustomOptionPriceRow) => {
    try {
      await deleteCustomOptionSourcePrice(sourceCode, record.itemId, record.customOptionId)
      toast.success(tk('deleteCustomOptionPriceSuccess'))
      loadCustomOptionPrices()
    } catch (error) {
      toast.error(tk('deleteCustomOptionPriceFailed'))
    }
  }

  // 保存所有修改
  const handleSave = async () => {
    try {
      setSaving(true)

      // 保存商品基础价格（itemPrice 是元单位，×100 转分）
      if (itemPriceModified && itemPrice !== undefined) {
        await batchSaveAllPrices({
          items: [{ sourceCode, itemId, price: Math.round(itemPrice * 100) }]
        })
        onSave(Math.round(itemPrice * 100))
      }

      // 保存自定义选项价格（仅外部渠道支持渠道级 modifier 价格）
      const modifiedOptions = isExternalChannel
        ? customOptionPrices.filter(p => p.modified && p.newSourcePrice !== undefined)
        : []

      if (modifiedOptions.length > 0) {
        const prices = modifiedOptions.map(p => ({
          itemId: p.itemId,
          customOptionId: p.customOptionId,
          price: p.newSourcePrice!
        }))
        await batchSaveCustomOptionSourcePrices(sourceCode, prices)
      }

      if (itemPriceModified || modifiedOptions.length > 0) {
        toast.success(t('common.saveSuccess'))
        await loadCustomOptionPrices()
        setItemPriceModified(false)
        setEditingKey('')
      } else {
        toast.info(tk('noChanges'))
      }
    } catch (error) {
      toast.error(t('common.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const getPriceSourceTag = (source: string) => {
    const map: Record<string, { variant: 'green' | 'gold' | 'default'; text: string }> = {
      source: { variant: 'green', text: tk('priceSourceChannel') },
      item: { variant: 'gold', text: tk('priceSourceItem') },
      default: { variant: 'default', text: tk('priceSourceDefault') }
    }
    const cfg = map[source] || { variant: 'default' as const, text: source }
    return <Badge variant={cfg.variant}>{cfg.text}</Badge>
  }

  const getStatistics = () => {
    const total = customOptionPrices.length
    const withSourcePrice = customOptionPrices.filter(p => p.priceSource === 'source').length
    const modified = customOptionPrices.filter(p => p.modified).length
    return { total, withSourcePrice, modified }
  }

  const columns: Column<CustomOptionPriceRow>[] = [
    {
      key: 'groupDisplayName',
      title: tk('optionGroup'),
      width: 120,
      render: (r) => <span className="font-medium text-slate-700">{r.groupDisplayName}</span>
    },
    {
      key: 'optionDisplayName',
      title: tk('optionName'),
      width: 150,
      render: (r) => r.optionDisplayName
    },
    {
      key: 'defaultPrice',
      title: tk('defaultPrice'),
      width: 100,
      align: 'right',
      render: (r) => <span className="text-slate-400">{formatPrice(r.defaultPrice || 0)}</span>
    },
    {
      key: 'channelPrice',
      title: tk('channelPrice'),
      width: 150,
      align: 'right',
      render: (record) => {
        const isEditing = editingKey === record.key
        const displayPrice = record.modified && record.newSourcePrice !== undefined
          ? record.newSourcePrice
          : record.sourcePrice

        if (isEditing) {
          const minorUnitsValue = record.newSourcePrice ?? record.sourcePrice ?? 0
          return (
            <MoneyInput
              value={fromMinorUnit(minorUnitsValue)}
              onChange={(value) => handleOptionPriceChange(record, value)}
              min={0}
              prefix={getCurrencySymbol()}
              autoFocus
              align="right"
            />
          )
        }

        return displayPrice !== undefined && displayPrice !== null
          ? <span className="font-medium text-green-600">{formatPrice(displayPrice)}</span>
          : <span className="text-slate-400">{tk('notSet')}</span>
      }
    },
    {
      key: 'finalPrice',
      title: tk('finalPrice'),
      width: 120,
      align: 'right',
      render: (record) => {
        const displayPrice = record.modified && record.newSourcePrice !== undefined
          ? record.newSourcePrice
          : record.finalPrice
        return (
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-semibold text-slate-800">{formatPrice(displayPrice || 0)}</span>
            {!record.modified && getPriceSourceTag(record.priceSource)}
          </div>
        )
      }
    },
    {
      key: 'actions',
      title: tk('actions'),
      width: 120,
      render: (record) => {
        const isEditing = editingKey === record.key

        if (isEditing) {
          return (
            <div className="flex items-center gap-1">
              <Btn variant="ghost" size="sm" icon={<CheckCircle2 size={14} className="text-green-600" />} onClick={() => setEditingKey('')} />
              <Btn
                variant="ghost"
                size="sm"
                icon={<XCircle size={14} className="text-red-500" />}
                onClick={() => {
                  setEditingKey('')
                  setCustomOptionPrices(prev => prev.map(item =>
                    item.key === record.key ? { ...item, modified: false, newSourcePrice: undefined } : item
                  ))
                }}
              />
            </div>
          )
        }

        return (
          <div className="flex items-center gap-1">
            <Btn variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => setEditingKey(record.key)} />
            {record.sourcePrice !== undefined && record.sourcePrice !== null && (
              <Btn variant="ghost" size="sm" icon={<Trash2 size={14} className="text-red-500" />} onClick={() => handleDeleteOptionPrice(record)} />
            )}
          </div>
        )
      }
    }
  ]

  const stats = getStatistics()
  const hasChanges = itemPriceModified || stats.modified > 0
  const priceDelta = itemPrice !== undefined ? itemPrice - fromMinorUnit(basePrice) : 0

  return (
    <Modal
      open={visible}
      onOpenChange={(o) => { if (!o) onClose() }}
      size="xl"
      title={
        <span className="inline-flex items-center gap-2">
          <DollarSign size={18} className="text-slate-500" />
          <span>{tk('itemPricingDetail')} - {itemName}</span>
          <Badge variant="blue">{sourceName}</Badge>
        </span>
      }
      footer={
        <div className="flex w-full items-center justify-between">
          <div>
            {hasChanges && (
              <span className="inline-flex items-center gap-1 text-sm text-amber-600">
                <Info size={14} /> {tk('unsavedChanges')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Btn variant="secondary" onClick={onClose}>{t('common.cancel')}</Btn>
            <Btn variant="primary" icon={<Save size={16} />} loading={saving} disabled={!hasChanges} onClick={handleSave}>
              {t('common.save')}{hasChanges && ` (${(itemPriceModified ? 1 : 0) + stats.modified})`}
            </Btn>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* 商品基础价格区域 */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <DollarSign size={16} className="text-slate-500" />
              {tk('itemBasePrice')}
            </span>
            {itemPriceModified && <Badge variant="gold">{tk('modified')}</Badge>}
          </div>
          <div className="space-y-4 p-4">
            <AlertBox type="info" title={tk('itemBasePriceTip')} />

            <div className="grid grid-cols-3 gap-6">
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-xs text-slate-400">{tk('originalPrice')}</div>
                <div className="text-2xl font-semibold text-slate-800">{getCurrencySymbol()}{fromMinorUnit(basePrice).toFixed(2)}</div>
              </div>
              <div>
                <div className="mb-2 text-sm font-medium text-slate-700">{tk('channelPrice')}</div>
                <MoneyInput value={itemPrice} onChange={handleItemPriceChange} min={0} prefix={getCurrencySymbol()} placeholder={tk('enterPrice')} />
              </div>
              <div>
                {itemPrice !== undefined && (
                  <div className={`rounded-lg border p-4 ${priceDelta >= 0 ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                    <div className="text-xs text-slate-400">{tk('priceChange')}</div>
                    <div className={`text-xl font-semibold ${priceDelta >= 0 ? 'text-green-600' : 'text-amber-600'}`}>
                      {priceDelta >= 0 ? '+' : '-'}{getCurrencySymbol()}{Math.abs(priceDelta).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 自定义选项定价区域 */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Info size={16} className="text-slate-500" />
              {tk('customOptionPricing')}
              {customOptionPrices.length > 0 && <Badge variant="blue">{customOptionPrices.length}</Badge>}
            </span>
            <div className="flex items-center gap-2">
              {stats.modified > 0 && <Badge variant="gold">{tk('modified')}: {stats.modified}</Badge>}
              <Btn variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={loadCustomOptionPrices} disabled={loading}>{t('common.refresh')}</Btn>
            </div>
          </div>

          <div className="p-4">
            {hasModifiers === false ? (
              <div className="py-10 text-center">
                <Info size={48} className="mx-auto mb-4 text-slate-300" />
                <div>
                  <span className="mb-2 block text-base text-slate-400">{tk('noModifiersConfigured')}</span>
                  <span className="text-sm text-slate-400">{tk('pleaseConfigureModifiersFirst')}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 批量定价工具 */}
                {customOptionPrices.length > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50">
                    <div className="flex items-center justify-between border-b border-blue-100 px-3 py-2">
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                        <DollarSign size={14} className="text-slate-500" />
                        {tk('batchPricingTool')}
                      </span>
                      <Btn variant="secondary" size="sm" onClick={handleResetBatchPricing}>{tk('reset')}</Btn>
                    </div>
                    <div className="flex flex-wrap items-end gap-4 p-3">
                      <div className="w-56">
                        <div className="mb-2 text-[13px] font-medium text-slate-700">{tk('pricingMethod')}</div>
                        <SelectInput
                          value={batchPricingMode === 'none' ? '' : batchPricingMode}
                          onChange={(value) => setBatchPricingMode((value || 'none') as any)}
                          placeholder={tk('selectPricingMethod')}
                          options={[
                            { value: 'percentage', label: tk('percentageDiscount') },
                            { value: 'adjustment', label: tk('adjustmentAmount') }
                          ]}
                        />
                      </div>

                      {batchPricingMode === 'percentage' && (
                        <>
                          <div className="w-40">
                            <div className="mb-2 text-[13px] font-medium text-slate-700">{tk('discountPercentage')}</div>
                            <MoneyInput value={batchPercentage} onChange={setBatchPercentage} min={-100} max={100} step={1} suffix="%" placeholder={tk('percentagePlaceholderShort')} />
                          </div>
                          {batchPercentage !== undefined && (
                            <div className="min-w-56 flex-1">
                              <AlertBox
                                type="info"
                                title={
                                  <span className="text-[13px]">
                                    {tk('preview')}: {formatPrice(1000)} →
                                    <strong className={`ml-1.5 ${batchPercentage > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                                      {formatPrice(Math.round(1000 * (1 + batchPercentage / 100)))}
                                    </strong>
                                  </span>
                                }
                              />
                            </div>
                          )}
                          <Btn variant="primary" icon={<CheckCircle2 size={16} />} onClick={handleApplyBatchPricing}>{tk('applyToAll')}</Btn>
                        </>
                      )}

                      {batchPricingMode === 'adjustment' && (
                        <>
                          <div className="w-40">
                            <div className="mb-2 text-[13px] font-medium text-slate-700">{tk('adjustmentAmountLabel')}</div>
                            <MoneyInput value={batchAdjustment} onChange={setBatchAdjustment} step={0.5} prefix={getCurrencySymbol()} placeholder={tk('adjustmentPlaceholder')} />
                          </div>
                          {batchAdjustment !== undefined && (
                            <div className="min-w-56 flex-1">
                              <AlertBox
                                type="info"
                                title={
                                  <span className="text-[13px]">
                                    {tk('preview')}: {formatPrice(1000)} →
                                    <strong className={`ml-1.5 ${batchAdjustment > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                                      {formatPrice(1000 + Math.round(batchAdjustment * 100))}
                                    </strong>
                                  </span>
                                }
                              />
                            </div>
                          )}
                          <Btn variant="primary" icon={<CheckCircle2 size={16} />} onClick={handleApplyBatchPricing}>{tk('applyToAll')}</Btn>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* 统计信息 */}
                {customOptionPrices.length > 0 && (
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-slate-400">{t('common.total')}</div>
                      <div className="text-xl font-semibold text-slate-800">{stats.total} <span className="text-sm font-normal text-slate-400">{t('common.items')}</span></div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">{tk('priceSourceChannel')}</div>
                      <div className="text-xl font-semibold text-green-600">{stats.withSourcePrice}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">{tk('priceSourceDefault')}</div>
                      <div className="text-xl font-semibold text-slate-400">{stats.total - stats.withSourcePrice}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">{tk('pendingSave')}</div>
                      <div className="text-xl font-semibold text-amber-500">{stats.modified}</div>
                    </div>
                  </div>
                )}

                {/* 价格表格 */}
                {loading ? (
                  <div className="py-10 text-center"><Spinner /></div>
                ) : customOptionPrices.length > 0 ? (
                  <Table columns={columns} data={customOptionPrices} rowKey={(r) => r.key} />
                ) : (
                  <div className="rounded bg-slate-50 p-10 text-center text-slate-400">{tk('noCustomOptionsData')}</div>
                )}

                {/* 提示信息 */}
                {customOptionPrices.length > 0 && (
                  <AlertBox type="info" title={<span className="text-xs">{tk('customOptionPricingTip')}</span>} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default ItemPricingModal
