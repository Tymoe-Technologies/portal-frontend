import React, { useState, useEffect } from 'react'
import { CheckCircle2, Info, Pencil } from 'lucide-react'
import {
  getTaxRates,
  getTaxClasses,
  createTaxRateOverride,
  type TaxRate,
  type TaxClass,
} from '../../services/item-management'
import {
  Table, type Column, AlertBox, Spinner, Modal, NumberInput, Textarea, Btn, FormRow, toast,
} from '@/components/ui-kit'

interface TaxRateListProps {
  regionCode: string
}

/**
 * 税率列表组件
 * 显示某地区的所有税率，包括系统预设和租户覆盖
 */
const TaxRateList: React.FC<TaxRateListProps> = ({ regionCode }) => {
  const [loading, setLoading] = useState(false)
  const [taxRates, setTaxRates] = useState<TaxRate[]>([])
  const [taxClasses, setTaxClasses] = useState<TaxClass[]>([])
  const [overrideModalVisible, setOverrideModalVisible] = useState(false)
  const [selectedRate, setSelectedRate] = useState<TaxRate | null>(null)
  const [rateValue, setRateValue] = useState<number>(0)
  const [overrideReason, setOverrideReason] = useState('')
  const [formError, setFormError] = useState('')

  // 加载税率数据
  const loadTaxRates = async () => {
    if (!regionCode) return
    setLoading(true)
    try {
      const [rates, classes] = await Promise.all([getTaxRates(regionCode), getTaxClasses(regionCode)])
      setTaxRates(rates)
      setTaxClasses(classes)
    } catch (error: any) {
      toast.error(`加载税率失败: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTaxRates()
  }, [regionCode])

  // 打开覆盖税率对话框
  const handleOverrideClick = (rate: TaxRate) => {
    setSelectedRate(rate)
    setRateValue(rate.rate)
    setOverrideReason('')
    setFormError('')
    setOverrideModalVisible(true)
  }

  // 提交税率覆盖
  const handleOverrideSubmit = async () => {
    if (rateValue == null || rateValue < 0 || rateValue > 100) { setFormError('税率必须在 0-100 之间'); return }
    if (!overrideReason.trim()) { setFormError('请说明覆盖原因'); return }
    setFormError('')
    if (!selectedRate) return
    try {
      await createTaxRateOverride({
        regionCode,
        taxType: selectedRate.taxType,
        rate: rateValue,
        basedOnDefaultId: selectedRate.id,
        overrideReason,
      })
      toast.success('税率覆盖设置成功')
      setOverrideModalVisible(false)
      loadTaxRates()
    } catch (error: any) {
      toast.error(`设置税率覆盖失败: ${error.message}`)
    }
  }

  const blueTag = (text: string) => <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 bg-blue-50 text-blue-600 ring-blue-200">{text}</span>

  // 税率表格列定义
  const taxRateColumns: Column<TaxRate>[] = [
    { key: 'name', title: '税率名称', width: 200, render: (r) => r.name },
    { key: 'taxType', title: '税种', width: 120, render: (r) => blueTag(r.taxType) },
    { key: 'rate', title: '税率', width: 100, render: (r) => <span className="font-semibold text-slate-800">{(r.rate * 100).toFixed(2)}%</span> },
    {
      key: 'foodExempt', title: '食品免税', width: 100, align: 'center',
      render: (r) => (r.foodExempt ? <CheckCircle2 className="w-[18px] h-[18px] text-green-500 mx-auto" /> : <span className="text-slate-300">-</span>),
    },
    {
      key: 'source', title: '来源', width: 160,
      render: (r) => (
        <div className="flex flex-col gap-1">
          <span className={`inline-flex w-fit items-center text-xs px-1.5 py-0.5 rounded ring-1 ${r.source === 'SYSTEM_DEFAULT' ? 'bg-slate-100 text-slate-600 ring-slate-200' : 'bg-amber-50 text-amber-600 ring-amber-200'}`}>
            {r.source === 'SYSTEM_DEFAULT' ? '系统预设' : '租户覆盖'}
          </span>
          {r.isOverridden && r.overrideReason && (
            <span className="text-xs text-slate-500 inline-flex items-center gap-1"><Info className="w-3 h-3" /> {r.overrideReason}</span>
          )}
        </div>
      ),
    },
    { key: 'effectiveDate', title: '生效日期', width: 120, render: (r) => (r.effectiveDate ? new Date(r.effectiveDate).toLocaleDateString() : '-') },
    { key: 'expiresDate', title: '失效日期', width: 120, render: (r) => (r.expiresDate ? new Date(r.expiresDate).toLocaleDateString() : '-') },
    { key: 'action', title: '操作', width: 100, render: (r) => <Btn variant="link" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => handleOverrideClick(r)}>覆盖</Btn> },
  ]

  // 税类表格列定义
  const taxClassColumns: Column<TaxClass>[] = [
    { key: 'name', title: '税类名称', width: 200, render: (r) => r.name },
    { key: 'description', title: '描述', render: (r) => r.description },
    {
      key: 'rates', title: '包含的税率',
      render: (r: any) => (
        <div className="flex flex-col gap-1">
          {(r.rates || []).map((rate: any, index: number) => (
            <div key={index} className="flex items-center gap-1.5">
              {blueTag(rate.taxRate.taxType)}
              <span className="text-slate-700">{rate.taxRate.name}</span>
              <span className="font-semibold text-slate-800"> ({(rate.taxRate.rate * 100).toFixed(2)}%)</span>
              {rate.compoundPrevious && <span className="ml-2 text-xs px-1.5 py-0.5 rounded ring-1 bg-amber-50 text-amber-600 ring-amber-200">复合税</span>}
            </div>
          ))}
        </div>
      ),
    },
  ]

  return (
    <div>
      {loading && <div className="py-3"><Spinner className="w-6 h-6 text-slate-400" /></div>}
      <div className="space-y-6">
        {/* 说明信息 */}
        <AlertBox
          type="info"
          title="税率说明"
          description={
            <div className="space-y-1">
              <p>• <strong>系统预设税率</strong>：由系统维护的标准税率，会随官方税率变化自动更新</p>
              <p>• <strong>租户覆盖</strong>：租户可以自定义税率覆盖系统预设，适用于特殊场景</p>
              <p>• <strong>食品免税</strong>：某些地区的食品类商品享受税率豁免</p>
              <p>• <strong>税类</strong>：预定义的税率组合，可直接应用到商品</p>
            </div>
          }
        />

        {/* 税率列表 */}
        <div>
          <h4 className="text-base font-semibold text-slate-800 mb-3">税率列表</h4>
          <Table columns={taxRateColumns} data={taxRates} rowKey={(r) => r.id} />
        </div>

        {/* 税类列表 */}
        <div className="mt-6">
          <h4 className="text-base font-semibold text-slate-800 mb-3">税类列表</h4>
          <Table columns={taxClassColumns} data={taxClasses} rowKey={(r) => r.id} />
        </div>
      </div>

      {/* 税率覆盖对话框 */}
      <Modal
        title={`覆盖税率: ${selectedRate?.name ?? ''}`}
        open={overrideModalVisible}
        onOpenChange={(o) => !o && setOverrideModalVisible(false)}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setOverrideModalVisible(false)}>取消</Btn>
            <Btn variant="primary" onClick={handleOverrideSubmit}>确定</Btn>
          </div>
        }
      >
        <div className="space-y-4">
          <AlertBox type="warning" title="注意" description="覆盖系统预设税率后，该地区的此税种将使用您设置的自定义税率，而不是系统维护的标准税率。" />
          <FormRow label="原税率">
            <span className="font-semibold text-slate-800">{selectedRate ? `${(selectedRate.rate * 100).toFixed(2)}%` : ''}</span>
          </FormRow>
          <FormRow label="新税率 (%)">
            <NumberInput value={rateValue} onChange={setRateValue} min={0} max={100} suffix="%" />
          </FormRow>
          <FormRow label="覆盖原因">
            <Textarea className="w-full" rows={3} value={overrideReason} onChange={setOverrideReason} placeholder="请说明为什么需要覆盖系统预设税率" />
          </FormRow>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
        </div>
      </Modal>
    </div>
  )
}

export default TaxRateList
