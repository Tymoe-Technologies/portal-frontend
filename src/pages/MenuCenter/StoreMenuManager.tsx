/**
 * StoreMenuManager - 门店菜单配置（BRANCH / FRANCHISE 专用）
 *
 * 功能：
 * 1. 查看所有可见商品（BRAND + STORE_EXCLUSIVE）
 * 2. 开关可用性、覆盖售价、覆盖 modifier 选项价格
 */

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      toast.error(t('pages.menuCenter.storeMenuManager.loadItemsFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleToggleAvailability = async (item: StoreMenuItem, isAvailable: boolean) => {
    try {
      await storeMenuService.upsertStoreMenuConfig(item.id, { isAvailable })
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, isAvailable } : i))
      toast.success(isAvailable ? t('pages.menuCenter.storeMenuManager.itemEnabled') : t('pages.menuCenter.storeMenuManager.itemDisabled'))
    } catch {
      toast.error(t('pages.menuCenter.storeMenuManager.operationFailed'))
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
      toast.success(t('pages.menuCenter.storeMenuManager.priceSaved'))
      setPriceOverrideModal(null)
      loadItems()
    } catch {
      toast.error(t('pages.menuCenter.storeMenuManager.saveFailed'))
    } finally {
      setSavingPrice(false)
    }
  }

  const columns: Column<StoreMenuItem>[] = [
    {
      key: 'name', title: t('pages.menuCenter.storeMenuManager.columnName'),
      render: r => (
        <div className="flex items-center gap-2">
          <span className="text-slate-800">{r.name}</span>
          {r.scope === 'STORE_EXCLUSIVE' && <Badge variant="gold">{t('pages.menuCenter.storeMenuManager.exclusiveBadge')}</Badge>}
          {r.hasStoreOverride && <Badge variant="blue">{t('pages.menuCenter.storeMenuManager.configuredBadge')}</Badge>}
        </div>
      ),
    },
    { key: 'basePrice', title: t('pages.menuCenter.storeMenuManager.columnBasePrice'), width: 110, render: r => fmtYuan(r.basePrice) },
    {
      key: 'effectivePrice', title: t('pages.menuCenter.storeMenuManager.columnEffectivePrice'), width: 140,
      render: r => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">{fmtYuan(r.effectivePrice)}</span>
          {r.effectivePrice !== r.basePrice && <Badge variant="gold">{t('pages.menuCenter.storeMenuManager.overriddenBadge')}</Badge>}
        </div>
      ),
    },
    {
      key: 'isAvailable', title: t('pages.menuCenter.storeMenuManager.columnIsAvailable'), width: 100,
      render: r => <Switch checked={r.isAvailable} onCheckedChange={v => handleToggleAvailability(r, v)} />,
    },
    {
      key: 'actions', title: t('pages.menuCenter.storeMenuManager.columnActions'), width: 160,
      render: r => (
        <div className="flex items-center gap-1.5">
          <Btn variant="secondary" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openPriceOverride(r)}>{t('pages.menuCenter.storeMenuManager.priceOverrideAction')}</Btn>
          <Btn variant="secondary" size="sm" icon={<GitBranch className="w-3.5 h-3.5" />} onClick={() => setChannelModal({ id: r.id, name: r.name })}>{t('pages.menuCenter.storeMenuManager.channelAction')}</Btn>
        </div>
      ),
    },
  ]

  return (
    <>
      <SectionCard
        title={<span className="inline-flex items-center gap-2">{t('pages.menuCenter.storeMenuManager.pageTitle')}
          <Btn variant="secondary" size="sm" icon={<RotateCcw className="w-3.5 h-3.5" />} loading={loading} onClick={loadItems}>{t('pages.menuCenter.storeMenuManager.refreshAction')}</Btn>
        </span>}
        description={t('pages.menuCenter.storeMenuManager.pageDescription')}
        bodyClassName="p-0"
      >
        <div className="p-4">
          <Table columns={columns} data={items} rowKey={r => r.id} loading={loading} empty={t('pages.menuCenter.storeMenuManager.emptyItems')} />
        </div>
      </SectionCard>

      {/* 价格覆盖弹窗 */}
      <Modal
        open={!!priceOverrideModal}
        onOpenChange={v => !v && setPriceOverrideModal(null)}
        title={t('pages.menuCenter.storeMenuManager.priceOverrideModalTitle', { name: priceOverrideModal?.item.name ?? '' })}
        size="lg"
        footer={<><Btn variant="secondary" onClick={() => setPriceOverrideModal(null)}>{t('pages.menuCenter.storeMenuManager.cancelAction')}</Btn><Btn variant="primary" loading={savingPrice} onClick={handleSavePriceOverride}>{t('pages.menuCenter.storeMenuManager.saveAction')}</Btn></>}
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-700">{t('pages.menuCenter.storeMenuManager.basePriceLabel', { price: priceOverrideModal ? fmtYuan(priceOverrideModal.item.basePrice) : '' })}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t('pages.menuCenter.storeMenuManager.basePriceHint')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('pages.menuCenter.storeMenuManager.storePriceLabel')}</label>
            <NumberInput value={priceOverride} onChange={setPriceOverride} min={0} className="w-full" />
          </div>

          {loadingItemModifiers ? (
            <Spinner />
          ) : itemModifierGroups.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-slate-400">{t('pages.menuCenter.storeMenuManager.modifierOverrideTitle')}</span>
                <span className="flex-1 h-px bg-slate-100" />
              </div>
              <p className="text-xs text-slate-400 mb-3">{t('pages.menuCenter.storeMenuManager.modifierOverrideHint')}</p>
              {itemModifierGroups.map(ig => (
                <div key={ig.modifierGroupId} className="mb-4">
                  <p className="text-xs text-slate-500 mb-1.5">{ig.group?.displayName || ig.modifierGroupId}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(ig.group?.options || []).map((opt: any) => (
                      <div key={opt.id} className="flex items-center gap-1.5">
                        <span className="flex-1 min-w-0 truncate text-xs text-slate-700" title={opt.displayName}>{opt.displayName}</span>
                        <span className="text-[11px] text-slate-400 shrink-0">{t('pages.menuCenter.storeMenuManager.brandPriceLabel', { price: fmtYuan(opt.defaultPrice) })}</span>
                        <input
                          type="number" min={0} step="0.01" placeholder={t('pages.menuCenter.storeMenuManager.overridePlaceholder')} className={numCls}
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
