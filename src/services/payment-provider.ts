import { httpService } from './http'

export interface PaymentProvider {
  id: string
  tenantId: string
  provider: string
  displayName: string
  description?: string
  config?: Record<string, any>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Stripe Connect 相关类型
export interface StripeConnectOnboardRequest {
  tenantId: string
  email: string
  businessType?: 'individual' | 'company'
  country?: string
}

export interface StripeConnectOnboardResponse {
  accountId: string
  onboardingUrl: string
  expiresAt: number
}

export interface StripeConnectStatus {
  status: 'not_connected' | 'pending' | 'active' | 'restricted' | 'disabled'
  accountId?: string
  detailsSubmitted?: boolean
  chargesEnabled?: boolean
  payoutsEnabled?: boolean
  onboardingCompleted?: boolean
  message?: string
  requirements?: {
    currentlyDue: string[]
    eventuallyDue: string[]
    pastDue: string[]
  }
}

export interface CreatePaymentProviderDTO {
  provider: string
  displayName: string
  description?: string
  config?: Record<string, any>
}

/**
 * 获取租户的所有支付服务提供商
 */
export const getTenantPaymentProviders = async (
  _tenantId: string
): Promise<PaymentProvider[]> => {
  const response = await httpService.get<{ data: PaymentProvider[] }>(
    `/api/finance/v1/payment-providers`
  )
  return response.data.data
}

/**
 * 获取租户的所有活跃支付服务提供商
 */
export const getActivePaymentProviders = async (
  _tenantId: string
): Promise<PaymentProvider[]> => {
  const response = await httpService.get<{ data: PaymentProvider[] }>(
    `/api/finance/v1/payment-providers/active`
  )
  return response.data.data
}

/**
 * 获取单个支付服务提供商
 */
export const getPaymentProvider = async (
  _tenantId: string,
  provider: string
): Promise<PaymentProvider> => {
  const response = await httpService.get<{ data: PaymentProvider }>(
    `/api/finance/v1/payment-providers/${provider}`
  )
  return response.data.data
}

/**
 * 创建支付服务提供商
 */
export const createPaymentProvider = async (
  _tenantId: string,
  dto: CreatePaymentProviderDTO
): Promise<PaymentProvider> => {
  const response = await httpService.post<{ data: PaymentProvider }>(
    `/api/finance/v1/payment-providers`,
    dto
  )
  return response.data.data
}

/**
 * 更新支付服务提供商
 */
export const updatePaymentProvider = async (
  _tenantId: string,
  provider: string,
  dto: Partial<CreatePaymentProviderDTO>
): Promise<PaymentProvider> => {
  const response = await httpService.put<{ data: PaymentProvider }>(
    `/api/finance/v1/payment-providers/${provider}`,
    dto
  )
  return response.data.data
}

/**
 * 启用支付服务提供商
 */
export const enablePaymentProvider = async (
  _tenantId: string,
  provider: string
): Promise<PaymentProvider> => {
  const response = await httpService.post<{ data: PaymentProvider }>(
    `/api/finance/v1/payment-providers/${provider}/enable`
  )
  return response.data.data
}

/**
 * 禁用支付服务提供商
 */
export const disablePaymentProvider = async (
  _tenantId: string,
  provider: string
): Promise<PaymentProvider> => {
  const response = await httpService.post<{ data: PaymentProvider }>(
    `/api/finance/v1/payment-providers/${provider}/disable`
  )
  return response.data.data
}

/**
 * 删除支付服务提供商
 */
export const deletePaymentProvider = async (
  _tenantId: string,
  provider: string
): Promise<PaymentProvider> => {
  const response = await httpService.delete<{ data: PaymentProvider }>(
    `/api/finance/v1/payment-providers/${provider}`
  )
  return response.data.data
}

// ============ Stripe Connect 相关 API ============

/**
 * 为商家创建 Stripe Connected Account 并生成 Onboarding Link
 */
export const onboardStripeConnect = async (
  request: StripeConnectOnboardRequest
): Promise<StripeConnectOnboardResponse> => {
  const response = await httpService.post<{ data: StripeConnectOnboardResponse }>(
    `/api/finance/v1/stripe-connect/onboard`,
    request
  )
  return response.data.data
}

/**
 * 查询商家 Stripe 账户状态
 */
export const getStripeConnectStatus = async (
  tenantId: string
): Promise<StripeConnectStatus> => {
  const response = await httpService.get<{ data: StripeConnectStatus }>(
    `/api/finance/v1/stripe-connect/status/${tenantId}`
  )
  return response.data.data
}

/**
 * 刷新 Onboarding Link (如果过期)
 */
export const refreshStripeOnboarding = async (
  tenantId: string
): Promise<{ onboardingUrl: string; expiresAt: number }> => {
  const response = await httpService.post<{ data: { onboardingUrl: string; expiresAt: number } }>(
    `/api/finance/v1/stripe-connect/refresh-onboarding/${tenantId}`
  )
  return response.data.data
}

/**
 * 查询门店线上收款账户状态（公开接口，无需鉴权）
 * onboarded = false 时该门店不能开启在线点单
 */
export const getStoreStripeAccountPublic = async (
  storeId: string
): Promise<{ connectedAccountId: string | null; onboarded: boolean; currency: string }> => {
  const response = await httpService.get<{ data: { connectedAccountId: string | null; onboarded: boolean; currency: string } }>(
    `/api/finance/v1/public/payments/merchant/${storeId}/stripe-account`
  )
  return response.data.data
}

/**
 * 直营分店绑定主店收款账户（仅 orgType = BRANCH 可用）
 */
export const bindParentStripeAccount = async (
  storeId: string
): Promise<{ storeId: string; parentOrgId: string; connectedAccountId: string; chargesEnabled: boolean; accountStatus: string }> => {
  const response = await httpService.post<{ data: { storeId: string; parentOrgId: string; connectedAccountId: string; chargesEnabled: boolean; accountStatus: string } }>(
    `/api/finance/v1/stripe-connect/bind-parent/${storeId}`
  )
  return response.data.data
}

/**
 * 更新平台费率
 */
export const updateStripeConnectFeeRate = async (
  tenantId: string,
  feeRate: number
): Promise<{ feeRate: number }> => {
  const response = await httpService.put<{ data: { feeRate: number } }>(
    `/api/finance/v1/stripe-connect/fee-rate/${tenantId}`,
    { feeRate }
  )
  return response.data.data
}
