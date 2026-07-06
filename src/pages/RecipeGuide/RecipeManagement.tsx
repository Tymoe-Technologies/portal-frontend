import React, { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getRecipes, deleteRecipe } from '@/services/recipe'
import type { Recipe } from '@/services/recipe'
import { Table, Btn, Badge, EmptyState, ConfirmDialog, toast, type Column } from '@/components/ui-kit'
import RecipeFormModal from './RecipeFormModal'

interface RecipeManagementProps {
  itemId?: string
}

const RecipeManagement: React.FC<RecipeManagementProps> = ({ itemId }) => {
  const { t } = useTranslation()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | undefined>()
  const [deletingRecipe, setDeletingRecipe] = useState<Recipe | undefined>()

  useEffect(() => {
    if (itemId) {
      loadRecipes()
    } else {
      setRecipes([])
    }
  }, [itemId])

  const loadRecipes = async () => {
    if (!itemId) return

    setLoading(true)
    try {
      const data = await getRecipes(itemId)
      setRecipes(data.recipes || [])
    } catch (error: any) {
      toast.error(error.message || t('pages.recipeGuide.loadFailed'))
      setRecipes([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingRecipe) return
    try {
      await deleteRecipe(deletingRecipe.id)
      toast.success(t('pages.recipeGuide.deleteSuccess'))
      setDeletingRecipe(undefined)
      loadRecipes()
    } catch (error: any) {
      toast.error(error.message || t('pages.recipeGuide.deleteFailed'))
    }
  }

  const handleCreate = () => {
    setEditingRecipe(undefined)
    setModalVisible(true)
  }

  const handleEdit = (record: Recipe) => {
    setEditingRecipe(record)
    setModalVisible(true)
  }

  const handleModalClose = () => {
    setModalVisible(false)
    setEditingRecipe(undefined)
  }

  const columns: Column<Recipe>[] = [
    {
      key: 'name',
      title: t('pages.recipeGuide.recipeName'),
      width: 200,
      render: (r) => r.name
    },
    {
      key: 'version',
      title: t('pages.recipeGuide.recipeVersion'),
      width: 100,
      render: (r) => r.version
    },
    {
      key: 'isDefault',
      title: t('pages.recipeGuide.isDefault'),
      width: 120,
      render: (r) => r.isDefault
        ? <Badge variant="green" icon={<CheckCircle2 size={12} />}>{t('pages.recipeGuide.isDefault')}</Badge>
        : null
    },
    {
      key: 'isActive',
      title: t('pages.recipeGuide.isActive'),
      width: 100,
      render: (r) => r.isActive
        ? <Badge variant="green">{t('pages.recipeGuide.isActive')}</Badge>
        : <Badge variant="default">{t('pages.menuCenter.inactive')}</Badge>
    },
    {
      key: 'stepCount',
      title: t('pages.recipeGuide.stepCount'),
      width: 100,
      render: (r) => r.steps?.length || 0
    },
    {
      key: 'actions',
      title: t('pages.recipeGuide.actions'),
      width: 150,
      render: (r) => (
        <div className="flex items-center gap-1">
          <Btn variant="link" size="sm" icon={<Pencil size={14} />} onClick={() => handleEdit(r)}>编辑</Btn>
          <Btn variant="ghost" size="sm" icon={<Trash2 size={14} className="text-red-500" />} title="删除配方" onClick={() => setDeletingRecipe(r)} />
        </div>
      )
    }
  ]

  if (!itemId) {
    return (
      <div className="py-16">
        <EmptyState title={t('pages.recipeGuide.noItemSelected')} />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Btn variant="primary" icon={<Plus size={16} />} onClick={handleCreate}>
          {t('pages.recipeGuide.createRecipe')}
        </Btn>
        <span className="text-sm text-slate-400">当前配方数量: {recipes.length}</span>
      </div>

      <RecipeFormModal
        visible={modalVisible}
        recipe={editingRecipe}
        itemId={itemId}
        onClose={handleModalClose}
        onSuccess={loadRecipes}
      />

      <Table
        columns={columns}
        data={recipes}
        rowKey={(r) => r.id}
        loading={loading}
        empty={
          <EmptyState
            title={t('pages.recipeGuide.noRecipes')}
            action={<Btn variant="primary" icon={<Plus size={16} />} onClick={handleCreate}>{t('pages.recipeGuide.createFirstRecipe')}</Btn>}
          />
        }
      />

      <ConfirmDialog
        open={!!deletingRecipe}
        onOpenChange={(o) => { if (!o) setDeletingRecipe(undefined) }}
        title={t('pages.recipeGuide.deleteRecipeConfirm')}
        description={t('pages.recipeGuide.deleteWarning')}
        confirmText={t('pages.recipeGuide.confirm')}
        cancelText={t('pages.recipeGuide.cancel')}
        danger
        onConfirm={handleDelete}
      />
    </div>
  )
}

export default RecipeManagement
