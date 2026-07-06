import { httpService } from './http'

const API_BASE = (import.meta.env.VITE_ORDER_API_BASE as string | undefined) ?? '/api/order/v1'

// 销售渠道类型（OrderSourceConfig.sourceType）
export type SalesChannelType = 'POS' | 'ONLINE' | 'DELIVERY' | 'SELF_SERVICE' | 'CUSTOM'

// 订单终端类型（Order.orderSource enum）
export type OrderTerminal = 'POS' | 'WEB' | 'KIOSK' | 'UBER_EATS'

export type CheckoutMode = 'NORMAL' | 'CREDIT_ACCOUNT'
export type ChannelAccessMode = 'PUBLIC' | 'MEMBER_ONLY'
export type BillingCycle = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
export type DiscountType = 'PERCENTAGE' | 'FIXED'
export type DeliveryPlatform =
  | 'UBER_EATS'
  | 'DOORDASH'
  | 'SKIP_THE_DISHES'
  | 'GRUBHUB'
  | 'RITUAL'
  | 'FANTUAN'
  | 'OTHER_PLATFORM'

export interface CreditConfig {
  billingCycle: BillingCycle
  cycleLimit: number // 分
}

export interface OrderDiscountRule {
  enabled: boolean
  type: DiscountType
  value: number // PERCENTAGE: 0-100；FIXED: 分
}

export interface CheckoutRules {
  orderDiscount?: OrderDiscountRule
}

// 销售渠道配置（对应后端 OrderSourceConfig / sales-channels API）
export interface SalesChannel {
  id: string
  tenantId: string
  sourceType: string
  sourceName: string
  description?: string
  isActive: boolean
  displayOrder: number
  isSystemChannel: boolean
  platformType?: DeliveryPlatform
  commissionRate?: string // Decimal 序列化为字符串
  accessMode: ChannelAccessMode
  checkoutMode: CheckoutMode
  creditConfig?: CreditConfig
  checkoutRules?: CheckoutRules
  createdAt: string
  updatedAt: string
}

export interface CreateSalesChannelRequest {
  channelType: string
  channelName: string
  description?: string
  isActive?: boolean
  displayOrder?: number
  accessMode?: ChannelAccessMode
  checkoutMode?: CheckoutMode
  creditConfig?: CreditConfig
  checkoutRules?: CheckoutRules
  commissionRate?: number
  platformType?: DeliveryPlatform
}

export interface UpdateSalesChannelRequest {
  channelName?: string
  description?: string
  isActive?: boolean
  displayOrder?: number
  accessMode?: ChannelAccessMode
  checkoutMode?: CheckoutMode
  creditConfig?: CreditConfig | null
  checkoutRules?: CheckoutRules | null
  commissionRate?: number | null
}

// API 响应类型
export interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
}

export interface ListResponse<T> {
  success: boolean
  message: string
  data: {
    items: T[]
    total: number
    page?: number
    pageSize?: number
  }
}

// 获取销售渠道列表
export async function getSalesChannels(): Promise<SalesChannel[]> {
  try {
    const response = await httpService.get<any>(
      `${API_BASE}/sales-channels`
    )
    const apiResponse = response.data
    if (apiResponse && apiResponse.data && Array.isArray(apiResponse.data)) {
      return apiResponse.data
    }
    if (Array.isArray(apiResponse)) {
      return apiResponse
    }
    return []
  } catch (error) {
    console.error('Failed to fetch sales channels:', error)
    throw error
  }
}

// 初始化默认销售渠道
export async function initializeDefaultSalesChannels(): Promise<SalesChannel[]> {
  try {
    const response = await httpService.post<any>(
      `${API_BASE}/sales-channels/init-defaults`,
      {}
    )
    const apiResponse = response.data
    if (apiResponse && apiResponse.data && Array.isArray(apiResponse.data)) {
      return apiResponse.data
    }
    if (Array.isArray(apiResponse)) {
      return apiResponse
    }
    return []
  } catch (error) {
    console.error('Failed to initialize default sales channels:', error)
    throw error
  }
}

