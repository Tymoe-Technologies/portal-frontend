import React, { useState, useEffect } from 'react'
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Modal, Field, TextInput, Textarea, SelectInput, Btn, Badge, toast } from '@/components/ui-kit'
import { createRecipe, updateRecipe, updateRecipeSteps, getStepTypes } from '@/services/recipe'
import type { Recipe, RecipeCondition, RecipeStep, StepType } from '@/services/recipe/types'
import type { ItemModifierGroup } from '@/services/item-management'

interface RecipeFormModalV2Props {
  visible: boolean
  recipe?: Recipe
  itemId: string
  itemName?: string  // 商品名称
  initialModifierConditions?: RecipeCondition[]  // 初始自定义选项条件
  modifierGroups: ItemModifierGroup[]
  onClose: () => void
  onSuccess: () => void
}

const RecipeFormModalV2: React.FC<RecipeFormModalV2Props> = ({
  visible,
  recipe,
  itemId,
  itemName,
  initialModifierConditions,
  modifierGroups,
  onClose,
  onSuccess
}) => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [stepTypes, setStepTypes] = useState<StepType[]>([])
  const [steps, setSteps] = useState<Array<RecipeStep & { _tempId?: string }>>([])
  const [printCode, setPrintCode] = useState('')
  const [displayCodeString, setDisplayCodeString] = useState('')
  const [description, setDescription] = useState('')
  const [printCodeError, setPrintCodeError] = useState<string | undefined>()

  useEffect(() => {
    if (visible) {
      loadStepTypes()
      setPrintCodeError(undefined)
      if (recipe) {
        // 编辑模式
        setPrintCode(recipe.printCode || '')
        setDisplayCodeString(recipe.displayCodeString || '')
        setDescription(recipe.description || '')
        setSteps(recipe.steps || [])
      } else {
        // 创建模式
        setDescription('')
        setSteps([])
        // 如果有初始自定义选项条件，生成建议的打印代码
        if (initialModifierConditions && initialModifierConditions.length > 0) {
          const suggestedCode = generateSuggestedPrintCode(initialModifierConditions)
          setPrintCode(suggestedCode.code)
          setDisplayCodeString(suggestedCode.display)
        } else {
          setPrintCode('')
          setDisplayCodeString('')
        }
      }
    }
  }, [visible, recipe, initialModifierConditions])

  // 根据自定义选项条件生成建议的打印代码
  const generateSuggestedPrintCode = (conditions: RecipeCondition[]) => {
    const displayParts: string[] = []
    const codeParts: string[] = []

    conditions.forEach(cond => {
      const group = modifierGroups.find(mg => mg.group?.id === cond.modifierGroupId)
      const option = group?.group?.options?.find(opt => opt.id === cond.modifierOptionId)

      if (option) {
        displayParts.push(option.displayName || option.name)
        // 取首字母作为代码
        codeParts.push((option.displayName || option.name).charAt(0).toUpperCase())
      }
    })

    return {
      code: codeParts.join(''),
      display: displayParts.join('-')
    }
  }

  const loadStepTypes = async () => {
    try {
      const data = await getStepTypes()
      setStepTypes(data || [])
    } catch (error: any) {
      console.error('加载步骤类型失败:', error)
      toast.error(error.message || t('pages.recipeGuide.formModal.loadStepTypesFailed'))
      setStepTypes([])
    }
  }

  const handleSubmit = async () => {
    if (!printCode.trim()) {
      setPrintCodeError(t('pages.recipeGuide.formModal.printCodeRequired'))
      return
    }
    setPrintCodeError(undefined)

    try {
      setLoading(true)

      // 验证步骤
      if (steps.length > 0) {
        const invalidSteps = steps.filter(step => !step.stepTypeId)
        if (invalidSteps.length > 0) {
          toast.error(t('pages.recipeGuide.formModal.allStepsRequireType'))
          setLoading(false)
          return
        }
      }

      if (recipe) {
        // 更新模式：分两步操作
        await updateRecipe(recipe.id, { printCode, displayCodeString, description })

        if (steps.length > 0) {
          await updateRecipeSteps(recipe.id, {
            steps: steps.map((step, index) => ({
              stepTypeId: step.stepTypeId,
              displayOrder: index + 1,
              instructions: step.instructions
            }))
          })
        }

        toast.success(t('pages.recipeGuide.formModal.updateRecipeSuccess'))
      } else {
        // 创建模式
        if (!initialModifierConditions || initialModifierConditions.length === 0) {
          toast.error(t('pages.recipeGuide.formModal.missingModifierConditions'))
          setLoading(false)
          return
        }

        await createRecipe({
          itemId,
          printCode,
          displayCodeString,
          description,
          conditions: initialModifierConditions,
          steps: steps.map((step, index) => ({
            stepTypeId: step.stepTypeId,
            displayOrder: index + 1,
            instructions: step.instructions
          }))
        })

        toast.success(t('pages.recipeGuide.createRecipeSuccess'))
      }

      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(error.message || t('pages.recipeGuide.formModal.operationFailed'))
    } finally {
      setLoading(false)
    }
  }

  const addStep = () => {
    setSteps([
      ...steps,
      {
        stepTypeId: '' as any,
        displayOrder: steps.length + 1,
        instructions: '',
        _tempId: `temp-${Date.now()}`
      } as any
    ])
  }

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index))
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= steps.length) return

    ;[newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]]
    setSteps(newSteps)
  }

  const updateStep = (index: number, field: keyof RecipeStep, value: any) => {
    const newSteps = [...steps]
    newSteps[index] = { ...newSteps[index], [field]: value }
    setSteps(newSteps)
  }

  // 渲染自定义选项条件标签
  const renderConditionTags = () => {
    if (!initialModifierConditions || initialModifierConditions.length === 0) return null

    return (
      <div className="flex flex-wrap gap-2">
        {initialModifierConditions.map((cond, index) => {
          const group = modifierGroups.find(mg => mg.group?.id === cond.modifierGroupId)
          const option = group?.group?.options?.find(opt => opt.id === cond.modifierOptionId)

          return (
            <Badge key={index} variant="blue">
              {group?.group?.displayName || t('pages.recipeGuide.formModal.customOption')}: {option?.displayName || option?.name || t('pages.recipeGuide.byModifierManager.unknownOption')}
            </Badge>
          )
        })}
      </div>
    )
  }

  return (
    <Modal
      open={visible}
      onOpenChange={(o) => { if (!o) onClose() }}
      size="xl"
      title={
        <div className="flex items-center gap-2">
          <span>{recipe ? t('pages.recipeGuide.editRecipe') : t('pages.recipeGuide.createRecipe')}</span>
          {itemName && <Badge variant="blue">{itemName}</Badge>}
        </div>
      }
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn variant="primary" loading={loading} onClick={handleSubmit}>{t('common.save')}</Btn>
        </>
      }
    >
      <div className="space-y-4">
        {/* 显示自定义选项条件 */}
        {!recipe && initialModifierConditions && initialModifierConditions.length > 0 && (
          <Field label={t('pages.recipeGuide.formModal.applicableConditions')}>{renderConditionTags()}</Field>
        )}

        <Field label={t('pages.recipeGuide.printCode')} required error={printCodeError} hint={t('pages.recipeGuide.formModal.printCodeHint')}>
          <TextInput value={printCode} onChange={setPrintCode} placeholder={t('pages.recipeGuide.formModal.printCodePlaceholderExample')} maxLength={20} />
        </Field>

        <Field label={t('pages.recipeGuide.displayCode')} hint={t('pages.recipeGuide.formModal.displayCodeHint')}>
          <TextInput value={displayCodeString} onChange={setDisplayCodeString} placeholder={t('pages.recipeGuide.formModal.displayCodePlaceholderExample')} />
        </Field>

        <Field label={t('pages.recipeGuide.recipeDescription')}>
          <Textarea value={description} onChange={setDescription} placeholder={t('pages.recipeGuide.recipeDescriptionPlaceholder')} rows={2} />
        </Field>

        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-semibold text-slate-700">{t('pages.recipeGuide.stepsConfig')}</span>
            <Btn variant="secondary" size="sm" icon={<Plus size={14} />} onClick={addStep}>{t('pages.recipeGuide.addStep')}</Btn>
          </div>
          <div className="p-3">
            {steps.length === 0 ? (
              <div className="py-5 text-center text-sm text-slate-400">{t('pages.recipeGuide.formModal.noStepsHint')}</div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div key={step._tempId || step.id || index} className="rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                      <span className="text-sm font-medium text-slate-700">{t('pages.recipeGuide.formModal.stepNumber', { number: index + 1 })}</span>
                      <div className="flex items-center gap-1">
                        <Btn variant="ghost" size="sm" icon={<ArrowUp size={14} />} disabled={index === 0} onClick={() => moveStep(index, 'up')} />
                        <Btn variant="ghost" size="sm" icon={<ArrowDown size={14} />} disabled={index === steps.length - 1} onClick={() => moveStep(index, 'down')} />
                        <Btn variant="ghost" size="sm" icon={<Trash2 size={14} className="text-red-500" />} onClick={() => removeStep(index)} />
                      </div>
                    </div>
                    <div className="space-y-3 px-3 py-3">
                      <Field label={t('pages.recipeGuide.stepType')} required error={!step.stepTypeId ? t('pages.recipeGuide.formModal.selectStepTypeRequired') : undefined}>
                        <SelectInput
                          placeholder={t('pages.recipeGuide.formModal.selectStepTypeRequiredPlaceholder')}
                          value={step.stepTypeId || ''}
                          onChange={(value) => updateStep(index, 'stepTypeId', value)}
                          options={stepTypes.map(type => ({ value: type.id, label: `${type.code} ${type.name}` }))}
                        />
                      </Field>
                      <Field label={t('pages.recipeGuide.formModal.operationInstructions')}>
                        <Textarea
                          placeholder={t('pages.recipeGuide.formModal.operationInstructionsPlaceholder')}
                          value={step.instructions || ''}
                          onChange={(v) => updateStep(index, 'instructions', v)}
                          rows={2}
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default RecipeFormModalV2
