import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Field, TextInput, Btn, toast } from '@/components/ui-kit'
import { createStepType, updateStepType } from '@/services/recipe'
import type { StepType } from '@/services/recipe'

interface StepTypeFormModalProps {
  visible: boolean
  stepType?: StepType
  existingStepTypes?: StepType[]
  onClose: () => void
  onSuccess: () => void
}

const StepTypeFormModalEnhanced: React.FC<StepTypeFormModalProps> = ({
  visible,
  stepType,
  existingStepTypes = [],
  onClose,
  onSuccess
}) => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState<{ name?: string; code?: string }>({})

  useEffect(() => {
    if (visible) {
      setName(stepType?.name ?? '')
      setCode(stepType?.code ?? '')
      setErrors({})
    }
  }, [visible, stepType])

  // 校验并返回错误信息，无错返回 null
  const validate = (): { name?: string; code?: string } => {
    const next: { name?: string; code?: string } = {}
    if (!name.trim()) next.name = t('pages.recipeGuide.nameRequired')
    if (!code.trim()) {
      next.code = t('pages.recipeGuide.codeRequired')
    } else if (
      !(stepType && code === stepType.code) &&
      existingStepTypes.some(
        st => st.code.toLowerCase() === code.toLowerCase() && st.id !== stepType?.id
      )
    ) {
      next.code = t('pages.recipeGuide.codeDuplicateError')
    }
    return next
  }

  const handleSubmit = async () => {
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    try {
      setLoading(true)
      if (stepType) {
        await updateStepType(stepType.id, { name, code })
        toast.success(t('pages.recipeGuide.updateSuccess'))
      } else {
        await createStepType({ name, code })
        toast.success(t('pages.recipeGuide.createSuccess'))
      }
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(error.message || t('pages.recipeGuide.operationFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={visible}
      onOpenChange={(o) => { if (!o) onClose() }}
      title={stepType ? t('pages.recipeGuide.editStepType') : t('pages.recipeGuide.createStepType')}
      size="sm"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn variant="primary" loading={loading} onClick={handleSubmit}>{t('common.save')}</Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('pages.recipeGuide.nameLabel')} required error={errors.name}>
          <TextInput
            value={name}
            onChange={setName}
            placeholder={t('pages.recipeGuide.namePlaceholder')}
            disabled={!!stepType}
          />
        </Field>
        <Field label={t('pages.recipeGuide.codeLabel')} required error={errors.code} hint={t('pages.recipeGuide.codeTooltip')}>
          <TextInput
            value={code}
            onChange={setCode}
            placeholder={t('pages.recipeGuide.codePlaceholderIngredient')}
            className="font-mono text-base uppercase"
          />
        </Field>
      </div>
    </Modal>
  )
}

export default StepTypeFormModalEnhanced
