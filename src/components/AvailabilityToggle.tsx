import { useTranslation } from 'react-i18next'
import { Tooltip } from '@/components/ui-kit'

export interface AvailabilityToggleProps {
  /** 门店级手动开关（store_menu_items.is_available / store_modifier_availability.is_available） */
  isAvailable: boolean
  unavailableUntil?: string | null
  /**
   * 品牌目录层面的启用状态（catalog_items.is_active / catalog_modifier_options.is_active）。
   * 缺省视为 true（不是所有调用方都关心这一层，比如 modifier 选项列表已经在别处按 is_active 过滤过）。
   * 品牌层已停用时，门店开关无论怎么设都不可能真正卖出去，必须显示为“关”，且禁止交互——
   * 不然会出现旁边品牌状态徽章显示“停用”、这个开关却显示“在售”的自相矛盾。
   */
  catalogIsActive?: boolean
  onClick: () => void
}

/**
 * 门店级可用性开关的视觉呈现——沿用原 Switch 组件的开关样式（深色=开，浅色=关），
 * 点击不再是直接切换，而是打开 SnoozeModal 统一选择“上下架”方式。
 * 临时下架中额外用琥珀色区分，方便和永久下架一眼分开；品牌层已停用时整体禁用。
 */
export function AvailabilityToggle({ isAvailable, unavailableUntil, catalogIsActive = true, onClick }: AvailabilityToggleProps) {
  const { t } = useTranslation()
  const isSnoozed = isAvailable && !!unavailableUntil && new Date(unavailableUntil).getTime() > Date.now()
  // 真实可售状态 = 品牌层启用 AND 门店手动开关开启 AND 没有生效中的临时下架
  const isDown = !catalogIsActive || !isAvailable || isSnoozed
  const disabled = !catalogIsActive

  const tooltipLabel = !catalogIsActive
    ? t('pages.menuCenter.catalogDisabledHint')
    : !isDown
      ? undefined
      : isSnoozed
        ? t('pages.menuCenter.snoozedUntil', { time: new Date(unavailableUntil!).toLocaleString() })
        : t('pages.menuCenter.inactive')

  return (
    <Tooltip label={tooltipLabel}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={
          'relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ' +
          (disabled
            ? 'bg-slate-100 cursor-not-allowed'
            : 'cursor-pointer ' + (isDown ? (isSnoozed ? 'bg-amber-400' : 'bg-slate-200') : 'bg-slate-900'))
        }
      >
        <span
          className={
            'block w-4 h-4 rounded-full shadow-sm transition-transform duration-200 ' +
            (disabled ? 'bg-slate-300' : 'bg-white') + ' ' +
            (isDown ? 'translate-x-0.5' : 'translate-x-[22px]')
          }
        />
      </button>
    </Tooltip>
  )
}
