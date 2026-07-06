import { httpService } from './http'

// 开发时可直连 member service 跳过 Vite proxy: VITE_MEMBER_API_BASE=http://localhost:7006/api/member/v1
const BASE = (import.meta.env.VITE_MEMBER_API_BASE as string | undefined) || '/api/member/v1'

// ─── 会员 ────────────────────────────────────────────────────────────────────

export interface Member {
  id: string
  memberNo: string
  name?: string
  areaCode: string
  phoneNumber: string
  email?: string
  points: number
  totalSpent: string
  levelId?: string
  level?: MemberLevel
  status: 'ACTIVE' | 'INACTIVE'
  source: string
  lastVisit?: string
  lastPurchase?: string
  createdAt: string
}

export interface PointTransaction {
  id: string
  type: 'EARN' | 'REDEEM' | 'ADJUST' | 'EXPIRE' | 'CANCEL'
  amount: number
  balanceBefore: number
  balanceAfter: number
  reason?: string
  source: string
  createdAt: string
}

export const memberApi = {
  list: (params?: {
    page?: number
    limit?: number
    search?: string
    status?: string
    levelId?: string
    birthdayWithin?: 'today' | 'thisWeek' | 'thisMonth' | 'next7'
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }) => {
    const qs = new URLSearchParams()
    if (params?.page)            qs.set('page', String(params.page))
    if (params?.limit)           qs.set('limit', String(params.limit))
    if (params?.search)          qs.set('search', params.search)
    if (params?.status)          qs.set('status', params.status)
    if (params?.levelId)         qs.set('levelId', params.levelId)
    if (params?.birthdayWithin)  qs.set('birthdayWithin', params.birthdayWithin)
    if (params?.sortBy)          qs.set('sortBy', params.sortBy)
    if (params?.sortOrder)       qs.set('sortOrder', params.sortOrder)
    const query = qs.toString()
    return httpService.get(`${BASE}/members${query ? `?${query}` : ''}`)
  },

  getById: (id: string) => httpService.get(`${BASE}/members/${id}`),

  update: (id: string, data: Partial<Pick<Member, 'name' | 'email' | 'status'>>) =>
    httpService.put(`${BASE}/members/${id}`, data),

  pointHistory: (memberId: string, params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page)  qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    const query = qs.toString()
    return httpService.get(`${BASE}/points/${memberId}/history${query ? `?${query}` : ''}`)
  },

  adjustPoints: (memberId: string, data: { amount: number; reason?: string; notes?: string }) =>
    httpService.post(`${BASE}/points/${memberId}/adjust`, data),
}

// ─── 会员等级 ─────────────────────────────────────────────────────────────────

export interface MemberLevel {
  id: string
  name: string
  description?: string
  rank: number
  icon?: string
  color?: string
  isDefault: boolean
  upgradeMinSpending?: string
  maintenanceEnabled?: boolean
  maintenanceMinSpending?: string
  maintenancePeriodDays?: number
  benefits: LevelBenefit[]
  status: 'ACTIVE' | 'INACTIVE'
}

export interface LevelBenefit {
  id?: string
  name: string
  description?: string
  type: 'POINTS_MULTIPLIER' | 'DISCOUNT' | 'FREE_ITEM' | 'CUSTOM'
  pointsMultiplier?: number
  discountType?: 'PERCENTAGE' | 'FIXED'
  discountValue?: number
  customValue?: string
  sortOrder?: number
}

export interface CreateLevelPayload {
  name: string
  description?: string
  rank: number
  color?: string
  isDefault?: boolean
  upgradeMinSpending?: number
  maintenanceEnabled?: boolean
  maintenanceMinSpending?: number
  maintenancePeriodDays?: number
  benefits?: Omit<LevelBenefit, 'id'>[]
}

export const levelApi = {
  list: () => httpService.get(`${BASE}/levels`),
  create: (data: CreateLevelPayload) => httpService.post(`${BASE}/levels`, data),
  update: (id: string, data: Partial<CreateLevelPayload>) => httpService.put(`${BASE}/levels/${id}`, data),
  remove: (id: string) => httpService.delete(`${BASE}/levels/${id}`),
}

// ─── 系统配置 ─────────────────────────────────────────────────────────────────

