import { httpService } from './http'

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'https://tymoe.com/api/auth-service/v1'

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED'

export interface Account {
  id: string
  orgId: string
  orgName?: string
  name?: string
  username?: string
  accountCode: string
  email?: string
  phone?: string
  pinCode?: string
  status: AccountStatus
  permissionSetId?: string | null
  lastLoginAt?: string
  createdAt: string
  updatedAt?: string
  createdBy?: string
  // 这行是不是"主账户"合成出来的展示行（组织所有者 User，不是真正的 Account 记录，
  // 不能编辑/删除/重置密码或 PIN）
  isOwner?: boolean
}

export interface CreateAccountRequest {
  orgId: string
  // 要不要给这个员工开通 Portal 后台登录（username+password）；不开通就只能用 PIN 登 POS
  grantBackendLogin: boolean
  name: string
  username?: string
  password?: string
  accountCode: string
  pinCode: string
  email?: string
  phone?: string
  permissionSetId?: string | null
}

export interface UpdateAccountRequest {
  username?: string
  status?: AccountStatus
  permissionSetId?: string | null
}

export interface GetAccountsParams {
  orgId?: string
  // 'OWNER' 是查询主账户那一行合成数据的特殊过滤值，不是真正的 Account 类型
  accountType?: 'OWNER'
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

export interface ResetAccountPinResponse {
  success: boolean
  message: string
}

export interface ResetAccountPasswordResponse {
  success: boolean
  message: string
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

/**
 * 重置账号的 PIN 码——PIN 由后端随机生成并直接邮件通知本人，接口不再接收/返回明文
 */
export async function resetAccountPin(accountId: string): Promise<ResetAccountPinResponse> {
  const response = await httpService.post<ResetAccountPinResponse>(
    `${API_BASE}/accounts/${accountId}/reset-pin`,
    {}
  )
  return response.data
}

/**
 * 重置账号的 Portal 登录密码（仅限已开通后台登录、即有 username 的账号）——
 * 密码由后端随机生成并直接邮件通知本人，接口不再接收/返回明文
 */
export async function resetAccountPassword(accountId: string): Promise<ResetAccountPasswordResponse> {
  const response = await httpService.post<ResetAccountPasswordResponse>(
    `${API_BASE}/accounts/${accountId}/reset-password`,
    {}
  )
  return response.data
}

export interface ChangeOwnPasswordResponse {
  success: boolean
  message: string
}

/**
 * 员工账号在"设置"里自己修改自己的 Portal 登录密码（需要验证当前密码）——
 * 仅限已开通后台登录（有 username）的账号，PIN-only 的账号没有密码可改
 */
export async function changeOwnAccountPassword(currentPassword: string, newPassword: string): Promise<ChangeOwnPasswordResponse> {
  const response = await httpService.post<ChangeOwnPasswordResponse>(
    `${API_BASE}/accounts/change-password`,
    { currentPassword, newPassword }
  )
  return response.data
}
