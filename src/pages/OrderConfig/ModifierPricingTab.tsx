import React, { useState, useEffect } from 'react'
import { DollarSign, Pencil, Trash2, Info, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  SectionCard,
  SelectInput,
  Table,
  Btn,
  Badge,
  Modal,
  Field,
  EmptyState,
  Spinner,
  ConfirmDialog,
  toast,
  Tooltip,
  type Column
} from '@/components/ui-kit'
import { getCurrencySymbol } from '../../config/currencyConfig'
import {
  queryModifierSourcePrices,
  batchSaveModifierSourcePrices,
  deleteModifierSourcePrice,
  type ModifierPriceData
} from '../../services/channel-pricing'
import { itemManagementService } from '../../services/item-management'

interface ModifierPricingTabProps {
  sourceCode: string
  sourceName: string
}

interface ModifierPriceRow extends ModifierPriceData {
  key: string
  modified?: boolean
  newSourcePrice?: number
}

const ModifierPricingTab: React.FC<ModifierPricingTabProps> = ({
  sourceCode,
  sourceName
}) => {
  const { t } = useTranslation()
  const tk = (key: string, opts?: Record<string, any>): string => t(`pages.orderConfig.modifierPricing.${key}`, opts as any) as string
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string>('')
  const [modifierPrices, setModifierPrices] = useState<ModifierPriceRow[]>([])
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingPrice, setEditingPrice] = useState<ModifierPriceRow | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [editError, setEditError] = useState<string | undefined>()
  const [deletingRow, setDeletingRow] = useState<ModifierPriceRow | null>(null)

  // 加载商品列表
  useEffect(() => {
    loadItems()
  }, [])

  // 当选择商品时，加载该商品的自定义选项价格
  useEffect(() => {
    if (selectedItemId && sourceCode) {
      loadModifierPrices()
    }
  }, [selectedItemId, sourceCode])

  const loadItems = async () => {
    try {
      setLoading(true)
      const response = await itemManagementService.getItems({ limit: 1000 })
      setItems(response.data || [])
    } catch (error) {
      toast.error(tk('loadItemsFailed'))
    } finally {
      setLoading(false)
    }
  }

  const loadModifierPrices = async () => {
    try {
      setLoading(true)
      const response = await queryModifierSourcePrices(sourceCode, selectedItemId)

      if (response && response.prices) {
        const rows: ModifierPriceRow[] = response.prices.map((price, index) => ({
          ...price,
          key: `${price.itemId}-${price.modifierOptionId}-${index}`
        }))
        setModifierPrices(rows)
      } else {
        setModifierPrices([])
      }
    } catch (error) {
      toast.error(tk('loadModifierPricesFailed'))
      setModifierPrices([])
    } finally {
      setLoading(false)
    }
  }

  const handleEditPrice = (record: ModifierPriceRow) => {
    setEditingPrice(record)
    setEditValue(String(record.sourcePrice ?? record.finalPrice ?? ''))
    setEditError(undefined)
    setEditModalVisible(true)
  }

  const handleModalOk = () => {
    if (!editingPrice) return
    const newPrice = Number(editValue)
    if (editValue === '' || Number.isNaN(newPrice)) {
      setEditError(tk('pleaseEnterChannelPrice'))
      return
    }
    if (newPrice < 0) {
      setEditError(tk('priceCannotBeNegative'))
      return
    }

    setModifierPrices(prev => prev.map(item =>
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
      await deleteModifierSourcePrice(sourceCode, deletingRow.itemId, deletingRow.modifierOptionId)
      toast.success(tk('deleteSuccess'))
      setDeletingRow(null)
      loadModifierPrices()
    } catch (error) {
      toast.error(tk('deleteFailed'))
    }
  }

  const handleSaveAll = async () => {
    const modifiedPrices = modifierPrices.filter(p => p.modified && p.newSourcePrice !== undefined)

    if (modifiedPrices.length === 0) {
      toast.info(tk('noChangesToSave'))
      return
    }

    try {
      setSaving(true)
      const prices = modifiedPrices.map(p => ({
        itemId: p.itemId,
        modifierOptionId: p.modifierOptionId,
        price: p.newSourcePrice!
      }))

      await batchSaveModifierSourcePrices(sourceCode, prices)
      toast.success(tk('savedPricesSuccess', { count: prices.length }))
      await loadModifierPrices()
    } catch (error) {
      toast.error(tk('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const priceSourceBadge = (source: string) => {
    const map: Record<string, { variant: 'green' | 'gold' | 'default'; text: string }> = {
      source: { variant: 'green', text: tk('sourcePricingBadge') },
      item: { variant: 'gold', text: tk('itemPricingBadge') },
      default: { variant: 'default', text: tk('defaultPricingBadge') }
    }
    const cfg = map[source] || { variant: 'default' as const, text: source }
    return <Badge variant={cfg.variant}>{cfg.text}</Badge>
  }

  const columns: Column<ModifierPriceRow>[] = [
    {
      key: 'groupName',
      title: tk('groupNameColumn'),
      width: 150,
      render: (r) => <span className="font-medium text-slate-700">{r.groupName || '-'}</span>
    },
    {
      key: 'optionName',
      title: tk('optionNameColumn'),
      width: 150,
      render: (r) => <span className="text-slate-700">{r.optionName || '-'}</span>
    },
    {
      key: 'prices',
      title: (
        <span className="inline-flex items-center gap-1">
          {tk('pricePriorityLabel')}
          <Tooltip label={tk('pricePriorityTooltip')}><Info size={13} className="text-slate-400" /></Tooltip>
        </span>
      ),
      width: 300,
      render: (record) => (
        <div className="flex flex-col gap-0.5 text-xs">
          <span className="text-slate-400">{tk('defaultPriceLabel')}: {record.defaultPrice?.toFixed(2) || '0.00'}</span>
          {record.itemPrice !== undefined && record.itemPrice !== null && (
            <span className="text-amber-600">{tk('itemLevelLabel')}: {record.itemPrice.toFixed(2)}</span>
          )}
          {(record.sourcePrice !== undefined && record.sourcePrice !== null) || record.modified ? (
            <span className="text-green-600">
              {tk('channelPriceLabel')}: {(record.newSourcePrice ?? record.sourcePrice ?? 0).toFixed(2)}
              {record.modified && <span className="ml-2"><Badge variant="gold">{tk('modifiedBadge')}</Badge></span>}
            </span>
          ) : (
            <span className="text-slate-400">{tk('channelPriceLabel')}: {tk('notSetLabel')}</span>
          )}
        </div>
      )
    },
    {
      key: 'finalPrice',
      title: tk('finalPriceColumn'),
      width: 120,
      render: (record) => {
        const displayPrice = record.modified && record.newSourcePrice !== undefined
          ? record.newSourcePrice
          : record.finalPrice
        return (
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-slate-800">{displayPrice?.toFixed(2) || '0.00'}</span>
            {priceSourceBadge(record.priceSource)}
          </div>
        )
      }
    },
    {
      key: 'actions',
      title: t('pages.orderConfig.actions'),
      width: 150,
      render: (record) => (
        <div className="flex items-center gap-1">
          <Btn variant="link" size="sm" icon={<Pencil size={14} />} onClick={() => handleEditPrice(record)}>{tk('setChannelPriceBtn')}</Btn>
          {record.sourcePrice !== undefined && record.sourcePrice !== null && (
            <Btn variant="ghost" size="sm" icon={<Trash2 size={14} className="text-red-500" />} onClick={() => setDeletingRow(record)} />
          )}
        </div>
      )
    }
  ]

  const modifiedCount = modifierPrices.filter(p => p.modified).length

  return (
    <div>
      <SectionCard
        title={
          <span className="inline-flex items-center gap-2">
            <DollarSign size={18} className="text-slate-500" />
            <span className="text-lg font-semibold text-slate-800">{tk('pageTitle')}</span>
            <Badge variant="blue">{sourceName}</Badge>
          </span>
        }
        action={
          modifiedCount > 0 ? (
            <Btn variant="primary" icon={<Save size={16} />} loading={saving} onClick={handleSaveAll}>
              {tk('saveAllChangesBtn')} ({modifiedCount})
            </Btn>
          ) : undefined
        }
      >
        <div className="space-y-6">
          {/* 商品选择 */}
          <SectionCard title={tk('selectItemTitle')}>
            <SelectInput
              placeholder={tk('selectItemPlaceholder')}
              value={selectedItemId}
              onChange={setSelectedItemId}
              options={items.map(item => ({ value: item.id, label: `${item.name} (${item.basePrice})` }))}
            />
          </SectionCard>

          {/* 自定义选项价格表格 */}
          {selectedItemId ? (
            loading ? (
              <div className="py-10 text-center"><Spinner /></div>
            ) : modifierPrices.length > 0 ? (
              <Table columns={columns} data={modifierPrices} rowKey={(r) => r.key} />
            ) : (
              <EmptyState title={tk('noModifiersForItem')} />
            )
          ) : (
            <EmptyState title={tk('pleaseSelectItemFirst')} />
          )}
        </div>
      </SectionCard>

      {/* 编辑价格模态框 */}
      <Modal
        open={editModalVisible}
        onOpenChange={(o) => { if (!o) { setEditModalVisible(false); setEditingPrice(null) } }}
        title={tk('setModifierChannelPriceTitle')}
        footer={
          <>
            <Btn variant="secondary" onClick={() => { setEditModalVisible(false); setEditingPrice(null) }}>{t('pages.orderConfig.cancel')}</Btn>
            <Btn variant="primary" onClick={handleModalOk}>{t('pages.orderConfig.confirm')}</Btn>
          </>
        }
      >
        {editingPrice && (
          <div className="space-y-4">
            <div>
              <span className="text-slate-400">{tk('groupNameColumn')}：</span>
              <span className="font-medium text-slate-700">{editingPrice.groupName}</span>
            </div>
            <div>
              <span className="text-slate-400">{tk('optionNameColumn')}：</span>
              <span className="font-medium text-slate-700">{editingPrice.optionName}</span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3">
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">{tk('defaultPriceFullLabel')}: {editingPrice.defaultPrice?.toFixed(2) || '0.00'}</span>
                {editingPrice.itemPrice !== undefined && editingPrice.itemPrice !== null && (
                  <span className="text-amber-600">{tk('itemLevelPriceFullLabel')}: {editingPrice.itemPrice.toFixed(2)}</span>
                )}
                {editingPrice.sourcePrice !== undefined && editingPrice.sourcePrice !== null && (
                  <span className="text-green-600">{tk('currentChannelPriceLabel')}: {editingPrice.sourcePrice.toFixed(2)}</span>
                )}
              </div>
            </div>

            <Field label={tk('newChannelPriceLabel')} required error={editError}>
              <div className="flex items-center rounded-lg border border-slate-200 bg-white px-3 focus-within:outline-2 focus-within:outline-slate-900">
                <span className="text-sm text-slate-400">{getCurrencySymbol()}</span>
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder={tk('enterPricePlaceholder')}
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
        title={tk('confirmDeleteTitle')}
        description={tk('confirmDeleteDesc')}
        danger
        onConfirm={handleDeletePrice}
      />
    </div>
  )
}

export default ModifierPricingTab
