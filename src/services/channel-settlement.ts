import { httpService } from './http'

const FINANCE_API = '/api/finance/v1'
const ORDER_API = (import.meta.env.VITE_ORDER_API_BASE as string | undefined) ?? '/api/order/v1'

export interface ChannelReceivableItem {
  id: string
  orderId: string
  orderNumber?: string | null
  amount: number
  balance: number
  status: string
  dueDate: string
  createdAt: string
  paidAt?: string | null
}

export interface ChannelReceivableGroup {
  channelId: string | null
  channelName: string | null
  orderCount: number
  totalAmount: number
  items: ChannelReceivableItem[]
}

export interface SettleResult {
  settledCount: number
  totalAmount: number
}

export interface CreditStatus {
  cycleLimit: number
  usedAmount: number
  availableAmount: number
  billingCycle: string
  cycleStart: string
  previousUnpaid: number
}

export interface CreditChannel {
  id: string
  sourceName: string
  checkoutMode: string
  isActive: boolean
}

export const channelSettlementService = {
  // 获取所有记账渠道（CREDIT_ACCOUNT）
  async listCreditChannels(): Promise<CreditChannel[]> {
    const res = await httpService.get<any>(`${ORDER_API}/sales-channels`)
    const payload = res.data as any
    const list: any[] = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : [])
    return list.filter((c: any) => c.checkoutMode === 'CREDIT_ACCOUNT')
  },

  // 获取所有渠道的未结清应收账款（按渠道分组）
  async listChannelReceivables(): Promise<ChannelReceivableGroup[]> {
    const res = await httpService.get<any>(`${FINANCE_API}/channel-settlements`)
    const payload = res.data as any
    const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : [])
    return list
  },

  // 手动结清某渠道所有未付账单
  async settleChannel(channelId: string, paymentNote?: string): Promise<SettleResult> {
    const res = await httpService.post<any>(
      `${FINANCE_API}/channel-settlements/${channelId}/settle`,
      { paymentNote }
    )
    const payload = res.data as any
    return payload?.data ?? payload ?? { settledCount: 0, totalAmount: 0 }
  },

  // 查询结算历史
  async getSettlementHistory(channelId: string, page = 1, pageSize = 20) {
    const res = await httpService.get<any>(
      `${FINANCE_API}/channel-settlements/${channelId}/history?page=${page}&pageSize=${pageSize}`
    )
    const payload = res.data as any
    if (Array.isArray(payload)) return { items: payload, total: payload.length }
    if (Array.isArray(payload?.data)) return { items: payload.data, total: payload.data.length }
    return { items: payload?.items ?? payload?.data?.items ?? [], total: payload?.total ?? 0 }
  },

  // 查询渠道授信额度
  async getChannelCreditStatus(channelConfigId: string): Promise<CreditStatus | null> {
    try {
      const res = await httpService.get<any>(
        `${ORDER_API}/sales-channels/channel-credit/${channelConfigId}`
      )
      const payload = res.data as any
      return payload?.data ?? null
    } catch {
      return null
    }
  },
}
