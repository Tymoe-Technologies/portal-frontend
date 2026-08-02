import { Icon } from '@iconify/react'
import { TAG_ICON_MAP } from '../lib/tagIcons'
import { PeanutIcon } from './icons/PeanutIcon'
import { TreeNutIcon } from './icons/TreeNutIcon'

// 跟 customer app 的 TagIcon 保持一致（见 src/lib/tagIcons.ts 顶部关于两边同步的说明）
// 图标库里找不到合适图形、手绘 SVG 顶替的标签，优先级高于 TAG_ICON_MAP
const CUSTOM_TAG_ICONS: Record<string, typeof PeanutIcon> = {
  peanuts: PeanutIcon,
  'tree-nut': TreeNutIcon,
}

export function hasTagIcon(iconKey?: string): boolean {
  if (!iconKey) return false
  return !!CUSTOM_TAG_ICONS[iconKey] || !!TAG_ICON_MAP[iconKey]
}

interface TagIconProps {
  iconKey?: string
  width: number
  height: number
  color: string
}

export function TagIcon({ iconKey, width, height, color }: TagIconProps) {
  if (!iconKey) return null

  const Custom = CUSTOM_TAG_ICONS[iconKey]
  if (Custom) return <Custom width={width} height={height} color={color} />

  const iconName = TAG_ICON_MAP[iconKey]
  if (!iconName) return null
  return <Icon icon={iconName} width={width} height={height} color={color} />
}
