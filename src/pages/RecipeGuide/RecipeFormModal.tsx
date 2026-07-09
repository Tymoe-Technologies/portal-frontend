import React, { useState, useEffect } from 'react'
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Modal, Field, TextInput, Textarea, NumberInput, SelectInput, Switch, Btn, toast } from '@/components/ui-kit'
import { createRecipe, updateRecipe, getStepTypes } from '@/services/recipe'
import type { Recipe, RecipeStep, StepType } from '@/services/recipe'

interface RecipeFormModalProps {
  visible: boolean
  recipe?: Recipe
  itemId: string
  initialAttributeConditions?: Record<string, string>  // 初始属性条件
  onClose: () => void
  onSuccess: () => void
}

const RecipeFormModal: React.FC<RecipeFormModalProps> = ({
  visible,
  recipe,
  itemId,
  initialAttributeConditions,
  onClose,
  onSuccess
}) => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [stepTypes, setStepTypes] = useState<StepType[]>([])
  const [steps, setSteps] = useState<RecipeStep[]>([])
  // 受控表单字段
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [attributeConditions, setAttributeConditions] = useState('')
  const [priority, setPriority] = useState<number | undefined>(0)
  const [isDefault, setIsDefault] = useState(false)
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (visible) {
      loadStepTypes()
      if (recipe) {
        // 编辑模式
        setName(recipe.name || '')
        setDescription(recipe.description || '')
        setAttributeConditions(recipe.attributeConditions ? JSON.stringify(recipe.attributeConditions, null, 2) : '')
        setPriority(recipe.priority || 0)
        setIsDefault(!!recipe.isDefault)
        setIsActive(recipe.isActive !== false)
        // 编辑模式：初始化步骤，添加_selectedSteps临时字段
        const initialSteps = (recipe.steps || []).map(step => {
          // 从ingredients解析出步骤编号
          let selectedSteps: number[] = []
          if (step.ingredients) {
            if (Array.isArray(step.ingredients)) {
              selectedSteps = step.ingredients.map((ing: any) => ing.stepNumber)
            } else if (typeof step.ingredients === 'string') {
              const matches = step.ingredients.match(/步骤(\d+):/g)
              if (matches) {
                selectedSteps = matches.map((match: string) => {
                  const num = match.match(/\d+/)
                  return num ? parseInt(num[0]) : 0
                }).filter((n: number) => n > 0)
              }
            }
          }
          return { ...step, _selectedSteps: selectedSteps }
        })
        setSteps(initialSteps as any)
      } else {
        // 创建模式
        setName('')
        setDescription('')
        setSteps([])
        if (initialAttributeConditions) {
          setAttributeConditions(JSON.stringify(initialAttributeConditions, null, 2))
          setPriority(10)
        } else {
          setAttributeConditions('')
          setPriority(0)
        }
        setIsDefault(false)
        setIsActive(true)
      }
    }
  }, [visible, recipe])

  const loadStepTypes = async () => {
    try {
      const data = await getStepTypes()
      setStepTypes(data || [])
    } catch (error: any) {
      toast.error(error.message || t('pages.recipeGuide.loadFailed'))
      setStepTypes([])
    }
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)

      // 处理attributeConditions: 如果是字符串则解析为JSON
      let parsedConditions: any = attributeConditions
      if (typeof parsedConditions === 'string') {
        if (parsedConditions.trim()) {
          try {
            parsedConditions = JSON.parse(parsedConditions)
          } catch (e) {
            toast.error(t('pages.recipeGuide.attributeConditionsParseError'))
            setLoading(false)
            return
          }
        } else {
          parsedConditions = null
        }
      } else if (!parsedConditions || Object.keys(parsedConditions).length === 0) {
        parsedConditions = null
      }

      // 验证步骤：每个步骤必须有stepTypeId
      const invalidSteps = steps.filter(step => !step.stepTypeId)
      if (invalidSteps.length > 0) {
        toast.error(t('pages.recipeGuide.stepTypeRequiredToast'))
        setLoading(false)
        return
      }

      // 构建payload（不包含tenantId，后端从请求头获取）
      const payload: any = {
        itemId,
        name,
        description,
        attributeConditions: parsedConditions,
        priority: priority || 10,
        isDefault,
        isActive,
        steps: steps.map((step, index) => {
          const stepData: any = {
            stepTypeId: step.stepTypeId,
            sortOrder: index,
            stepNumber: index + 1
          }
          if (step.amount !== undefined && step.amount !== null && step.amount !== '') {
            stepData.amount = step.amount
          }
          if (step.ingredients) stepData.ingredients = step.ingredients
          if (step.operation) stepData.operation = step.operation
          if (step.duration) stepData.duration = step.duration
          return stepData
        })
      }

      let result
      if (recipe) {
        result = await updateRecipe(recipe.id, payload)
        if (payload.steps.length > 0 && (!result.steps || result.steps.length === 0)) {
          toast.warning(t('pages.recipeGuide.updateSuccessStepsNotSaved'))
        } else {
          toast.success(t('pages.recipeGuide.updateSuccess'))
        }
      } else {
        result = await createRecipe(payload)
        const issues = []
        if (!result.attributeConditions && parsedConditions) issues.push(t('pages.recipeGuide.issueAttributeConditions'))
        if (payload.steps.length > 0 && (!result.steps || result.steps.length === 0)) issues.push(t('pages.recipeGuide.issueSteps'))

        if (issues.length > 0) {
          toast.warning(t('pages.recipeGuide.createSuccessWithIssues', { issues: issues.join(t('pages.recipeGuide.issueJoiner')) }))
        } else {
          toast.success(t('pages.recipeGuide.createSuccess'))
        }
      }

      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(error.message || t('pages.recipeGuide.createFailed'))
    } finally {
      setLoading(false)
    }
  }

  const addStep = () => {
    setSteps([
      ...steps,
      {
        stepTypeId: '' as any,
        amount: '',
        ingredients: '',
        operation: '',
        duration: undefined,
        sortOrder: steps.length,
        _selectedSteps: [] as number[]
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

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...steps]
    newSteps[index] = { ...newSteps[index], [field]: value }
    setSteps(newSteps)
  }

  return (
    <Modal
      open={visible}
      onOpenChange={(o) => { if (!o) onClose() }}
      size="xl"
      title={recipe ? t('pages.recipeGuide.editRecipe') : t('pages.recipeGuide.createRecipe')}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>{t('pages.recipeGuide.cancel')}</Btn>
          <Btn variant="primary" loading={loading} onClick={handleSubmit}>{t('pages.recipeGuide.save')}</Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('pages.recipeGuide.recipeName')} hint={t('pages.recipeGuide.recipeNameAutoGenerate')}>
          <TextInput value={name} onChange={setName} placeholder={t('pages.recipeGuide.recipeNameAutoPlaceholder')} />
        </Field>

        <Field label={t('pages.recipeGuide.recipeDescription')}>
          <Textarea value={description} onChange={setDescription} placeholder={t('pages.recipeGuide.recipeDescriptionPlaceholder')} rows={2} />
        </Field>

        <Field label={t('pages.recipeGuide.attributeConditions')} hint={t('pages.recipeGuide.attributeConditionsHint')}>
          <Textarea value={attributeConditions} onChange={setAttributeConditions} placeholder={t('pages.recipeGuide.attributeConditionsJsonPlaceholder')} rows={2} />
        </Field>

        <div className="flex items-end gap-8">
          <Field label={t('pages.recipeGuide.priority')} hint={t('pages.recipeGuide.priorityTooltip')}>
            <div className="w-32">
              <NumberInput value={priority} onChange={setPriority} min={0} max={100} />
            </div>
          </Field>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">{t('pages.recipeGuide.isDefault')}</span>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">{t('pages.recipeGuide.isActive')}</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </label>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-semibold text-slate-700">{t('pages.recipeGuide.stepsConfig')}</span>
            <Btn variant="secondary" size="sm" icon={<Plus size={14} />} onClick={addStep}>{t('pages.recipeGuide.addStep')}</Btn>
          </div>
          <div className="p-3">
            {steps.length === 0 ? (
              <div className="py-5 text-center text-sm text-slate-400">{t('pages.recipeGuide.noSteps')}</div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div key={index} className="rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                      <span className="text-sm font-medium text-slate-700">{t('pages.recipeGuide.stepNumber')} {index + 1}</span>
                      <div className="flex items-center gap-1">
                        <Btn variant="ghost" size="sm" icon={<ArrowUp size={14} />} disabled={index === 0} onClick={() => moveStep(index, 'up')} />
                        <Btn variant="ghost" size="sm" icon={<ArrowDown size={14} />} disabled={index === steps.length - 1} onClick={() => moveStep(index, 'down')} />
                        <Btn variant="ghost" size="sm" icon={<Trash2 size={14} className="text-red-500" />} onClick={() => removeStep(index)} />
                      </div>
                    </div>
                    <div className="space-y-3 px-3 py-3">
                      <Field label={t('pages.recipeGuide.stepType')} required error={!step.stepTypeId ? t('pages.recipeGuide.stepTypeRequiredError') : undefined}>
                        <SelectInput
                          placeholder={t('pages.recipeGuide.stepTypeSelectPlaceholder')}
                          value={step.stepTypeId || ''}
                          onChange={(value) => updateStep(index, 'stepTypeId', value)}
                          options={stepTypes.map(type => ({ value: type.id, label: `${type.code} ${type.name}` }))}
                        />
                      </Field>

                      <TextInput
                        placeholder={t('pages.recipeGuide.stepAmountPlaceholder')}
                        value={(step.amount as any) || ''}
                        onChange={(v) => updateStep(index, 'amount', v)}
                      />

                      <div className="w-40">
                        <NumberInput
                          value={step.duration ?? undefined}
                          onChange={(v) => updateStep(index, 'duration', v)}
                          min={0}
                          suffix={t('pages.recipeGuide.seconds')}
                        />
                      </div>

                      <div className="rounded bg-blue-50 px-3 py-2 text-xs text-slate-600">
                        💡 {t('pages.recipeGuide.printCodeAutoGenNote')}
                      </div>
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

export default RecipeFormModal
