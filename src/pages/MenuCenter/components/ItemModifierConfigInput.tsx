import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import type { ModifierGroup } from '../../../services/item-management'
import { Switch, Badge, EmptyState } from '@/components/ui-kit'

export interface ItemModifierConfig {
  groupId: string
  isRequired: boolean
  minSelections: number
  maxSelections: number
  sortOrder: number
  enabledOptions: string[]   // 启用的选项ID列表
  defaultOptionId?: string   // 默认选项ID
  optionPrices: Record<string, number>  // 选项价格覆盖（元）
}

interface ItemModifierConfigInputProps {
  value?: ItemModifierConfig[]
  onChange?: (value: ItemModifierConfig[]) => void
  modifierGroups: ModifierGroup[]
}

const numCls = 'text-sm border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:outline-2 focus:outline-slate-900 disabled:bg-slate-50 disabled:text-slate-400'

const ItemModifierConfigInput: React.FC<ItemModifierConfigInputProps> = ({ value = [], onChange, modifierGroups }) => {
  const { t } = useTranslation()
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(value.map(c => c.groupId))
  const [configs, setConfigs] = useState<Record<string, ItemModifierConfig>>(
    value.reduce((acc, c) => ({ ...acc, [c.groupId]: c }), {})
  )

  const valueJson = useMemo(() => JSON.stringify(value || []), [value])
  useEffect(() => {
    setSelectedGroupIds(value.map(c => c.groupId))
    setConfigs(value.reduce((acc, c) => ({ ...acc, [c.groupId]: c }), {}))
  }, [valueJson])

  const handleGroupToggle = (groupId: string, checked: boolean) => {
    let newIds: string[]
    const newConfigs = { ...configs }
    if (checked) {
      newIds = [...selectedGroupIds, groupId]
      const group = modifierGroups.find(g => g.id === groupId)
      const allOptionIds = group?.options?.map(o => o.id) || []
      newConfigs[groupId] = {
        groupId, isRequired: false, minSelections: 0, maxSelections: 1,
        sortOrder: newIds.length, enabledOptions: allOptionIds, optionPrices: {},
      }
    } else {
      newIds = selectedGroupIds.filter(id => id !== groupId)
      delete newConfigs[groupId]
    }
    setSelectedGroupIds(newIds)
    setConfigs(newConfigs)
    onChange?.(Object.values(newConfigs))
  }

  const handleConfigChange = (groupId: string, updates: Partial<ItemModifierConfig>) => {
    const newConfigs = { ...configs, [groupId]: { ...configs[groupId], ...updates } }
    setConfigs(newConfigs)
    onChange?.(Object.values(newConfigs))
  }

  const handleOptionToggle = (groupId: string, optionId: string, checked: boolean) => {
    const enabledOptions = checked
      ? [...configs[groupId].enabledOptions, optionId]
      : configs[groupId].enabledOptions.filter(id => id !== optionId)
    handleConfigChange(groupId, { enabledOptions })
  }

  const handleOptionPriceChange = (groupId: string, optionId: string, price: number | null) => {
    const newPrices = { ...configs[groupId].optionPrices }
    if (price === null) delete newPrices[optionId]
    else newPrices[optionId] = price
    handleConfigChange(groupId, { optionPrices: newPrices })
  }

  const activeGroups = modifierGroups.filter(g => g.isActive)

  return (
    <div>
      <p className="text-sm font-semibold text-slate-800 mb-3">{t('pages.menuCenter.itemModifierConfigInput.selectGroupsTitle')}</p>

      {activeGroups.length === 0 ? (
        <EmptyState title={t('pages.menuCenter.itemModifierConfigInput.emptyGroupsTitle')} description={t('pages.menuCenter.itemModifierConfigInput.emptyGroupsDesc')} />
      ) : (
        <div className="space-y-4">
          {activeGroups.map(group => {
            const isSelected = selectedGroupIds.includes(group.id)
            const config = configs[group.id]
            const options = group.options || []

            return (
              <div key={group.id} className={clsx('rounded-lg border p-3', isSelected ? 'border-slate-900 bg-slate-50' : 'border-slate-200')}>
                {/* 组头部 */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Switch checked={isSelected} onCheckedChange={c => handleGroupToggle(group.id, c)} />
                    <div className="min-w-0">
                      <span className="font-medium text-slate-800">{group.displayName}</span>
                      <span className="text-xs text-slate-400 ml-2">({group.name})</span>
                      <span className="ml-2 inline-flex align-middle">
                        {group.storeId == null ? <Badge variant="blue">{t('pages.menuCenter.modifierGroupManager.scopeBrand')}</Badge> : <Badge variant="gold">{t('pages.menuCenter.modifierGroupManager.scopeStore')}</Badge>}
                      </span>
                    </div>
                  </div>
                  {isSelected && <span className="text-xs text-slate-400 shrink-0">{t('pages.menuCenter.itemModifierConfigInput.optionsCountLabel', { count: options.length })}</span>}
                </div>

                {/* 选择规则 */}
                {isSelected && config && (
                  <>
                    <hr className="my-3 border-slate-100" />
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-4 sm:col-span-3">
                        <div className="text-xs text-slate-500 mb-1.5">{t('pages.menuCenter.itemModifierConfigInput.isRequiredLabel')}</div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={config.isRequired}
                            onCheckedChange={checked => {
                              const updates: Partial<ItemModifierConfig> = { isRequired: checked }
                              if (checked && config.minSelections === 0) updates.minSelections = 1
                              else if (!checked) updates.minSelections = 0
                              handleConfigChange(group.id, updates)
                            }}
                          />
                          <span className="text-xs text-slate-500">{config.isRequired ? t('pages.menuCenter.required') : t('pages.menuCenter.optional')}</span>
                        </div>
                      </div>
                      <div className="col-span-4">
                        <div className="text-xs text-slate-500 mb-1.5">{t('pages.menuCenter.itemModifierConfigInput.minSelectionsLabel')}</div>
                        <input
                          type="number" className={clsx(numCls, 'w-full')}
                          min={config.isRequired ? 1 : 0} max={config.maxSelections}
                          value={config.minSelections} disabled={!config.isRequired}
                          onChange={e => { const v = Number(e.target.value); handleConfigChange(group.id, { minSelections: config.isRequired ? Math.max(1, v || 1) : (v || 0) }) }}
                        />
                      </div>
                      <div className="col-span-4">
                        <div className="text-xs text-slate-500 mb-1.5">{t('pages.menuCenter.itemModifierConfigInput.maxSelectionsLabel')}</div>
                        <input
                          type="number" className={clsx(numCls, 'w-full')}
                          min={config.minSelections}
                          value={config.maxSelections}
                          onChange={e => handleConfigChange(group.id, { maxSelections: Number(e.target.value) || 1 })}
                        />
                      </div>
                    </div>

                    {/* 选项配置 */}
                    {options.length > 0 && (
                      <>
                        <div className="flex items-center gap-2 my-3">
                          <span className="text-xs font-medium text-slate-400">{t('pages.menuCenter.itemModifierConfigInput.optionConfigLabel')}</span>
                          <span className="flex-1 h-px bg-slate-100" />
                        </div>
                        <div className="max-h-80 overflow-y-auto sidebar-scroll grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {options.map(option => {
                            const isEnabled = config.enabledOptions.includes(option.id)
                            const isDefault = config.defaultOptionId === option.id
                            const hasCustomPrice = option.id in config.optionPrices
                            const customPrice = hasCustomPrice ? config.optionPrices[option.id] : undefined
                            const defaultPrice = typeof option.defaultPrice === 'string' ? parseFloat(option.defaultPrice) : option.defaultPrice

                            return (
                              <div key={option.id} className={clsx('rounded-md border p-2', isDefault ? 'border-slate-900' : 'border-slate-200', !isEnabled && 'bg-slate-50')}>
                                <div className="flex items-center gap-1.5">
                                  <Switch checked={isEnabled} onCheckedChange={c => handleOptionToggle(group.id, option.id, c)} />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium text-slate-700 truncate">{option.displayName}</div>
                                    <div className="text-[10px] text-slate-400 truncate">{option.name}</div>
                                  </div>
                                  {isDefault && <Badge variant="blue">{t('pages.menuCenter.default')}</Badge>}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <span className="text-[11px] text-slate-500 shrink-0">{(defaultPrice ?? 0).toFixed(2)}</span>
                                  <input
                                    type="number" min={0} step="0.01" placeholder={t('pages.menuCenter.itemModifierConfigInput.itemPricePlaceholder')} disabled={!isEnabled}
                                    value={customPrice ?? ''}
                                    onChange={e => handleOptionPriceChange(group.id, option.id, e.target.value === '' ? null : Number(e.target.value))}
                                    className={clsx(numCls, 'flex-1 min-w-0 text-[11px]')}
                                  />
                                  {hasCustomPrice ? (
                                    <button
                                      onClick={() => handleOptionPriceChange(group.id, option.id, null)}
                                      disabled={!isEnabled} title={t('pages.menuCenter.itemModifierConfigInput.clearAction')}
                                      className="px-1.5 text-red-500 hover:bg-red-50 rounded cursor-pointer disabled:opacity-40"
                                    >×</button>
                                  ) : (
                                    <button
                                      onClick={() => { if (isEnabled && !isDefault) handleConfigChange(group.id, { defaultOptionId: option.id }) }}
                                      disabled={!isEnabled || isDefault}
                                      className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40"
                                    >{t('pages.menuCenter.itemModifierConfigInput.setDefaultAction')}</button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ItemModifierConfigInput
