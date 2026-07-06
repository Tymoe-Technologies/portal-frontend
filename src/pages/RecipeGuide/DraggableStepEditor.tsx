import React from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd'
import { GripVertical, Trash2, Plus } from 'lucide-react'
import { TextInput, NumberInput, Switch, Btn, Badge, EmptyState } from '@/components/ui-kit'
import type { RecipeStep, StepType } from '@/services/recipe'

interface DraggableStepEditorProps {
  steps: RecipeStep[]
  stepTypes: StepType[]
  onChange: (steps: RecipeStep[]) => void
}

const DraggableStepEditor: React.FC<DraggableStepEditorProps> = ({
  steps,
  stepTypes,
  onChange
}) => {
  // 直接使用传入的stepTypes
  const availableStepTypes = stepTypes

  // 拖拽结束处理
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const { source, destination } = result

    // 从步骤类型库拖到步骤列表
    if (source.droppableId === 'stepTypes' && destination.droppableId === 'steps') {
      const stepType = availableStepTypes[source.index]
      const newStep: RecipeStep = {
        stepTypeId: stepType.id,
        title: stepType.name,
        amount: '',
        duration: undefined,
        isCritical: false,
        isOptional: false
      }
      const newSteps = Array.from(steps)
      newSteps.splice(destination.index, 0, newStep)
      onChange(newSteps)
      return
    }

    // 在步骤列表内重新排序
    if (source.droppableId === 'steps' && destination.droppableId === 'steps') {
      const newSteps = Array.from(steps)
      const [removed] = newSteps.splice(source.index, 1)
      newSteps.splice(destination.index, 0, removed)
      onChange(newSteps)
      return
    }
  }

  // 更新步骤
  const updateStep = (index: number, field: keyof RecipeStep, value: any) => {
    const newSteps = [...steps]
    newSteps[index] = { ...newSteps[index], [field]: value }
    onChange(newSteps)
  }

  // 删除步骤
  const removeStep = (index: number) => {
    onChange(steps.filter((_, i) => i !== index))
  }

  // 添加空白步骤
  const addBlankStep = () => {
    const newStep: RecipeStep = {
      title: '',
      amount: '',
      isCritical: false,
      isOptional: false
    }
    onChange([...steps, newStep])
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4">
        {/* 左侧：步骤类型库 */}
        <div className="w-[280px] flex-shrink-0 rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">步骤类型库</div>
          <div className="max-h-[500px] overflow-y-auto p-2">
            <div className="mb-2 text-xs text-slate-400">💡 拖拽到右侧添加步骤</div>
            <Droppable droppableId="stepTypes" isDropDisabled={true}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {availableStepTypes.map((stepType, index) => (
                    <Draggable key={stepType.id} draggableId={`stepType-${stepType.id}`} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={provided.draggableProps.style}
                          className={`mb-2 flex cursor-grab items-center gap-2 rounded-md border px-3 py-2 ${
                            snapshot.isDragging ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50'
                          }`}
                        >
                          <GripVertical size={16} className="text-slate-400" />
                          <Badge variant="blue">{stepType.code}</Badge>
                          <span className="flex-1 text-sm text-slate-700">{stepType.name}</span>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        </div>

        {/* 右侧：步骤列表 */}
        <div className="flex-1 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">制作步骤</span>
              <Badge variant="blue">{steps.length} 个步骤</Badge>
            </div>
            <Btn variant="secondary" size="sm" icon={<Plus size={14} />} onClick={addBlankStep}>添加空白步骤</Btn>
          </div>

          <Droppable droppableId="steps">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`min-h-[400px] rounded-md p-2 ${snapshot.isDraggingOver ? 'bg-blue-50/40' : ''}`}
              >
                {steps.length === 0 ? (
                  <div className="py-16">
                    <EmptyState title="从左侧拖拽步骤类型到这里，或点击上方按钮添加空白步骤" />
                  </div>
                ) : (
                  steps.map((step, index) => (
                    <Draggable key={`step-${index}`} draggableId={`step-${index}`} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          style={provided.draggableProps.style}
                          className={`mb-3 rounded-lg border bg-white ${snapshot.isDragging ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200'}`}
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div {...provided.dragHandleProps} className="cursor-grab">
                                <GripVertical size={16} className="text-slate-400" />
                              </div>
                              <Badge variant="blue">步骤 {index + 1}</Badge>
                              {step.stepTypeId && (
                                <Badge variant="green">{stepTypes.find(t => t.id === step.stepTypeId)?.code}</Badge>
                              )}
                            </div>
                            <Btn variant="ghost" size="sm" icon={<Trash2 size={14} className="text-red-500" />} onClick={() => removeStep(index)} />
                          </div>

                          <div className="space-y-2 px-3 py-3">
                            {/* 步骤标题 */}
                            <TextInput
                              placeholder="步骤标题"
                              value={step.title || ''}
                              onChange={(v) => updateStep(index, 'title', v)}
                              className="font-medium"
                            />

                            {/* 用量和耗时 */}
                            <div className="flex items-center gap-2">
                              <div className="w-52">
                                <TextInput
                                  placeholder="数量/用量 (如: 200ml, 8块)"
                                  value={step.amount || ''}
                                  onChange={(v) => updateStep(index, 'amount', v)}
                                />
                              </div>
                              <div className="w-32">
                                <NumberInput
                                  value={step.duration ?? undefined}
                                  onChange={(v) => updateStep(index, 'duration', v)}
                                  min={0}
                                  suffix="秒"
                                />
                              </div>
                            </div>

                            {/* 打印代码预览 */}
                            {step.printCode && (
                              <div className="text-xs text-slate-400">
                                打印代码: <code className="text-blue-600">{step.printCode}</code>
                              </div>
                            )}

                            <div className="border-t border-slate-100" />

                            {/* 选项 */}
                            <div className="flex items-center gap-6">
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <Switch checked={!!step.isCritical} onCheckedChange={(c) => updateStep(index, 'isCritical', c)} />
                                关键步骤
                              </label>
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <Switch checked={!!step.isOptional} onCheckedChange={(c) => updateStep(index, 'isOptional', c)} />
                                可选步骤
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </div>
    </DragDropContext>
  )
}

export default DraggableStepEditor
