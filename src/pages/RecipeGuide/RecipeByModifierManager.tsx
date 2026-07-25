import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, Pencil, Copy, CheckCircle2, Trash2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getRecipes, getRecipeById, generateCombinations, createRecipe, updateRecipe, updateRecipeSteps, deleteRecipe } from '@/services/recipe'
import type { Recipe, ModifierCombination } from '@/services/recipe/types'
import type { ItemModifierGroup } from '@/services/item-management'
import { SectionCard, Table, Btn, Badge, Checkbox, AlertBox, ConfirmDialog, toast, type Column } from '@/components/ui-kit'
import RecipeFormWithSteps from './RecipeFormWithSteps'
import { useAuthContext } from '@/auth/AuthProvider'
import { canEditModule } from '@/auth/permissions'

interface ModifierCombinationWithRecipe extends ModifierCombination {
  recipe?: Recipe
}

interface RecipeByModifierManagerProps {
  itemId: string
  itemName: string
  modifierGroups: ItemModifierGroup[]
}

// 批量复制确认对话框所需的上下文
interface CopyContext {
  fullRecipe: any
  targetCombinations: ModifierCombinationWithRecipe[]
  unconfiguredCount: number
  configuredCount: number
}

const RecipeByModifierManager: React.FC<RecipeByModifierManagerProps> = ({
  itemId,
  itemName,
  modifierGroups
}) => {
  const { t } = useTranslation()
  const { role, permissions } = useAuthContext()
  const canEdit = canEditModule('recipesSupplies', role, permissions)
  const [loading, setLoading] = useState(false)
  const [, setRecipes] = useState<Recipe[]>([])
  const [combinations, setCombinations] = useState<ModifierCombinationWithRecipe[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | undefined>()
  const [selectedCombination, setSelectedCombination] = useState<ModifierCombinationWithRecipe | undefined>()
  // 删除确认
  const [deletingRecipe, setDeletingRecipe] = useState<Recipe | undefined>()
  // 批量复制确认
  const [copyContext, setCopyContext] = useState<CopyContext | undefined>()
  const [copying, setCopying] = useState(false)

  // 用户选择的自定义选项组（根据已有配方智能勾选）
  const [selectedModifierGroupIds, setSelectedModifierGroupIds] = useState<string[]>([])
  // 记录上次初始化的 itemId，避免 modifierGroups 引用变化时重复覆盖用户的手动选择
  const initializedItemIdRef = useRef<string | null>(null)
  // 保持最新的 modifierGroups 引用，供 init effect 使用（避免 stale closure）
  const modifierGroupsRef = useRef(modifierGroups)
  useEffect(() => { modifierGroupsRef.current = modifierGroups }, [modifierGroups])

  // 初始化：仅在 itemId 变化时重新智能勾选自定义选项组
  useEffect(() => {
    if (!itemId) return
    if (initializedItemIdRef.current === itemId) return
    initializedItemIdRef.current = itemId

    const groups = modifierGroupsRef.current
    if (groups && groups.length > 0) {
      // 有自定义选项：读取已有配方条件来预选对应的自定义选项组
      getRecipes(itemId)
        .then(recipesData => {
          const usedGroupIds = new Set<string>()
          recipesData.recipes.forEach(recipe => {
            const r = recipe as any
            const conditions = r.modifier_conditions || r.modifierConditions || r.conditions
            if (conditions && Array.isArray(conditions)) {
              conditions.forEach((condition: any) => {
                const groupId = condition.modifier_group_id
                  || condition.modifierGroupId
                  || condition.groupId
                  || condition.modifier_group?.id
                if (groupId) usedGroupIds.add(groupId)
              })
            }
          })

          if (usedGroupIds.size > 0) {
            setSelectedModifierGroupIds(Array.from(usedGroupIds))
          } else {
            setSelectedModifierGroupIds([])
          }
        })
        .catch(() => {
          setSelectedModifierGroupIds(modifierGroupsRef.current.map(mg => mg.group!.id))
        })
    } else {
      setSelectedModifierGroupIds([])
    }
  }, [itemId])

  useEffect(() => {
    if (itemId) {
      loadRecipesAndCombinations()
    }
  }, [itemId, selectedModifierGroupIds])

  const loadRecipesAndCombinations = async () => {
    setLoading(true)
    try {
      const recipesData = await getRecipes(itemId)
      setRecipes(recipesData.recipes || [])

      // 如果没有自定义选项，创建一个默认组合
      if (selectedModifierGroupIds.length === 0) {
        const allRecipes = recipesData.recipes || []
        const defaultRecipes = allRecipes.filter((r: any) => {
          const conds = r.modifier_conditions ?? r.modifierConditions
          return !conds || (Array.isArray(conds) && conds.length === 0)
        })

        if (defaultRecipes.length === 0) {
          setCombinations([{ id: 'default', options: [], hasRecipe: false, recipe: undefined }])
        } else {
          setCombinations(defaultRecipes.map((r: any, i: number) => ({
            id: `default-${i}`,
            options: [],
            hasRecipe: true,
            recipe: r
          })))
        }
        return
      }

      // 生成所有可能的自定义选项组合
      const combinationsData = await generateCombinations(itemId, { modifierGroupIds: selectedModifierGroupIds })

      if (!combinationsData || !combinationsData.combinations || !Array.isArray(combinationsData.combinations)) {
        toast.error(t('pages.recipeGuide.byModifierManager.invalidCombinationData'))
        setCombinations([])
        return
      }

      // 将配方和组合匹配
      const combinationsWithRecipes = combinationsData.combinations.map((combo: any) => {
        let options = combo.options || []

        // 如果没有 options 但有 conditions，则转换 conditions 为 options
        if ((!options || options.length === 0) && combo.conditions && Array.isArray(combo.conditions)) {
          options = combo.conditions.map((cond: any) => {
            const groupId = cond.groupId || cond.modifierGroupId
            const optionId = cond.optionId || cond.modifierOptionId
            const modifierGroup = modifierGroups.find(mg => mg.group?.id === groupId)
            const option = modifierGroup?.group?.options?.find(opt => opt.id === optionId)
            return {
              modifierGroupId: groupId,
              modifierOptionId: optionId,
              displayName: option?.displayName || option?.name || cond.optionName || t('pages.recipeGuide.byModifierManager.unknownOption')
            }
          })
        }

        // 查找匹配的配方，优先使用后端返回的 existingRecipeId
        let recipe: Recipe | undefined = undefined
        if (combo.hasRecipe && combo.existingRecipeId) {
          recipe = (recipesData.recipes || []).find(r => r.id === combo.existingRecipeId)
        }

        // 如果没找到，尝试通过条件匹配
        if (!recipe && options.length > 0) {
          recipe = (recipesData.recipes || []).find(r => {
            const conds = (r as any).modifier_conditions || r.modifierConditions
            if (!conds || conds.length === 0) return false
            if (conds.length !== options.length) return false
            return conds.every((cond: any) => {
              const condGroupId = cond.modifier_group_id || cond.modifierGroupId
              const condOptId = cond.modifier_option_id || cond.modifierOptionId
              return options.some((opt: any) =>
                opt.modifierGroupId === condGroupId &&
                opt.modifierOptionId === condOptId
              )
            })
          })
        }

        return {
          id: combo.combinationId || combo.id || '',
          options,
          hasRecipe: !!recipe,
          recipe
        }
      })

      // 排序组合：按照用户选择的自定义选项组顺序排序
      const sortedCombinations = combinationsWithRecipes.sort((a, b) => {
        for (const groupId of selectedModifierGroupIds) {
          const aOption = a.options.find(opt => opt.modifierGroupId === groupId)
          const bOption = b.options.find(opt => opt.modifierGroupId === groupId)

          if (!aOption && !bOption) continue
          if (!aOption) return 1
          if (!bOption) return -1

          const modifierGroup = modifierGroups.find(mg => mg.group?.id === groupId)
          const aModifierOption = modifierGroup?.group?.options?.find(opt => opt.id === aOption.modifierOptionId)
          const bModifierOption = modifierGroup?.group?.options?.find(opt => opt.id === bOption.modifierOptionId)

          const aOrder = aModifierOption?.displayOrder ?? 999
          const bOrder = bModifierOption?.displayOrder ?? 999

          if (aOrder !== bOrder) return aOrder - bOrder

          const nameComparison = (aOption.displayName || '').localeCompare(bOption.displayName || '')
          if (nameComparison !== 0) return nameComparison
        }
        return 0
      })

      setCombinations(sortedCombinations)
    } catch (error: any) {
      toast.error(error.message || t('pages.recipeGuide.byModifierManager.loadRecipesFailed'))
      setCombinations([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRecipe = (combination?: ModifierCombinationWithRecipe) => {
    setSelectedCombination(combination)
    setEditingRecipe(undefined)
    setModalVisible(true)
  }

  const handleEditRecipe = async (recipe: Recipe) => {
    if (!recipe) {
      toast.error(t('pages.recipeGuide.byModifierManager.recipeLoadFailedRefresh'))
      return
    }

    try {
      // 如果配方没有步骤数据，从详情API获取完整数据
      if (!recipe.steps || recipe.steps.length === 0) {
        const fullRecipe = await getRecipeById(recipe.id)
        setEditingRecipe(fullRecipe)
      } else {
        setEditingRecipe(recipe)
      }

      setSelectedCombination(undefined)
      setModalVisible(true)
    } catch (error: any) {
      toast.error(error.message || t('pages.recipeGuide.byModifierManager.loadRecipeDetailFailed'))
    }
  }

  // 打开批量复制确认框：先拉取完整配方并计算目标组合数量
  const handleCopyToAll = async (sourceRecipe: Recipe) => {
    try {
      if (selectedModifierGroupIds.length === 0) {
        toast.info(t('pages.recipeGuide.byModifierManager.noModifierGroupsNoCopyNeeded'))
        return
      }

      const fullRecipe = await getRecipeById(sourceRecipe.id)

      if (!fullRecipe.steps || fullRecipe.steps.length === 0) {
        toast.error(t('pages.recipeGuide.byModifierManager.noStepsCannotCopy'))
        return
      }

      const targetCombinations = combinations.filter(c => c.recipe?.id !== sourceRecipe.id)

      if (targetCombinations.length === 0) {
        toast.info(t('pages.recipeGuide.byModifierManager.noOtherCombinationsToCopy'))
        return
      }

      const unconfiguredCount = targetCombinations.filter(c => !c.hasRecipe).length
      const configuredCount = targetCombinations.filter(c => c.hasRecipe).length

      setCopyContext({ fullRecipe, targetCombinations, unconfiguredCount, configuredCount })
    } catch (error: any) {
      toast.error(error.message || t('pages.recipeGuide.byModifierManager.getRecipeDetailFailed'))
    }
  }

  // 执行批量复制
  const runCopyToAll = async () => {
    if (!copyContext) return
    const { fullRecipe, targetCombinations } = copyContext
    setCopying(true)

    let successCount = 0
    let updateCount = 0
    let createCount = 0
    let errorCount = 0

    for (const combo of targetCombinations) {
      try {
        const conditions = combo.options.map(opt => ({
          modifierGroupId: opt.modifierGroupId,
          modifierOptionId: opt.modifierOptionId
        }))

        // 使用完整配方的步骤数据，转换为新格式
        const steps = fullRecipe.steps.map((step: any, index: number) => {
          const meta = step.metadata
          if (meta?.subSteps && Array.isArray(meta.subSteps)) {
            return {
              subSteps: meta.subSteps,
              wrapSymbol: meta.wrapSymbol ?? meta.separator ?? '',
              stepInstruction: step.instruction || '',
              displayOrder: index + 1
            }
          }
          const typeId = step.step_type_id || step.stepTypeId || ''
          return {
            subSteps: [{ stepTypeId: typeId, instruction: step.instruction || '' }],
            wrapSymbol: '',
            stepInstruction: '',
            displayOrder: index + 1
          }
        })

        const fr = fullRecipe as any
        const sourcePrintCode = fr.printCode || fr.print_code || ''

        if (combo.hasRecipe && combo.recipe) {
          await updateRecipe(combo.recipe.id, { description: fr.description, printCode: sourcePrintCode })
          if (steps && steps.length > 0) {
            await updateRecipeSteps(combo.recipe.id, { steps })
          }
          updateCount++
        } else {
          await createRecipe({ itemId, printCode: sourcePrintCode, description: fr.description, conditions, steps })
          createCount++
        }

        successCount++
      } catch (error: any) {
        errorCount++
      }
    }

    const messages = []
    if (createCount > 0) messages.push(t('pages.recipeGuide.byModifierManager.createdCount', { count: createCount }))
    if (updateCount > 0) messages.push(t('pages.recipeGuide.byModifierManager.updatedCount', { count: updateCount }))

    if (successCount > 0) {
      toast.success(t('pages.recipeGuide.byModifierManager.copyResultSuccess', {
        messages: messages.join('，'),
        failSuffix: errorCount > 0 ? t('pages.recipeGuide.byModifierManager.failedCountSuffix', { count: errorCount }) : ''
      }))
    } else {
      toast.error(t('pages.recipeGuide.byModifierManager.allCopyFailed'))
    }

    setCopying(false)
    setCopyContext(undefined)
    loadRecipesAndCombinations()
  }

  const handleDeleteRecipe = async () => {
    if (!deletingRecipe) return
    try {
      await deleteRecipe(deletingRecipe.id)
      toast.success(t('pages.recipeGuide.deleteSuccess'))
      setDeletingRecipe(undefined)
      loadRecipesAndCombinations()
    } catch (error: any) {
      toast.error(error.message || t('pages.recipeGuide.deleteFailed'))
    }
  }

  const handleModalSuccess = () => {
    setModalVisible(false)
    loadRecipesAndCombinations()
  }

  // 生成表格列
  const columns: Column<ModifierCombinationWithRecipe>[] = useMemo(() => {
    const selectedGroups = selectedModifierGroupIds
      .map(groupId => modifierGroups.find(mg => mg.group!.id === groupId))
      .filter(mg => mg !== undefined) as ItemModifierGroup[]

    const modifierColumns: Column<ModifierCombinationWithRecipe>[] = selectedGroups.map(mg => ({
      key: mg.group!.id,
      title: mg.group?.displayName || mg.group?.name || t('pages.recipeGuide.byModifierManager.defaultOptionLabel'),
      render: (record) => {
        if (!record.options || !Array.isArray(record.options)) {
          return <span className="text-slate-400">-</span>
        }
        const option = record.options.find(opt => opt.modifierGroupId === mg.group!.id)
        return option ? <Badge variant="blue">{option.displayName}</Badge> : <span className="text-slate-400">-</span>
      }
    }))

    return [
      ...modifierColumns,
      {
        key: 'printCode',
        title: t('pages.recipeGuide.printCode'),
        render: (record) => {
          const rc = record.recipe as any
          const pc = rc?.printCode || rc?.print_code
          const dcs = rc?.displayCodeString || rc?.display_code_string
          return record.hasRecipe && pc ? (
            <div className="flex flex-col">
              <code className="text-xs text-slate-700">{pc}</code>
              {dcs && <span className="text-[11px] text-slate-400">{dcs}</span>}
            </div>
          ) : <span className="text-slate-400">-</span>
        }
      },
      {
        key: 'status',
        title: t('pages.recipeGuide.status'),
        render: (record) => (
          record.hasRecipe
            ? <Badge variant="green" icon={<CheckCircle2 size={12} />}>{t('pages.recipeGuide.configured')}</Badge>
            : <Badge variant="default">{t('pages.recipeGuide.unconfigured')}</Badge>
        )
      },
      {
        key: 'actions',
        title: t('pages.recipeGuide.actions'),
        render: (record) => !canEdit ? null : (
          <div className="flex items-center gap-1">
            {record.hasRecipe ? (
              <>
                <Btn variant="link" size="sm" icon={<Pencil size={14} />} onClick={() => handleEditRecipe(record.recipe!)}>{t('pages.recipeGuide.byModifierManager.editAction')}</Btn>
                <Btn variant="ghost" size="sm" icon={<Copy size={14} />} title={t('pages.recipeGuide.byModifierManager.copyToAllTooltip')} onClick={() => handleCopyToAll(record.recipe!)} />
                <Btn variant="ghost" size="sm" icon={<Trash2 size={14} className="text-red-500" />} title={t('pages.recipeGuide.byModifierManager.deleteRecipeTooltip')} onClick={() => setDeletingRecipe(record.recipe!)} />
              </>
            ) : (
              <Btn variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => handleCreateRecipe(record)}>
                {t('pages.recipeGuide.createRecipe')}
              </Btn>
            )}
          </div>
        )
      }
    ]
  }, [t, modifierGroups, selectedModifierGroupIds, combinations])

  const hasRecipeCount = combinations.filter(c => c.hasRecipe).length
  const totalCount = combinations.length

  // 处理自定义选项组选择变化
  const handleModifierGroupChange = (groupId: string, checked: boolean) => {
    if (checked) {
      setSelectedModifierGroupIds([...selectedModifierGroupIds, groupId])
    } else {
      setSelectedModifierGroupIds(selectedModifierGroupIds.filter(id => id !== groupId))
    }
  }

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedModifierGroupIds(modifierGroups.map(mg => mg.group!.id))
    } else {
      setSelectedModifierGroupIds([])
    }
  }

  // 计算可能的组合数量（笛卡尔积）
  const estimatedCombinations = useMemo(() => {
    const selectedGroups = modifierGroups.filter(mg => selectedModifierGroupIds.includes(mg.group!.id))
    if (selectedGroups.length === 0) return 0

    return selectedGroups.reduce((total, mg) => {
      const optionCount = mg.group?.options?.length || 0
      return total * (optionCount > 0 ? optionCount : 1)
    }, 1)
  }, [modifierGroups, selectedModifierGroupIds])

  return (
    <div className="space-y-6">
      {/* 自定义选项组选择器 - 仅当有自定义选项时显示 */}
      {modifierGroups && modifierGroups.length > 0 && (
        <SectionCard title={t('pages.recipeGuide.byModifierManager.step1Title')}>
          <div className="space-y-3">
            <Checkbox
              checked={selectedModifierGroupIds.length === modifierGroups.length}
              onCheckedChange={handleSelectAll}
              label={t('pages.recipeGuide.byModifierManager.selectAllToggle')}
            />

            <div className="flex flex-wrap gap-4">
              {modifierGroups.map(mg => (
                <Checkbox
                  key={mg.group!.id}
                  checked={selectedModifierGroupIds.includes(mg.group!.id)}
                  onCheckedChange={(c) => handleModifierGroupChange(mg.group!.id, c)}
                  label={
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">{mg.group?.displayName || mg.group?.name}</span>
                      <Badge variant="blue">{t('pages.recipeGuide.byModifierManager.optionsCountBadge', { count: mg.group?.options?.length || 0 })}</Badge>
                    </span>
                  }
                />
              ))}
            </div>

            {selectedModifierGroupIds.length > 0 && (
              <AlertBox
                type="info"
                title={
                  <span className="flex items-center gap-2">
                    <span>{t('pages.recipeGuide.byModifierManager.estimatedCombinationsPrefix')} <strong className="text-amber-600">{estimatedCombinations}</strong> {t('pages.recipeGuide.byModifierManager.estimatedCombinationsSuffix')}</span>
                    <Btn variant="link" size="sm" icon={<RefreshCw size={14} />} onClick={loadRecipesAndCombinations} loading={loading}>{t('pages.recipeGuide.byModifierManager.regenerateCombinations')}</Btn>
                  </span>
                }
              />
            )}
          </div>
        </SectionCard>
      )}

      {/* 配方组合表格 */}
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <span>{modifierGroups && modifierGroups.length > 0 ? t('pages.recipeGuide.byModifierManager.titleStepPrefix') : ''}{itemName} - {modifierGroups && modifierGroups.length > 0 ? t('pages.recipeGuide.byModifierManager.titleSuffixWithModifiers') : t('pages.recipeGuide.byModifierManager.titleSuffixWithoutModifiers')}</span>
            <Badge variant="blue">{hasRecipeCount} / {totalCount} {t('pages.recipeGuide.configured')}</Badge>
          </span>
        }
        action={<span className="text-sm text-slate-400">{modifierGroups && modifierGroups.length > 0 ? t('pages.recipeGuide.byModifierManager.combinationCountAction', { count: totalCount }) : t('pages.recipeGuide.byModifierManager.singleRecipeAction')}</span>}
      >
        <Table
          columns={columns}
          data={combinations}
          rowKey={(r) => r.id}
          loading={loading}
        />
      </SectionCard>

      {/* 配方创建/编辑模态框（带步骤编辑器） */}
      {modalVisible && (() => {
        const er = editingRecipe as any
        const existingConds = er?.modifierConditions || er?.modifier_conditions
        const modifierConditions = existingConds && existingConds.length > 0
          ? existingConds.map((cond: any) => {
              const groupId = cond.modifierGroupId || cond.modifier_group_id || cond.modifier_group?.id
              const optionId = cond.modifierOptionId || cond.modifier_option_id || cond.modifier_option?.id
              const mg = modifierGroups.find(g => g.group?.id === groupId)
              const opt = mg?.group?.options?.find(o => o.id === optionId)
              const displayName = opt?.displayName || opt?.name
                || cond.modifier_option?.display_name || cond.modifier_option?.name
                || cond.modifier_option?.displayName
              return { modifierGroupId: groupId, modifierOptionId: optionId, displayName }
            })
          : selectedCombination?.options.map(opt => ({
              modifierGroupId: opt.modifierGroupId,
              modifierOptionId: opt.modifierOptionId,
              displayName: opt.displayName
            }))

        return (
          <RecipeFormWithSteps
            visible={modalVisible}
            itemId={itemId}
            itemName={itemName}
            recipe={editingRecipe}
            initialModifierConditions={modifierConditions}
            onClose={() => setModalVisible(false)}
            onSuccess={handleModalSuccess}
          />
        )
      })()}

      {/* 删除配方确认 */}
      <ConfirmDialog
        open={!!deletingRecipe}
        onOpenChange={(o) => { if (!o) setDeletingRecipe(undefined) }}
        title={t('pages.recipeGuide.deleteRecipe')}
        description={t('pages.recipeGuide.byModifierManager.deleteRecipeConfirmDesc')}
        danger
        onConfirm={handleDeleteRecipe}
      />

      {/* 批量复制配方确认 */}
      <ConfirmDialog
        open={!!copyContext}
        onOpenChange={(o) => { if (!o && !copying) setCopyContext(undefined) }}
        title={t('pages.recipeGuide.byModifierManager.batchCopyTitle')}
        confirmText={t('pages.recipeGuide.confirmCopy')}
        danger={(copyContext?.configuredCount ?? 0) > 0}
        loading={copying}
        onConfirm={runCopyToAll}
        description={copyContext && (
          <div className="space-y-1">
            <div>{t('pages.recipeGuide.byModifierManager.copyToOtherCombinationsDesc', { count: copyContext.targetCombinations.length })}</div>
            {copyContext.unconfiguredCount > 0 && (
              <div className="text-xs text-green-600">• {t('pages.recipeGuide.byModifierManager.unconfiguredWillCreate', { count: copyContext.unconfiguredCount })}</div>
            )}
            {copyContext.configuredCount > 0 && (
              <div className="text-xs text-amber-600">• {t('pages.recipeGuide.byModifierManager.configuredWillOverwrite', { count: copyContext.configuredCount })}</div>
            )}
            <div className="mt-2 text-xs text-blue-600">{t('pages.recipeGuide.byModifierManager.willCopySteps', { count: copyContext.fullRecipe.steps.length })}</div>
            <div className="text-xs text-slate-400">{t('pages.recipeGuide.byModifierManager.copyHint')}</div>
          </div>
        )}
      />
    </div>
  )
}

export default RecipeByModifierManager
