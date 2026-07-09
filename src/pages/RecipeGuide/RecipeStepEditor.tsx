import React from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, ArrowUp, ArrowDown, X } from 'lucide-react'
import { SelectInput, TextInput, Btn, Badge } from '@/components/ui-kit'
import type { StepType, StepEditorItem } from '@/services/recipe/types'
import { generateStepCode, generateRecipePrintCode, WRAP_SYMBOLS } from '@/utils/printCodeGenerator'

interface RecipeStepEditorProps {
  value?: StepEditorItem[]
  onChange?: (steps: StepEditorItem[]) => void
  onPrintCodeChange?: (printCode: string) => void
  stepTypes: StepType[]
}

const emptySubStep = () => ({ stepTypeId: '', instruction: '' })
const emptyStep = (): StepEditorItem => ({
  subSteps: [emptySubStep()],
  wrapSymbol: '',
  stepInstruction: ''
})

const RecipeStepEditor: React.FC<RecipeStepEditorProps> = ({
  value = [],
  onChange,
  onPrintCodeChange,
  stepTypes
}) => {
  const { t } = useTranslation()
  // 步骤类型映射
  const stepTypeMap = new Map<string, StepType>()
  stepTypes.forEach(st => stepTypeMap.set(st.id, st))

  // 通知父组件
  const notify = (steps: StepEditorItem[]) => {
    onChange?.(steps)
    onPrintCodeChange?.(generateRecipePrintCode(steps, stepTypeMap))
  }

  // ---- 步骤级别操作 ----
  const addStep = () => notify([...value, emptyStep()])

  const removeStep = (i: number) => notify(value.filter((_, idx) => idx !== i))

  const moveStep = (i: number, dir: 'up' | 'down') => {
    const j = dir === 'up' ? i - 1 : i + 1
    if (j < 0 || j >= value.length) return
    const steps = [...value]
    ;[steps[i], steps[j]] = [steps[j], steps[i]]
    notify(steps)
  }

  const updateStep = (i: number, patch: Partial<StepEditorItem>) => {
    const steps = value.map((s, idx) => idx === i ? { ...s, ...patch } : s)
    notify(steps)
  }

  // ---- subStep 级别操作 ----
  const addSubStep = (i: number) => {
    const step = value[i]
    updateStep(i, { subSteps: [...step.subSteps, emptySubStep()] })
  }

  const removeSubStep = (i: number, j: number) => {
    const step = value[i]
    if (step.subSteps.length <= 1) return  // 至少保留一个
    updateStep(i, { subSteps: step.subSteps.filter((_, idx) => idx !== j) })
  }

  const updateSubStep = (i: number, j: number, field: 'stepTypeId' | 'instruction', val: string) => {
    const step = value[i]
    const subSteps = step.subSteps.map((s, idx) =>
      idx === j ? { ...s, [field]: val } : s
    )
    updateStep(i, { subSteps })
  }

  return (
    <div>
      {value.map((step, i) => {
        const code = generateStepCode(step, stepTypeMap)

        return (
          <div key={i} className="mb-2 rounded-lg border border-slate-200 bg-white">
            {/* 卡片头 */}
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-700">{t('pages.recipeGuide.stepIndexLabel', { number: i + 1 })}</span>
                {code && <Badge variant="green"><span className="font-mono">{code}</span></Badge>}
              </div>
              <div className="flex items-center gap-0.5">
                <Btn variant="ghost" size="sm" icon={<ArrowUp size={14} />} disabled={i === 0} onClick={() => moveStep(i, 'up')} />
                <Btn variant="ghost" size="sm" icon={<ArrowDown size={14} />} disabled={i === value.length - 1} onClick={() => moveStep(i, 'down')} />
                <Btn variant="ghost" size="sm" icon={<Trash2 size={14} className="text-red-500" />} onClick={() => removeStep(i)} />
              </div>
            </div>

            <div className="px-3 py-2.5">
              {/* subStep 列表 */}
              <div className="mb-2">
                <div className="mb-1.5 text-xs font-medium text-slate-500">{t('pages.recipeGuide.stepType')}</div>
                {step.subSteps.map((sub, j) => {
                  const type = stepTypeMap.get(sub.stepTypeId)
                  return (
                    <div key={j} className="mb-1.5 flex items-center gap-1.5">
                      {/* 步骤类型选择 */}
                      <div className="flex-[2]">
                        <SelectInput
                          value={sub.stepTypeId}
                          onChange={v => updateSubStep(i, j, 'stepTypeId', v)}
                          placeholder={t('pages.recipeGuide.selectStepType')}
                          options={stepTypes.map(st => ({ value: st.id, label: `${st.code} ${st.name}` }))}
                        />
                      </div>
                      {/* 用量输入 */}
                      <div className="flex-1">
                        <TextInput value={sub.instruction} onChange={v => updateSubStep(i, j, 'instruction', v)} placeholder={t('pages.recipeGuide.subStepAmountPlaceholder')} />
                      </div>
                      {/* 预览 */}
                      {type && (
                        <span className="whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                          {type.code}{sub.instruction || ''}
                        </span>
                      )}
                      {/* 删除 subStep */}
                      <Btn variant="ghost" size="sm" icon={<X size={14} className="text-slate-400" />} disabled={step.subSteps.length <= 1} onClick={() => removeSubStep(i, j)} />
                    </div>
                  )
                })}
                <Btn variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => addSubStep(i)} className="w-full">{t('pages.recipeGuide.addStepType')}</Btn>
              </div>

              {/* 包裹符号 + 步骤说明 */}
              <div className="border-t border-slate-100 pt-2">
                <div className="mb-1.5 text-xs font-medium text-slate-500">{t('pages.recipeGuide.wrapSymbolLabel')}</div>
                <div className="flex flex-wrap gap-1">
                  {WRAP_SYMBOLS.map(sym => (
                    <button
                      key={sym.value}
                      type="button"
                      onClick={() => updateStep(i, { wrapSymbol: sym.value })}
                      className={`min-w-8 cursor-pointer select-none rounded px-2 py-0.5 text-center font-mono text-xs ring-1 ${
                        step.wrapSymbol === sym.value
                          ? 'bg-blue-50 text-blue-600 ring-blue-200'
                          : 'bg-slate-50 text-slate-600 ring-slate-200'
                      }`}
                    >
                      {sym.label}
                    </button>
                  ))}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <span className="whitespace-nowrap text-xs text-slate-500">{t('pages.recipeGuide.stepInstructionLabel')}</span>
                  <div className="w-32">
                    <TextInput value={step.stepInstruction} onChange={v => updateStep(i, { stepInstruction: v })} placeholder={t('pages.recipeGuide.stepInstructionPlaceholder')} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}

      <Btn variant="secondary" onClick={addStep} icon={<Plus size={16} />} className="w-full">{t('pages.recipeGuide.addStep')}</Btn>
    </div>
  )
}

export default RecipeStepEditor
