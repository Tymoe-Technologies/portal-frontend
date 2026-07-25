import { httpService } from './http'

export interface LoginPayload {
  email: string
  password: string
  captcha?: string
}

export interface RegisterPayload {
  email: string
  password: string
  name?: string
  phone?: string
}

export interface AuthUser {
  id?: string  // 用户ID可能不存在于profile响应中
  email: string
  name: string
  phone?: string
  emailVerified?: boolean  // 新的API使用boolean而不是timestamp
  emailVerifiedAt?: string  // 保留向后兼容
  createdAt?: string
  updatedAt?: string
  organizations?: Organization[]
}

export interface Organization {
  id: string
  orgName: string
  orgType: 'MAIN' | 'BRANCH' | 'FRANCHISE'
  parentOrgId?: string
  parentOrgName?: string
  description?: string
  location?: string
  street?: string
  unit?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
  latitude?: number
  longitude?: number
  phone?: string
  email?: string
  timezone?: string | null
  businessHours?: Record<string, any> | null
  // 品牌身份字段（仅 MAIN 适用）—— 由 auth-service 管理
  subdomain?: string | null
  customDomain?: string | null
  themeSettings?: Record<string, any> | null
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED'
  createdAt: string
  updatedAt: string
  // 是否是自己名下真正拥有的组织；false 表示只是通过主店旗下关系可见的加盟店（仅可见不可管理）
  canManage?: boolean
  // 仅当 canManage===false 时后端才会附带：该加盟店 owner 的账号信息，方便主店联系/核实身份
  owner?: {
    name: string | null
    email: string
    phone: string | null
  }
}

export interface CreateOrganizationPayload {
  orgName: string
  orgType: 'MAIN' | 'BRANCH' | 'FRANCHISE'
  parentOrgId?: string | null
  description?: string
  location?: string
  street?: string
  unit?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
  latitude?: number
  longitude?: number
  phone?: string
  email?: string
  timezone?: string
  businessHours?: Record<string, any>
  // 品牌身份字段（仅 MAIN 适用）
  subdomain?: string
  customDomain?: string
  themeSettings?: Record<string, any>
}

export interface CreateOrganizationResponse {
  success: boolean
  message: string
  data: Organization
}

export interface GetOrganizationsResponse {
  success: boolean
  data: Organization[]
  total: number
}

export interface GetOrganizationsParams {
  orgType?: 'MAIN' | 'BRANCH' | 'FRANCHISE'
  status?: 'ACTIVE' | 'SUSPENDED' | 'DELETED'
}

export interface LoginResponse {
  success: boolean
  user: AuthUser
  organizations: Organization[]
}

export interface CaptchaStatus {
  captcha_required: boolean
  captcha_site_key?: string
  threshold: number
}

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in: number
}

export interface UserTokenRequest {
  grant_type: 'password'
  username: string
  password: string
  client_id: string
}

export interface AccountTokenRequest {
  grant_type: 'password'
  username: string
  password: string
  client_id: string
}

export interface AccountPOSTokenRequest {
  grant_type: 'password'
  pin_code: string
  client_id: string
}

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'https://tymoe.com/api/auth-service/v1'
const AUTH_BASE = (import.meta.env.VITE_AUTH_BASE as string | undefined) ?? 'https://tymoe.com'

// 身份管理 API
export async function login(payload: LoginPayload): Promise<LoginResponse> {
  console.log('🔑 [AUTH DEBUG] Login request payload:', JSON.stringify(payload, null, 2))

  const response = await httpService.post<LoginResponse>(`${API_BASE}/identity/login`, payload)

  console.log('🔑 [AUTH DEBUG] Login response - Full response object:', JSON.stringify(response, null, 2))
  console.log('🔑 [AUTH DEBUG] Login response - Response data:', JSON.stringify(response.data, null, 2))
  console.log('🔑 [AUTH DEBUG] Login response - User info:', JSON.stringify(response.data.user, null, 2))
  console.log('🔑 [AUTH DEBUG] Login response - Organizations:', JSON.stringify(response.data.organizations, null, 2))
  
  return response.data
}

