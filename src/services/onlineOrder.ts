/**
 * 在线点单配置 API 服务
 *
 * 注意：商家身份字段（subdomain / customDomain / themeSettings / parentMerchantId）
 * 全部归 auth-service 管理（见 services/auth.ts 的 Organization）。本服务只负责"点单业务字段"。
 */
import { httpService } from './http'

const ORDER_SERVICE_BASE = (import.meta.env.VITE_ORDER_SERVICE_BASE as string | undefined) ?? 'http://localhost:3002/api/order/v1'

export interface DayPeriod {
  open: string      // "HH:mm"
  close: string     // "HH:mm"
  nextDay?: boolean // true = close 是次日（跨午夜）
}

export interface DayHours {
  closed: boolean
  periods: DayPeriod[]
}

export interface BusinessHours {
  monday: DayHours
  tuesday: DayHours
  wednesday: DayHours
  thursday: DayHours
  friday: DayHours
  saturday: DayHours
  sunday: DayHours
}

/** 兼容旧格式 { open, close, closed } 和新格式 { closed, periods } */
export function normalizeDayHours(raw: any): DayHours {
  if (!raw) return { closed: false, periods: [{ open: '09:00', close: '22:00' }] }
  if (Array.isArray(raw.periods)) return raw as DayHours
  return {
    closed: raw.closed === true,
    periods: [{ open: raw.open || '09:00', close: raw.close || '22:00' }],
  }
}

export interface OnlineOrderConfig {
  id: string
  merchantId: string
  parentMerchantId: string | null
  enabled: boolean
  allowPickup: boolean
  allowDineIn: boolean
  allowDelivery: boolean
  businessHours: BusinessHours | null
  minOrderAmount: number | null  // 单位:分
  deliveryFee: number | null      // 单位:分
  deliveryRadius: number | null   // 单位:公里
  // 自取预约配置
  allowPickupSchedule: boolean
  pickupLeadMinutes: number       // 最早提前量（分钟）
  pickupSlotInterval: number      // 时间槽间隔（分钟）
  pickupAdvanceDays: number       // 可提前预约天数
  createdAt: string
  updatedAt: string
}

export interface CreateOnlineOrderConfigPayload {
  enabled?: boolean
  allowPickup?: boolean
  allowDineIn?: boolean
  allowDelivery?: boolean
  businessHours?: BusinessHours
  minOrderAmount?: number
  deliveryFee?: number
  deliveryRadius?: number
  allowPickupSchedule?: boolean
  pickupLeadMinutes?: number
  pickupSlotInterval?: number
  pickupAdvanceDays?: number
}

export interface UpdateOnlineOrderConfigPayload {
  enabled?: boolean
  allowPickup?: boolean
  allowDineIn?: boolean
  allowDelivery?: boolean
  businessHours?: BusinessHours
  minOrderAmount?: number | null
  deliveryFee?: number
  deliveryRadius?: number
  allowPickupSchedule?: boolean
  pickupLeadMinutes?: number
  pickupSlotInterval?: number
  pickupAdvanceDays?: number
}

/**
 * 获取商家在线点单配置
 */
export async function getOnlineOrderConfig(merchantId: string): Promise<OnlineOrderConfig | null> {
  try {
    const response = await httpService.get(`${ORDER_SERVICE_BASE}/merchants/${merchantId}/config`)
    const result = response.data as any
    return result.data || result as OnlineOrderConfig
  } catch (error: any) {
    // 404 = 配置未初始化，静默返回 null
    if (error.message?.includes('未找到') || error.message?.includes('不存在') || error.message?.includes('资源')) {
      return null
    }
    throw error
  }
}

/**
 * 创建在线点单配置
 * 后端会自动调用 auth-service 解析主店/分店关系（不需要前端传 parentMerchantId）
 * 业务规则：分店启用前主店必须已启用
 */
export async function createOnlineOrderConfig(
  merchantId: string,
  payload: CreateOnlineOrderConfigPayload
): Promise<OnlineOrderConfig> {
  const response = await httpService.post(
    `${ORDER_SERVICE_BASE}/merchants/${merchantId}/config`,
    payload
  )
  const result = response.data as any
  return result.data || result as OnlineOrderConfig
}

/**
 * 更新在线点单配置
 */
export async function updateOnlineOrderConfig(
  merchantId: string,
  payload: UpdateOnlineOrderConfigPayload
): Promise<OnlineOrderConfig> {
  const response = await httpService.put(
    `${ORDER_SERVICE_BASE}/merchants/${merchantId}/config`,
    payload
  )
  const result = response.data as any
  return result.data || result as OnlineOrderConfig
}

/**
 * 删除在线点单配置
 */
export async function deleteOnlineOrderConfig(merchantId: string): Promise<void> {
  await httpService.delete(`${ORDER_SERVICE_BASE}/merchants/${merchantId}/config`)
}

/**
 * 获取默认营业时间
 */
export function getDefaultBusinessHours(): BusinessHours {
  const defaultDay: DayHours = { closed: false, periods: [{ open: '09:00', close: '22:00' }] }
  return {
    monday: { ...defaultDay, periods: [...defaultDay.periods] },
    tuesday: { ...defaultDay, periods: [...defaultDay.periods] },
    wednesday: { ...defaultDay, periods: [...defaultDay.periods] },
    thursday: { ...defaultDay, periods: [...defaultDay.periods] },
    friday: { ...defaultDay, periods: [...defaultDay.periods] },
    saturday: { ...defaultDay, periods: [...defaultDay.periods] },
    sunday: { ...defaultDay, periods: [...defaultDay.periods] },
  }
}

/**
 * 构建在线点单 URL
 * @param subdomain 主店的 subdomain（从 auth-service 的 Organization 获取）
 */
export function buildOnlineOrderUrl(subdomain: string): string {
  const baseDomain = import.meta.env.VITE_BASE_DOMAIN || 'tymoe.com'
  return `https://${subdomain}.order.${baseDomain}`
}
