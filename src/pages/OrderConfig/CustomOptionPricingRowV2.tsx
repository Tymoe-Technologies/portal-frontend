import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Pencil, Trash2, Info, Save, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Table, Btn, Badge, AlertBox, Spinner, toast, Tooltip, type Column } from '@/components/ui-kit'
import { getCurrencySymbol } from '../../config/currencyConfig'
import {
  batchSaveCustomOptionSourcePrices,
  deleteCustomOptionSourcePrice,
  calculatePrice,
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
  groupDisplayName?: string
  optionDisplayName?: string
}

/**
 * 自定义选项定价表格组件 V2 (优化版)
 * 表格布局 + 内联编辑 + 批量价格计算 + 统计信息
 */
const CustomOptionPricingRowV2: React.FC<CustomOptionPricingRowProps> = ({
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
  const [hasModifiers, setHasModifiers] = useState<boolean | null>(null)
  const [editingKey, setEditingKey] = useState<string>('')

  // 展开时加载数据
  useEffect(() => {
    if (expanded && itemId && sourceCode) {
      loadCustomOptionPrices()
    }
  }, [expanded, itemId, sourceCode])

  // 加载自定义选项价格数据（批量调用价格计算API）
  const loadCustomOptionPrices = async () => {
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

      // 收集所有自定义选项选项
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
      try {
        const result = await calculatePrice({
          itemId,
          sourceCode,
          customOptions: allOptions.map(opt => ({ optionId: opt.optionId, quantity: 1 }))
        })

        const rows: CustomOptionPriceRow[] = result.customOptions.map((priceData, index) => {
          const optionInfo = allOptions.find(opt => opt.optionId === priceData.optionId)

          let defaultPrice = priceData.unitPrice
          let itemPrice: number | undefined
          let sourcePrice: number | undefined

          if (priceData.priceSource === 'item') {
            itemPrice = priceData.unitPrice
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
            itemPrice,
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

  const handleEdit = (record: CustomOptionPriceRow) => setEditingKey(record.key)

  const handleCancelEdit = () => {
    setEditingKey('')
    // 重置修改状态
    setCustomOptionPrices(prev => prev.map(item => ({ ...item, modified: false, newSourcePrice: undefined })))
  }

  const handleSaveEdit = (_record: CustomOptionPriceRow) => setEditingKey('')

  const handlePriceChange = (record: CustomOptionPriceRow, value: number | null) => {
    setCustomOptionPrices(prev => prev.map(item =>
      item.key === record.key
        ? { ...item, newSourcePrice: value ?? undefined, modified: true }
        : item
    ))
  }

  const handleDeletePrice = async (record: CustomOptionPriceRow) => {
    try {
      await deleteCustomOptionSourcePrice(sourceCode, record.itemId, record.customOptionId)
      toast.success(tk('deleteCustomOptionPriceSuccess'))
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
      setEditingKey('')
    } catch (error) {
      toast.error(tk('saveCustomOptionPricesFailed'))
    } finally {
      setSaving(false)
    }
  }

  const getStatistics = () => {
    const total = customOptionPrices.length
    const withSourcePrice = customOptionPrices.filter(p => p.priceSource === 'source').length
    const withItemPrice = customOptionPrices.filter(p => p.priceSource === 'item').length
    const withDefaultPrice = customOptionPrices.filter(p => p.priceSource === 'default').length
    const modified = customOptionPrices.filter(p => p.modified).length
    return { total, withSourcePrice, withItemPrice, withDefaultPrice, modified }
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
      title: (
        <Tooltip label={tk('customOptionPricingTip')}>
          <span className="inline-flex items-center gap-1">
            {tk('defaultPrice')}
            <Info size={13} className="text-slate-400" />
          </span>
        </Tooltip>
      ),
      width: 100,
      align: 'right',
      render: (r) => <span className="text-slate-400">{r.defaultPrice?.toFixed(2) || '0.00'}</span>
    },
    {
      key: 'itemPrice',
      title: tk('itemLevelPrice'),
      width: 100,
      align: 'right',
      render: (r) => r.itemPrice !== undefined && r.itemPrice !== null
        ? <span className="text-amber-500">{r.itemPrice.toFixed(2)}</span>
        : <span className="text-slate-400">-</span>
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
          return (
            <div className="flex items-center rounded-lg border border-slate-200 bg-white px-2 focus-within:outline-2 focus-within:outline-slate-900">
              <span className="text-xs text-slate-400">{getCurrencySymbol()}</span>
              <input
                type="number"
                step={0.01}
                min={0}
                autoFocus
                value={record.newSourcePrice ?? record.sourcePrice ?? ''}
                onChange={(e) => handlePriceChange(record, e.target.value === '' ? null : Number(e.target.value))}
                className="w-full bg-transparent py-1.5 pl-1 text-right text-sm text-slate-700 focus:outline-none"
              />
            </div>
          )
        }

        return displayPrice !== undefined && displayPrice !== null ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="font-medium text-green-600">{displayPrice.toFixed(2)}</span>
            {record.modified && <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />}
          </span>
        ) : <span className="text-slate-400">{tk('notSet')}</span>
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
            <span className="text-base font-semibold text-slate-800">{displayPrice?.toFixed(2) || '0.00'}</span>
            {!record.modified && getPriceSourceTag(record.priceSource)}
          </div>
        )
      }
    },
    {
      key: 'actions',
      title: tk('actions'),
      width: 150,
      render: (record) => {
        const isEditing = editingKey === record.key

        if (isEditing) {
          return (
            <div className="flex items-center gap-1">
              <Btn variant="link" size="sm" icon={<CheckCircle2 size={14} />} onClick={() => handleSaveEdit(record)}>{t('common.confirm')}</Btn>
              <Btn variant="link" size="sm" icon={<XCircle size={14} className="text-red-500" />} onClick={handleCancelEdit}>{t('common.cancel')}</Btn>
            </div>
          )
        }

        return (
          <div className="flex items-center gap-1">
            <Btn variant="link" size="sm" icon={<Pencil size={14} />} onClick={() => handleEdit(record)}>{tk('setChannelPrice')}</Btn>
            {record.sourcePrice !== undefined && record.sourcePrice !== null && (
              <Btn variant="ghost" size="sm" icon={<Trash2 size={14} className="text-red-500" />} onClick={() => handleDeletePrice(record)} />
            )}
          </div>
        )
      }
    }
  ]

  const stats = getStatistics()

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
        {!expanded && customOptionPrices.length > 0 && (
          <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500 px-1.5 text-xs text-white">
            {customOptionPrices.length}
          </span>
        )}
      </Btn>

      {/* 展开内容 */}
      {expanded && (
        <div className="mt-3 rounded-lg bg-slate-50 p-4">
          {hasModifiers === false ? (
            // 状态1：未配置自定义选项
            <div className="rounded border border-dashed border-slate-300 bg-white p-10 text-center">
              <Info size={48} className="mx-auto mb-4 text-slate-300" />
              <div>
                <span className="mb-2 block text-base text-slate-400">{tk('noModifiersConfigured')}</span>
                <span className="text-sm text-slate-400">{tk('pleaseConfigureModifiersFirst')}</span>
              </div>
            </div>
          ) : (
            <>
              {/* 统计信息栏 */}
              {customOptionPrices.length > 0 && (
                <div className="mb-4 grid grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-slate-400">{t('common.total')}</div>
                    <div className="text-2xl font-semibold text-slate-800">{stats.total} <span className="text-sm font-normal text-slate-400">{t('common.items')}</span></div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{tk('priceSourceChannel')}</div>
                    <div className="text-2xl font-semibold text-green-600">{stats.withSourcePrice}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{tk('priceSourceItem')}</div>
                    <div className="text-2xl font-semibold text-amber-500">{stats.withItemPrice}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{tk('priceSourceDefault')}</div>
                    <div className="text-2xl font-semibold text-slate-400">{stats.withDefaultPrice}</div>
                  </div>
                </div>
              )}

              {/* 操作栏 */}
              <div className="mb-4 flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">{tk('customOptionPricing')}</span>
                  <Tooltip label={tk('customOptionPricingTip')}><Info size={14} className="text-slate-400" /></Tooltip>
                </span>
                <div className="flex items-center gap-2">
                  <Btn variant="secondary" icon={<RefreshCw size={16} />} onClick={loadCustomOptionPrices} disabled={loading}>{t('common.refresh')}</Btn>
                  {stats.modified > 0 && (
                    <Btn variant="primary" icon={<Save size={16} />} loading={saving} onClick={handleSaveAll}>
                      {tk('saveOptionPrices')} ({stats.modified})
                    </Btn>
                  )}
                </div>
              </div>

              {/* 提示信息 */}
              {stats.modified > 0 && (
                <div className="mb-4">
                  <AlertBox type="warning" title={`${tk('modified')}: ${stats.modified} ${t('common.items')}`} />
                </div>
              )}

              {/* 价格表格 */}
              {loading ? (
                <div className="py-10 text-center"><Spinner /></div>
              ) : customOptionPrices.length > 0 ? (
                <Table columns={columns} data={customOptionPrices} rowKey={(r) => r.key} />
              ) : (
                <div className="rounded bg-white p-10 text-center text-slate-400">{tk('noCustomOptionsData')}</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default CustomOptionPricingRowV2
