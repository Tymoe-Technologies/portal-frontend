import { httpService } from '../http'

const BASE = '/api/subscription-service/v1/subscriptions'
const CATALOG_BASE = '/api/subscription-service/v1/catalog'
const QUERY_BASE = '/api/subscription-service/v1/queries'

// 解包 { success, data } 信封
function unwrap<T>(response: { data: { success?: boolean; data?: T } }): T {
  const body = response.data as { success?: boolean; data?: T }
  if (body && typeof body === 'object' && 'data' in body) {
    return body.data as T
  }
  return body as unknown as T
}

// ─── Types ──────────────────────────────────────────────────────────

export interface Subscription {
  id: string
  orgId: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  plan: string
  status: string
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  createdAt: string
  updatedAt: string
}

// Query API 返回的丰富订阅数据
export interface SubscriptionQueryResult {
  subscription: {
    status: string  // 'none'|'active'|'trialing'|'past_due'|'canceled'|'unpaid'|'incomplete'
    planKey: string | null
    planName: string | null
    moduleKeys: string[]
    trialEndsAt: string | null
    currentPeriodEnd: string | null
    stripeSubscriptionId: string | null
    stripeCustomerId: string | null
  }
  permissions: { features: string[]; includedModules: string[] }
  trial: { hasUsedTrial: boolean; canStartTrial: boolean; trialActivatedAt: string | null }
}

export interface CheckoutResult {
  checkoutUrl: string
  sessionId: string
  expiresAt: string
}

export interface PortalResult {
  portalUrl: string
}

export interface CatalogPlan {
  key: string
  name: string
  description: string | null
  monthlyPrice: string
  includedModules: { moduleKey: string; quantity: number }[]
  trialDurationDays: number
}

export interface CatalogModule {
  key: string
  name: string
  description: string | null
  monthlyPrice: string
  dependencies: string[]
  allowMultiple: boolean
}

// ─── Subscription API ───────────────────────────────────────────────

export const subscriptionApi = {
  async createCheckout(data: { orgId: string; planKey: string; moduleKeys?: string[] }): Promise<CheckoutResult> {
    return unwrap<CheckoutResult>(await httpService.post(`${BASE}/checkout`, data))
  },

  async getSubscription(orgId: string): Promise<Subscription | null> {
    try {
      return unwrap<Subscription>(await httpService.get(`${BASE}/${orgId}`))
    } catch (err: unknown) {
      // httpService.handleError 将 AxiosError 转为普通 Error，404 消息为"请求的资源不存在"
      if (err instanceof Error && err.message === '请求的资源不存在') {
        return null
      }
      throw err
    }
  },

  async createPortal(orgId: string): Promise<PortalResult> {
    return unwrap<PortalResult>(await httpService.post(`${BASE}/${orgId}/portal`))
  },

  async getPlans(): Promise<CatalogPlan[]> {
    const result = unwrap<{ plans: CatalogPlan[] }>(await httpService.get(`${CATALOG_BASE}/plans`))
    return result.plans
  },

  async getModules(): Promise<CatalogModule[]> {
    const result = unwrap<{ modules: CatalogModule[] }>(await httpService.get(`${CATALOG_BASE}/modules`))
    return result.modules
  },

  async getSubscriptionQuery(orgId: string): Promise<SubscriptionQueryResult> {
    return unwrap<SubscriptionQueryResult>(
      await httpService.get(`${QUERY_BASE}/orgs/${orgId}/subscription`)
    )
  },
}
