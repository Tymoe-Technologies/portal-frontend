/**
 * 积分奖励编辑弹窗（积分奖励 Tab 用）
 *
 * 复用 <RewardFields> 渲染奖励字段，额外加"所需积分"。
 * 保存：pointsCost 必填、isGrantable=false（积分奖励不作礼物发放）。
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  memberRewardService,
  type RedeemItem,
  type CreateRedeemItemPayload,
} from '@/services/memberReward'
import { isRateLimited } from '@/services/http'
import { Modal, Btn, FormRow, toast } from '@/components/ui-kit'
import RewardFields, { buildRewardPayload, type LinkedItemLite, type RewardFormValues } from './RewardFields'

export interface RewardEditorModalProps {
  open: boolean
  editing?: RedeemItem | null
  onClose: () => void
  onSaved: (reward: RedeemItem) => void
}

const DEFAULT_VALUES: RewardFormValues = { rewardType: 'FREE_ITEM', selectionMode: 'FIXED', stackingMode: 'STACKABLE', validityMode: 'PERMANENT' }

const RewardEditorModal: React.FC<RewardEditorModalProps> = ({ open, editing, onClose, onSaved }) => {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [linkedItems, setLinkedItems] = useState<LinkedItemLite[]>([])
  const [values, setValues] = useState<RewardFormValues>(DEFAULT_VALUES)
  const [error, setError] = useState('')

  const setValue = (patch: Partial<RewardFormValues>) => setValues(prev => ({ ...prev, ...patch }))

  useEffect(() => {
    if (!open) return
    setError('')
    if (editing) {
      setLinkedItems(editing.linkedItems ?? [])
      setValues({
        name: editing.name,
        description: editing.description,
        pointsCost: editing.pointsCost,
        rewardType: editing.rewardType,
        selectionMode: editing.selectionMode,
        pickCount: editing.pickCount,
        discountAmount: editing.discountAmount != null ? editing.discountAmount / 100 : undefined,
        discountPercentage: editing.discountPercentage,
        discountMaxAmount: editing.discountMaxAmount != null ? editing.discountMaxAmount / 100 : undefined,
        stackingMode: editing.stackingMode,
        exclusionGroup: editing.exclusionGroup,
        stock: editing.stock,
        limitPerMember: editing.limitPerMember,
        validityMode: editing.validityDays != null ? 'DAYS' : 'PERMANENT',
        validityDays: editing.validityDays ?? undefined,
      })
    } else {
      setLinkedItems([])
      setValues(DEFAULT_VALUES)
    }
  }, [open, editing])

  const validate = (): string => {
    if (!values.name?.trim()) return t('pages.rewardManagement.editorModal.validateName')
    if (!values.description?.trim()) return t('pages.rewardManagement.editorModal.validateDescription')
    if (values.pointsCost == null || values.pointsCost < 1) return t('pages.rewardManagement.editorModal.validatePointsCost')
    if (values.rewardType === 'DISCOUNT_AMOUNT' && values.discountAmount == null) return t('pages.rewardManagement.editorModal.validateDiscountAmount')
    if (values.rewardType === 'DISCOUNT_PERCENTAGE' && values.discountPercentage == null) return t('pages.rewardManagement.editorModal.validateDiscountPercentage')
    if (values.validityMode === 'DAYS' && values.validityDays == null) return t('pages.rewardManagement.editorModal.validateValidityDays')
    if (values.rewardType === 'FREE_ITEM' && values.selectionMode === 'PICK_N' && values.pickCount == null) return t('pages.rewardManagement.editorModal.validatePickCount')
    return ''
  }

  const handleSave = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setSaving(true)
    try {
      const payload: CreateRedeemItemPayload = {
        ...buildRewardPayload(values, linkedItems),
        pointsCost: values.pointsCost,   // 积分奖励必填
        isGrantable: false,
      }
      let saved: RedeemItem
      if (editing) {
        const res = await memberRewardService.update(editing.id, payload)
        saved = (res.data as any).data
        toast.success(t('pages.rewardManagement.editorModal.updateSuccess'))
      } else {
        const res = await memberRewardService.create(payload)
        saved = (res.data as any).data
        toast.success(t('pages.rewardManagement.editorModal.createSuccess'))
      }
      onSaved(saved)
      onClose()
    } catch (err: any) {
      if (isRateLimited(err)) return
      toast.error(err?.response?.data?.error?.message ?? t('common.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={editing ? t('pages.rewardManagement.editorModal.titleEdit') : t('pages.rewardManagement.editorModal.titleCreate')}
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Btn variant="secondary" onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn variant="primary" loading={saving} onClick={handleSave}>{t('common.save')}</Btn>
        </div>
      }
    >
      <div>
        <RewardFields values={values} setValue={setValue} linkedItems={linkedItems} onLinkedItemsChange={setLinkedItems} active={open} />
        <FormRow label={t('pages.rewardManagement.editorModal.pointsCostLabel')}>
          <div className="flex items-center gap-1.5">
            <input type="number" min={1} value={values.pointsCost ?? ''} placeholder={t('pages.rewardManagement.editorModal.pointsCostPlaceholder')}
              onChange={e => setValue({ pointsCost: e.target.value === '' ? undefined : Number(e.target.value) })}
              className="w-52 text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0" />
            <span className="text-xs text-slate-400">pts</span>
          </div>
        </FormRow>
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </div>
    </Modal>
  )
}

export default RewardEditorModal
