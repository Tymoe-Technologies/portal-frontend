import { httpService } from './http'

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'https://tymoe.com/api/auth-service/v1'

export type AccountType = 'OWNER' | 'MANAGER' | 'STAFF'
export type ProductType =
  | 'beauty_salon'
  | 'hair_salon'
  | 'spa'
  | 'restaurant'
  | 'fast_food'
  | 'cafe'
  | 'beverage'
  | 'home_studio'
  | 'fitness'
  | 'yoga_studio'
  | 'retail'
  | 'chinese_restaurant'
  | 'clinic'
  | 'liquor_store'
  | 'other'
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED'

export interface Account {
  id: string
  orgId: string
  orgName?: string
  accountType: AccountType
  productType: ProductType
  name?: string
  username?: string
  accountCode: string
  email?: string
  phone?: string
  pinCode?: string
  status: AccountStatus
  lastLoginAt?: string
  createdAt: string
  updatedAt?: string
  createdBy?: string
}

export interface CreateAccountRequest {
  orgId: string
  accountType: AccountType
  name: string
  username?: string
  password?: string
  accountCode: string
  pinCode: string
  email?: string
  phone?: string
}

export interface UpdateAccountRequest {
  username?: string
  status?: AccountStatus
}

export interface GetAccountsParams {
  orgId?: string
  accountType?: AccountType
  status?: AccountStatus
}

export interface AccountListResponse {
  success: boolean
  data: Account[]
  total: number
}

export interface AccountDetailResponse {
  success: boolean
  data: Account
}

export interface CreateAccountResponse {
  success: boolean
  message: string
  data: Account
  warning?: string
}

export interface UpdateAccountResponse {
  success: boolean
  message: string
  data: Account
}

export interface DeleteAccountResponse {
  success: boolean
  message: string
  deletedCount?: number
}

/**
 * 创建账号
 */
export async function createAccount(data: CreateAccountRequest): Promise<CreateAccountResponse> {
  const response = await httpService.post<CreateAccountResponse>(
    `${API_BASE}/accounts`,
    data
  )
  return response.data
}

/**
 * 获取组织的所有账号
 */
export async function getAccounts(params: GetAccountsParams): Promise<AccountListResponse> {
  const queryParams = new URLSearchParams()
  
  if (params.orgId) {
    queryParams.append('orgId', params.orgId)
  }
  if (params.accountType) {
    queryParams.append('accountType', params.accountType)
  }
  if (params.status) {
    queryParams.append('status', params.status)
  }
  
  const queryString = queryParams.toString()
  const url = `${API_BASE}/accounts${queryString ? `?${queryString}` : ''}`
  
  const response = await httpService.get<AccountListResponse>(url)
  return response.data
}

/**
 * 获取单个账号详情
 */
export async function getAccountDetail(accountId: string): Promise<AccountDetailResponse> {
  const response = await httpService.get<AccountDetailResponse>(
    `${API_BASE}/accounts/${accountId}`
  )
  return response.data
}

/**
 * 更新账号信息
 */
export async function updateAccount(
  accountId: string,
  data: UpdateAccountRequest
): Promise<UpdateAccountResponse> {
  const response = await httpService.patch<UpdateAccountResponse>(
    `${API_BASE}/accounts/${accountId}`,
    data
  )
  return response.data
}

/**
 * 删除账号（软删除）
 */
export async function deleteAccount(accountId: string): Promise<DeleteAccountResponse> {
  const response = await httpService.delete<DeleteAccountResponse>(
    `${API_BASE}/accounts/${accountId}`
  )
  return response.data
}