export interface RegisterResponse {
  success: boolean
  message: string
  data: {
    email: string
  }
}

export async function register(payload: RegisterPayload): Promise<RegisterResponse> {
  console.log('📝 [AUTH DEBUG] Register request payload:', JSON.stringify(payload, null, 2))

  const response = await httpService.post<RegisterResponse>(`${API_BASE}/identity/register`, payload)

  console.log('📝 [AUTH DEBUG] Register response - Full response object:', JSON.stringify(response, null, 2))
  console.log('📝 [AUTH DEBUG] Register response - Response data:', JSON.stringify(response.data, null, 2))
  
  return response.data
}

export interface EmailVerificationResponse {
  success: boolean
  message: string
  data: {
    email: string
    emailVerified: boolean
  }
}

export async function verifyEmail(email: string, code: string): Promise<EmailVerificationResponse> {
  const response = await httpService.post<EmailVerificationResponse>(`${API_BASE}/identity/verification`, { 
    email, 
    code 
  })
  return response.data
}

export interface ResendCodeResponse {
  success: boolean
  message: string
  data: {
    email: string
    expiresIn: number
  }
}

export async function resendVerificationCode(email: string, purpose: 'signup' | 'password_reset' | 'email_change' = 'signup'): Promise<ResendCodeResponse> {
  const response = await httpService.post<ResendCodeResponse>(`${API_BASE}/identity/resend`, {
    email,
    purpose
  })
  return response.data
}

export interface LogoutResponse {
  success: boolean
  message: string
}

export async function logout(refreshToken: string): Promise<LogoutResponse> {
  try {
    const response = await httpService.post<LogoutResponse>(`${API_BASE}/identity/logout`, {
      refresh_token: refreshToken
    })
    return response.data
  } finally {
    // 清除本地存储的 token
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }
}

export interface ProfileResponse {
  success: boolean
  data: AuthUser
}

export async function getProfile(): Promise<AuthUser | null> {
  try {
    console.log('👤 [AUTH DEBUG] Getting user profile...')
    const response = await httpService.get<ProfileResponse>(`${API_BASE}/identity/profile`)
    
    console.log('👤 [AUTH DEBUG] Profile response - Full response object:', JSON.stringify(response, null, 2))
    console.log('👤 [AUTH DEBUG] Profile response - User data:', JSON.stringify(response.data.data, null, 2))
    
    return response.data.data
  } catch (error) {
    console.error('❌ [AUTH DEBUG] Failed to get profile:', error)
    return null
  }
}

// 注意：getCompleteProfile函数已移除，现在应该分别调用getProfile()和getOrganizations()
// 这样可以更好地处理用户信息和组织信息的获取，符合新的API设计

export interface UpdateProfileResponse {
  success: boolean
  message: string
  data: AuthUser
}

export async function updateProfile(data: Partial<Pick<AuthUser, 'name'>> & { phone?: string }): Promise<AuthUser> {
  const response = await httpService.patch<UpdateProfileResponse>(`${API_BASE}/identity/profile`, data)
  return response.data.data
}

export async function getCaptchaStatus(email: string): Promise<CaptchaStatus> {
  const response = await httpService.get<CaptchaStatus>(`${API_BASE}/identity/captcha-status?email=${encodeURIComponent(email)}`)
  return response.data
}

export interface ForgotPasswordResponse {
  success: boolean
  message: string
}

export interface ResetPasswordResponse {
  success: boolean
  message: string
}

export interface ChangePasswordResponse {
  success: boolean
  message: string
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  const response = await httpService.post<ForgotPasswordResponse>(`${API_BASE}/identity/forgot-password`, { email })
  return response.data
}

