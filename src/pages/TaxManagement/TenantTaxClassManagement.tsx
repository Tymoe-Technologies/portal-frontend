import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
import { useAuthContext } from '@/auth/AuthProvider'
import { canEditModule } from '@/auth/permissions'

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
  const { t } = useTranslation()
  const { role, permissions } = useAuthContext()
  const canEdit = canEditModule('taxSettings', role, permissions)
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
      toast.error(t('pages.taxManagement.tenantTaxClass.loadDataFailed', { message: error.message }))
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
    if (!name.trim()) { setFormError(t('pages.taxManagement.tenantTaxClass.pleaseEnterName')); return }
    if (rates.length === 0) { setFormError(t('pages.taxManagement.tenantTaxClass.addAtLeastOneRate')); return }
    if (rates.some(r => !r.taxType)) { setFormError(t('pages.taxManagement.tenantTaxClass.selectTaxTypeForEachRow')); return }
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
      toast.success(t('pages.taxManagement.tenantTaxClass.createSuccess'))
      setModalVisible(false)
      loadData()
    } catch (error: any) {
      toast.error(t('pages.taxManagement.tenantTaxClass.createFailed', { message: error.message }))
    }
  }

  const blueTag = (text: string) => <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 bg-blue-50 text-blue-600 ring-blue-200">{text}</span>

  const columns: Column<TaxClass>[] = [
    { key: 'name', title: t('pages.taxManagement.taxRateList.colTaxClassName'), width: 200, render: (r) => r.name },
    { key: 'description', title: t('pages.taxManagement.taxRateList.colDescription'), width: 250, render: (r) => r.description },
    {
      key: 'rates', title: t('pages.taxManagement.taxRateList.colIncludedRates'),
      render: (r: any) => (
        <div className="flex flex-col gap-1">
          {(r.rates || []).map((rate: any, index: number) => (
            <div key={index} className="flex items-center gap-1.5">
              {blueTag(rate.taxRate.taxType)}
              <span className="text-slate-700">{rate.taxRate.name}</span>
              <span className="font-semibold text-slate-800"> ({(rate.taxRate.rate * 100).toFixed(2)}%)</span>
              {rate.compoundPrevious && <span className="ml-2 text-xs px-1.5 py-0.5 rounded ring-1 bg-amber-50 text-amber-600 ring-amber-200">{t('pages.taxManagement.taxRateList.compoundTax')}</span>}
            </div>
          ))}
        </div>
      ),
    },
    // 类型：原 purple 标签，改 slate（严禁紫色）
    { key: 'type', title: t('pages.taxManagement.tenantTaxClass.colType'), width: 120, render: () => <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 bg-slate-100 text-slate-600 ring-slate-200">{t('pages.taxManagement.tenantTaxClass.tenantCustomBadge')}</span> },
  ]

  return (
    <div>
      {canEdit && (
        <div className="mb-4">
          <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleCreateClick}>{t('pages.taxManagement.tenantTaxClass.createCustomTaxClassBtn')}</Btn>
        </div>
      )}

      <div className="mb-4">
        <AlertBox type="info" title={t('pages.taxManagement.tenantTaxClass.explanationTitle')} description={t('pages.taxManagement.tenantTaxClass.explanationDesc')} />
      </div>

      <Table columns={columns} data={taxClasses} rowKey={(r) => r.id} loading={loading} />

      {/* 创建税类对话框 */}
      <Modal
        title={t('pages.taxManagement.tenantTaxClass.createCustomTaxClassBtn')}
        open={modalVisible}
        onOpenChange={(o) => !o && setModalVisible(false)}
        size="xl"
        footer={
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setModalVisible(false)}>{t('common.cancel')}</Btn>
            <Btn variant="primary" onClick={handleSubmit}>{t('common.create')}</Btn>
          </div>
        }
      >
        <div className="space-y-4">
          <FormRow label={t('pages.taxManagement.tenantTaxClass.taxClassNameLabel')}>
            <TextInput className="w-full" value={name} onChange={setName} placeholder={t('pages.taxManagement.tenantTaxClass.taxClassNamePlaceholder')} />
          </FormRow>
          <FormRow label={t('pages.taxManagement.tenantTaxClass.descriptionLabel')}>
            <Textarea className="w-full" rows={2} value={description} onChange={setDescription} placeholder={t('pages.taxManagement.tenantTaxClass.descriptionPlaceholder')} />
          </FormRow>

          <div>
            <div className="text-sm text-slate-600 mb-1.5">{t('pages.taxManagement.tenantTaxClass.rateConfigLabel')}</div>
            <AlertBox type="info" title={t('pages.taxManagement.tenantTaxClass.calcOrderTitle')} description={t('pages.taxManagement.tenantTaxClass.calcOrderDesc')} />

            <div className="mt-3 space-y-2">
              {rates.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-40">
                    <SelectInput className="w-full" placeholder={t('pages.taxManagement.tenantTaxClass.selectTaxTypePlaceholder')} value={row.taxType} onChange={(v) => setRate(index, { taxType: String(v) })}
                      options={availableTaxRates.map(r => ({ label: r.taxType, value: r.taxType }))} />
                  </div>
                  <NumberInput value={row.rate} onChange={(v) => setRate(index, { rate: v })} min={0} max={100} suffix="%" />
                  <div className="w-32">
                    <SelectInput className="w-full" value={row.compoundPrevious ? 'true' : 'false'} onChange={(v) => setRate(index, { compoundPrevious: v === 'true' })}
                      options={[{ label: t('pages.taxManagement.tenantTaxClass.normalTax'), value: 'false' }, { label: t('pages.taxManagement.taxRateList.compoundTax'), value: 'true' }]} />
                  </div>
                  <Btn variant="link" onClick={() => setRates(prev => prev.filter((_, i) => i !== index))}>{t('common.delete')}</Btn>
                </div>
              ))}

              <Btn variant="secondary" className="w-full" icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setRates(prev => [...prev, { taxType: '', rate: 0, compoundPrevious: false }])}>{t('pages.taxManagement.tenantTaxClass.addRateBtn')}</Btn>
            </div>
          </div>

          {formError && <p className="text-sm text-red-500">{formError}</p>}
        </div>
      </Modal>
    </div>
  )
}

export default TenantTaxClassManagement
