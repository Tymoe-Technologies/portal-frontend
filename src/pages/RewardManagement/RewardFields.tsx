/**
 * 奖励表单字段（受控片段，可嵌入任意弹窗）
 *
 * 包含：奖励类型、名称、说明、库存限制、FREE_ITEM 商品关联、折扣配置、叠加规则。
 * 不含 pointsCost（由积分奖励场景额外加）和弹窗外壳。
 *
 * 用法：父组件提供 values + setValue 受控状态，以及 linkedItems 受控状态。
 */

import React, { useState, useEffect, useRef } from 'react'
import { Gift, DollarSign, Percent, Search, X } from 'lucide-react'
import type { RewardType, SelectionMode, StackingMode } from '@/services/memberReward'
import { itemManagementService, type Item } from '@/services/item-management'
import { TextInput, Textarea, SelectInput, FormRow } from '@/components/ui-kit'

export interface LinkedItemLite {
  itemId: string
  itemName: string
  itemImageUrl?: string
  itemCategory?: string
}

export type RewardFormValues = Record<string, any>

const REWARD_TYPE_OPTIONS: { value: RewardType; icon: React.ReactNode; label: string; desc: string }[] = [
  { value: 'FREE_ITEM', icon: <Gift className="w-5 h-5" />, label: '免费商品', desc: '自动加入指定商品' },
  { value: 'DISCOUNT_AMOUNT', icon: <DollarSign className="w-5 h-5" />, label: '固定金额折扣', desc: '立减固定金额，如 $5 off' },
  { value: 'DISCOUNT_PERCENTAGE', icon: <Percent className="w-5 h-5" />, label: '百分比折扣', desc: '按比例折扣，如 10% off' },
]

