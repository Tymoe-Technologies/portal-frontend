import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      toast.error(t('pages.taxManagement.batchTaxCalc.loadItemsFailed', { message: error.message }))
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
      toast.warning(t('pages.taxManagement.batchTaxCalc.selectItemsFirst'))
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
      toast.success(t('pages.taxManagement.batchTaxCalc.calcSuccessCount', { count: results.length }))
    } catch (error: any) {
      toast.error(t('pages.taxManagement.batchTaxCalc.batchCalcFailed', { message: error.message }))
    } finally {
      setCalculating(false)
    }
  }

  const notCalc = <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 bg-slate-100 text-slate-500 ring-slate-200">{t('pages.taxManagement.batchTaxCalc.notCalculated')}</span>

  const columns: Column<ItemWithTax>[] = [
    {
      key: 'select', title: <Checkbox checked={allSelected} onCheckedChange={toggleAll} />, width: 44,
      render: (r) => <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleRow(r.id)} />,
    },
    { key: 'name', title: t('pages.taxManagement.itemTaxClass.colItemName'), width: 200, render: (r) => r.name },
    { key: 'basePrice', title: t('pages.taxManagement.itemTaxClass.colBasePrice'), width: 120, render: (r) => <span className="font-semibold text-slate-800">${(r.basePrice / 100).toFixed(2)}</span> },
    { key: 'tax', title: t('pages.taxManagement.batchTaxCalc.colTax'), width: 120, render: (r) => (r.taxResult ? <span className="font-semibold text-red-600">{r.taxResult.totalTaxDisplay}</span> : notCalc) },
    { key: 'finalPrice', title: t('pages.taxManagement.batchTaxCalc.colFinalPrice'), width: 120, render: (r) => (r.taxResult ? <span className="font-semibold text-base text-green-600">{r.taxResult.finalPriceDisplay}</span> : notCalc) },
    {
      key: 'taxDetails', title: t('pages.taxManagement.batchTaxCalc.colTaxDetails'),
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
        <AlertBox type="info" title={t('pages.taxManagement.batchTaxCalc.explanationTitle')} description={t('pages.taxManagement.batchTaxCalc.explanationDesc')} />
      </div>

      <div className="flex gap-2 mb-4">
        <Btn variant="primary" icon={<Calculator className="w-3.5 h-3.5" />} loading={calculating} disabled={selected.size === 0} onClick={handleBatchCalculate}>
          {t('pages.taxManagement.batchTaxCalc.batchCalcBtn', { count: selected.size })}
        </Btn>
        <Btn variant="secondary" icon={<Search className="w-3.5 h-3.5" />} onClick={loadItems}>{t('pages.taxManagement.batchTaxCalc.refreshItemsBtn')}</Btn>
      </div>

      <Table columns={columns} data={items} rowKey={(r) => r.id} loading={loading} />

      {/* 统计信息 */}
      {items.some(item => item.taxResult) && (
        <div className="mt-4">
          <SectionCard>
            <h5 className="text-base font-semibold text-slate-800 mb-2">{t('pages.taxManagement.batchTaxCalc.calcStatsTitle')}</h5>
            <div className="flex flex-col gap-1 text-sm text-slate-700">
              <div>{t('pages.taxManagement.batchTaxCalc.calculatedCountLabel')}<span className="font-semibold">{items.filter(item => item.taxResult).length}</span></div>
              <div>{t('pages.taxManagement.batchTaxCalc.totalTaxLabel')}<span className="font-semibold text-red-600">${(items.filter(item => item.taxResult).reduce((sum, item) => sum + (item.taxResult?.totalTax || 0), 0) / 100).toFixed(2)}</span></div>
              <div>{t('pages.taxManagement.batchTaxCalc.totalFinalPriceLabel')}<span className="font-semibold text-green-600">${(items.filter(item => item.taxResult).reduce((sum, item) => sum + (item.taxResult?.finalPrice || 0), 0) / 100).toFixed(2)}</span></div>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  )
}

export default BatchTaxCalculation
