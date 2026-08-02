import React from 'react'
import clsx from 'clsx'
import type { TagGroup } from '../../../services/item-management'

interface ItemTagsConfigInputProps {
  tagGroups: TagGroup[]
  value: string[]           // 已选标签 id 列表
  onChange?: (ids: string[]) => void
  readOnly?: boolean
}

// 简单把十六进制颜色转成一个很浅的背景色（选中态用），避免额外引入调色库
function tint(hex: string | undefined, alpha: string): string {
  if (!hex) return '#f1f5f9'
  return `${hex}${alpha}`
}

const ItemTagsConfigInput: React.FC<ItemTagsConfigInputProps> = ({ tagGroups, value, onChange, readOnly }) => {
  const toggleTag = (groupId: string, tagId: string, isExclusive: boolean) => {
    if (readOnly) return
    const group = tagGroups.find(g => g.id === groupId)
    const groupTagIds = group?.tags.map(t => t.id) || []
    const isSelected = value.includes(tagId)

    if (isSelected) {
      onChange?.(value.filter(id => id !== tagId))
      return
    }

    if (isExclusive) {
      // 互斥分组：先移除同组内其他已选标签，再选中当前标签
      onChange?.([...value.filter(id => !groupTagIds.includes(id)), tagId])
    } else {
      onChange?.([...value, tagId])
    }
  }

  return (
    <div className="space-y-5">
      {tagGroups.map(group => (
        <div key={group.id}>
          <div className="text-sm font-medium text-slate-700 mb-2">
            {group.name}
            {group.isExclusive && <span className="ml-1.5 text-xs text-slate-400">（单选）</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {group.tags.map(tag => {
              const selected = value.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => toggleTag(group.id, tag.id, group.isExclusive)}
                  className={clsx(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    readOnly ? 'cursor-default opacity-70' : 'cursor-pointer hover:border-slate-400',
                    !selected && 'bg-white border-slate-200 text-slate-500',
                  )}
                  style={selected ? {
                    backgroundColor: tint(tag.color, '1a'),
                    borderColor: tag.color || '#94a3b8',
                    color: tag.color || '#334155',
                  } : undefined}
                >
                  {tag.name}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default ItemTagsConfigInput
