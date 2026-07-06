import { httpService } from './http'

// 支付方式配置类型
export interface PaymentMethodConfigDTO {
  paymentMethod: string // 'clover' | 'stripe' | 'cash' | 'custom_xxx' 等
  displayName: string
  isEnabled: boolean
  posProvider?: string
  posDeviceId?: string
  posConfig?: Record<string, any>
  currency?: string
  currencySymbol?: string
  roundingUnit?: number
  roundingRule?: 'round' | 'ceil' | 'floor'
}

export interface PaymentMethodConfigResponse extends PaymentMethodConfigDTO {
  id: string
  tenantId: string
  deviceId: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface DeviceWithPaymentMethods {
  id: string
  tenantId: string
  deviceType: string
  deviceName: string
  deviceIdentifier: string
  locationId?: string
  locationName?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  paymentMethods: PaymentMethodConfigResponse[]
}

const FINANCE_API_BASE = '/api/finance/v1'

/**
 * 获取租户所有设备及其支付方式配置
 */
export const getTenantDevicesWithPaymentMethods = async (
  _tenantId: string
): Promise<DeviceWithPaymentMethods[]> => {
  const response = await httpService.get<{ data: DeviceWithPaymentMethods[] }>(
    `${FINANCE_API_BASE}/payment-methods`
  )
  return response.data.data || []
}

/**
 * 获取特定设备的支付方式配置
 */
export const getDevicePaymentMethods = async (
  _tenantId: string,
  deviceId: string
): Promise<PaymentMethodConfigResponse[]> => {
  const response = await httpService.get<{ data: PaymentMethodConfigResponse[] }>(
    `${FINANCE_API_BASE}/devices/${deviceId}/payment-methods`
  )
  return response.data.data || []
}

/**
 * 为设备创建支付方式配置
 */
export const createDevicePaymentMethod = async (
  _tenantId: string,
  deviceId: string,
  config: PaymentMethodConfigDTO
): Promise<PaymentMethodConfigResponse[]> => {
  const response = await httpService.post<{ data: PaymentMethodConfigResponse[] }>(
    `${FINANCE_API_BASE}/devices/${deviceId}/payment-methods`,
    config
  )
  return response.data.data || []
}

/**
 * 更新设备的支付方式配置
 */
export const updateDevicePaymentMethod = async (
  _tenantId: string,
  deviceId: string,
  paymentMethod: string,
  config: Partial<PaymentMethodConfigDTO>
): Promise<PaymentMethodConfigResponse[]> => {
  const response = await httpService.put<{ data: PaymentMethodConfigResponse[] }>(
    `${FINANCE_API_BASE}/devices/${deviceId}/payment-methods/${paymentMethod}`,
    config
  )
  return response.data.data || []
}

/**
 * 启用设备的支付方式
 */
export const enableDevicePaymentMethod = async (
  _tenantId: string,
  deviceId: string,
  paymentMethod: string
): Promise<PaymentMethodConfigResponse[]> => {
  const response = await httpService.post<{ data: PaymentMethodConfigResponse[] }>(
    `${FINANCE_API_BASE}/devices/${deviceId}/payment-methods/${paymentMethod}/enable`
  )
  return response.data.data || []
}

/**
 * 禁用设备的支付方式
 */
export const disableDevicePaymentMethod = async (
  _tenantId: string,
  deviceId: string,
  paymentMethod: string
): Promise<PaymentMethodConfigResponse[]> => {
  const response = await httpService.post<{ data: PaymentMethodConfigResponse[] }>(
    `${FINANCE_API_BASE}/devices/${deviceId}/payment-methods/${paymentMethod}/disable`
  )
  return response.data.data || []
}

/**
 * 删除设备的支付方式配置
 */
export const deleteDevicePaymentMethod = async (
  _tenantId: string,
  deviceId: string,
  paymentMethod: string
): Promise<PaymentMethodConfigResponse[]> => {
  const response = await httpService.delete<{ data: PaymentMethodConfigResponse[] }>(
    `${FINANCE_API_BASE}/devices/${deviceId}/payment-methods/${paymentMethod}`
  )
  return response.data.data || []
}
