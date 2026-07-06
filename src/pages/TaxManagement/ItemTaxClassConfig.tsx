import React, { useState, useEffect } from 'react'
import { Settings, Search } from 'lucide-react'
import {
  getItems,
  getTaxClasses,
  getItemTaxClass,
  addMultipleItemTaxClasses,
  calculateItemTax,
  type Item,
  type TaxClass,
  type TaxCalculationResult
} from '../../services/item-management'
import { formatPrice } from '../../utils/priceConverter'
import { Table, Btn, Modal, Badge, Checkbox, AlertBox, TextInput, toast, type Column } from '@/components/ui-kit'

interface ItemTaxClassConfigProps {
  regionCode: string
}

interface ItemWithTaxInfo extends Item {
  taxClassIds?: string[]
  taxClassNames?: string[]
  calculatedTax?: number
  finalPrice?: number
}

/**
 * 商品税类配置组件
 * 为商品分配税类并计算含税价格
 */
const ItemTaxClassConfig: React.FC<ItemTaxClassConfigProps> = ({ regionCode }) => {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<ItemWithTaxInfo[]>([])
  const [taxClasses, setTaxClasses] = useState<TaxClass[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ItemWithTaxInfo | null>(null)
  const [selectedTaxClassIds, setSelectedTaxClassIds] = useState<string[]>([])
  const [searchText, setSearchText] = useState<string>('')
  const [taxResult, setTaxResult] = useState<TaxCalculationResult | null>(null)

  // 加载商品列表
  const loadItems = async () => {
    setLoading(true)
    try {
      const response = await getItems({ isActive: true, limit: 100 })
      const itemsWithTax: ItemWithTaxInfo[] = []

      // 为每个商品加载税类信息
      for (const item of response.data) {
        try {
          const taxInfo = await getItemTaxClass(item.id)
          itemsWithTax.push({
            ...item,
            taxClassIds: taxInfo.taxes?.map(t => t.id) || [],
            taxClassNames: taxInfo.taxes?.map(t => t.name) || []
          })
        } catch {
          // 如果没有配置税类，直接添加商品
          itemsWithTax.push(item)
        }
      }

      setItems(itemsWithTax)
    } catch (error: any) {
      toast.error(`加载商品失败: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // 加载税类列表
  const loadTaxClasses = async () => {
    if (!regionCode) return

    try {
      const classes = await getTaxClasses(regionCode)
      setTaxClasses(classes)
    } catch (error: any) {
      toast.error(`加载税类失败: ${error.message}`)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])

  useEffect(() => {
    loadTaxClasses()
  }, [regionCode])

  // 打开配置对话框
  const handleConfigClick = (item: ItemWithTaxInfo) => {
    setSelectedItem(item)
    setSelectedTaxClassIds(item.taxClassIds || [])
    setTaxResult(null)
    setModalVisible(true)
  }

  // 切换税类勾选
  const toggleTaxClass = (id: string, checked: boolean) => {
    setSelectedTaxClassIds(prev => checked ? [...prev, id] : prev.filter(x => x !== id))
  }

  // 计算税费
  const handleCalculateTax = async () => {
    if (!selectedItem) return

    try {
      const result = await calculateItemTax(selectedItem.id, regionCode)
      setTaxResult(result)
    } catch (error: any) {
      toast.error(`计算税费失败: ${error.message}`)
    }
  }

  // 保存税类配置
  const handleSave = async () => {
    if (!selectedItem || selectedTaxClassIds.length === 0) {
      toast.warning('请选择至少一个税类')
      return
    }

    try {
      await addMultipleItemTaxClasses(selectedItem.id, { taxClassIds: selectedTaxClassIds })
      toast.success('税类配置成功')
      setModalVisible(false)
      loadItems()
    } catch (error: any) {
      toast.error(`配置失败: ${error.message}`)
    }
  }

  // 筛选商品
  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchText.toLowerCase())
  )

  // 表格列定义
  const columns: Column<ItemWithTaxInfo>[] = [
    {
      key: 'name',
      title: '商品名称',
      width: 200,
      render: (r) => r.name
    },
    {
      key: 'basePrice',
      title: '基础价格',
      width: 120,
      render: (r) => <span className="font-medium text-slate-700">{formatPrice(r.basePrice)}</span>
    },
    {
      key: 'taxClassNames',
      title: '税类',
      width: 200,
      render: (r) =>
        r.taxClassNames && r.taxClassNames.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {r.taxClassNames.map((name, idx) => (
              <Badge key={idx} variant="blue">{name}</Badge>
            ))}
          </div>
        ) : (
          <Badge variant="default">未配置</Badge>
        )
    },
    {
      key: 'isActive',
      title: '状态',
      width: 100,
      align: 'center',
      render: (r) => (
        <Badge variant={r.isActive ? 'green' : 'default'}>{r.isActive ? '启用' : '禁用'}</Badge>
      )
    },
    {
      key: 'action',
      title: '操作',
      width: 120,
      render: (record) => (
        <Btn variant="link" size="sm" icon={<Settings size={14} />} onClick={() => handleConfigClick(record)}>配置税类</Btn>
      )
    }
  ]

  return (
    <div>
      {/* 搜索栏 */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative w-80">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <TextInput
            placeholder="搜索商品名称"
            value={searchText}
            onChange={setSearchText}
            className="pl-9!"
          />
        </div>
        <Btn variant="primary" onClick={loadItems}>刷新</Btn>
      </div>

      {/* 商品列表 */}
      <Table
        columns={columns}
        data={filteredItems}
        rowKey={(r) => r.id}
        loading={loading}
      />

      {/* 配置对话框 */}
      <Modal
        open={modalVisible}
        onOpenChange={(o) => { if (!o) setModalVisible(false) }}
        size="lg"
        title={`配置商品税类: ${selectedItem?.name || ''}`}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setModalVisible(false)}>取消</Btn>
            <Btn variant="primary" onClick={handleSave}>保存</Btn>
          </>
        }
      >
        <div className="space-y-6">
          {/* 商品基本信息 */}
          <div>
            <span className="text-slate-400">商品基础价格：</span>
            <span className="ml-2 text-base font-medium text-slate-700">
              {selectedItem && formatPrice(selectedItem.basePrice)}
            </span>
          </div>

          {/* 税类选择（多选） */}
          <div>
            <div className="mb-2 font-medium text-slate-700">选择税类（可多选）：</div>
            {taxClasses.length === 0 ? (
              <div className="text-sm text-slate-400">暂无可用税类</div>
            ) : (
              <div className="space-y-2">
                {taxClasses.map(taxClass => (
                  <label
                    key={taxClass.id}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 hover:border-slate-300"
                  >
                    <Checkbox
                      checked={selectedTaxClassIds.includes(taxClass.id)}
                      onCheckedChange={(c) => toggleTaxClass(taxClass.id, c)}
                    />
                    <div className="flex-1">
                      <div>
                        <span className="font-medium text-slate-700">{taxClass.name}</span>
                        {taxClass.description && (
                          <span className="ml-2 text-xs text-slate-400">({taxClass.description})</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {taxClass.rates.map((rate, idx) => (
                          <Badge key={idx} variant="blue">{rate.taxType}: {(rate.rate * 100).toFixed(2)}%</Badge>
                        ))}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 计算税费按钮 */}
          <Btn variant="secondary" onClick={handleCalculateTax} disabled={selectedTaxClassIds.length === 0} className="w-full">
            预览税费计算
          </Btn>

          {/* 税费计算结果 */}
          {taxResult && (
            <AlertBox
              type="success"
              title="税费计算结果"
              description={
                <div className="space-y-1">
                  <div><span>基础价格：</span><span className="font-medium">{taxResult.basePriceDisplay}</span></div>

                  {taxResult.taxes.map((tax, idx) => (
                    <div key={idx}>
                      <span>{tax.taxName} ({tax.taxType})：</span>
                      <span className="font-medium">{tax.amountDisplay}</span>
                      <span className="text-slate-400"> ({(tax.rate * 100).toFixed(2)}%)</span>
                    </div>
                  ))}

                  <div className="mt-2 border-t border-slate-200 pt-2">
                    <span>总税费：</span>
                    <span className="font-medium text-red-500">{taxResult.totalTaxDisplay}</span>
                  </div>

                  <div>
                    <span>最终价格：</span>
                    <span className="text-base font-medium text-green-600">{taxResult.finalPriceDisplay}</span>
                  </div>
                </div>
              }
            />
          )}
        </div>
      </Modal>
    </div>
  )
}

export default ItemTaxClassConfig
