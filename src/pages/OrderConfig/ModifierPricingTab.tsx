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
  const { t: _t } = useTranslation()
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
      toast.error('加载商品列表失败')
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
      toast.error('加载自定义选项价格失败')
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
      setEditError('请输入渠道价格')
      return
    }
    if (newPrice < 0) {
      setEditError('价格不能为负数')
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
      toast.success('删除成功')
      setDeletingRow(null)
      loadModifierPrices()
    } catch (error) {
      toast.error('删除失败')
    }
  }

  const handleSaveAll = async () => {
    const modifiedPrices = modifierPrices.filter(p => p.modified && p.newSourcePrice !== undefined)

    if (modifiedPrices.length === 0) {
      toast.info('没有修改需要保存')
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
      toast.success(`成功保存 ${prices.length} 个自定义选项价格`)
      await loadModifierPrices()
    } catch (error) {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const priceSourceBadge = (source: string) => {
    const map: Record<string, { variant: 'green' | 'gold' | 'default'; text: string }> = {
      source: { variant: 'green', text: '渠道定价' },
      item: { variant: 'gold', text: '商品定价' },
      default: { variant: 'default', text: '默认价格' }
    }
    const cfg = map[source] || { variant: 'default' as const, text: source }
    return <Badge variant={cfg.variant}>{cfg.text}</Badge>
  }

  const columns: Column<ModifierPriceRow>[] = [
    {
      key: 'groupName',
      title: '自定义选项组',
      width: 150,
      render: (r) => <span className="font-medium text-slate-700">{r.groupName || '-'}</span>
    },
    {
      key: 'optionName',
      title: '选项名称',
      width: 150,
      render: (r) => <span className="text-slate-700">{r.optionName || '-'}</span>
    },
    {
      key: 'prices',
      title: (
        <span className="inline-flex items-center gap-1">
          价格优先级
          <span title="价格计算优先级：渠道价格 > 商品级价格 > 默认价格"><Info size={13} className="text-slate-400" /></span>
        </span>
      ),
      width: 300,
      render: (record) => (
        <div className="flex flex-col gap-0.5 text-xs">
          <span className="text-slate-400">默认: {record.defaultPrice?.toFixed(2) || '0.00'}</span>
          {record.itemPrice !== undefined && record.itemPrice !== null && (
            <span className="text-amber-600">商品级: {record.itemPrice.toFixed(2)}</span>
          )}
          {(record.sourcePrice !== undefined && record.sourcePrice !== null) || record.modified ? (
            <span className="text-green-600">
              渠道价: {(record.newSourcePrice ?? record.sourcePrice ?? 0).toFixed(2)}
              {record.modified && <span className="ml-2"><Badge variant="gold">已修改</Badge></span>}
            </span>
          ) : (
            <span className="text-slate-400">渠道价: 未设置</span>
          )}
        </div>
      )
    },
    {
      key: 'finalPrice',
      title: '最终价格',
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
      title: '操作',
      width: 150,
      render: (record) => (
        <div className="flex items-center gap-1">
          <Btn variant="link" size="sm" icon={<Pencil size={14} />} onClick={() => handleEditPrice(record)}>设置渠道价</Btn>
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
            <span className="text-lg font-semibold text-slate-800">自定义选项渠道定价</span>
            <Badge variant="blue">{sourceName}</Badge>
          </span>
        }
        action={
          modifiedCount > 0 ? (
            <Btn variant="primary" icon={<Save size={16} />} loading={saving} onClick={handleSaveAll}>
              保存所有修改 ({modifiedCount})
            </Btn>
          ) : undefined
        }
      >
        <div className="space-y-6">
          {/* 商品选择 */}
          <SectionCard title="选择商品">
            <SelectInput
              placeholder="请选择商品以查看其自定义选项价格"
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
              <EmptyState title="该商品没有关联的自定义选项" />
            )
          ) : (
            <EmptyState title="请先选择一个商品" />
          )}
        </div>
      </SectionCard>

      {/* 编辑价格模态框 */}
      <Modal
        open={editModalVisible}
        onOpenChange={(o) => { if (!o) { setEditModalVisible(false); setEditingPrice(null) } }}
        title="设置自定义选项渠道价格"
        footer={
          <>
            <Btn variant="secondary" onClick={() => { setEditModalVisible(false); setEditingPrice(null) }}>取消</Btn>
            <Btn variant="primary" onClick={handleModalOk}>确定</Btn>
          </>
        }
      >
        {editingPrice && (
          <div className="space-y-4">
            <div>
              <span className="text-slate-400">自定义选项组：</span>
              <span className="font-medium text-slate-700">{editingPrice.groupName}</span>
            </div>
            <div>
              <span className="text-slate-400">选项名称：</span>
              <span className="font-medium text-slate-700">{editingPrice.optionName}</span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3">
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">默认价格: {editingPrice.defaultPrice?.toFixed(2) || '0.00'}</span>
                {editingPrice.itemPrice !== undefined && editingPrice.itemPrice !== null && (
                  <span className="text-amber-600">商品级价格: {editingPrice.itemPrice.toFixed(2)}</span>
                )}
                {editingPrice.sourcePrice !== undefined && editingPrice.sourcePrice !== null && (
                  <span className="text-green-600">当前渠道价: {editingPrice.sourcePrice.toFixed(2)}</span>
                )}
              </div>
            </div>

            <Field label="新的渠道价格" required error={editError}>
              <div className="flex items-center rounded-lg border border-slate-200 bg-white px-3 focus-within:outline-2 focus-within:outline-slate-900">
                <span className="text-sm text-slate-400">{getCurrencySymbol()}</span>
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="请输入价格"
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
        title="确认删除"
        description="确定要删除此自定义选项的渠道价格吗？"
        danger
        onConfirm={handleDeletePrice}
      />
    </div>
  )
}

export default ModifierPricingTab
