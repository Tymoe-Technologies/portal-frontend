import { httpService } from './http'

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'https://tymoe.com/api/auth-service/v1'

export type DeviceType = 'POS' | 'KIOSK' | 'TABLET' | 'DISPLAY'
export type DeviceStatus = 'PENDING' | 'ACTIVE' | 'DELETED'

export interface Device {
  id?: string
  deviceId?: string
  orgId: string
  orgName?: string
  deviceType: DeviceType
  deviceName: string
  activationCode?: string
  status: DeviceStatus
  activatedAt?: string
  lastActiveAt?: string
  expiresAt?: string
  deviceFingerprint?: any
  createdAt: string
  updatedAt?: string
}

export interface CreateDeviceRequest {
  orgId: string
  deviceType: DeviceType
  deviceName: string
}

export interface CreateDeviceResponse {
  success: boolean
  message: string
  data: Device
  warning?: string
}

export interface ActivateDeviceRequest {
  deviceId: string
  activationCode: string
}

export interface ActivateDeviceResponse {
  success: boolean
  message: string
  data: Device
}

export interface UpdateActivationCodeRequest {
  orgId: string
  deviceType: DeviceType
  newDeviceName?: string
  currentActivationCode: string
}

export interface UpdateActivationCodeResponse {
  success: boolean
  message: string
  data: {
    deviceId: string
    orgId: string
    deviceType: DeviceType
    deviceName: string
    newActivationCode: string
    status: DeviceStatus
  }
  warning?: string
}

export interface UpdateDeviceRequest {
  deviceName?: string
}

export interface UpdateDeviceResponse {
  success: boolean
  message: string
  data: Device
}

export interface GetDevicesParams {
  orgId: string
  deviceType?: DeviceType
  status?: DeviceStatus
}

export interface DeviceListResponse {
  success: boolean
  data: Device[]
  total: number
}

export interface DeviceDetailResponse {
  success: boolean
  data: Device
}

export interface DeleteDeviceResponse {
  success: boolean
  message: string
}

export interface DeviceSessionResponse {
  success: boolean
  data: {
    deviceId: string
    sessionStatus: string | null
    activatedAt?: string
    lastActiveAt?: string
    sessionExists: boolean
    message?: string
  }
}

/**
 * 创建设备（生成激活码）
 */
export async function createDevice(data: CreateDeviceRequest): Promise<CreateDeviceResponse> {
  const response = await httpService.post<CreateDeviceResponse>(
    `${API_BASE}/devices`,
    data
  )
  return response.data
}

/**
 * 激活设备
 * 注意：此接口不需要 Authorization
 */
export async function activateDevice(data: ActivateDeviceRequest): Promise<ActivateDeviceResponse> {
  const response = await httpService.post<ActivateDeviceResponse>(
    `${API_BASE}/devices/activate`,
    data
  )
  return response.data
}

/**
 * 更新激活码
 */
export async function updateActivationCode(
  deviceId: string,
  data: UpdateActivationCodeRequest
): Promise<UpdateActivationCodeResponse> {
  const response = await httpService.post<UpdateActivationCodeResponse>(
    `${API_BASE}/devices/${deviceId}/update-activation-code`,
    data
  )
  return response.data
}

/**
 * 获取组织的所有设备
 */
export async function getDevices(params: GetDevicesParams): Promise<DeviceListResponse> {
  const queryParams = new URLSearchParams()
  
  queryParams.append('orgId', params.orgId)
  
  if (params.deviceType) {
    queryParams.append('deviceType', params.deviceType)
  }
  if (params.status) {
    queryParams.append('status', params.status)
  }
  
  const queryString = queryParams.toString()
  const url = `${API_BASE}/devices${queryString ? `?${queryString}` : ''}`
  
  const response = await httpService.get<DeviceListResponse>(url)
  return response.data
}

/**
 * 获取单个设备详情
 */
export async function getDeviceDetail(deviceId: string): Promise<DeviceDetailResponse> {
  const response = await httpService.get<DeviceDetailResponse>(
    `${API_BASE}/devices/${deviceId}`
  )
  return response.data
}

/**
 * 更新设备信息
 */
export async function updateDevice(
  deviceId: string,
  data: UpdateDeviceRequest
): Promise<UpdateDeviceResponse> {
  const response = await httpService.patch<UpdateDeviceResponse>(
    `${API_BASE}/devices/${deviceId}`,
    data
  )
  return response.data
}

/**
 * 删除设备（软删除）
 */
export async function deleteDevice(deviceId: string): Promise<DeleteDeviceResponse> {
  const response = await httpService.delete<DeleteDeviceResponse>(
    `${API_BASE}/devices/${deviceId}`
  )
  return response.data
}

/**
 * 查询设备会话状态
 */
export async function getDeviceSession(deviceId: string): Promise<DeviceSessionResponse> {
  const response = await httpService.get<DeviceSessionResponse>(
    `${API_BASE}/devices/${deviceId}/session`
  )
  return response.data
}
