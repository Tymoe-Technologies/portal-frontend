/**
 * StoreMenuManager - 门店菜单配置（BRANCH / FRANCHISE 专用）
 *
 * 功能：
 * 1. 查看所有可见商品（BRAND + STORE_EXCLUSIVE）
 * 2. 开关可用性、覆盖售价、覆盖 modifier 选项价格
 */

import React, { useEffect, useState } from 'react'
import { Pencil, RotateCcw, GitBranch } from 'lucide-react'
import { storeMenuService, type StoreMenuItem } from '../../services/store-menu'
import { itemManagementService, type ItemModifierGroup } from '../../services/item-management'
import ItemChannelConfig from './components/ItemChannelConfig'
import {
  SectionCard, Table, Switch, Badge, Btn, Modal, Spinner, NumberInput, toast, type Column,
} from '@/components/ui-kit'

const fmtYuan = (v: number | undefined | null) => (v != null ? Number(v).toFixed(2) : '—')
const numCls = 'text-sm border border-slate-200 rounded-md px-2 py-1 text-slate-700 w-24 focus:outline-2 focus:outline-slate-900'

const StoreMenuManager: React.FC = () => {
  const [items, setItems] = useState<StoreMenuItem[]>([])
  const [loading, setLoading] = useState(false)

  // 价格覆盖弹窗
  const [priceOverrideModal, setPriceOverrideModal] = useState<{ item: StoreMenuItem } | null>(null)
  const [priceOverride, setPriceOverride] = useState<number>(NaN)
  const [itemModifierGroups, setItemModifierGroups] = useState<ItemModifierGroup[]>([])
  const [modifierPriceOverrides, setModifierPriceOverrides] = useState<Record<string, string>>({})
  const [loadingItemModifiers, setLoadingItemModifiers] = useState(false)
  const [savingPrice, setSavingPrice] = useState(false)

  // 渠道配置弹窗
  const [channelModal, setChannelModal] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => { loadItems() }, [])

  const loadItems = async () => {
    setLoading(true)
    try {
      const menu = await storeMenuService.getStoreMenu()
      setItems(menu.items)
    } catch {
      toast.error('加载商品列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleAvailability = async (item: StoreMenuItem, isAvailable: boolean) => {
    try {
      await storeMenuService.upsertStoreMenuConfig(item.id, { isAvailable })
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, isAvailable } : i))
      toast.success(isAvailable ? '商品已启用' : '商品已停用')
    } catch {
      toast.error('操作失败')
    }
  }

  const openPriceOverride = async (item: StoreMenuItem) => {
    setPriceOverride(item.effectivePrice !== item.basePrice ? item.effectivePrice : NaN)
    setModifierPriceOverrides({})
    setItemModifierGroups([])
    setPriceOverrideModal({ item })
    setLoadingItemModifiers(true)
    try {
      setItemModifierGroups(await itemManagementService.getItemModifiers(item.id))
    } catch {
      // modifier 加载失败不阻断主流程
    } finally {
      setLoadingItemModifiers(false)
    }
  }

  const handleSavePriceOverride = async () => {
    if (!priceOverrideModal) return
    setSavingPrice(true)
    try {
      await storeMenuService.upsertStoreMenuConfig(priceOverrideModal.item.id, {
        priceOverride: Number.isNaN(priceOverride) ? undefined : priceOverride,
        isAvailable: priceOverrideModal.item.isAvailable,
      })
      const modifierPrices = Object.entries(modifierPriceOverrides)
        .filter(([, v]) => v !== '' && v != null)
        .map(([modifierOptionId, price]) => ({ modifierOptionId, price: parseFloat(price) }))
      if (modifierPrices.length > 0) {
        await storeMenuService.setStoreModifierPrices(priceOverrideModal.item.id, modifierPrices)
      }
      toast.success('价格已保存')
      setPriceOverrideModal(null)
      loadItems()
    } catch {
      toast.error('保存失败')
    } finally {
      setSavingPrice(false)
    }
  }

  const columns: Column<StoreMenuItem>[] = [
    {
      key: 'name', title: '商品名称',
      render: r => (
        <div className="flex items-center gap-2">
          <span className="text-slate-800">{r.name}</span>
          {r.scope === 'STORE_EXCLUSIVE' && <Badge variant="gold">专属</Badge>}
          {r.hasStoreOverride && <Badge variant="blue">已配置</Badge>}
        </div>
      ),
    },
    { key: 'basePrice', title: '品牌定价', width: 110, render: r => fmtYuan(r.basePrice) },
    {
      key: 'effectivePrice', title: '门店售价', width: 140,
      render: r => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">{fmtYuan(r.effectivePrice)}</span>
          {r.effectivePrice !== r.basePrice && <Badge variant="gold">已覆盖</Badge>}
        </div>
      ),
    },
    {
      key: 'isAvailable', title: '本店可用', width: 100,
      render: r => <Switch checked={r.isAvailable} onCheckedChange={v => handleToggleAvailability(r, v)} />,
    },
    {
      key: 'actions', title: '操作', width: 160,
      render: r => (
        <div className="flex items-center gap-1.5">
          <Btn variant="secondary" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openPriceOverride(r)}>改价</Btn>
          <Btn variant="secondary" size="sm" icon={<GitBranch className="w-3.5 h-3.5" />} onClick={() => setChannelModal({ id: r.id, name: r.name })}>渠道</Btn>
        </div>
      ),
    },
  ]

  return (
    <>
      <SectionCard
        title={<span className="inline-flex items-center gap-2">本店菜单
          <Btn variant="secondary" size="sm" icon={<RotateCcw className="w-3.5 h-3.5" />} loading={loading} onClick={loadItems}>刷新</Btn>
        </span>}
        description="金色「专属」= 仅本店可见的商品"
        bodyClassName="p-0"
      >
        <div className="p-4">
          <Table columns={columns} data={items} rowKey={r => r.id} loading={loading} empty="暂无商品" />
        </div>
      </SectionCard>

      {/* 价格覆盖弹窗 */}
      <Modal
        open={!!priceOverrideModal}
        onOpenChange={v => !v && setPriceOverrideModal(null)}
        title={`覆盖价格 — ${priceOverrideModal?.item.name ?? ''}`}
        size="lg"
        footer={<><Btn variant="secondary" onClick={() => setPriceOverrideModal(null)}>取消</Btn><Btn variant="primary" loading={savingPrice} onClick={handleSavePriceOverride}>保存</Btn></>}
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-700">品牌定价：{priceOverrideModal ? fmtYuan(priceOverrideModal.item.basePrice) : ''}</p>
            <p className="text-xs text-slate-400 mt-0.5">留空则恢复使用品牌定价</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">本店售价（元）</label>
            <NumberInput value={priceOverride} onChange={setPriceOverride} min={0} className="w-full" />
          </div>

          {loadingItemModifiers ? (
            <Spinner />
          ) : itemModifierGroups.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-slate-400">自定义选项价格覆盖</span>
                <span className="flex-1 h-px bg-slate-100" />
              </div>
              <p className="text-xs text-slate-400 mb-3">留空使用品牌价格；填入后仅本店生效</p>
              {itemModifierGroups.map(ig => (
                <div key={ig.modifierGroupId} className="mb-4">
                  <p className="text-xs text-slate-500 mb-1.5">{ig.group?.displayName || ig.modifierGroupId}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(ig.group?.options || []).map((opt: any) => (
                      <div key={opt.id} className="flex items-center gap-1.5">
                        <span className="flex-1 min-w-0 truncate text-xs text-slate-700" title={opt.displayName}>{opt.displayName}</span>
                        <span className="text-[11px] text-slate-400 shrink-0">品牌 {fmtYuan(opt.defaultPrice)}</span>
                        <input
                          type="number" min={0} step="0.01" placeholder="覆盖" className={numCls}
                          value={modifierPriceOverrides[opt.id] ?? ''}
                          onChange={e => setModifierPriceOverrides(prev => ({ ...prev, [opt.id]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {channelModal && (
        <ItemChannelConfig
          open={!!channelModal}
          itemId={channelModal.id}
          itemName={channelModal.name}
          onClose={() => setChannelModal(null)}
        />
      )}
    </>
  )
}

export default StoreMenuManager
