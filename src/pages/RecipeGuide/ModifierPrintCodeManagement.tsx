import React, { useState, useEffect } from 'react'
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

const ModifierPrintCodeManagement: React.FC = () => {
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
      toast.error('加载自定义选项组失败')
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
          errors.push(errMsg || `「${option.displayName}」打印代码重复`)
        } else {
          errors.push(`「${option.displayName}」保存失败`)
        }
      }
    }

    setSaving(false)

    if (errors.length === 0) {
      toast.success(`已保存 ${changed.length} 条`)
    } else if (errors.length < changed.length) {
      toast.warning(`部分保存失败：${errors.join('；')}`)
    } else {
      toast.error(errors.join('；'))
    }
  }

  // 展开的行渲染
  const expandedRowRender = (group: ModifierGroup) => {
    const options = group.options || []

    if (options.length === 0) {
      return <EmptyState title="该组暂无选项" />
    }

    const subColumns: Column<ModifierOption>[] = [
      {
        key: 'displayName',
        title: '选项名称',
        width: 140,
        render: (r) => r.displayName
      },
      {
        key: 'code',
        title: '打印代码',
        width: 160,
        render: (record) => {
          const savedBase = record.printBaseCode ?? ''
          const editValue = editingValues[record.id] !== undefined ? editingValues[record.id] : savedBase
          const isDirty = editValue !== savedBase
          return (
            <TextInput
              value={editValue}
              placeholder="如: LICE, P, C"
              maxLength={20}
              onChange={(v) => setEditingValues(prev => ({ ...prev, [record.id]: v }))}
              className={isDirty ? 'border-amber-400' : ''}
            />
          )
        }
      },
      {
        key: 'instruction',
        title: '用量',
        width: 160,
        render: (record) => {
          const savedUsage = record.printInstruction ?? ''
          const editValue = editingUsageValues[record.id] !== undefined ? editingUsageValues[record.id] : savedUsage
          const isDirty = editValue !== savedUsage
          return (
            <TextInput
              value={editValue}
              placeholder="如: 50%, 30g, 2份"
              maxLength={50}
              onChange={(v) => setEditingUsageValues(prev => ({ ...prev, [record.id]: v }))}
              className={isDirty ? 'border-amber-400' : ''}
            />
          )
        }
      },
      {
        key: 'combined',
        title: '组合预览',
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
      title: '选项组名称',
      width: 200,
      render: (r) => r.displayName
    },
    {
      key: 'optionCount',
      title: '选项数量',
      width: 100,
      align: 'center',
      render: (record) => {
        const count = record.options?.length || 0
        return <Badge variant={count > 0 ? 'blue' : 'default'}>{count} 个</Badge>
      }
    }
  ]

  const changedCount = getChangedOptions().length

  return (
    <SectionCard
      title="自定义选项打印代码管理"
      description="为每个自定义选项配置打印代码，用于标签打印"
      action={
        <div className="flex items-center gap-2">
          <Btn variant="secondary" icon={<RefreshCw size={16} />} onClick={loadModifierGroups} loading={loading}>刷新</Btn>
          <Btn variant="primary" icon={<Save size={16} />} loading={saving} disabled={changedCount === 0} onClick={handleSaveAll}>
            保存{changedCount > 0 ? `（${changedCount} 项）` : ''}
          </Btn>
        </div>
      }
    >
      <div className="mb-4">
        <AlertBox
          type="info"
          title="使用说明"
          description={
            <div className="space-y-1 text-[13px]">
              <div>• 展开选项组，填写打印代码和用量，完成后点击右上角<strong>保存</strong>按钮</div>
              <div>• <strong>打印代码</strong>：标签上的缩写标识，如 LICE、P、C，同一品牌内不能重复</div>
              <div>• <strong>用量</strong>：具体用量说明，如 50%、30g、2份（可为空）</div>
              <div>• <strong>组合预览</strong>：打印代码 + 用量的最终标签内容，如 "LICE50%"</div>
              <div className="text-amber-600">• 输入框变为橙色边框表示有未保存的修改</div>
            </div>
          }
        />
      </div>

      <Table
        columns={columns}
        data={modifierGroups}
        rowKey={(r) => r.id}
        loading={loading}
        empty="暂无自定义选项组"
        expandable={{ render: expandedRowRender }}
      />
    </SectionCard>
  )
}

export default ModifierPrintCodeManagement