// 创建销售渠道
export async function createSalesChannel(request: CreateSalesChannelRequest): Promise<SalesChannel> {
  try {
    const response = await httpService.post<any>(
      `${API_BASE}/sales-channels`,
      request
    )
    const apiResponse = response.data
    if (apiResponse && apiResponse.data) {
      return apiResponse.data as SalesChannel
    }
    return apiResponse as SalesChannel
  } catch (error) {
    console.error('Failed to create sales channel:', error)
    throw error
  }
}

// 更新销售渠道
export async function updateSalesChannel(id: string, request: UpdateSalesChannelRequest): Promise<SalesChannel> {
  try {
    const response = await httpService.put<any>(
      `${API_BASE}/sales-channels/${id}`,
      request
    )
    const apiResponse = response.data
    if (apiResponse && apiResponse.data) {
      return apiResponse.data as SalesChannel
    }
    return apiResponse as SalesChannel
  } catch (error) {
    console.error('Failed to update sales channel:', error)
    throw error
  }
}

// 删除销售渠道
export async function deleteSalesChannel(id: string): Promise<void> {
  try {
    await httpService.delete(
      `${API_BASE}/sales-channels/${id}`
    )
  } catch (error) {
    console.error('Failed to delete sales channel:', error)
    throw error
  }
}

// ── 渠道成员管理 ──────────────────────────────────────────────────────

export interface ChannelMember {
  id: string
  channelId: string
  phone: string
  name?: string | null
  note?: string | null
  isActive: boolean
  createdAt: string
}

export async function getChannelMembers(channelId: string): Promise<ChannelMember[]> {
  const res = await httpService.get<any>(`${API_BASE}/sales-channels/${channelId}/members`)
  const payload = res.data
  return Array.isArray(payload) ? payload : (payload?.data ?? [])
}

export async function addChannelMember(channelId: string, data: { phone: string; name?: string; note?: string }): Promise<ChannelMember> {
  const res = await httpService.post<any>(`${API_BASE}/sales-channels/${channelId}/members`, data)
  return res.data?.data ?? res.data
}

export async function batchAddChannelMembers(channelId: string, members: { phone: string; name?: string; note?: string }[]) {
  const res = await httpService.post<any>(`${API_BASE}/sales-channels/${channelId}/members/batch`, { members })
  return res.data?.data ?? res.data
}

export async function updateChannelMember(channelId: string, memberId: string, data: { name?: string; note?: string; isActive?: boolean }): Promise<ChannelMember> {
  const res = await httpService.put<any>(`${API_BASE}/sales-channels/${channelId}/members/${memberId}`, data)
  return res.data?.data ?? res.data
}

export async function removeChannelMember(channelId: string, memberId: string): Promise<void> {
  await httpService.delete(`${API_BASE}/sales-channels/${channelId}/members/${memberId}`)
}

// ── 向后兼容别名（逐步废弃） ────────────────────────────────────────────
/** @deprecated 使用 SalesChannel */
export type OrderSource = SalesChannel
/** @deprecated 使用 SalesChannelType */
export type OrderSourceType = SalesChannelType
/** @deprecated 使用 CreateSalesChannelRequest */
export type CreateOrderSourceRequest = CreateSalesChannelRequest
/** @deprecated 使用 UpdateSalesChannelRequest */
export type UpdateOrderSourceRequest = UpdateSalesChannelRequest
/** @deprecated 使用 getSalesChannels */
export const getOrderSources = getSalesChannels
/** @deprecated 使用 initializeDefaultSalesChannels */
export const initializeDefaultOrderSources = initializeDefaultSalesChannels
/** @deprecated 使用 createSalesChannel */
export const createOrderSource = createSalesChannel
/** @deprecated 使用 updateSalesChannel */
export const updateOrderSource = updateSalesChannel
/** @deprecated 使用 deleteSalesChannel */
export const deleteOrderSource = deleteSalesChannel
