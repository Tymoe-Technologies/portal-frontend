import React from 'react'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import type { TagGroup, TagItem } from '../../../services/item-management'
import { TagIcon, hasTagIcon } from '../../../components/TagIcon'
import { featureBadgeColor, getTagLabel, shadeColor } from '../../../lib/tagIcons'

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

// 顾客端商品卡片的简化预览。只画卡片轮廓和角标位置，图文用灰色占位块代替——
// 商家在这里要确认的是"角标长什么样、在什么位置"，不是具体某个商品的图文内容。
// 角标样式跟 customer app 的 ProductCard 保持一致：卡片右上角、左下圆角、同色相 135° 渐变 + 白字
const FeatureBadgePreview: React.FC<{ tag: TagItem; groupCode: string; locale: string }> = ({ tag, groupCode, locale }) => {
  const color = featureBadgeColor(tag, groupCode)
  const label = getTagLabel(tag, groupCode, locale)

  return (
    <div className="relative w-[260px] overflow-hidden rounded-2xl bg-white p-3 ring-1 ring-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <div
        className="absolute -top-px -right-px z-10 flex max-w-[45%] items-center gap-1 rounded-bl-lg px-2 py-1 text-white"
        style={{ backgroundImage: `linear-gradient(135deg, ${color} 0%, ${shadeColor(color, 0.22)} 100%)` }}
      >
        {hasTagIcon(tag.icon) && <TagIcon iconKey={tag.icon} width={14} height={14} color="#ffffff" />}
        <span className="truncate text-[10px] font-semibold leading-none">{label}</span>
      </div>

      {/* 占位内容：左侧文字区 + 右侧图片区，只表达布局 */}
      <div className="flex gap-3">
        <div className="flex-1 min-w-0 space-y-2 py-0.5">
          <div className="h-2.5 w-3/5 rounded bg-slate-200" />
          <div className="h-2 w-full rounded bg-slate-100" />
          <div className="h-2 w-4/5 rounded bg-slate-100" />
          <div className="h-3 w-12 rounded bg-slate-200" />
        </div>
        <div className="h-20 w-20 flex-shrink-0 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200" />
      </div>
    </div>
  )
}

const ItemTagsConfigInput: React.FC<ItemTagsConfigInputProps> = ({ tagGroups, value, onChange, readOnly }) => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

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
      {tagGroups.map(group => {
        // 特色标签在顾客端不是普通标签，而是渲染成商品卡片右上角的促销角标，
        // 所以单独给一块预览让商家看到实际效果。这个分组是互斥的，最多只会选中一个
        const isFeatureGroup = group.code === 'feature'
        const selectedFeatureTag = isFeatureGroup
          ? group.tags.find(tag => value.includes(tag.id))
          : undefined

        return (
          <div key={group.id}>
            <div className="text-sm font-medium text-slate-700 mb-2">
              {group.name}
              {group.isExclusive && <span className="ml-1.5 text-xs text-slate-400">{t('pages.menuCenter.tagSingleSelectHint')}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {group.tags.map(tag => {
                const selected = value.includes(tag.id)
                // 图标跟着文字颜色走：选中用标签本色，未选中用中性灰，跟胶囊整体保持一致
                const iconColor = selected ? (tag.color || '#334155') : '#94a3b8'
                return (
                  <button
                    key={tag.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => toggleTag(group.id, tag.id, group.isExclusive)}
                    className={clsx(
                      'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                      readOnly ? 'cursor-default opacity-70' : 'cursor-pointer hover:border-slate-400',
                      !selected && 'bg-white border-slate-200 text-slate-500',
                    )}
                    style={selected ? {
                      backgroundColor: tint(tag.color, '1a'),
                      borderColor: tag.color || '#94a3b8',
                      color: tag.color || '#334155',
                    } : undefined}
                  >
                    {hasTagIcon(tag.icon) && <TagIcon iconKey={tag.icon} width={14} height={14} color={iconColor} />}
                    {tag.name}
                  </button>
                )
              })}
            </div>

            {isFeatureGroup && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2.5 text-xs text-slate-500">
                  {t('pages.menuCenter.featureTagPreviewTitle')}
                </div>
                {selectedFeatureTag ? (
                  <FeatureBadgePreview tag={selectedFeatureTag} groupCode={group.code} locale={locale} />
                ) : (
                  <div className="text-xs text-slate-400">
                    {t('pages.menuCenter.featureTagPreviewEmpty')}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default ItemTagsConfigInput
