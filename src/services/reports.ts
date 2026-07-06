import { httpService } from './http'

const API_BASE = (import.meta.env.VITE_ORDER_API_BASE as string | undefined) ?? '/api/order/v1'

export interface DateRangeParams {
  startDate: string // UTC ISO
  endDate: string // UTC ISO
}

export interface OrderStatistics {
  totalOrders: number
  totalRevenue: number
  averageOrderValue: number
  ordersByStatus: Record<string, number>
  ordersByType: Record<string, number>
  ordersBySource: Record<string, number>
  storeTimezone: string | null
}

export type RevenueGroupBy = 'day' | 'hour' | 'source' | 'type' | 'channel'

export interface RevenueRow {
  bucket?: string
  hour?: number
  key?: string
  orderCount: number
  subtotal: number
  taxAmount: number
  discountAmount: number
  serviceFee: number
  deliveryFee: number
  tipAmount: number
  totalAmount: number
}

export interface RevenueStatistics {
  storeTimezone: string | null
  groupBy: RevenueGroupBy
  rows: RevenueRow[]
}

export interface ItemStatisticsRow {
  itemId: string
  itemName: string
  quantity: number
  totalPrice: number
  discountAmount: number
}

export interface ItemStatistics {
  page: number
  pageSize: number
  total: number
  rows: ItemStatisticsRow[]
}

export type TaxGroupBy = 'day' | 'source' | 'channel'

export interface TaxRow {
  bucket?: string
  key?: string
  orderCount: number
  taxableSales: number
  taxCollected: number
}

export interface TaxStatistics {
  storeTimezone: string | null
  groupBy: TaxGroupBy
  note: string
  rows: TaxRow[]
}

export interface ReconciliationRow {
  paymentMethod: string
  paymentStatus: string
  settlementStatus: string
  orderCount: number
  totalAmount: number
  tipAmount: number
}

export interface ReconciliationStatistics {
  storeTimezone: string | null
  note: string
  rows: ReconciliationRow[]
}

function unwrap<T>(apiResponse: any): T {
  if (apiResponse && apiResponse.data !== undefined) return apiResponse.data as T
  return apiResponse as T
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value))
  })
  return search.toString()
}

export async function getOrderStatistics(params: DateRangeParams): Promise<OrderStatistics> {
  const response = await httpService.get<any>(`${API_BASE}/statistics/orders?${toQueryString(params)}`)
  return unwrap<OrderStatistics>(response.data)
}

export async function getRevenueStatistics(
  params: DateRangeParams & { groupBy?: RevenueGroupBy }
): Promise<RevenueStatistics> {
  const response = await httpService.get<any>(`${API_BASE}/statistics/revenue?${toQueryString(params)}`)
  return unwrap<RevenueStatistics>(response.data)
}

export async function getItemStatistics(
  params: DateRangeParams & { page?: number; pageSize?: number }
): Promise<ItemStatistics> {
  const response = await httpService.get<any>(`${API_BASE}/statistics/items?${toQueryString(params)}`)
  return unwrap<ItemStatistics>(response.data)
}

export async function getTaxStatistics(
  params: DateRangeParams & { groupBy?: TaxGroupBy }
): Promise<TaxStatistics> {
  const response = await httpService.get<any>(`${API_BASE}/statistics/tax?${toQueryString(params)}`)
  return unwrap<TaxStatistics>(response.data)
}

export async function getReconciliationStatistics(
  params: DateRangeParams
): Promise<ReconciliationStatistics> {
  const response = await httpService.get<any>(
    `${API_BASE}/statistics/reconciliation?${toQueryString(params)}`
  )
  return unwrap<ReconciliationStatistics>(response.data)
}
