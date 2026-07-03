import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios'
import { toast } from '@/components/ui-kit'

// 429 提示节流：连续限流时只弹一次，避免 toast 刷屏
let lastRateLimitToast = 0

/**
 * 判断错误是否为 429 限流。
 * 页面 catch 用它跳过自己的"加载失败"提示——429 已由拦截器统一提示，避免双重 toast。
 */
export function isRateLimited(error: unknown): boolean {
  return (error as AxiosError)?.response?.status === 429
}

export interface ApiResponse<T = unknown> {
  success?: boolean
  data?: T
  message?: string
  error?: string
  detail?: string
}

export interface HttpResponse<T = unknown> {
  data: T
  status: number
}

class HttpService {
  private api: AxiosInstance
  private isRefreshing = false

  constructor() {
    this.api = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // 请求拦截器
    this.api.interceptors.request.use(
      (config) => {
        // FormData 上传时，完全重置 headers 并移除默认的 Content-Type
        // 让浏览器/XHR 自动设置含 boundary 的 multipart/form-data
        if (config.data instanceof FormData) {
          config.headers = {} as any
        }

        const token = localStorage.getItem('access_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }

        // 注入组织上下文（若存在）
        try {
          const organizationId = localStorage.getItem('organization_id')

          if (organizationId) {
            // 检查是否需要添加组织ID的请求
            // 包括：商品管理、菜单中心、财务服务、订单服务等业务API
            const needsOrgContext = typeof config.url === 'string' && (
              config.url.includes('/api/item-manage') ||
              config.url.includes('/api/menu-service') ||
              config.url.includes('/api/finance') ||
              config.url.includes('/api/order') ||
              config.url.includes('/menu-center') ||
              config.url.includes('/api/booking-service') ||
              config.url.includes('/api/subscription-service') ||
              config.url.includes('/api/member')
            )

            // 排除不需要组织上下文的请求（认证、注册等）
            const isAuthRequest = typeof config.url === 'string' && (
              config.url.includes('/identity/register') ||
              config.url.includes('/identity/login') ||
              config.url.includes('/identity/refresh') ||
              config.url.includes('/auth-service/v1/oauth') ||
              config.url.includes('/auth-service/v1/identity')
            )

            if (needsOrgContext && !isAuthRequest) {
              config.headers['X-Organization-Id'] = organizationId
              config.headers['X-Tenant-Id'] = organizationId
              // 对于Finance API，使用小写的 x-tenant-id
              if (config.url?.includes('/api/finance')) {
                config.headers['x-tenant-id'] = organizationId
              }
              // Booking Service 和 Subscription Service 使用 X-Org-Id
              if (config.url?.includes('/api/booking-service') || config.url?.includes('/api/subscription-service')) {
                config.headers['X-Org-Id'] = organizationId
              }
            }

            // 对于 Order Service 的请求，添加 X-Merchant-Id 头
            if (typeof config.url === 'string' && config.url.includes('/api/order')) {
              // 尝试从 URL 中提取 merchantId，格式: /merchants/{merchantId}/config
              const merchantIdMatch = config.url.match(/\/merchants\/([a-f0-9\-]+)\//)
              const merchantIdFromUrl = merchantIdMatch?.[1]
              // 优先使用 URL 中的 merchantId，否则使用 organizationId
              config.headers['X-Merchant-Id'] = merchantIdFromUrl ?? organizationId
            }
          }
        } catch (error) {
          console.error('Error injecting organization context:', error)
        }
        
        // 对于注册和登录请求，强制清除所有认证相关的头部和配置
        if (config.url?.includes('/identity/register') || config.url?.includes('/identity/login')) {
          // 删除所有可能的认证头部
          delete config.headers.Cookie
          delete config.headers.cookie
          delete config.headers.Authorization
          delete config.headers.authorization
          // 禁用凭证传递
          config.withCredentials = false
          // 重新设置干净的头部
          config.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...config.headers
          }
        }
        
        return config
      },
      (error) => Promise.reject(error)
    )

    // 响应拦截器
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        return response
      },
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          const errorData = error.response?.data as any
          const errorCode = errorData?.code || errorData?.error

          console.log('[AUTH] 401 Error Details:', {
            url: error.config?.url,
            code: errorCode,
            error: errorData?.error,
            message: errorData?.message,
            reason: errorData?.reason
          })

          // token_expired: 尝试刷新
          if (errorCode === 'token_expired') {
            console.log('[AUTH] Token expired, will attempt refresh')
            return this.handleTokenExpired(error)
          }

          // token_revoked: 直接登出
          if (errorCode === 'token_revoked') {
            console.log('[AUTH] Token revoked:', errorData?.reason)
            return this.handleTokenRevoked()
          }

          // 其他401错误（invalid_token）
          console.log('[AUTH] Invalid token received, calling handleInvalidToken')
          return this.handleInvalidToken()
        }

