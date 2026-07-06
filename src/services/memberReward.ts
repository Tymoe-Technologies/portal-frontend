import { httpService } from './http'

const BASE = (import.meta.env.VITE_MEMBER_API_BASE as string | undefined) || '/api/member/v1'

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export type RewardType = 'TEXT_ONLY' | 'FREE_ITEM' | 'DISCOUNT_AMOUNT' | 'DISCOUNT_PERCENTAGE'
export type SelectionMode = 'FIXED' | 'PICK_ONE' | 'PICK_N' | 'PICK_FROM_CATEGORY'
export type StackingMode = 'EXCLUSIVE' | 'STACKABLE' | 'GROUP_EXCLUSIVE'
export type RewardStatus = 'ACTIVE' | 'INACTIVE' | 'COMING_SOON' | 'SOLD_OUT'

export interface LinkedItem {
  id?: string
  itemId: string
  itemName: string
  itemImageUrl?: string
  itemCategory?: string
  sortOrder?: number
}

export interface RedeemItem {
  id: string
  organizationId: string
  name: string
  description?: string
  image?: string
  pointsCost?: number | null   // null = 不可用积分兑换（仅发放）
  isGrantable: boolean         // 可作为礼物发放
  rewardType: RewardType

  // FREE_ITEM
  selectionMode?: SelectionMode
  pickCount?: number
  linkedCategories: string[]
  linkedItems: LinkedItem[]

  // DISCOUNT
  discountAmount?: number       // 分（cents）
  discountPercentage?: number   // 如 10.00 = 10% off
  discountMaxAmount?: number    // 分

  // 叠加规则
  stackingMode: StackingMode
  exclusionGroup?: string
  maxPerOrder: number
  incompatibleWith: string[]
  priority: number

  // 限制
  restrictToLevelIds: string[]
  stock?: number
  limitPerMember?: number
  validFrom?: string
  validTo?: string
  validityDays?: number | null   // null = 永久不过期；N = 发放后 N 天过期

  sortOrder: number
  status: RewardStatus
  createdAt: string
  updatedAt: string
}

export interface CreateRedeemItemPayload {
  name: string
  description?: string
  image?: string
  pointsCost?: number | null
  isGrantable?: boolean
  rewardType: RewardType

  selectionMode?: SelectionMode
  pickCount?: number
  linkedCategories?: string[]
  linkedItems?: Omit<LinkedItem, 'id'>[]

  discountAmount?: number
  discountPercentage?: number
  discountMaxAmount?: number

  stackingMode?: StackingMode
  exclusionGroup?: string
  maxPerOrder?: number
  incompatibleWith?: string[]
  priority?: number

  restrictToLevelIds?: string[]
  stock?: number
  limitPerMember?: number
  validFrom?: string
  validTo?: string
  validityDays?: number | null
  sortOrder?: number
}

export interface RedeemItemListResponse {
  data: RedeemItem[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// ─────────────────────────────────────────────
// API 调用
// ─────────────────────────────────────────────

export const memberRewardService = {
  list(params?: { status?: string; rewardType?: string; redeemableOnly?: boolean; page?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params?.status)         query.set('status', params.status)
    if (params?.rewardType)     query.set('rewardType', params.rewardType)
    if (params?.redeemableOnly) query.set('redeemableOnly', 'true')
    if (params?.page)           query.set('page', String(params.page))
    if (params?.limit)          query.set('limit', String(params.limit))
    const qs = query.toString()
    return httpService.get<RedeemItemListResponse>(`${BASE}/rewards${qs ? `?${qs}` : ''}`)
  },

  getById(id: string) {
    return httpService.get<{ data: RedeemItem }>(`${BASE}/rewards/${id}`)
  },

  create(payload: CreateRedeemItemPayload) {
    return httpService.post<{ data: RedeemItem }>(`${BASE}/rewards`, payload)
  },

  update(id: string, payload: Partial<CreateRedeemItemPayload>) {
    return httpService.put<{ data: RedeemItem }>(`${BASE}/rewards/${id}`, payload)
  },

  remove(id: string) {
    return httpService.delete<{ data: { message: string } }>(`${BASE}/rewards/${id}`)
  },

  // 彻底删除（物理删除），仅限从未发放过的奖励
  hardRemove(id: string) {
    return httpService.delete<{ data: { message: string } }>(`${BASE}/rewards/${id}/permanent`)
  },

  // 重新上架（INACTIVE → ACTIVE）
  reactivate(id: string) {
    return httpService.post<{ data: RedeemItem }>(`${BASE}/rewards/${id}/reactivate`)
  },
}
