import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
import { useAuthContext } from '@/auth/AuthProvider'
import { canEditModule } from '@/auth/permissions'

interface TaxRateListProps {
  regionCode: string
}

/**
 * 税率列表组件
 * 显示某地区的所有税率，包括系统预设和租户覆盖
 */
const TaxRateList: React.FC<TaxRateListProps> = ({ regionCode }) => {
  const { t } = useTranslation()
  const { role, permissions } = useAuthContext()
  const canEdit = canEditModule('taxSettings', role, permissions)
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
      toast.error(t('pages.taxManagement.taxRateList.loadFailed', { message: error.message }))
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
    if (rateValue == null || rateValue < 0 || rateValue > 100) { setFormError(t('pages.taxManagement.taxRateList.rateRangeError')); return }
    if (!overrideReason.trim()) { setFormError(t('pages.taxManagement.taxRateList.pleaseExplainReason')); return }
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
      toast.success(t('pages.taxManagement.taxRateList.overrideSuccess'))
      setOverrideModalVisible(false)
      loadTaxRates()
    } catch (error: any) {
      toast.error(t('pages.taxManagement.taxRateList.overrideFailed', { message: error.message }))
    }
  }

  const blueTag = (text: string) => <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 bg-blue-50 text-blue-600 ring-blue-200">{text}</span>

  // 税率表格列定义
  const taxRateColumns: Column<TaxRate>[] = [
    { key: 'name', title: t('pages.taxManagement.taxRateList.colRateName'), width: 200, render: (r) => r.name },
    { key: 'taxType', title: t('pages.taxManagement.taxRateList.colTaxType'), width: 120, render: (r) => blueTag(r.taxType) },
    { key: 'rate', title: t('pages.taxManagement.colRate'), width: 100, render: (r) => <span className="font-semibold text-slate-800">{(r.rate * 100).toFixed(2)}%</span> },
    {
      key: 'foodExempt', title: t('pages.taxManagement.taxRateList.colFoodExempt'), width: 100, align: 'center',
      render: (r) => (r.foodExempt ? <CheckCircle2 className="w-[18px] h-[18px] text-green-500 mx-auto" /> : <span className="text-slate-300">-</span>),
    },
    {
      key: 'source', title: t('pages.taxManagement.taxRateList.colSource'), width: 160,
      render: (r) => (
        <div className="flex flex-col gap-1">
          <span className={`inline-flex w-fit items-center text-xs px-1.5 py-0.5 rounded ring-1 ${r.source === 'SYSTEM_DEFAULT' ? 'bg-slate-100 text-slate-600 ring-slate-200' : 'bg-amber-50 text-amber-600 ring-amber-200'}`}>
            {r.source === 'SYSTEM_DEFAULT' ? t('pages.taxManagement.taxRateList.sourceSystemDefault') : t('pages.taxManagement.taxRateList.sourceTenantOverride')}
          </span>
          {r.isOverridden && r.overrideReason && (
            <span className="text-xs text-slate-500 inline-flex items-center gap-1"><Info className="w-3 h-3" /> {r.overrideReason}</span>
          )}
        </div>
      ),
    },
    { key: 'effectiveDate', title: t('pages.taxManagement.taxRateList.colEffectiveDate'), width: 120, render: (r) => (r.effectiveDate ? new Date(r.effectiveDate).toLocaleDateString() : '-') },
    { key: 'expiresDate', title: t('pages.taxManagement.taxRateList.colExpiresDate'), width: 120, render: (r) => (r.expiresDate ? new Date(r.expiresDate).toLocaleDateString() : '-') },
    { key: 'action', title: t('pages.taxManagement.colActions'), width: 100, render: (r) => canEdit ? <Btn variant="link" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => handleOverrideClick(r)}>{t('pages.taxManagement.taxRateList.overrideBtn')}</Btn> : null },
  ]

  // 税类表格列定义
  const taxClassColumns: Column<TaxClass>[] = [
    { key: 'name', title: t('pages.taxManagement.taxRateList.colTaxClassName'), width: 200, render: (r) => r.name },
    { key: 'description', title: t('pages.taxManagement.taxRateList.colDescription'), render: (r) => r.description },
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
  ]

  return (
    <div>
      {loading && <div className="py-3"><Spinner className="w-6 h-6 text-slate-400" /></div>}
      <div className="space-y-6">
        {/* 说明信息 */}
        <AlertBox
          type="info"
          title={t('pages.taxManagement.taxRateList.taxRateExplanationTitle')}
          description={
            <div className="space-y-1">
              <p>• <strong>{t('pages.taxManagement.taxRateList.explSystemDefaultLabel')}</strong>{t('pages.taxManagement.taxRateList.explSystemDefaultDesc')}</p>
              <p>• <strong>{t('pages.taxManagement.taxRateList.explTenantOverrideLabel')}</strong>{t('pages.taxManagement.taxRateList.explTenantOverrideDesc')}</p>
              <p>• <strong>{t('pages.taxManagement.taxRateList.explFoodExemptLabel')}</strong>{t('pages.taxManagement.taxRateList.explFoodExemptDesc')}</p>
              <p>• <strong>{t('pages.taxManagement.taxRateList.explTaxClassLabel')}</strong>{t('pages.taxManagement.taxRateList.explTaxClassDesc')}</p>
            </div>
          }
        />

        {/* 税率列表 */}
        <div>
          <h4 className="text-base font-semibold text-slate-800 mb-3">{t('pages.taxManagement.taxRateList.taxRateListTitle')}</h4>
          <Table columns={taxRateColumns} data={taxRates} rowKey={(r) => r.id} />
        </div>

        {/* 税类列表 */}
        <div className="mt-6">
          <h4 className="text-base font-semibold text-slate-800 mb-3">{t('pages.taxManagement.taxRateList.taxClassListTitle')}</h4>
          <Table columns={taxClassColumns} data={taxClasses} rowKey={(r) => r.id} />
        </div>
      </div>

      {/* 税率覆盖对话框 */}
      <Modal
        title={t('pages.taxManagement.taxRateList.overrideModalTitle', { name: selectedRate?.name ?? '' })}
        open={overrideModalVisible}
        onOpenChange={(o) => !o && setOverrideModalVisible(false)}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setOverrideModalVisible(false)}>{t('common.cancel')}</Btn>
            <Btn variant="primary" onClick={handleOverrideSubmit}>{t('common.confirm')}</Btn>
          </div>
        }
      >
        <div className="space-y-4">
          <AlertBox type="warning" title={t('pages.taxManagement.taxRateList.overrideWarningTitle')} description={t('pages.taxManagement.taxRateList.overrideWarningDesc')} />
          <FormRow label={t('pages.taxManagement.taxRateList.originalRateLabel')}>
            <span className="font-semibold text-slate-800">{selectedRate ? `${(selectedRate.rate * 100).toFixed(2)}%` : ''}</span>
          </FormRow>
          <FormRow label={t('pages.taxManagement.taxRateList.newRateLabel')}>
            <NumberInput value={rateValue} onChange={setRateValue} min={0} max={100} suffix="%" />
          </FormRow>
          <FormRow label={t('pages.taxManagement.taxRateList.overrideReasonLabel')}>
            <Textarea className="w-full" rows={3} value={overrideReason} onChange={setOverrideReason} placeholder={t('pages.taxManagement.taxRateList.overrideReasonPlaceholder')} />
          </FormRow>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
        </div>
      </Modal>
    </div>
  )
}

export default TaxRateList