export async function resetPassword(email: string, code: string, password: string): Promise<ResetPasswordResponse> {
  const response = await httpService.post<ResetPasswordResponse>(`${API_BASE}/identity/reset-password`, {
    email,
    code,
    password
  })
  return response.data
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<ChangePasswordResponse> {
  const response = await httpService.post<ChangePasswordResponse>(`${API_BASE}/identity/change-password`, {
    currentPassword,
    newPassword
  })
  return response.data
}

export interface ResetOwnPinResponse {
  success: boolean
  message: string
}

// 重置主账户（USER）自己登录 POS 用的 PIN 码——跟 Account 的 reset-pin 是不同的接口，
// 因为主账户/加盟店 owner 是 User 记录，不是 Account。PIN 由后端随机生成并邮件通知本人，
// 接口不再接收/返回明文
export async function resetOwnPin(): Promise<ResetOwnPinResponse> {
  const response = await httpService.post<ResetOwnPinResponse>(`${API_BASE}/identity/reset-pin`, {})
  return response.data
}

// 修改邮箱相关API
export interface ChangeEmailResponse {
  success: boolean
  message: string
  data: {
    newEmail: string
    expiresIn?: number
  }
}

export interface VerifyEmailChangeResponse {
  success: boolean
  message: string
  data: {
    newEmail: string
  }
}

export async function changeEmail(newEmail: string, password: string): Promise<ChangeEmailResponse> {
  const response = await httpService.post<ChangeEmailResponse>(`${API_BASE}/identity/change-email`, {
    newEmail,
    password
  })
  return response.data
}

export async function verifyEmailChange(code: string): Promise<VerifyEmailChangeResponse> {
  const response = await httpService.post<VerifyEmailChangeResponse>(`${API_BASE}/identity/verification-email-change`, {
    code
  })
  return response.data
}

// OAuth2 Token 获取
export async function getOAuthToken(
  request: UserTokenRequest | AccountTokenRequest | AccountPOSTokenRequest,
  deviceId?: string
): Promise<TokenResponse> {
  console.log('🎫 [AUTH DEBUG] OAuth token request:', {
    grant_type: request.grant_type,
    client_id: request.client_id,
    deviceId: deviceId ? '***存在***' : '❌缺失'
  })

  const params = new URLSearchParams({
    grant_type: request.grant_type,
    client_id: request.client_id
  })

  // 根据请求类型添加不同参数
  if ('username' in request && 'password' in request) {
    params.append('username', request.username)
    params.append('password', request.password)
  } else if ('pin_code' in request) {
    params.append('pin_code', request.pin_code)
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded'
  }

  if (deviceId) {
    headers['X-Device-ID'] = deviceId
  }

  const tokenUrl = `${AUTH_BASE}/oauth/token`
  console.log('🎫 [AUTH DEBUG] OAuth token URL:', tokenUrl)
  const response = await httpService.post<TokenResponse>(tokenUrl, params.toString(), { headers })
  
  console.log('🎫 [AUTH DEBUG] OAuth token response - Full response object:', JSON.stringify(response, null, 2))
  console.log('🎫 [AUTH DEBUG] OAuth token response - Token data:', JSON.stringify(response.data, null, 2))
  console.log('🎫 [AUTH DEBUG] OAuth token response - Token summary:', {
    access_token: response.data.access_token ? '***存在***' : '❌缺失',
    refresh_token: response.data.refresh_token ? '***存在***' : '❌缺失',
    token_type: response.data.token_type,
    expires_in: response.data.expires_in
  })
  
  return response.data
}

// 刷新Token
export interface RefreshTokenRequest {
  grant_type: 'refresh_token'
  refresh_token: string
  client_id: string
}

export async function refreshOAuthToken(request: RefreshTokenRequest): Promise<TokenResponse> {
  console.log('🔄 [AUTH DEBUG] Refresh token request:', {
    grant_type: request.grant_type,
    client_id: request.client_id
  })

  const params = new URLSearchParams({
    grant_type: request.grant_type,
    refresh_token: request.refresh_token,
    client_id: request.client_id
  })

  const tokenUrl = `${AUTH_BASE}/oauth/token`
  console.log('🔄 [AUTH DEBUG] Refresh token URL:', tokenUrl)
  const response = await httpService.post<TokenResponse>(tokenUrl, params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })

  console.log('🔄 [AUTH DEBUG] Refresh token response - Full response object:', JSON.stringify(response, null, 2))
  console.log('🔄 [AUTH DEBUG] Refresh token response - Token data:', JSON.stringify(response.data, null, 2))
  
  return response.data
}

