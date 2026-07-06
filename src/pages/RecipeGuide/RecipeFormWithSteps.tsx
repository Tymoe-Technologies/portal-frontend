import React, { useState, useEffect } from 'react'
import { Modal, Field, Textarea, Btn, Badge, toast } from '@/components/ui-kit'
import { getStepTypes, createRecipe, updateRecipe, updateRecipeSteps } from '@/services/recipe'
import type { Recipe, StepType, StepEditorItem } from '@/services/recipe/types'
import RecipeStepEditor from './RecipeStepEditor'

interface RecipeFormWithStepsProps {
  visible: boolean
  itemId: string
  itemName?: string
  recipe?: Recipe
  initialModifierConditions?: Array<{ modifierGroupId: string; modifierOptionId: string; displayName?: string }>
  onClose: () => void
  onSuccess: () => void
}

const RecipeFormWithSteps: React.FC<RecipeFormWithStepsProps> = ({
  visible,
  itemId,
  itemName,
  recipe,
  initialModifierConditions,
  onClose,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false)
  const [stepTypes, setStepTypes] = useState<StepType[]>([])
  const [steps, setSteps] = useState<StepEditorItem[]>([])
  const [printCode, setPrintCode] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!visible) return
    loadStepTypes()

    if (recipe) {
      // 编辑模式：加载现有数据
      setDescription(recipe.description || '')
      if (recipe.printCode) setPrintCode(recipe.printCode)

      // 从 metadata 重建步骤编辑器格式
      // 注意：后端返回 snake_case，用 (s as any) 兼容两种 key
      if (recipe.steps && recipe.steps.length > 0) {
        const editorSteps: StepEditorItem[] = recipe.steps.map(step => {
          const s = step as any
          const meta = s.metadata
          // 新格式：metadata 中有 subSteps
          if (meta?.subSteps && Array.isArray(meta.subSteps)) {
            return {
              subSteps: meta.subSteps,
              wrapSymbol: meta.wrapSymbol ?? meta.separator ?? '',
              stepInstruction: s.instruction || ''
            }
          }
          // 旧格式：单 stepTypeId（兼容 snake_case 和 camelCase）
          const typeId = s.step_type_id || s.stepTypeId || ''
          return {
            subSteps: [{ stepTypeId: typeId, instruction: s.instruction || '' }],
            wrapSymbol: '',
            stepInstruction: ''
          }
        })
        setSteps(editorSteps)
      } else {
        setSteps([])
      }
    } else {
      // 创建模式
      setDescription('')
      setSteps([])
      setPrintCode('')
    }
  }, [visible, recipe])

  const loadStepTypes = async () => {
    try {
      const types = await getStepTypes()
      setStepTypes(types)
    } catch (error: any) {
      toast.error('加载步骤类型失败: ' + error.message)
    }
  }

  const handleSubmit = async () => {
    try {
      if (steps.length === 0) {
        toast.error('请至少添加一个制作步骤')
        return
      }

      const hasEmptyType = steps.some(s => s.subSteps.some(sub => !sub.stepTypeId))
      if (hasEmptyType) {
        toast.error('请为所有步骤类型选择类型')
        return
      }

      if (!printCode) {
        toast.error('打印代码生成失败，请检查步骤配置')
        return
      }

      setLoading(true)

      const stepsPayload = steps.map((step, index) => ({
        subSteps: step.subSteps,
        wrapSymbol: step.wrapSymbol,
        stepInstruction: step.stepInstruction,
        displayOrder: index + 1
      }))

      if (recipe) {
        await updateRecipe(recipe.id, { printCode, description })
        await updateRecipeSteps(recipe.id, { steps: stepsPayload })
        toast.success('更新配方成功')
      } else {
        await createRecipe({
          itemId,
          printCode,
          description,
          conditions: initialModifierConditions || [],
          steps: stepsPayload
        })
        toast.success('创建配方成功')
      }

      onSuccess()
    } catch (error: any) {
      toast.error(error.message || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={visible}
      onOpenChange={(o) => { if (!o) onClose() }}
      size="xl"
      title={
        <div className="flex flex-wrap items-center gap-2">
          <span>{recipe ? '编辑配方' : '创建配方'}</span>
          {itemName && <Badge variant="blue">{itemName}</Badge>}
          {/* 显示绑定的自定义选项（只读） */}
          {initialModifierConditions && initialModifierConditions.length > 0
            ? initialModifierConditions.map((cond, i) => (
                <Badge key={i} variant="gold">{cond.displayName || cond.modifierOptionId}</Badge>
              ))
            : <Badge variant="default">默认配方</Badge>
          }
        </div>
      }
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>取消</Btn>
          <Btn variant="primary" loading={loading} onClick={handleSubmit}>确定</Btn>
        </>
      }
    >
      <div className="space-y-4">
        {/* 生成的打印代码 */}
        {printCode && (
          <Field label="打印代码">
            <span className="inline-block rounded bg-green-50 px-3.5 py-1.5 font-mono text-[15px] text-green-600 ring-1 ring-green-200">
              {printCode}
            </span>
          </Field>
        )}

        {/* 描述 */}
        <Field label="描述">
          <Textarea value={description} onChange={setDescription} rows={2} placeholder="配方描述（可选）" />
        </Field>

        {/* 步骤编辑器 */}
        <Field label="制作步骤" required>
          <RecipeStepEditor
            value={steps}
            onChange={setSteps}
            onPrintCodeChange={setPrintCode}
            stepTypes={stepTypes}
          />
        </Field>
      </div>
    </Modal>
  )
}

export default RecipeFormWithSteps
