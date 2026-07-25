import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Save } from 'lucide-react'
import {
  SectionCard,
  Table,
  TextInput,
  Badge,
  EmptyState,
  AlertBox,
  Btn,
  toast,
  type Column
} from '@/components/ui-kit'
import {
  itemManagementService,
  type ModifierGroup,
  type ModifierOption
} from '../../services/item-management'
import { useAuthContext } from '../../auth/AuthProvider'
import { canEditModule } from '../../auth/permissions'

const ModifierPrintCodeManagement: React.FC = () => {
  const { t } = useTranslation()
  const { role, permissions } = useAuthContext()
  const canEdit = canEditModule('menuCatalog', role, permissions)
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  // 打印代码（base）的编辑中值，key 为 optionId
  const [editingValues, setEditingValues] = useState<Record<string, string>>({})
  // 用量的编辑中值，key 为 optionId
  const [editingUsageValues, setEditingUsageValues] = useState<Record<string, string>>({})

  // 加载自定义选项组，并合并已保存的打印配置
  const loadModifierGroups = async () => {
    setLoading(true)
    try {
      const [groupsWithOptions, printConfigs] = await Promise.all([
        itemManagementService.getModifierGroups({ isActive: true }),
        itemManagementService.getAllPrintConfigs().catch(() => [])
      ])

      const configMap = new Map(printConfigs.map(c => [c.modifierOptionId, c]))

      // DB 中 print_code 只存 base，直接用作 printBaseCode
      const merged = groupsWithOptions.map(group => ({
        ...group,
        options: (group.options || []).map(opt => {
          const config = configMap.get(opt.id)
          if (!config || !config.printCode) return opt
          return {
            ...opt,
            printBaseCode: config.printCode,
            printInstruction: config.instruction ?? ''
          }
        })
      }))

      setModifierGroups(merged)
      // 刷新时清除未保存的编辑内容
      setEditingValues({})
      setEditingUsageValues({})
    } catch (error) {
      console.error('Failed to load modifier groups:', error)
      toast.error(t('pages.recipeGuide.modifierPrintCode.loadFailed') as string)
      setModifierGroups([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadModifierGroups()
  }, [])

  // 收集所有有变更的选项
  const getChangedOptions = () => {
    const changed: Array<{
      groupId: string
      option: ModifierOption
      newBase: string
      newInstruction: string
    }> = []

    for (const group of modifierGroups) {
      for (const opt of group.options || []) {
        const savedBase = opt.printBaseCode ?? ''
        const savedUsage = opt.printInstruction ?? ''
        const newBase = editingValues[opt.id] !== undefined ? editingValues[opt.id] : savedBase
        const newInstruction = editingUsageValues[opt.id] !== undefined ? editingUsageValues[opt.id] : savedUsage
        if (newBase !== savedBase || newInstruction !== savedUsage) {
          changed.push({ groupId: group.id, option: opt, newBase, newInstruction })
        }
      }
    }
    return changed
  }

  // 统一保存所有有变更的选项
  const handleSaveAll = async () => {
    const changed = getChangedOptions()
    if (changed.length === 0) return

    setSaving(true)
    const errors: string[] = []

    for (const { groupId, option, newBase, newInstruction } of changed) {
      try {
        await itemManagementService.updatePrintConfig(groupId, option.id, {
          printCode: newBase.trim(),
          instruction: newInstruction
        })

        // 保存成功后更新本地状态
        setModifierGroups(prev =>
          prev.map(g => {
            if (g.id !== groupId) return g
            return {
              ...g,
              options: (g.options || []).map(opt => {
                if (opt.id !== option.id) return opt
                return {
                  ...opt,
                  printBaseCode: newBase.trim() || undefined,
                  printInstruction: newBase.trim() ? newInstruction : undefined
                }
              })
            }
          })
        )
        setEditingValues(prev => { const s = { ...prev }; delete s[option.id]; return s })
        setEditingUsageValues(prev => { const s = { ...prev }; delete s[option.id]; return s })
      } catch (error: any) {
        const status = error?.response?.status
        const errMsg = error?.response?.data?.error || error?.message || ''
        if (status === 409) {
          errors.push(errMsg || (t('pages.recipeGuide.modifierPrintCode.duplicatePrintCode', { name: option.displayName }) as string))
        } else {
          errors.push(t('pages.recipeGuide.modifierPrintCode.saveOneFailed', { name: option.displayName }) as string)
        }
      }
    }

    setSaving(false)

    if (errors.length === 0) {
      toast.success(t('pages.recipeGuide.modifierPrintCode.savedCount', { count: changed.length }) as string)
    } else if (errors.length < changed.length) {
      toast.warning(t('pages.recipeGuide.modifierPrintCode.partialSaveFailed', { errors: errors.join('；') }) as string)
    } else {
      toast.error(errors.join('；'))
    }
  }

  // 展开的行渲染
  const expandedRowRender = (group: ModifierGroup) => {
    const options = group.options || []

    if (options.length === 0) {
      return <EmptyState title={t('pages.recipeGuide.modifierPrintCode.noOptionsInGroup') as string} />
    }

    const subColumns: Column<ModifierOption>[] = [
      {
        key: 'displayName',
        title: t('pages.recipeGuide.modifierPrintCode.optionName') as string,
        width: 140,
        render: (r) => r.displayName
      },
      {
        key: 'code',
        title: t('pages.recipeGuide.modifierPrintCode.printCode') as string,
        width: 160,
        render: (record) => {
          const savedBase = record.printBaseCode ?? ''
          const editValue = editingValues[record.id] !== undefined ? editingValues[record.id] : savedBase
          const isDirty = editValue !== savedBase
          return (
            <TextInput
              value={editValue}
              placeholder={t('pages.recipeGuide.modifierPrintCode.printCodePlaceholder') as string}
              maxLength={20}
              disabled={!canEdit}
              onChange={(v) => setEditingValues(prev => ({ ...prev, [record.id]: v }))}
              className={isDirty ? 'border-amber-400' : ''}
            />
          )
        }
      },
      {
        key: 'instruction',
        title: t('pages.recipeGuide.modifierPrintCode.usage') as string,
        width: 160,
        render: (record) => {
          const savedUsage = record.printInstruction ?? ''
          const editValue = editingUsageValues[record.id] !== undefined ? editingUsageValues[record.id] : savedUsage
          const isDirty = editValue !== savedUsage
          return (
            <TextInput
              value={editValue}
              placeholder={t('pages.recipeGuide.modifierPrintCode.usagePlaceholder') as string}
              maxLength={50}
              disabled={!canEdit}
              onChange={(v) => setEditingUsageValues(prev => ({ ...prev, [record.id]: v }))}
              className={isDirty ? 'border-amber-400' : ''}
            />
          )
        }
      },
      {
        key: 'combined',
        title: t('pages.recipeGuide.modifierPrintCode.combinedPreview') as string,
        width: 160,
        render: (record) => {
          const base = editingValues[record.id] !== undefined
            ? editingValues[record.id]
            : (record.printBaseCode ?? '')
          const usage = editingUsageValues[record.id] !== undefined
            ? editingUsageValues[record.id]
            : (record.printInstruction ?? '')
          const combined = base + usage
          if (!combined) return <span className="text-slate-400">-</span>
          return <code className="text-[13px] text-blue-600">{combined}</code>
        }
      }
    ]

    return (
      <div className="my-2">
        <Table columns={subColumns} data={options} rowKey={(r) => r.id} />
      </div>
    )
  }

  const columns: Column<ModifierGroup>[] = [
    {
      key: 'displayName',
      title: t('pages.recipeGuide.modifierPrintCode.groupName') as string,
      width: 200,
      render: (r) => r.displayName
    },
    {
      key: 'optionCount',
      title: t('pages.recipeGuide.modifierPrintCode.optionCount') as string,
      width: 100,
      align: 'center',
      render: (record) => {
        const count = record.options?.length || 0
        return <Badge variant={count > 0 ? 'blue' : 'default'}>{t('pages.recipeGuide.modifierPrintCode.optionCountUnit', { count }) as string}</Badge>
      }
    }
  ]

  const changedCount = getChangedOptions().length

  return (
    <SectionCard
      title={t('pages.recipeGuide.modifierPrintCode.title') as string}
      description={t('pages.recipeGuide.modifierPrintCode.description') as string}
      action={
        <div className="flex items-center gap-2">
          <Btn variant="secondary" icon={<RefreshCw size={16} />} onClick={loadModifierGroups} loading={loading}>{t('pages.recipeGuide.modifierPrintCode.refresh') as string}</Btn>
          {canEdit && (
            <Btn variant="primary" icon={<Save size={16} />} loading={saving} disabled={changedCount === 0} onClick={handleSaveAll}>
              {changedCount > 0
                ? (t('pages.recipeGuide.modifierPrintCode.saveWithCount', { count: changedCount }) as string)
                : (t('pages.recipeGuide.modifierPrintCode.save') as string)}
            </Btn>
          )}
        </div>
      }
    >
      <div className="mb-4">
        <AlertBox
          type="info"
          title={t('pages.recipeGuide.modifierPrintCode.usageGuideTitle') as string}
          description={
            <div className="space-y-1 text-[13px]">
              <div>
                • {t('pages.recipeGuide.modifierPrintCode.usageGuideStep1Prefix') as string}
                <strong>{t('pages.recipeGuide.modifierPrintCode.usageGuideStep1Save') as string}</strong>
                {t('pages.recipeGuide.modifierPrintCode.usageGuideStep1Suffix') as string}
              </div>
              <div>
                • <strong>{t('pages.recipeGuide.modifierPrintCode.usageGuideStep2Label') as string}</strong>
                {t('pages.recipeGuide.modifierPrintCode.usageGuideStep2') as string}
              </div>
              <div>
                • <strong>{t('pages.recipeGuide.modifierPrintCode.usageGuideStep3Label') as string}</strong>
                {t('pages.recipeGuide.modifierPrintCode.usageGuideStep3') as string}
              </div>
              <div>
                • <strong>{t('pages.recipeGuide.modifierPrintCode.usageGuideStep4Label') as string}</strong>
                {t('pages.recipeGuide.modifierPrintCode.usageGuideStep4') as string}
              </div>
              <div className="text-amber-600">• {t('pages.recipeGuide.modifierPrintCode.usageGuideStep5') as string}</div>
            </div>
          }
        />
      </div>

      <Table
        columns={columns}
        data={modifierGroups}
        rowKey={(r) => r.id}
        loading={loading}
        empty={t('pages.recipeGuide.modifierPrintCode.noOptionGroups') as string}
        expandable={{ render: expandedRowRender }}
      />
    </SectionCard>
  )
}

export default ModifierPrintCodeManagement
