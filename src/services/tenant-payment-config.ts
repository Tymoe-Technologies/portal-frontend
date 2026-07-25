/**
 * 租户级全局支付配置服务
 * 从 Finance Service 获取和管理租户的全局支付配置
 */

import { httpService } from './http'

export interface TenantPaymentConfig {
  id: string
  tenantId: string
  currency: string // 货币代码 (ISO 4217)，如 USD, EUR, CNY
  roundingUnit?: number // 取整单位（例如现金的最小面额）
  roundingMethod?: 'ROUND' | 'ROUND_UP' | 'ROUND_DOWN' // 取整方式
  createdAt: string
  updatedAt: string
}

export interface TenantPaymentConfigDTO {
  currency: string
  roundingUnit?: number
}

const FINANCE_API_BASE = '/api/finance/v1'

/**
 * 获取租户的全局支付配置
 */
export const getTenantPaymentConfig = async (
  tenantId: string
): Promise<TenantPaymentConfig | null> => {
  try {
    const response = await httpService.get<{
      success: boolean
      data?: TenantPaymentConfig
      message?: string
    }>(`${FINANCE_API_BASE}/tenants/${tenantId}/payment-config`)

    if (response.data?.success && response.data?.data) {
      return response.data.data
    }
    return null
  } catch (error: any) {
    // 404 表示配置不存在，这是正常情况
    if (error.response?.status === 404 || error.message?.includes('资源不存在')) {
      console.log('[Tenant Config] 租户支付配置不存在')
      return null
    }
    console.error('[Tenant Config] 获取租户支付配置失败:', error)
    throw error
  }
}

/**
 * 创建或更新租户的全局支付配置
 */
export const upsertTenantPaymentConfig = async (
  tenantId: string,
  config: TenantPaymentConfigDTO
): Promise<TenantPaymentConfig> => {
  try {
    const response = await httpService.post<{
      success: boolean
      data?: TenantPaymentConfig
      message?: string
    }>(`${FINANCE_API_BASE}/tenants/${tenantId}/payment-config`, config)

    if (response.data?.success && response.data?.data) {
      return response.data.data
    }
    throw new Error('保存租户支付配置失败')
  } catch (error: any) {
    console.error('[Tenant Config] 保存租户支付配置失败:', error)
    throw error
  }
}

/**
 * 删除租户的全局支付配置
 */
export const deleteTenantPaymentConfig = async (
  tenantId: string
): Promise<void> => {
  try {
    const response = await httpService.delete<{
      success: boolean
      message?: string
    }>(`${FINANCE_API_BASE}/tenants/${tenantId}/payment-config`)

    if (!response.data?.success) {
      throw new Error('删除租户支付配置失败')
    }
  } catch (error: any) {
    console.error('[Tenant Config] 删除租户支付配置失败:', error)
    throw error
  }
}
