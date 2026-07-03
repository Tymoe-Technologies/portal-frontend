import React, { useState, useEffect } from 'react'
import { Calculator, Search } from 'lucide-react'
import {
  getItems,
  calculateBatchItemTax,
  type Item,
  type TaxCalculationResult,
} from '../../services/item-management'
import {
  Table, type Column, Btn, AlertBox, Checkbox, SectionCard, toast,
} from '@/components/ui-kit'

interface BatchTaxCalculationProps {
  regionCode: string
}

interface ItemWithTax extends Item {
  taxResult?: TaxCalculationResult
}

/**
 * 批量税费计算组件
 * 批量计算多个商品的税后价格
 */
const BatchTaxCalculation: React.FC<BatchTaxCalculationProps> = ({ regionCode }) => {
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [items, setItems] = useState<ItemWithTax[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const loadItems = async () => {
    setLoading(true)
    try {
      const response = await getItems({ isActive: true, limit: 100 })
      setItems(response.data)
    } catch (error: any) {
      toast.error(`加载商品失败: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])

  const toggleRow = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const allSelected = items.length > 0 && items.every(i => selected.has(i.id))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map(i => i.id)))

  const handleBatchCalculate = async () => {
    if (selected.size === 0) {
      toast.warning('请先选择要计算的商品')
      return
    }
    setCalculating(true)
    try {
      const itemIds = [...selected]
      const results = await calculateBatchItemTax(itemIds, regionCode)
      setItems(prev => prev.map(item => {
        const taxResult = results.find(r => r.itemId === item.id)
        return taxResult ? { ...item, taxResult } : item
      }))
      toast.success(`成功计算 ${results.length} 个商品的税费`)
    } catch (error: any) {
      toast.error(`批量计算失败: ${error.message}`)
    } finally {
      setCalculating(false)
    }
  }

  const notCalc = <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 bg-slate-100 text-slate-500 ring-slate-200">未计算</span>

  const columns: Column<ItemWithTax>[] = [
    {
      key: 'select', title: <Checkbox checked={allSelected} onCheckedChange={toggleAll} />, width: 44,
      render: (r) => <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleRow(r.id)} />,
    },
    { key: 'name', title: '商品名称', width: 200, render: (r) => r.name },
    { key: 'basePrice', title: '基础价格', width: 120, render: (r) => <span className="font-semibold text-slate-800">${(r.basePrice / 100).toFixed(2)}</span> },
    { key: 'tax', title: '税费', width: 120, render: (r) => (r.taxResult ? <span className="font-semibold text-red-600">{r.taxResult.totalTaxDisplay}</span> : notCalc) },
    { key: 'finalPrice', title: '含税价格', width: 120, render: (r) => (r.taxResult ? <span className="font-semibold text-base text-green-600">{r.taxResult.finalPriceDisplay}</span> : notCalc) },
    {
      key: 'taxDetails', title: '税率明细',
      render: (r) => (!r.taxResult ? notCalc : (
        <div className="flex flex-col gap-1">
          {r.taxResult.taxes.map((tax, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 bg-blue-50 text-blue-600 ring-blue-200">{tax.taxType}</span>
              <span className="text-slate-700">{tax.taxName}: </span>
              <span className="font-semibold text-slate-800">{tax.amountDisplay}</span>
              <span className="text-slate-500"> ({(tax.rate * 100).toFixed(2)}%)</span>
            </div>
          ))}
        </div>
      )),
    },
  ]

  return (
    <div>
      <div className="mb-4">
        <AlertBox type="info" title="批量税费计算说明" description="选择多个商品后，可以一次性计算它们在指定地区的税后价格。计算结果会显示每个商品的税费明细和最终价格。" />
      </div>

      <div className="flex gap-2 mb-4">
        <Btn variant="primary" icon={<Calculator className="w-3.5 h-3.5" />} loading={calculating} disabled={selected.size === 0} onClick={handleBatchCalculate}>
          批量计算税费 ({selected.size} 个商品)
        </Btn>
        <Btn variant="secondary" icon={<Search className="w-3.5 h-3.5" />} onClick={loadItems}>刷新商品列表</Btn>
      </div>

      <Table columns={columns} data={items} rowKey={(r) => r.id} loading={loading} />

      {/* 统计信息 */}
      {items.some(item => item.taxResult) && (
        <div className="mt-4">
          <SectionCard>
            <h5 className="text-base font-semibold text-slate-800 mb-2">计算统计</h5>
            <div className="flex flex-col gap-1 text-sm text-slate-700">
              <div>已计算商品数: <span className="font-semibold">{items.filter(item => item.taxResult).length}</span></div>
              <div>总税费: <span className="font-semibold text-red-600">${(items.filter(item => item.taxResult).reduce((sum, item) => sum + (item.taxResult?.totalTax || 0), 0) / 100).toFixed(2)}</span></div>
              <div>总含税价格: <span className="font-semibold text-green-600">${(items.filter(item => item.taxResult).reduce((sum, item) => sum + (item.taxResult?.finalPrice || 0), 0) / 100).toFixed(2)}</span></div>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  )
}

export default BatchTaxCalculation