export type PointsExpiryMode = 'NEVER' | 'ROLLING' | 'CALENDAR_YEAR'

export interface MemberConfig {
  id: string
  organizationId: string
  membershipEnabled: boolean
  enableMemberLevels: boolean
  notificationsEnabled: boolean
  defaultLevelId?: string
  maxRewardsPerOrder?: number
  maxPromotionsPerOrder?: number
  pointsExpiryMode: PointsExpiryMode
  pointsExpiryDays?: number | null
  pointsExpiryMonth?: number | null
  pointsExpiryDay?: number | null
  updatedAt: string
}

export const configApi = {
  get: () => httpService.get(`${BASE}/config`),
  update: (data: Partial<Omit<MemberConfig, 'id' | 'organizationId' | 'updatedAt'>>) =>
    httpService.put(`${BASE}/config`, data),
}

// ─── 积分规则 ─────────────────────────────────────────────────────────────────

export interface PointsRule {
  id: string
  organizationId: string
  name: string
  description?: string
  type: 'EARN' | 'REDEEM'
  isDefault: boolean
  status: 'ACTIVE' | 'INACTIVE'
  earnConversionRate?: string   // 每 N 元得 1 积分
  earnMinAmount?: string
  earnMaxPerTransaction?: number
  redeemConversionRate?: string
  redeemMinPoints?: number
  redeemMaxPerTransaction?: number
  timeLimitDaysOfWeek: number[] // 0=周日 1=周一...6=周六，空=每天
  timeLimitStartTime?: string   // "HH:MM"
  timeLimitEndTime?: string     // "HH:MM"
  timeLimitValidFrom?: string
  timeLimitValidTo?: string
  createdAt: string
  updatedAt: string
}

export interface CreatePointsRulePayload {
  name: string
  description?: string
  type: 'EARN' | 'REDEEM'
  isDefault?: boolean
  earnConversionRate?: number
  earnMinAmount?: number
  earnMaxPerTransaction?: number
  redeemConversionRate?: number
  redeemMinPoints?: number
  redeemMaxPerTransaction?: number
  timeLimitDaysOfWeek?: number[]
  timeLimitStartTime?: string
  timeLimitEndTime?: string
  timeLimitValidFrom?: string
  timeLimitValidTo?: string
}

export const pointsRuleApi = {
  list: (type?: 'EARN' | 'REDEEM') => {
    const qs = type ? `?type=${type}` : ''
    return httpService.get(`${BASE}/points-rules${qs}`)
  },
  create: (data: CreatePointsRulePayload) =>
    httpService.post(`${BASE}/points-rules`, data),
  update: (id: string, data: Partial<CreatePointsRulePayload> & { status?: 'ACTIVE' | 'INACTIVE'; isDefault?: boolean }) =>
    httpService.put(`${BASE}/points-rules/${id}`, data),
  remove: (id: string) =>
    httpService.delete(`${BASE}/points-rules/${id}`),
}

// ─── 奖励模板（统一：积分兑换/生日礼/会员专属券/营销活动 都引用它）─────────

export type RewardType = 'TEXT_ONLY' | 'FREE_ITEM' | 'DISCOUNT_AMOUNT' | 'DISCOUNT_PERCENTAGE'

export interface RewardLinkedItem {
  id?: string
  itemId: string
  itemName: string
  itemImageUrl?: string
  itemCategory?: string
}