        // 429 限流：给用户明确提示（节流 5 秒，避免刷屏）
        if (error.response?.status === 429) {
          const now = Date.now()
          if (now - lastRateLimitToast > 5000) {
            lastRateLimitToast = now
            const retryAfter = error.response.headers?.['retry-after']
            const hint = retryAfter ? `请等待约 ${retryAfter} 秒后重试` : '请稍后再试'
            toast.warning(`操作过于频繁，已被限流。${hint}`)
          }
        }

        return Promise.reject(error)
      }
    )

    // 启动定时token过期检查
    this.startTokenExpiryChecker()
  }

  /**
   * 处理token过期：尝试用refresh_token刷新
   */
  private async handleTokenExpired(error: AxiosError): Promise<never> {
    if (this.isRefreshing) {
      // 已经在刷新中，拒绝此请求
      return Promise.reject(error)
    }

    this.isRefreshing = true

    try {
      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) {
        throw new Error('No refresh token available')
      }

      // 调用refresh端点
      const response = await this.api.post('/oauth/token', {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: 'portal-frontend'
      })

      const newAccessToken = response.data.access_token
      localStorage.setItem('access_token', newAccessToken)

      // 重试原始请求
      if (error.config) {
        error.config.headers.Authorization = `Bearer ${newAccessToken}`
        return this.api.request(error.config) as any
      }

      throw new Error('Cannot retry original request')
    } catch (refreshError) {
      // 刷新失败，清除token并跳转登录
      console.error('[AUTH] Token refresh failed:', refreshError)
      this.clearAuth()
      return Promise.reject(refreshError)
    } finally {
      this.isRefreshing = false
    }
  }

  /**
   * 处理token被撤销：直接清除并登出
   */
  private handleTokenRevoked(): Promise<never> {
    console.log('[AUTH] Token has been revoked, clearing credentials')
    this.clearAuth()
    return Promise.reject(new Error('Token has been revoked'))
  }

  /**
   * 处理无效token：清除并登出
   */
  private handleInvalidToken(): Promise<never> {
    console.log('[AUTH] Token is invalid, clearing credentials')
    this.clearAuth()
    return Promise.reject(new Error('Token is invalid'))
  }

  /**
   * 清除认证信息并重定向到登录
   */
  private clearAuth(): void {
    if (this.isRefreshing) return

    this.isRefreshing = true

    // 清除所有认证信息
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('organization_id')

    // 延迟跳转，避免多个401同时触发
    setTimeout(() => {
      this.isRefreshing = false
      window.location.href = '/login'
    }, 100)
  }

  /**
   * 启动定时检查token过期时间
   * 在token即将过期（剩余20秒内）时主动刷新
   */
  private startTokenExpiryChecker(): void {
    setInterval(() => {
      try {
        const token = localStorage.getItem('access_token')
        if (!token) return

        // 解析JWT payload
        const parts = token.split('.')
        if (parts.length !== 3) {
          // token格式不正确，不处理
          return
        }

        try {
          // Base64URL → 标准 Base64，补全 padding
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
          const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=')
          const payload = JSON.parse(atob(padded))
          if (!payload.exp) return

          const expiresAt = payload.exp * 1000 // 转换为毫秒
          const now = Date.now()
          const timeLeft = expiresAt - now

          // 剩余时间在20秒以内，主动刷新
          if (0 < timeLeft && timeLeft < 20 * 1000) {
            this.proactiveTokenRefresh()
          }
        } catch (parseError) {
          // token payload解析失败，不处理（可能是旧token或损坏的token）
          return
        }
      } catch (e) {
        // 最外层异常，静默处理避免影响其他功能
      }
    }, 10000) // 每10秒检查一次（缩短间隔以便更频繁地检查）
  }

  /**
   * 主动刷新token
   */
  private async proactiveTokenRefresh(): Promise<void> {
    if (this.isRefreshing) return

    try {
      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) return

      this.isRefreshing = true

      const response = await this.api.post('/oauth/token', {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: 'portal-frontend'
      })

      const newAccessToken = response.data.access_token
      localStorage.setItem('access_token', newAccessToken)

      console.log('[AUTH] Token proactively refreshed')
    } catch (error) {
      console.error('[AUTH] Proactive token refresh failed:', error)
      // 主动刷新失败，等待下次被动刷新触发
    } finally {
      this.isRefreshing = false
    }
  }

  async get<T = unknown>(url: string): Promise<HttpResponse<T>> {
    try {
      const response = await this.api.get<T>(url)
      return { data: response.data, status: response.status }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async post<T = unknown>(url: string, data?: unknown, config?: any): Promise<HttpResponse<T>> {
    try {
      const response = await this.api.post<T>(url, data, config)
      return { data: response.data, status: response.status }
    } catch (error) {
      // 特殊处理：如果是400但响应中包含数据，可能是后端返回了成功数据但状态码错误
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        const responseData = error.response.data
        console.warn('⚠️ 收到400响应但可能包含有效数据:', responseData)
        
        // 如果响应中有 success=true 或包含 id 字段，说明实际是成功的
        if (responseData && typeof responseData === 'object') {
          if ((responseData as any).success === true || (responseData as any).id) {
            console.log('✅ 400响应但数据有效，视为成功')
            return { data: responseData as T, status: 200 }
          }
        }
      }
      throw this.handleError(error)
    }
  }

  async put<T = unknown>(url: string, data?: unknown): Promise<HttpResponse<T>> {
    try {
      const response = await this.api.put<T>(url, data)
      return { data: response.data, status: response.status }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async patch<T = unknown>(url: string, data?: unknown): Promise<HttpResponse<T>> {
    try {
      const response = await this.api.patch<T>(url, data)
      return { data: response.data, status: response.status }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async delete<T = unknown>(url: string): Promise<HttpResponse<T>> {
    try {
      const response = await this.api.delete<T>(url)
      return { data: response.data, status: response.status }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * 统一错误处理：在拍平后的 Error 上补挂 status / code / response，
   * 让调用方仍能按状态码分支（如 isRateLimited、409 引用保护），
   * 同时 message 保持原来友好的文案不变。
   */
  private handleError(error: unknown): Error {
    const err = this.buildError(error) as any
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as any
      err.status = error.response?.status
      err.code = data?.error?.code ?? data?.code ?? data?.error
      err.response = error.response
    }
    return err
  }

  private buildError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const apiError = error.response?.data as ApiResponse
      
      // 打印详细错误信息用于调试 (404 通常是正常情况,不打印)
      if (error.response?.status !== 404) {
        console.error('API Error Details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.response?.headers,
          url: error.config?.url,
          method: error.config?.method
        })
      }
      
      // 对于注册请求的 500 错误，额外记录
      if (error.config?.url?.includes('/identity/register') && error.response?.status === 500) {
        console.error('🚨 Registration 500 Error - Server Response:', {
          responseData: error.response?.data,
          responseText: typeof error.response?.data === 'string' ? error.response.data : JSON.stringify(error.response?.data),
          requestPayload: error.config?.data
        })
      }
      
      // 对于组织创建请求的 500 错误，额外记录
      if (error.config?.url?.includes('/organizations') && error.response?.status === 500) {
        console.error('🚨 Organization Creation 500 Error - Server Response:', {
          responseData: error.response?.data,
          responseText: typeof error.response?.data === 'string' ? error.response.data : JSON.stringify(error.response?.data),
          requestPayload: error.config?.data,
          requestHeaders: error.config?.headers
        })
      }
      
      // 对于设备API请求的 500 错误，额外记录
      if (error.config?.url?.includes('/devices') && error.response?.status === 500) {
        console.error('🚨 Device API 500 Error - Server Response:', {
          responseData: error.response?.data,
          responseText: typeof error.response?.data === 'string' ? error.response.data : JSON.stringify(error.response?.data),
          requestUrl: error.config?.url,
          requestMethod: error.config?.method,
          requestParams: error.config?.params,
          requestHeaders: error.config?.headers
        })
        
        // 为设备API提供更友好的错误信息
        return new Error('加载设备列表失败，后端服务出现异常。请检查后端日志或联系技术支持。')
      }
      
      if (apiError?.error || apiError?.detail) {
        // 对于通用的 server_error，提供更友好的提示
        if (apiError.error === 'server_error' && !apiError.detail) {
          return new Error('服务器内部错误，请稍后重试或联系技术支持')
        }
        // 处理 error 可能是对象的情况（如 {code, message}）
        let errorMsg = apiError.detail
        if (!errorMsg) {
          if (typeof apiError.error === 'string') {
            errorMsg = apiError.error
          } else if (typeof apiError.error === 'object' && apiError.error?.message) {
            errorMsg = apiError.error.message
          }
        }
        return new Error(errorMsg || 'Request failed')
      }
      
      // 根据状态码提供更友好的错误信息
      if (error.response?.status === 500) {
        return new Error('服务器内部错误，请稍后重试')
      } else if (error.response?.status === 400) {
        // 对于400错误，尝试提供更详细的错误信息
        const responseData = error.response?.data
        if (responseData && typeof responseData === 'object') {
          const errorMsg = (responseData as any).message || (responseData as any).detail || (responseData as any).error
          if (errorMsg) {
            return new Error(errorMsg)
          }
        }
        return new Error('请求参数错误，请检查输入数据')
      } else if (error.response?.status === 401) {
        return new Error('未授权访问')
      } else if (error.response?.status === 403) {
        return new Error('访问被拒绝')
      } else if (error.response?.status === 404) {
        return new Error('请求的资源不存在')
      }
      
      return new Error(error.message || 'Network error')
    }
    return new Error('Unknown error occurred')
  }
}

export const httpService = new HttpService()

// 兼容性导出
export const httpGet = httpService.get.bind(httpService)
export const httpPost = httpService.post.bind(httpService)
export const httpPut = httpService.put.bind(httpService)
export const httpPatch = httpService.patch.bind(httpService)
export const httpDelete = httpService.delete.bind(httpService)

// ==================== Token 工具函数 ====================

/**
 * 解析 JWT payload
 * JWT 使用 Base64URL 编码（- 和 _），而 atob() 只支持标准 Base64（+ 和 /），需要先转换
 */
function parseJWTPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    // Base64URL → 标准 Base64
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    // 补全 padding 到4的倍数
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

/**
 * 检查token是否已过期
 * 添加时间容差，避免前后端时间微小差异导致误判
 */
export function isTokenExpired(token?: string, toleranceSec: number = 60): boolean {
  const t = token || localStorage.getItem('access_token')
  if (!t) return true

  const payload = parseJWTPayload(t)
  if (!payload?.exp) return true

  const expiresAt = payload.exp * 1000 // 转换为毫秒
  const toleranceMs = toleranceSec * 1000

  // 只有当token剩余时间小于容差时，才认为已过期
  return expiresAt < Date.now() + toleranceMs
}

/**
 * 获取token的剩余有效时间（毫秒）
 */
export function getTokenTimeLeft(token?: string): number {
  const t = token || localStorage.getItem('access_token')
  if (!t) return -1

  const payload = parseJWTPayload(t)
  if (!payload?.exp) return -1

  const expiresAt = payload.exp * 1000 // 转换为毫秒
  const timeLeft = expiresAt - Date.now()

  return timeLeft > 0 ? timeLeft : -1
}

/**
 * 清除所有认证信息
 */
export function clearAuthStorage(): void {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('organization_id')
}

/**
 * 检查用户是否已认证
 */
export function isAuthenticated(): boolean {
  const token = localStorage.getItem('access_token')
  return !!token && !isTokenExpired(token)
}
