import React, { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  getTaxClasses,
  getTaxRates,
  createTenantTaxClass,
  type TaxClass,
  type TaxRate,
  type CreateTenantTaxClassPayload,
} from '../../services/item-management'
import {
  Table, type Column, Btn, Modal, TextInput, Textarea, NumberInput, SelectInput, AlertBox, FormRow, toast,
} from '@/components/ui-kit'

interface TenantTaxClassManagementProps {
  regionCode: string
}

interface RateRow {
  taxType: string
  rate: number
  compoundPrevious: boolean
}

/**
 * 租户自定义税类管理组件
 * 允许租户创建和管理自定义税类
 */
const TenantTaxClassManagement: React.FC<TenantTaxClassManagementProps> = ({ regionCode }) => {
  const [loading, setLoading] = useState(false)
  const [taxClasses, setTaxClasses] = useState<TaxClass[]>([])
  const [availableTaxRates, setAvailableTaxRates] = useState<TaxRate[]>([])
  const [modalVisible, setModalVisible] = useState(false)

  // 表单状态
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rates, setRates] = useState<RateRow[]>([])
  const [formError, setFormError] = useState('')

  const loadData = async () => {
    if (!regionCode) return
    setLoading(true)
    try {
      const [classes, rateList] = await Promise.all([getTaxClasses(regionCode), getTaxRates(regionCode)])
      setTaxClasses(classes)
      setAvailableTaxRates(rateList)
    } catch (error: any) {
      toast.error(`加载数据失败: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [regionCode])

  const handleCreateClick = () => {
    setName('')
    setDescription('')
    setRates([])
    setFormError('')
    setModalVisible(true)
  }

  const setRate = (index: number, patch: Partial<RateRow>) =>
    setRates(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))

  const handleSubmit = async () => {
    if (!name.trim()) { setFormError('请输入税类名称'); return }
    if (rates.length === 0) { setFormError('至少添加一个税率'); return }
    if (rates.some(r => !r.taxType)) { setFormError('请为每一行选择税种'); return }
    setFormError('')
    try {
      const payload: CreateTenantTaxClassPayload = {
        name,
        description,
        regionCode,
        rates: rates.map((rateConfig, index) => ({
          taxType: rateConfig.taxType,
          rate: rateConfig.rate / 100, // 转换为小数
          applyOrder: index + 1,
          compoundPrevious: rateConfig.compoundPrevious || false,
        })),
      }
      await createTenantTaxClass(payload)
      toast.success('自定义税类创建成功')
      setModalVisible(false)
      loadData()
    } catch (error: any) {
      toast.error(`创建失败: ${error.message}`)
    }
  }

  const blueTag = (text: string) => <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 bg-blue-50 text-blue-600 ring-blue-200">{text}</span>

  const columns: Column<TaxClass>[] = [
    { key: 'name', title: '税类名称', width: 200, render: (r) => r.name },
    { key: 'description', title: '描述', width: 250, render: (r) => r.description },
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
    // 类型：原 purple 标签，改 slate（严禁紫色）
    { key: 'type', title: '类型', width: 120, render: () => <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 bg-slate-100 text-slate-600 ring-slate-200">租户自定义</span> },
  ]

  return (
    <div>
      <div className="mb-4">
        <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleCreateClick}>创建自定义税类</Btn>
      </div>

      <div className="mb-4">
        <AlertBox type="info" title="租户自定义税类说明" description="您可以根据业务需求创建自定义税类组合。自定义税类仅在当前租户下可用，不会影响系统预设税类。" />
      </div>

      <Table columns={columns} data={taxClasses} rowKey={(r) => r.id} loading={loading} />

      {/* 创建税类对话框 */}
      <Modal
        title="创建自定义税类"
        open={modalVisible}
        onOpenChange={(o) => !o && setModalVisible(false)}
        size="xl"
        footer={
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setModalVisible(false)}>取消</Btn>
            <Btn variant="primary" onClick={handleSubmit}>创建</Btn>
          </div>
        }
      >
        <div className="space-y-4">
          <FormRow label="税类名称">
            <TextInput className="w-full" value={name} onChange={setName} placeholder="例如: 特殊商品税类" />
          </FormRow>
          <FormRow label="描述">
            <Textarea className="w-full" rows={2} value={description} onChange={setDescription} placeholder="描述该税类的用途和适用场景" />
          </FormRow>

          <div>
            <div className="text-sm text-slate-600 mb-1.5">税率配置</div>
            <AlertBox type="info" title="税率计算顺序" description="税率将按照添加顺序依次计算。如果选择'复合税'，该税率将基于前面税率计算后的金额计算。" />

            <div className="mt-3 space-y-2">
              {rates.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-40">
                    <SelectInput className="w-full" placeholder="选择税种" value={row.taxType} onChange={(v) => setRate(index, { taxType: String(v) })}
                      options={availableTaxRates.map(r => ({ label: r.taxType, value: r.taxType }))} />
                  </div>
                  <NumberInput value={row.rate} onChange={(v) => setRate(index, { rate: v })} min={0} max={100} suffix="%" />
                  <div className="w-32">
                    <SelectInput className="w-full" value={row.compoundPrevious ? 'true' : 'false'} onChange={(v) => setRate(index, { compoundPrevious: v === 'true' })}
                      options={[{ label: '普通税', value: 'false' }, { label: '复合税', value: 'true' }]} />
                  </div>
                  <Btn variant="link" onClick={() => setRates(prev => prev.filter((_, i) => i !== index))}>删除</Btn>
                </div>
              ))}

              <Btn variant="secondary" className="w-full" icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setRates(prev => [...prev, { taxType: '', rate: 0, compoundPrevious: false }])}>添加税率</Btn>
            </div>
          </div>

          {formError && <p className="text-sm text-red-500">{formError}</p>}
        </div>
      </Modal>
    </div>
  )
}

export default TenantTaxClassManagement