export interface Reward {
  id: string
  organizationId: string
  name: string
  description?: string
  image?: string
  pointsCost?: number | null    // null = 不能用积分换
  isGrantable: boolean          // 是否能作为礼物发放
  rewardType: RewardType
  selectionMode?: 'FIXED' | 'PICK_ONE' | 'PICK_N' | 'PICK_FROM_CATEGORY' | null
  pickCount?: number | null
  linkedCategories: string[]
  linkedItems?: RewardLinkedItem[]
  discountAmount?: number | null      // 分
  discountPercentage?: string | null  // 1-100
  discountMaxAmount?: number | null
  validFrom?: string | null
  validTo?: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'COMING_SOON' | 'SOLD_OUT'
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreateRewardPayload {
  name: string
  description?: string
  image?: string
  pointsCost?: number | null
  isGrantable?: boolean
  rewardType: RewardType
  selectionMode?: string | null
  pickCount?: number
  linkedCategories?: string[]
  linkedItems?: RewardLinkedItem[]
  discountAmount?: number
  discountPercentage?: number
  discountMaxAmount?: number
  validFrom?: string
  validTo?: string
  status?: string
  sortOrder?: number
}

export const rewardApi = {
  list: (params?: { isGrantable?: boolean; activeOnly?: boolean }) => {
    const qs = new URLSearchParams()
    if (params?.isGrantable) qs.set('isGrantable', 'true')
    if (params?.activeOnly) qs.set('activeOnly', 'true')
    const q = qs.toString()
    return httpService.get(`${BASE}/rewards${q ? `?${q}` : ''}`)
  },
  create: (data: CreateRewardPayload) => httpService.post(`${BASE}/rewards`, data),
  update: (id: string, data: Partial<CreateRewardPayload>) => httpService.put(`${BASE}/rewards/${id}`, data),
  remove: (id: string) => httpService.delete(`${BASE}/rewards/${id}`),
}

// ─── 生日券规则 ────────────────────────────────────────────────────────

export interface BirthdayRewardRule {
  id: string
  organizationId: string
  levelId: string | null
  rewardId: string
  daysAheadOfBirthday: number
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
}

export interface CreateBirthdayRulePayload {
  levelId?: string | null
  rewardId: string
  daysAheadOfBirthday?: number
  status?: 'ACTIVE' | 'INACTIVE'
}

export const birthdayRuleApi = {
  list: () => httpService.get(`${BASE}/birthday-rules`),
  create: (data: CreateBirthdayRulePayload) =>
    httpService.post(`${BASE}/birthday-rules`, data),
  update: (id: string, data: Partial<CreateBirthdayRulePayload>) =>
    httpService.patch(`${BASE}/birthday-rules/${id}`, data),
  remove: (id: string) =>
    httpService.delete(`${BASE}/birthday-rules/${id}`),
  /** 立即扫描发券（手动触发 cron 任务，含 advisory lock 防重） */
  scanNow: () => httpService.post(`${BASE}/birthday-rules/scan-now`, {}),
}

// ─── 会员钱包（已发放奖励，统一来源）────────────────────────────────────

export type GrantSource = 'POINTS_REDEEM' | 'BIRTHDAY' | 'MEMBER_EXCLUSIVE' | 'CAMPAIGN' | 'MANUAL'
export type GrantedRewardStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED' | 'CANCELLED'

export interface GrantedReward {
  id: string
  organizationId: string
  memberId: string
  rewardId: string
  source: GrantSource
  sourceRef?: string | null
  pointsSpent?: number | null
  // 快照
  rewardType: RewardType
  rewardName: string
  discountAmount?: number | null
  discountPercentage?: string | null
  discountMaxAmount?: number | null
  status: GrantedRewardStatus
  expiresAt?: string | null
  usedAt?: string | null
  externalOrderId?: string | null
  revokedAt?: string
  revokedBy?: string
  revokedReason?: string
  createdAt: string
}

export const grantedRewardApi = {
  list: (memberId: string, opts?: { status?: GrantedRewardStatus; source?: GrantSource }) => {
    const qs = new URLSearchParams({ memberId })
    if (opts?.status) qs.set('status', opts.status)
    if (opts?.source) qs.set('source', opts.source)
    return httpService.get(`${BASE}/granted-rewards?${qs.toString()}`)
  },
  revoke: (id: string, reason: string) =>
    httpService.post(`${BASE}/granted-rewards/${id}/revoke`, { reason }),
}

// ─── 生日券：发放历史 + 手动补发 ─────────────────────────────────────

export interface BirthdayRewardGrant {
  id: string
  organizationId: string
  memberId: string
  birthdayYear: number
  ruleId: string
  grantedRewardId: string
  status: 'GRANTED' | 'REVOKED'
  revokedAt?: string
  revokedBy?: string
  revokedReason?: string
  createdAt: string
}

export const birthdayGrantApi = {
  list: (memberId: string) =>
    httpService.get(`${BASE}/birthday-grants?memberId=${memberId}`),
  manualIssue: (data: { memberId: string; birthdayYear: number; reason: string }) =>
    httpService.post(`${BASE}/birthday-grants/manual-issue`, data),
}
