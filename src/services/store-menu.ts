import { httpService } from './http'
import { fromMinorUnit, toMinorUnit } from '@/utils/priceConverter'

const API_BASE = (import.meta.env.VITE_ITEM_MANAGE_BASE as string | undefined) ?? 'http://localhost:3000/api/item-manage/v1'

// ==================== 类型定义 ====================

/** 品牌目录商品在该门店的配置（overlay）——门店只能改本店价格 + 是否售卖，名称/描述/图片一律取品牌目录 */
export interface StoreMenuConfig {
  id: string
  storeId: string
  catalogItemId: string | null
  priceOverride?: number         // 门店价格覆盖（分）
  isAvailable: boolean
  /** 临时下架（86'd/snooze）到期时间；为空或已过期 = 视为可售，到期自动恢复 */
  unavailableUntil?: string | null
  channels?: StoreItemChannel[]
  catalogItem?: {
    id: string
    name: string
    basePrice: number
    imageUrl?: string
  }
}

/** 门店 modifier 选项的临时下架/可用性覆盖（无记录 = 默认可售） */
export interface StoreModifierAvailability {
  modifierOptionId: string
  isAvailable: boolean
  unavailableUntil?: string | null
  /** 当前时刻的有效可用性（临时下架过期即为 true），后端计算好直接返回 */
  effectivelyAvailable: boolean
}

/** 端可见性配置（pos/online/self_delivery/kiosk 等，只管可见性，不带价格） */
export interface StoreItemChannel {
  id: string
  channelCode: string
  isVisible: boolean
}

/** 门店完整菜单（品牌目录 + 门店覆盖 + 店铺专属商品，统一在 items 中） */
export interface StoreMenu {
  items: StoreMenuItem[]
  meta: {
    storeId: string
    brandId: string
    channel: string
  }
}

export interface StoreMenuItem {
  id: string
  name: string
  description?: string
  imageUrl?: string
  basePrice: number
  effectivePrice: number         // 应用覆盖后的价格
  categoryId?: string
  isActive: boolean
  hasStoreOverride: boolean
  isAvailable: boolean
  storeConfigId?: string
  scope: 'BRAND' | 'STORE_EXCLUSIVE'
}

// ==================== 价格转换工具 ====================

function normalizeConfig(raw: any): StoreMenuConfig {
  return {
    ...raw,
    priceOverride: raw.price_override != null ? fromMinorUnit(raw.price_override) : undefined,
    storeId: raw.store_id,
    catalogItemId: raw.catalog_item_id,
    isAvailable: raw.is_available,
    unavailableUntil: raw.unavailable_until ?? null,
    catalogItem: raw.catalog_item ? {
      id: raw.catalog_item.id,
      name: raw.catalog_item.name,
      basePrice: fromMinorUnit(raw.catalog_item.base_price),
      imageUrl: raw.catalog_item.image_url,
    } : undefined,
    channels: raw.channels?.map((ch: any) => ({
      id: ch.id,
      channelCode: ch.channel_code,
      isVisible: ch.is_visible,
    }))
  }
}

// ==================== API 方法 ====================

class StoreMenuService {