export async function revokeToken(token: string, tokenTypeHint: 'access_token' | 'refresh_token' = 'refresh_token'): Promise<void> {
  const revokeUrl = AUTH_BASE ? `${AUTH_BASE}/oauth/revoke` : '/oauth/revoke'
  await httpService.post(revokeUrl, {
    token,
    token_type_hint: tokenTypeHint
  })
}

export interface UserInfoOrganization {
  id: string
  orgName: string
  orgType: 'MAIN' | 'BRANCH' | 'FRANCHISE'
  parentOrgId: string | null
  role: 'USER' | 'OWNER'
  status: string
}

export interface UserInfoResponse {
  success: boolean
  userType: 'USER' | 'ACCOUNT'
  data: {
    // USER 字段
    email?: string
    organizations?: UserInfoOrganization[]
    emailVerified?: boolean
    // ACCOUNT 字段
    username?: string
    employeeNumber?: string
    organization?: Omit<UserInfoOrganization, 'role'>
    // 两者共有
    name?: string
    phone?: string
    createdAt?: string
    // ACCOUNT 专属：细粒度权限位（如 "devices.view"）
    permissions?: string[]
  }
}

// 统一的"我是谁"接口：同时支持 USER（老板，邮箱登录）和 ACCOUNT（员工，用户名登录）两种身份，
// 用于替代只支持 USER 的 /identity/profile
export async function getUserInfo(): Promise<UserInfoResponse> {
  const userinfoUrl = AUTH_BASE ? `${AUTH_BASE}/userinfo` : '/userinfo'
  const response = await httpService.get<UserInfoResponse>(userinfoUrl)
  return response.data
}

