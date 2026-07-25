import React, { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getStepTypes, deleteStepType } from '@/services/recipe'
import type { StepType } from '@/services/recipe'
import StepTypeFormModalEnhanced from './StepTypeFormModalEnhanced'
import { Table, type Column, Btn, EmptyState, ConfirmDialog, toast } from '@/components/ui-kit'
import { useAuthContext } from '@/auth/AuthProvider'
import { canEditModule } from '@/auth/permissions'

const StepTypeManagement: React.FC = () => {
  const { t } = useTranslation()
  const { role, permissions } = useAuthContext()
  const canEdit = canEditModule('recipesSupplies', role, permissions)
  const [stepTypes, setStepTypes] = useState<StepType[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingStepType, setEditingStepType] = useState<StepType | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    loadStepTypes()
  }, [])

  const loadStepTypes = async () => {
    setLoading(true)
    try {
      const data = await getStepTypes()
      setStepTypes(data)
    } catch (error: any) {
      toast.error(error.message || t('pages.recipeGuide.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteStepType(deleteId)
      toast.success(t('pages.recipeGuide.deleteSuccess'))
      setDeleteId(null)
      loadStepTypes()
    } catch (error: any) {
      toast.error(error.message || t('pages.recipeGuide.deleteFailed'))
    }
  }

  const handleCreate = () => {
    setEditingStepType(undefined)
    setModalVisible(true)
  }

  const handleEdit = (record: StepType) => {
    setEditingStepType(record)
    setModalVisible(true)
  }

  const columns: Column<StepType>[] = [
    { key: 'code', title: t('pages.recipeGuide.stepTypeCode'), width: 150, render: (r) => r.code },
    { key: 'name', title: t('pages.recipeGuide.stepTypeName'), render: (r) => r.name },
    {
      key: 'actions', title: t('pages.recipeGuide.actions'), width: 150,
      render: (r) => !canEdit ? null : (
        <div className="flex items-center gap-1">
          <Btn variant="link" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => handleEdit(r)}>{t('pages.recipeGuide.edit')}</Btn>
          <Btn variant="link" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setDeleteId(r.id)}>{t('pages.recipeGuide.delete')}</Btn>
        </div>
      ),
    },
  ]

  return (
    <div>
      {canEdit && (
        <div className="mb-4">
          <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleCreate}>{t('pages.recipeGuide.createStepType')}</Btn>
        </div>
      )}

      <StepTypeFormModalEnhanced
        visible={modalVisible}
        stepType={editingStepType}
        existingStepTypes={stepTypes}
        onClose={() => { setModalVisible(false); setEditingStepType(undefined) }}
        onSuccess={loadStepTypes}
      />

      {!loading && stepTypes.length === 0 ? (
        <EmptyState
          title={t('pages.recipeGuide.noStepTypes')}
          action={canEdit ? <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleCreate}>{t('pages.recipeGuide.createFirstStepType')}</Btn> : undefined}
        />
      ) : (
        <Table columns={columns} data={stepTypes} rowKey={(r) => r.id} loading={loading} />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title={t('pages.recipeGuide.deleteStepTypeConfirm')}
        description={t('pages.recipeGuide.deleteWarning')}
        danger
        confirmText={t('pages.recipeGuide.confirm')}
        cancelText={t('pages.recipeGuide.cancel')}
        onConfirm={handleDelete}
      />
    </div>
  )
}

export default StepTypeManagement