  /** 获取门店完整菜单（品牌目录 + 覆盖 + 本地商品） */
  async getStoreMenu(channel?: string): Promise<StoreMenu> {
    const params = channel ? `?channel=${channel}` : ''
    const res = await httpService.get<any>(`${API_BASE}/store-menu${params}`)
    return {
      items: (res.data.items ?? []).map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        imageUrl: item.image_url,
        basePrice: fromMinorUnit(item.base_price),
        effectivePrice: fromMinorUnit(item.effective_price ?? item.base_price),
        categoryId: item.category_id,
        isActive: item.is_active,
        hasStoreOverride: item._has_store_override ?? false,
        isAvailable: item.store_config?.is_available ?? true,
        storeConfigId: item._store_config_id,
        scope: item.scope ?? 'BRAND',
      })),
      meta: res.data.meta,
    }
  }

  /** 获取门店所有覆盖配置（管理视图） */
  async getStoreMenuConfigs(): Promise<StoreMenuConfig[]> {
    const res = await httpService.get<any>(`${API_BASE}/store-menu/configs`)
    return (res.data.configs ?? []).map(normalizeConfig)
  }

  /** 设置品牌目录商品的门店覆盖（本店价格 + 是否售卖 + 临时下架到期时间） */
  async upsertStoreMenuConfig(catalogItemId: string, payload: {
    priceOverride?: number
    isAvailable?: boolean
    /** ISO 时间 = 临时下架至该时刻（过期自动恢复），null = 清除临时下架，缺省 = 不修改 */
    unavailableUntil?: string | null
  }): Promise<StoreMenuConfig> {
    const res = await httpService.put<any>(`${API_BASE}/store-menu/items/${catalogItemId}`, {
      catalogItemId,
      priceOverride: payload.priceOverride != null ? toMinorUnit(payload.priceOverride) : undefined,
      isAvailable: payload.isAvailable,
      unavailableUntil: payload.unavailableUntil,
    })
    return normalizeConfig(res.data)
  }

  /** 批量设置商品可用性（开关 + 可选临时下架到期时间） */
  async batchSetAvailability(items: Array<{
    catalogItemId: string
    isAvailable: boolean
    unavailableUntil?: string | null
  }>): Promise<void> {
    await httpService.put(`${API_BASE}/store-menu/items/batch-availability`, { items })
  }

  /** 获取本店所有 modifier 可用性覆盖（无记录 = 默认可售） */
  async getStoreModifierAvailability(): Promise<StoreModifierAvailability[]> {
    const res = await httpService.get<{ availability: any[] }>(`${API_BASE}/store-menu/modifier-availability`)
    return (res.data.availability ?? []).map((a) => ({
      modifierOptionId: a.modifierOptionId,
      isAvailable: a.isAvailable,
      unavailableUntil: a.unavailableUntil ?? null,
      effectivelyAvailable: a.effectivelyAvailable,
    }))
  }

  /** 设置单个 modifier 选项的本店可用性/临时下架 */
  async upsertStoreModifierAvailability(modifierOptionId: string, payload: {
    isAvailable?: boolean
    unavailableUntil?: string | null
  }): Promise<StoreModifierAvailability> {
    const res = await httpService.put<any>(`${API_BASE}/store-menu/modifier-availability`, {
      modifierOptionId,
      isAvailable: payload.isAvailable,
      unavailableUntil: payload.unavailableUntil,
    })
    return {
      modifierOptionId: res.data.modifierOptionId,
      isAvailable: res.data.isAvailable,
      unavailableUntil: res.data.unavailableUntil ?? null,
      effectivelyAvailable: res.data.effectivelyAvailable,
    }
  }

  /** 批量设置 modifier 可用性 */
  async batchSetModifierAvailability(options: Array<{
    modifierOptionId: string
    isAvailable: boolean
    unavailableUntil?: string | null
  }>): Promise<void> {
    await httpService.post(`${API_BASE}/store-menu/modifier-availability/batch`, { options })
  }

  /** 获取门店级自定义选项价格覆盖（返回 { modifierOptionId: 元 }，供改价弹窗回显） */
  async getStoreModifierPrices(catalogItemId: string): Promise<Record<string, number>> {
    const res = await httpService.get<{ success: boolean; data: Record<string, number> }>(
      `${API_BASE}/store-menu/items/${catalogItemId}/modifier-prices`
    )
    const raw = res.data.data ?? {}
    const result: Record<string, number> = {}
    for (const [optionId, cents] of Object.entries(raw)) {
      result[optionId] = fromMinorUnit(cents)
    }
    return result
  }

  /** 设置门店级自定义选项价格覆盖（price 传元，内部转分） */
  async setStoreModifierPrices(catalogItemId: string, prices: Array<{ modifierOptionId: string; price: number }>): Promise<void> {
    await httpService.put(`${API_BASE}/store-menu/items/${catalogItemId}/modifier-prices`, {
      prices: prices.map(p => ({ modifierOptionId: p.modifierOptionId, price: toMinorUnit(p.price) }))
    })
  }

  /** 获取商品的渠道配置列表 */
  async getItemChannels(catalogItemId: string): Promise<StoreItemChannel[]> {
    const res = await httpService.get<{ channels: any[] }>(`${API_BASE}/store-menu/items/${catalogItemId}/channels`)
    return (res.data.channels ?? []).map((ch: any) => ({
      id: ch.id,
      channelCode: ch.channel_code,
      isVisible: ch.is_visible,
      priceOverride: ch.price_override != null ? fromMinorUnit(ch.price_override) : undefined,
    }))
  }

  /** 批量保存商品渠道配置（price 传元，内部转分） */
  async batchSetItemChannels(catalogItemId: string, channels: Array<{
    channelCode: string
    isVisible: boolean
    priceOverride?: number
  }>): Promise<void> {
    await httpService.put(`${API_BASE}/store-menu/items/${catalogItemId}/batch-channels`, {
      channels: channels.map(ch => ({
        channelCode: ch.channelCode,
        isVisible: ch.isVisible,
        priceOverride: ch.priceOverride != null ? toMinorUnit(ch.priceOverride) : undefined,
      }))
    })
  }
}

// ─── catalog-items service（仅 MAIN 使用）──────────────────────────────────

const ITEM_API_BASE = (import.meta.env.VITE_ITEM_MANAGE_BASE as string | undefined) ?? 'http://localhost:3000/api/item-manage/v1'

export interface CreateStoreExclusiveItemPayload {
  name: string
  description?: string
  imageUrl?: string
  basePrice: number           // 元
  cost?: number
  categoryId: string
  isAvailable?: boolean
  visibleStoreIds?: string[]
}

class CatalogItemService {
  /** 创建店铺专属商品（仅 MAIN，scope=STORE_EXCLUSIVE） */
  async createStoreExclusiveItem(payload: CreateStoreExclusiveItemPayload) {
    const res = await httpService.post<any>(`${ITEM_API_BASE}/catalog-items`, {
      ...payload,
      basePrice: toMinorUnit(payload.basePrice),
      cost: payload.cost != null ? toMinorUnit(payload.cost) : undefined,
      scope: 'STORE_EXCLUSIVE',
    })
    return res.data
  }

  /** 更新店铺专属商品的可见门店列表（仅 MAIN） */
  async setItemVisibility(itemId: string, visibleStoreIds: string[]): Promise<void> {
    await httpService.put(`${ITEM_API_BASE}/catalog-items/${itemId}/visibility`, { visibleStoreIds })
  }
}

export const catalogItemService = new CatalogItemService()
export const storeMenuService = new StoreMenuService()
