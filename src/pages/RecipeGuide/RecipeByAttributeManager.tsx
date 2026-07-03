import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Pencil, Copy, CheckCircle2, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getRecipes, createRecipe, updateRecipe, deleteRecipe } from '@/services/recipe'
import type { Recipe } from '@/services/recipe'
import RecipeFormModal from './RecipeFormModal'
import { SectionCard, Table, type Column, Btn, ConfirmDialog, toast } from '@/components/ui-kit'

interface ItemAttribute {
  name: string
  label: string
  options: Array<{ value: string; label: string }>
}

interface AttributeCombination {
  key: string
  attributes: Record<string, string>
  attributeLabels: Record<string, string>
  hasRecipe: boolean
  recipe?: Recipe
}

interface RecipeByAttributeManagerProps {
  itemId: string
  itemName: string
  itemAttributes: ItemAttribute[]
}

const RecipeByAttributeManager: React.FC<RecipeByAttributeManagerProps> = ({ itemId, itemName, itemAttributes }) => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [combinations, setCombinations] = useState<AttributeCombination[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | undefined>()
  const [selectedCombination, setSelectedCombination] = useState<AttributeCombination | undefined>()
  // 确认框：承载「批量复制」与「删除」两种确认
  const [confirm, setConfirm] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null)

  useEffect(() => {
    if (itemId) {
      loadRecipes()
      generateCombinations()
    }
  }, [itemId, itemAttributes])

  const loadRecipes = async () => {
    setLoading(true)
    try {
      const data = await getRecipes(itemId)
      setRecipes(data)
    } catch (error: any) {
      toast.error(error.message || '加载配方失败')
    } finally {
      setLoading(false)
    }
  }

  const generateCombinations = () => {
    if (!itemAttributes || itemAttributes.length === 0) {
      setCombinations([])
      return
    }

    const generate = (attrs: ItemAttribute[], index: number, current: Record<string, string>): Record<string, string>[] => {
      if (index >= attrs.length) return [{ ...current }]
      const attr = attrs[index]
      const results: Record<string, string>[] = []
      for (const option of attr.options) {
        const next = { ...current, [attr.name]: option.value }
        results.push(...generate(attrs, index + 1, next))
      }
      return results
    }

    const allCombinations = generate(itemAttributes, 0, {})
    const combinationsWithRecipes = allCombinations.map((combo) => {
      const key = Object.values(combo).join('-')
      const attributeLabels: Record<string, string> = {}
      Object.keys(combo).forEach((attrName) => {
        const attr = itemAttributes.find((a) => a.name === attrName)
        const option = attr?.options.find((o) => o.value === combo[attrName])
        attributeLabels[attrName] = option?.label || combo[attrName]
      })

      const recipe = recipes.find((r) => {
        const recipeAttrs = r.attributeConditions || {}
        return Object.keys(combo).every((k) => recipeAttrs[k] === combo[k])
      })

      return { key, attributes: combo, attributeLabels, hasRecipe: !!recipe, recipe }
    })

    setCombinations(combinationsWithRecipes)
  }

  useEffect(() => {
    generateCombinations()
  }, [recipes])

  const handleCreateRecipe = (combination?: AttributeCombination) => {
    setSelectedCombination(combination)
    setEditingRecipe(undefined)
    setModalVisible(true)
  }

  const handleEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe)
    setSelectedCombination(undefined)
    setModalVisible(true)
  }

  const handleCopyToAll = (sourceRecipe: Recipe) => {
    const targetCombinations = combinations.filter((c) => {
      const sourceAttrs = sourceRecipe.attributeConditions || {}
      return JSON.stringify(c.attributes) !== JSON.stringify(sourceAttrs)
    })

    setConfirm({
      title: '批量复制配方',
      description: `确定要将此配方复制到其他 ${targetCombinations.length} 个属性组合吗？已存在的配方将被覆盖。`,
      onConfirm: async () => {
        let successCount = 0
        let updateCount = 0
        for (const combo of targetCombinations) {
          try {
            if (combo.hasRecipe && combo.recipe?.id) {
              await updateRecipe(combo.recipe.id, {
                itemId: sourceRecipe.itemId,
                name: sourceRecipe.name,
                description: sourceRecipe.description,
                attributeConditions: combo.attributes,
                priority: sourceRecipe.priority,
                isDefault: sourceRecipe.isDefault,
                isActive: sourceRecipe.isActive,
                steps: sourceRecipe.steps,
              })
              updateCount++
            } else {
              await createRecipe({
                itemId: sourceRecipe.itemId,
                name: sourceRecipe.name,
                description: sourceRecipe.description,
                attributeConditions: combo.attributes,
                priority: sourceRecipe.priority,
                steps: sourceRecipe.steps,
              })
              successCount++
            }
          } catch (error) {
            console.error('复制失败:', error)
          }
        }
        toast.success(`成功创建 ${successCount} 个配方，更新 ${updateCount} 个配方`)
        setConfirm(null)
        loadRecipes()
      },
    })
  }

  const handleDeleteRecipe = (recipe: Recipe) => {
    setConfirm({
      title: t('pages.recipeGuide.deleteRecipe'),
      description: '确定要删除这个配方吗？',
      onConfirm: async () => {
        try {
          await deleteRecipe(recipe.id!)
          toast.success('删除成功')
          setConfirm(null)
          loadRecipes()
        } catch (error: any) {
          toast.error(error.message || '删除失败')
        }
      },
    })
  }

  const handleModalSuccess = () => {
    setModalVisible(false)
    loadRecipes()
  }

  const columns: Column<AttributeCombination>[] = useMemo(() => [
    ...itemAttributes.map((attr) => ({
      key: attr.name,
      title: attr.label,
      width: 120,
      render: (row: AttributeCombination) => row.attributeLabels[attr.name],
    })),
    {
      key: 'printCode',
      title: t('pages.recipeGuide.printCode'),
      width: 150,
      render: (row: AttributeCombination) => (
        row.hasRecipe && row.recipe?.printCodeString
          ? <code className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{row.recipe.printCodeString}</code>
          : <span className="text-slate-400">-</span>
      ),
    },
    {
      key: 'status',
      title: t('pages.recipeGuide.status'),
      width: 100,
      render: (row: AttributeCombination) => (
        row.hasRecipe
          ? <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ring-1 bg-green-50 text-green-600 ring-green-200"><CheckCircle2 className="w-3 h-3" />{t('pages.recipeGuide.configured')}</span>
          : <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 bg-slate-100 text-slate-500 ring-slate-200">{t('pages.recipeGuide.unconfigured')}</span>
      ),
    },
    {
      key: 'actions',
      title: t('pages.recipeGuide.actions'),
      width: 280,
      render: (row: AttributeCombination) => (
        <div className="flex items-center gap-1">
          {row.hasRecipe ? (
            <>
              <Btn variant="link" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => handleEditRecipe(row.recipe!)}>编辑</Btn>
              <Btn variant="link" icon={<Copy className="w-3.5 h-3.5" />} onClick={() => handleCopyToAll(row.recipe!)} />
              <Btn variant="link" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => handleDeleteRecipe(row.recipe!)} />
            </>
          ) : (
            <Btn variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => handleCreateRecipe(row)}>{t('pages.recipeGuide.createRecipe')}</Btn>
          )}
        </div>
      ),
    },
  ], [t, recipes, itemAttributes])

  const hasRecipeCount = combinations.filter((c) => c.hasRecipe).length
  const totalCount = combinations.length

  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          <span>{itemName} - {t('pages.recipeGuide.recipeManagement')}</span>
          <span className="text-xs px-1.5 py-0.5 rounded ring-1 bg-blue-50 text-blue-600 ring-blue-200">{hasRecipeCount} / {totalCount} {t('pages.recipeGuide.configured')}</span>
        </span>
      }
    >
      <Table columns={columns} data={combinations} rowKey={(r) => r.key} loading={loading} />

      {modalVisible && (
        <RecipeFormModal
          visible={modalVisible}
          itemId={itemId}
          recipe={editingRecipe}
          initialAttributeConditions={selectedCombination?.attributes}
          onClose={() => setModalVisible(false)}
          onSuccess={handleModalSuccess}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title ?? ''}
        description={confirm?.description}
        onConfirm={() => confirm?.onConfirm()}
      />
    </SectionCard>
  )
}

export default RecipeByAttributeManager