// 组织管理 API
export async function getOrganizations(params?: GetOrganizationsParams): Promise<Organization[]> {
  console.log('🏢 [AUTH DEBUG] Getting organizations...', params)

  const queryParams = new URLSearchParams()
  if (params?.orgType) queryParams.append('orgType', params.orgType)
  if (params?.status) queryParams.append('status', params.status)

  const url = `${API_BASE}/organizations${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
  const response = await httpService.get<GetOrganizationsResponse>(url)

  console.log('🏢 [AUTH DEBUG] Organizations response - Full response object:', JSON.stringify(response, null, 2))
  console.log('🏢 [AUTH DEBUG] Organizations response - Organizations data:', JSON.stringify(response.data.data, null, 2))

  return response.data.data
}

export async function createOrganization(payload: CreateOrganizationPayload): Promise<Organization> {
  console.log('🏢 [AUTH DEBUG] Creating organization...', payload)

  // 根据API文档创建请求载荷
  const requestPayload: any = {
    orgName: payload.orgName,
    orgType: payload.orgType,
  }
  
  // 根据API文档：parentOrgId 的处理规则
  if (payload.orgType === 'MAIN') {
    // MAIN 类型必须为 null
    requestPayload.parentOrgId = null
  } else if (payload.parentOrgId !== undefined && payload.parentOrgId !== null) {
    // BRANCH/FRANCHISE 类型必须提供有效的 parentOrgId
    requestPayload.parentOrgId = payload.parentOrgId
  }
  
  // 添加可选字段（如果存在且非空）
  if (payload.description && payload.description.trim()) {
    requestPayload.description = payload.description.trim()
  }
  if (payload.location && payload.location.trim()) {
    requestPayload.location = payload.location.trim()
  }
  if (payload.street && payload.street.trim()) {
    requestPayload.street = payload.street.trim()
  }
  if (payload.city && payload.city.trim()) {
    requestPayload.city = payload.city.trim()
  }
  if (payload.province && payload.province.trim()) {
    requestPayload.province = payload.province.trim()
  }
  if (payload.postalCode && payload.postalCode.trim()) {
    requestPayload.postalCode = payload.postalCode.trim()
  }
  if (payload.country && payload.country.trim()) {
    requestPayload.country = payload.country.trim()
  }
  if (payload.latitude != null) {
    requestPayload.latitude = payload.latitude
  }
  if (payload.longitude != null) {
    requestPayload.longitude = payload.longitude
  }
  if (payload.phone && payload.phone.trim()) {
    requestPayload.phone = payload.phone.trim()
  }
  if (payload.email && payload.email.trim()) {
    requestPayload.email = payload.email.trim()
  }
  // 品牌身份字段（仅 MAIN 有意义；分店传了会被 auth-service 拒绝）
  if (payload.subdomain && payload.subdomain.trim()) {
    requestPayload.subdomain = payload.subdomain.trim().toLowerCase()
  }
  if (payload.customDomain && payload.customDomain.trim()) {
    requestPayload.customDomain = payload.customDomain.trim().toLowerCase()
  }
  if (payload.themeSettings) {
    requestPayload.themeSettings = payload.themeSettings
  }

  console.log('🏢 [AUTH DEBUG] Final request payload:', JSON.stringify(requestPayload, null, 2))
  
  const response = await httpService.post<CreateOrganizationResponse>(`${API_BASE}/organizations`, requestPayload, {
    headers: {
      'Content-Type': 'application/json'
      // Authorization 头部会由 httpService 自动添加
    }
  })

  console.log('🏢 [AUTH DEBUG] Create organization response - Full response object:', JSON.stringify(response, null, 2))
  console.log('🏢 [AUTH DEBUG] Create organization response - Organization data:', JSON.stringify(response.data.data, null, 2))
  
  return response.data.data
}

// 更新用户档案信息并保持组织信息同步
export async function updateProfileWithOrganizations(data: Partial<Pick<AuthUser, 'name'>> & { phone?: string }): Promise<AuthUser> {
  console.log('🔄 [AUTH DEBUG] Updating profile...')
  const response = await httpService.patch<UpdateProfileResponse>(`${API_BASE}/identity/profile`, data)
  
  console.log('🔄 [AUTH DEBUG] Profile updated successfully:', JSON.stringify(response.data.data, null, 2))
  return response.data.data
}

export async function getOrganization(id: string): Promise<Organization> {
  const response = await httpService.get<{ success: boolean; data: Organization }>(`${API_BASE}/organizations/${id}`)
  return response.data.data
}

export async function updateOrganization(id: string, data: Partial<Omit<Organization, 'id' | 'orgType' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<Organization> {
  const response = await httpService.put<CreateOrganizationResponse>(`${API_BASE}/organizations/${id}`, data)
  return response.data.data
}

export async function deleteOrganization(id: string): Promise<void> {
  await httpService.delete(`${API_BASE}/organizations/${id}`)
}

// 主店解除与旗下加盟店的关联：加盟店变成独立主店，owner 自己的数据（账号/菜单/设备等）不受影响
export async function dissociateFranchise(id: string): Promise<Organization> {
  const response = await httpService.post<CreateOrganizationResponse>(`${API_BASE}/organizations/${id}/dissociate`, {})
  return response.data.data
}

export async function uploadOrgLogo(orgId: string, file: File): Promise<{ logoUrl: string }> {
  const formData = new FormData()
  formData.append('image', file)
  const response = await httpService.post<{ success: boolean; logoUrl: string }>(
    `${API_BASE}/organizations/${orgId}/logo`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return { logoUrl: response.data.logoUrl }
}

export async function deleteOrgLogo(orgId: string): Promise<void> {
  await httpService.delete(`${API_BASE}/organizations/${orgId}/logo`)
}

// 加盟店邀请 API
export interface FranchiseInvitation {
  id: string
  email: string
  proposedOrgName?: string | null
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'
  expiresAt: string
  acceptedAt?: string | null
  createdOrgId?: string | null
  createdAt: string
}

export interface CreateFranchiseInvitationPayload {
  email: string
  proposedOrgName?: string
}

export interface FranchiseInvitationPublicInfo {
  brand: string | null
  email: string
  // 邀请邮箱是否已经是一个 User：决定 accept 页面走"设置新密码"还是"验证已有密码"
  emailHasAccount: boolean
  proposedOrgName?: string | null
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'
  expiresAt: string
}

export interface AcceptFranchiseInvitationPayload {
  orgName: string
  description?: string
  street?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
  latitude?: number
  longitude?: number
  phone?: string
  email?: string
  password: string
  pinCode: string
  name?: string
}

export interface AcceptFranchiseInvitationResult {
  organizationId: string
  orgName: string
  userId: string
  email: string
  // 是否真的用了本次提交的 pinCode——挂靠到已有账号且对方已经设过 PIN 时会是 false（沿用旧 PIN）
  pinCodeApplied: boolean
}

export async function createFranchiseInvitation(orgId: string, payload: CreateFranchiseInvitationPayload): Promise<FranchiseInvitation> {
  const response = await httpService.post<{ success: boolean; data: FranchiseInvitation }>(
    `${API_BASE}/organizations/${orgId}/franchise-invitations`,
    payload
  )
  return response.data.data
}

export async function listFranchiseInvitations(orgId: string): Promise<FranchiseInvitation[]> {
  const response = await httpService.get<{ success: boolean; data: FranchiseInvitation[] }>(
    `${API_BASE}/organizations/${orgId}/franchise-invitations`
  )
  return response.data.data
}

export async function revokeFranchiseInvitation(id: string): Promise<void> {
  await httpService.delete(`${API_BASE}/franchise-invitations/${id}`)
}

export async function getFranchiseInvitationPublic(token: string): Promise<FranchiseInvitationPublicInfo> {
  const response = await httpService.get<{ success: boolean; data: FranchiseInvitationPublicInfo }>(
    `${API_BASE}/franchise-invitations/${token}`
  )
  return response.data.data
}

export async function acceptFranchiseInvitation(token: string, payload: AcceptFranchiseInvitationPayload): Promise<AcceptFranchiseInvitationResult> {
  const response = await httpService.post<{ success: boolean; data: AcceptFranchiseInvitationResult }>(
    `${API_BASE}/franchise-invitations/${token}/accept`,
    payload
  )
  return response.data.data
}

// 权限集 API
export type PermissionAction = 'view' | 'edit'

export interface PermissionCatalogModule {
  module: string
  actions: PermissionAction[]
}

export interface PermissionSet {
  id: string
  orgId: string
  name: string
  permissions: string[]
  createdAt: string
  updatedAt: string
}

export async function getPermissionCatalog(): Promise<{ modules: PermissionCatalogModule[]; allPermissions: string[] }> {
  const response = await httpService.get<{ success: boolean; data: { modules: PermissionCatalogModule[]; allPermissions: string[] } }>(
    `${API_BASE}/permission-sets/catalog`
  )
  return response.data.data
}

export async function listPermissionSets(orgId: string): Promise<PermissionSet[]> {
  const response = await httpService.get<{ success: boolean; data: PermissionSet[] }>(
    `${API_BASE}/organizations/${orgId}/permission-sets`
  )
  return response.data.data
}

export async function createPermissionSet(orgId: string, payload: { name: string; permissions: string[] }): Promise<PermissionSet> {
  const response = await httpService.post<{ success: boolean; data: PermissionSet }>(
    `${API_BASE}/organizations/${orgId}/permission-sets`,
    payload
  )
  return response.data.data
}

export async function updatePermissionSet(id: string, payload: { name?: string; permissions?: string[] }): Promise<PermissionSet> {
  const response = await httpService.put<{ success: boolean; data: PermissionSet }>(
    `${API_BASE}/permission-sets/${id}`,
    payload
  )
  return response.data.data
}

export async function deletePermissionSet(id: string): Promise<void> {
  await httpService.delete(`${API_BASE}/permission-sets/${id}`)
}