// 奖励类型卡片选择器（选中态用 slate，严禁紫色）
const RewardTypeSelector: React.FC<{ value?: RewardType; onChange: (v: RewardType) => void }> = ({ value, onChange }) => (
  <div className="grid grid-cols-3 gap-3">
    {REWARD_TYPE_OPTIONS.map(opt => {
      const active = value === opt.value
      return (
        <div
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-lg p-3 cursor-pointer transition-all h-full border-2 ${active ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-slate-50/50'}`}
        >
          <div className="flex flex-col gap-1">
            <span className={active ? 'text-slate-900' : 'text-slate-500'}>{opt.icon}</span>
            <span className={`font-semibold ${active ? 'text-slate-900' : 'text-slate-700'}`}>{opt.label}</span>
            <span className="text-xs text-slate-400 leading-snug">{opt.desc}</span>
          </div>
        </div>
      )
    })}
  </div>
)

// 可选数值输入：空 → undefined（用于"留空 = 无限"语义）
function OptNumber({ value, onChange, min, max, step, suffix, placeholder, className }: {
  value: number | undefined; onChange: (v: number | undefined) => void
  min?: number; max?: number; step?: number; suffix?: string; placeholder?: string; className?: string
}) {
  return (
    <div className={`flex items-center gap-1.5 ${className ?? ''}`}>
      <input type="number" min={min} max={max} step={step} value={value ?? ''} placeholder={placeholder}
        onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className="flex-1 text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0" />
      {suffix && <span className="text-xs text-slate-400 shrink-0">{suffix}</span>}
    </div>
  )
}

export interface RewardFieldsProps {
  values: RewardFormValues
  setValue: (patch: Partial<RewardFormValues>) => void
  linkedItems: LinkedItemLite[]
  onLinkedItemsChange: (items: LinkedItemLite[]) => void
  active: boolean
}

const RewardFields: React.FC<RewardFieldsProps> = ({ values, setValue, linkedItems, onLinkedItemsChange, active }) => {
  const rewardType: RewardType = values.rewardType ?? 'FREE_ITEM'
  const selectionMode: SelectionMode = values.selectionMode ?? 'FIXED'
  const stackingMode: StackingMode = values.stackingMode ?? 'STACKABLE'
  const validityMode: 'PERMANENT' | 'DAYS' = values.validityMode ?? 'PERMANENT'

  const [itemOptions, setItemOptions] = useState<Item[]>([])
  const [itemSearching, setItemSearching] = useState(false)
  const [itemKeyword, setItemKeyword] = useState('')
  const [showItemMenu, setShowItemMenu] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  const searchItems = async (keyword = '') => {
    setItemSearching(true)
    try {
      const res = await itemManagementService.getItems({ search: keyword, limit: 50, isActive: true })
      setItemOptions(res.data ?? [])
    } catch {
      // 静默
    } finally {
      setItemSearching(false)
    }
  }
  const handleItemSearch = (val: string) => {
    setItemKeyword(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => searchItems(val), 300)
  }
  const addLinkedItem = (item: Item) => {
    if (linkedItems.some(l => l.itemId === item.id)) return
    onLinkedItemsChange([...linkedItems, { itemId: item.id, itemName: item.name, itemImageUrl: item.imageUrl }])
  }
  const removeLinkedItem = (itemId: string) => onLinkedItemsChange(linkedItems.filter(l => l.itemId !== itemId))

  useEffect(() => {
    if (active && rewardType === 'FREE_ITEM') searchItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, rewardType])

  const sectionTitle = (text: string) => (
    <div className="flex items-center gap-2 my-3">
      <span className="text-[13px] text-slate-500">{text}</span>
      <div className="flex-1 border-t border-slate-100" />
    </div>
  )

  return (
    <div>
      <FormRow label="奖励类型">
        <div className="w-full"><RewardTypeSelector value={rewardType} onChange={(v) => setValue({ rewardType: v })} /></div>
      </FormRow>

      <FormRow label="奖励名称">
        <TextInput className="w-full" value={values.name ?? ''} onChange={(v) => setValue({ name: v })}
          placeholder={rewardType === 'FREE_ITEM' ? '如：生日免费拿铁' : rewardType === 'DISCOUNT_AMOUNT' ? '如：生日 $5 券' : '如：生日九折'} />
      </FormRow>

      <FormRow label="说明">
        <Textarea className="w-full" rows={2} value={values.description ?? ''} onChange={(v) => setValue({ description: v })}
          placeholder={rewardType === 'FREE_ITEM' ? '如：生日当月免费一杯中杯拿铁' : rewardType === 'DISCOUNT_AMOUNT' ? '如：消费满 $20 立减 $5' : '如：全单九折'} />
      </FormRow>

      <div className="grid grid-cols-2 gap-4">
        <FormRow label="库存数量" hint="不填 = 无限量">
          <OptNumber value={values.stock} onChange={(v) => setValue({ stock: v })} min={0} placeholder="留空 = 无限" className="w-full" />
        </FormRow>
        <FormRow label="每人上限" hint="不填 = 不限次数">
          <OptNumber value={values.limitPerMember} onChange={(v) => setValue({ limitPerMember: v })} min={1} placeholder="留空 = 不限" className="w-full" />
        </FormRow>
      </div>

      {/* 券有效期 */}
      <FormRow label="券有效期" hint="券发放到顾客后的有效时间">
        <div className="flex gap-4">
          {(['PERMANENT', 'DAYS'] as const).map(m => (
            <label key={m} className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="radio" checked={validityMode === m} onChange={() => setValue({ validityMode: m })} className="w-4 h-4 accent-slate-900" />
              {m === 'PERMANENT' ? '永久有效' : '限时有效'}
            </label>
          ))}
        </div>
      </FormRow>
      {validityMode === 'DAYS' && (
        <FormRow label="有效期天数" hint="从发放当天起算，过期后券自动失效">
          <OptNumber value={values.validityDays} onChange={(v) => setValue({ validityDays: v })} min={1} suffix="天" placeholder="如：30" className="w-52" />
        </FormRow>
      )}

      {/* FREE_ITEM 专属 */}
      {rewardType === 'FREE_ITEM' && (
        <>
          {sectionTitle('商品设置')}
          <FormRow label="顾客选品方式">
            <div className="w-full"><SelectInput className="w-full" value={selectionMode} onChange={(v) => setValue({ selectionMode: v })}
              options={[
                { label: '固定商品（系统自动加入，无需选择）', value: 'FIXED' },
                { label: '任选 1 件（从以下商品中选一件）', value: 'PICK_ONE' },
                { label: '任选 N 件（从以下商品中选多件）', value: 'PICK_N' },
                { label: '从指定品类中自选', value: 'PICK_FROM_CATEGORY' },
              ]} /></div>
          </FormRow>

          {selectionMode === 'PICK_N' && (
            <FormRow label="可选件数">
              <OptNumber value={values.pickCount} onChange={(v) => setValue({ pickCount: v })} min={2} suffix="件" className="w-40" />
            </FormRow>
          )}

          {selectionMode !== 'PICK_FROM_CATEGORY' && (
            <FormRow label="关联商品">
              <div className="w-full">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={itemKeyword}
                    onChange={e => handleItemSearch(e.target.value)}
                    onFocus={() => { setShowItemMenu(true); if (itemOptions.length === 0) searchItems() }}
                    onBlur={() => setTimeout(() => setShowItemMenu(false), 150)}
                    placeholder="搜索商品名称"
                    className="w-full text-sm bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
                  />
                  {showItemMenu && (
                    <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                      {itemSearching ? (
                        <div className="px-3 py-2 text-sm text-slate-400">搜索中...</div>
                      ) : itemOptions.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-400">无匹配商品</div>
                      ) : itemOptions.map(item => (
                        <button key={item.id} type="button" onMouseDown={(e) => { e.preventDefault(); addLinkedItem(item) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 cursor-pointer">
                          {item.imageUrl
                            ? <img src={item.imageUrl} className="w-5 h-5 rounded object-cover" />
                            : <span className="w-5 h-5 rounded bg-slate-200 text-slate-500 text-[10px] flex items-center justify-center">{item.name[0]}</span>}
                          <span className="text-sm text-slate-700">{item.name}</span>
                          {item.basePrice != null && <span className="text-xs text-slate-400 ml-auto">${(item.basePrice / 100).toFixed(2)}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {linkedItems.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {linkedItems.map(item => (
                      <span key={item.itemId} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                        {item.itemName}
                        <button type="button" onClick={() => removeLinkedItem(item.itemId)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </FormRow>
          )}
        </>
      )}

      {/* DISCOUNT_AMOUNT 专属 */}
      {rewardType === 'DISCOUNT_AMOUNT' && (
        <>
          {sectionTitle('折扣设置')}
          <FormRow label="折扣金额（$）" hint="订单立减此金额">
            <OptNumber value={values.discountAmount} onChange={(v) => setValue({ discountAmount: v })} min={0.01} step={0.5} placeholder="如：5.00" className="w-full" />
          </FormRow>
        </>
      )}

      {/* DISCOUNT_PERCENTAGE 专属 */}
      {rewardType === 'DISCOUNT_PERCENTAGE' && (
        <>
          {sectionTitle('折扣设置')}
          <div className="grid grid-cols-2 gap-4">
            <FormRow label="折扣百分比" hint="如：10 表示九折">
              <OptNumber value={values.discountPercentage} onChange={(v) => setValue({ discountPercentage: v })} min={1} max={99} suffix="% off" placeholder="如：10" className="w-full" />
            </FormRow>
            <FormRow label="最高折扣上限（$）" hint="可选，留空不限">
              <OptNumber value={values.discountMaxAmount} onChange={(v) => setValue({ discountMaxAmount: v })} min={0} step={0.5} placeholder="留空 = 不限" className="w-full" />
            </FormRow>
          </div>
        </>
      )}

      {/* 叠加规则 */}
      {sectionTitle('叠加规则')}
      <div className="grid grid-cols-2 gap-4">
        <FormRow label="与其他优惠叠加">
          <div className="w-full"><SelectInput className="w-full" value={stackingMode} onChange={(v) => setValue({ stackingMode: v })}
            options={[
              { label: '可叠加', value: 'STACKABLE' },
              { label: '独占（不可与任何优惠叠加）', value: 'EXCLUSIVE' },
              { label: '组内互斥', value: 'GROUP_EXCLUSIVE' },
            ]} /></div>
        </FormRow>
        {stackingMode === 'GROUP_EXCLUSIVE' && (
          <FormRow label="互斥分组名称" hint="相同分组名互斥">
            <TextInput className="w-full" value={values.exclusionGroup ?? ''} onChange={(v) => setValue({ exclusionGroup: v })} placeholder="如：order_discount" />
          </FormRow>
        )}
      </div>
    </div>
  )
}

export default RewardFields

/**
 * 把表单值 + linkedItems 转成创建/更新 Reward 的 payload
 * 供调用方在 save 时复用（元 → 分换算等）。
 */
export function buildRewardPayload(values: any, linkedItems: LinkedItemLite[]) {
  return {
    name: values.name,
    description: values.description,
    rewardType: values.rewardType,
    selectionMode: values.selectionMode,
    pickCount: values.pickCount,
    stock: values.stock,
    limitPerMember: values.limitPerMember,
    discountAmount: values.discountAmount != null ? Math.round(values.discountAmount * 100) : undefined,
    discountPercentage: values.discountPercentage,
    discountMaxAmount: values.discountMaxAmount != null ? Math.round(values.discountMaxAmount * 100) : undefined,
    stackingMode: values.stackingMode,
    exclusionGroup: values.exclusionGroup,
    validityDays: values.validityMode === 'DAYS' ? (values.validityDays ?? null) : null,
    linkedItems: values.rewardType === 'FREE_ITEM' ? linkedItems : [],
  }
}
