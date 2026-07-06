import axios from 'axios'
import { httpService } from './http'

const API_BASE = (import.meta.env.VITE_ORDER_API_BASE as string | undefined) ?? '/api/order/v1'

// 创建不带默认 Content-Type 的 axios 实例，用于文件上传
const uploadAxios = axios.create({
  timeout: 10000,
})

// 票据类型
export type TicketType = 'CUSTOMER_RECEIPT' | 'KITCHEN_TICKET' | 'ITEM_LABEL' | 'DAILY_REPORT' | 'SHIFT_REPORT'

// 票据类型元信息
export interface TicketTypeMeta {
  ticketType: TicketType
  name: string
  protocol: string
  defaultCopies: number
  defaultEnabled: boolean
}

// 打印设置
export interface PrintSetting {
  id: string
  tenantId: string
  ticketType: TicketType
  isEnabled: boolean
  copies: number
  config: Record<string, any>
  version: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

// 版本检查结果
export interface VersionCheckResult {
  hasUpdates: boolean
  versions: Record<string, { version: number; needsUpdate: boolean }>
}

// 票据类型显示信息
export const TICKET_TYPE_LABELS: Record<TicketType, { name: string; description: string; icon: string }> = {
  CUSTOMER_RECEIPT: { name: '客户收据', description: '给客户的消费凭证，包含订单详情和支付信息', icon: 'receipt' },
  KITCHEN_TICKET: { name: '厨房菜品单', description: '发送到厨房的制作单，包含商品和备注信息', icon: 'kitchen' },
  ITEM_LABEL: { name: '标签贴纸', description: '贴在商品上的标签，包含商品名和订单信息', icon: 'label' },
  DAILY_REPORT: { name: '日结报表', description: '每日营业数据汇总报表', icon: 'report' },
  SHIFT_REPORT: { name: '交接班单', description: '交接班时的营业数据汇总', icon: 'shift' },
}

/**
 * 获取所有打印设置
 */
export async function getPrintSettings(): Promise<PrintSetting[]> {
  const response = await httpService.get<{ success: boolean; data: PrintSetting[] }>(
    `${API_BASE}/print-settings`
  )
  return response.data?.data || []
}

/**
 * 获取某种票据类型的设置
 */
export async function getPrintSettingByType(ticketType: TicketType): Promise<PrintSetting> {
  const response = await httpService.get<{ success: boolean; data: PrintSetting }>(
    `${API_BASE}/print-settings/${ticketType}`
  )
  return response.data.data
}

/**
 * 更新打印设置
 */
export async function updatePrintSetting(
  ticketType: TicketType,
  data: { isEnabled?: boolean; copies?: number; config?: Record<string, any> }
): Promise<PrintSetting> {
  const response = await httpService.put<{ success: boolean; data: PrintSetting }>(
    `${API_BASE}/print-settings/${ticketType}`,
    data
  )
  return response.data.data
}

/**
 * 启用/禁用票据类型
 */
export async function togglePrintSetting(ticketType: TicketType): Promise<PrintSetting> {
  const response = await httpService.patch<{ success: boolean; data: PrintSetting }>(
    `${API_BASE}/print-settings/${ticketType}/toggle`
  )
  return response.data.data
}

/**
 * 初始化默认打印设置
 */
export async function initializePrintSettings(): Promise<PrintSetting[]> {
  const response = await httpService.post<{ success: boolean; data: PrintSetting[] }>(
    `${API_BASE}/print-settings/initialize`
  )
  return response.data?.data || []
}

/**
 * 获取票据类型元信息
 */
export async function getTicketTypeMeta(): Promise<TicketTypeMeta[]> {
  const response = await httpService.get<{ success: boolean; data: TicketTypeMeta[] }>(
    `${API_BASE}/print-settings/meta`
  )
  return response.data?.data || []
}

/**
 * 上传打印 Logo 图片
 */
export async function uploadPrintLogo(file: File): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append('image', file)

  // 不手动设置 Content-Type，让 axios 自动为 FormData 添加正确的 boundary
  const response = await httpService.post<{ success: boolean; data: { url: string } }>(
    `${API_BASE}/print-settings/logo`,
    formData
  )
  return response.data.data
}

/**
 * 删除打印 Logo 图片
 */
export async function deletePrintLogo(): Promise<void> {
  await httpService.delete(`${API_BASE}/print-settings/logo`)
}

// 品牌配置（租户级别，所有打印模板共享）
export interface PrintBrandProfile {
  id: string
  tenantId: string
  logoUrl: string | null
  logoPublicId: string | null
  updatedAt: string
  createdAt: string
}

/**
 * 获取品牌配置（含共享 Logo URL）
 */
export async function getBrandProfile(): Promise<PrintBrandProfile | null> {
  const response = await httpService.get<{ success: boolean; data: PrintBrandProfile | null }>(
    `${API_BASE}/print-brand`
  )
  return response.data?.data ?? null
}

/**
 * 上传品牌 Logo（自动保存到数据库，所有模板可复用）
 */
export async function uploadBrandLogo(file: File): Promise<{ url: string; profile: PrintBrandProfile }> {
  const formData = new FormData()
  formData.append('image', file)

  // 使用 httpService，它的拦截器会正确处理 FormData 的 Content-Type
  const response = await httpService.post<{ success: boolean; data: { url: string; profile: PrintBrandProfile } }>(
    `${API_BASE}/print-brand/logo`,
    formData
  )
  return response.data.data
}

/**
 * 删除品牌 Logo
 */
export async function deleteBrandLogo(): Promise<void> {
  await httpService.delete(`${API_BASE}/print-brand/logo`)
}

// ─── 取餐号配置 ────────────────────────────────────────────────────────────────

export interface PickupNumberConfig {
  startAt: number
  showPrefix: boolean
  channelPrefixes: Record<string, string>
  queueDisplayEnabled: boolean
}

/**
 * 获取取餐号配置
 */
export async function getPickupNumberConfig(): Promise<PickupNumberConfig> {
  const response = await httpService.get<{ success: boolean; data: PickupNumberConfig }>(
    `${API_BASE}/print-settings/pickup-number-config`
  )
  return response.data?.data ?? { startAt: 1, showPrefix: true }
}

/**
 * 更新取餐号配置
 */
export async function updatePickupNumberConfig(
  data: Partial<PickupNumberConfig>
): Promise<PickupNumberConfig> {
  const response = await httpService.put<{ success: boolean; data: PickupNumberConfig }>(
    `${API_BASE}/print-settings/pickup-number-config`,
    data
  )
  return response.data?.data ?? { startAt: 1, showPrefix: true }
}
