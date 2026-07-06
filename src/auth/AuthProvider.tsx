import React, { createContext, useContext, useMemo, useState, useEffect } from 'react'
import { getProfile, getOrganizations, logout as authLogout, type AuthUser, type Organization } from '../services/auth'
import { isTokenExpired } from '../services/http'

export interface UserInfo {
  id: string
  email: string
  name: string
  emailVerified?: boolean
  roles?: string[]
}

interface AuthContextValue {
  user: UserInfo | null
  organizations: Organization[]
  isAuthenticated: boolean
  loading: boolean
  login: (token?: string, userInfo?: AuthUser) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  updateOrganizations: (orgs: Organization[]) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// 临时硬编码为 false 以确保认证流程启用
const authDisabled = false // (import.meta.env.VITE_AUTH_DISABLED ?? 'false') === 'true'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)

  // 初始化时检查是否已登录
  useEffect(() => {
    const initAuth = async () => {
      console.log('AuthProvider initAuth - authDisabled:', authDisabled)
      console.log('VITE_AUTH_DISABLED env value:', import.meta.env.VITE_AUTH_DISABLED)
      
      if (authDisabled) {
        // 如果认证被禁用，设置默认用户
        setUser({ id: 'placeholder', email: 'guest@example.com', name: 'Guest' })
        setLoading(false)
        return
      }

      const token = localStorage.getItem('access_token')
      if (token) {
        // 检查token是否已过期（5秒容差防止时钟偏差，避免短期token误判）
        if (isTokenExpired(token, 5)) {
          console.warn('[AUTH] Token is expired at startup, clearing credentials')
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          setLoading(false)
          return
        }

        try {
          // 分别获取用户资料和组织信息
          const profile = await getProfile()
          if (profile) {
            console.log('🔧 [AUTH PROVIDER DEBUG] Setting user from profile:', JSON.stringify(profile, null, 2))
            setUser(profile)

            // 获取组织信息
            try {
              const userOrganizations = await getOrganizations(undefined, 'beverage')
              console.log('🔧 [AUTH PROVIDER DEBUG] Setting organizations:', JSON.stringify(userOrganizations, null, 2))
              setOrganizations(userOrganizations)

              // 只有在没有选中组织时，才自动选择第一个
              const currentOrgId = localStorage.getItem('organization_id')
              if (!currentOrgId && userOrganizations.length > 0) {
                console.log('🔧 [AUTH PROVIDER DEBUG] No organization selected, setting first one:', userOrganizations[0].id)
                localStorage.setItem('organization_id', userOrganizations[0].id)
              } else if (currentOrgId) {
                console.log('🔧 [AUTH PROVIDER DEBUG] Organization already selected:', currentOrgId)
              }
            } catch (orgError) {
              console.warn('Failed to get organizations:', orgError)
              setOrganizations([])
            }
          } else {
            // profile 获取失败（网络问题或服务暂时不可用），但 token 有效
            // 用 JWT payload 中的基本信息构造临时用户，避免误登出
            console.warn('[AUTH] getProfile returned null, using token payload as fallback')
            try {
              const parts = token.split('.')
              // Base64URL → 标准 Base64，补全 padding
              const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
              const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=')
              const payload = JSON.parse(atob(padded))
              if (payload.sub && payload.email) {
                setUser({
                  id: payload.sub,
                  email: payload.email,
                  name: payload.email.split('@')[0]
                })
                console.log('[AUTH] Fallback user set from token payload')
              }
            } catch (parseError) {
              console.warn('[AUTH] Failed to parse token payload for fallback')
            }
          }
        } catch (error) {
          console.warn('Failed to get user profile:', error)
          // Token 可能已过期，清除本地存储
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [])

  // 额外的保护机制：如果组织状态为空但localStorage中有组织ID，尝试恢复
  useEffect(() => {
    const restoreOrganizations = async () => {
      if (authDisabled || organizations.length > 0) return
      
      const orgId = localStorage.getItem('organization_id')
      const token = localStorage.getItem('access_token')
      
      if (orgId && token) {
        console.log('🔧 [AUTH PROVIDER DEBUG] Organizations state is empty but localStorage has org ID, attempting to restore...')
        try {
          const userOrganizations = await getOrganizations(undefined, 'beverage')
          if (userOrganizations.length > 0) {
            console.log('🔧 [AUTH PROVIDER DEBUG] Successfully restored organizations:', userOrganizations.length)
            setOrganizations(userOrganizations)
          }
        } catch (error) {
          console.warn('Failed to restore organizations:', error)
        }
      }
    }

    restoreOrganizations()
  }, [authDisabled, organizations.length])

  // 强制刷新机制：页面加载时检查组织状态
  useEffect(() => {
    const forceRefreshOrganizations = async () => {
      if (authDisabled) return
      
      const token = localStorage.getItem('access_token')
      if (!token) return
      
      // 如果组织状态为空，强制刷新
      if (organizations.length === 0) {
        console.log('🔧 [AUTH PROVIDER DEBUG] Force refreshing organizations...')
        try {
          const userOrganizations = await getOrganizations(undefined, 'beverage')
          console.log('🔧 [AUTH PROVIDER DEBUG] Force refresh result:', userOrganizations.length)
          if (userOrganizations.length > 0) {
            setOrganizations(userOrganizations)
            console.log('🔧 [AUTH PROVIDER DEBUG] Force refresh successful')
          }
        } catch (error) {
          console.warn('Force refresh failed:', error)
        }
      }
    }

    // 延迟执行，确保其他初始化完成
    const timer = setTimeout(forceRefreshOrganizations, 1000)
    return () => clearTimeout(timer)
  }, [authDisabled])

  const refreshUser = async () => {
    if (authDisabled) return

    try {
      // 分别获取用户资料和组织信息
      const profile = await getProfile()
      if (profile) {
        console.log('🔧 [AUTH PROVIDER DEBUG] Refreshing user profile:', JSON.stringify(profile, null, 2))
        setUser(profile)
        
        // 获取组织信息
        try {
          const userOrganizations = await getOrganizations(undefined, 'beverage')
          console.log('🔧 [AUTH PROVIDER DEBUG] Updating organizations:', JSON.stringify(userOrganizations, null, 2))
          setOrganizations(userOrganizations)
          if (userOrganizations.length > 0) {
            localStorage.setItem('organization_id', userOrganizations[0].id)
          }
        } catch (orgError) {
          console.warn('Failed to refresh organizations:', orgError)
          setOrganizations([])
        }
      }
    } catch (error) {
      console.warn('Failed to refresh user profile:', error)
      setUser(null)
      setOrganizations([])
    }
  }

  const login = async (token?: string, userInfo?: AuthUser) => {
    if (authDisabled) {
      setUser({ id: 'placeholder', email: 'guest@example.com', name: 'Guest' })
      return
    }

    try {
      if (token) {
        localStorage.setItem('access_token', token)
      }

      // 如果提供了用户信息（如登录响应），直接使用
      if (userInfo) {
        console.log('🔧 [AUTH PROVIDER DEBUG] Using provided user info from login response:', JSON.stringify(userInfo, null, 2))
        setUser(userInfo)
        // 设置组织信息
        if (userInfo.organizations) {
          console.log('🔧 [AUTH PROVIDER DEBUG] Setting organizations from login response:', JSON.stringify(userInfo.organizations, null, 2))
          setOrganizations(userInfo.organizations)
          try {
            const firstOrgId = userInfo.organizations?.[0]?.id
            if (firstOrgId) localStorage.setItem('organization_id', firstOrgId)
          } catch {}
        } else {
          setOrganizations([])
        }
        return
      }

      // 否则从API获取用户信息
      const profile = await getProfile()
      if (profile) {
        console.log('🔧 [AUTH PROVIDER DEBUG] Login successful, setting user from API:', JSON.stringify(profile, null, 2))
        setUser(profile)
        
        // 获取组织信息
        try {
          console.log('🔧 [AUTH PROVIDER DEBUG] Fetching organizations...')
          // 使用 'beverage' 获取组织
          const userOrganizations = await getOrganizations(undefined, 'beverage')
          console.log('🔧 [AUTH PROVIDER DEBUG] Organizations response:', JSON.stringify(userOrganizations, null, 2))
          console.log('🔧 [AUTH PROVIDER DEBUG] Organizations count:', userOrganizations?.length || 0)
          
          setOrganizations(userOrganizations)
          if (userOrganizations.length > 0) {
            localStorage.setItem('organization_id', userOrganizations[0].id)
            console.log('✅ [AUTH PROVIDER DEBUG] Set organization ID:', userOrganizations[0].id)
          } else {
            console.log('⚠️ [AUTH PROVIDER DEBUG] No organizations found')
          }
        } catch (orgError) {
          console.error('❌ [AUTH PROVIDER DEBUG] Failed to get organizations:', orgError)
          setOrganizations([])
        }
      } else {
        throw new Error('Failed to get user profile')
      }
    } catch (error) {
      // 如果获取用户信息失败，清除 token
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      throw error
    }
  }

  const logout = async () => {
    try {
      if (!authDisabled) {
        const refreshToken = localStorage.getItem('refresh_token')
        if (refreshToken) {
          await authLogout(refreshToken)
        }
      }
    } catch (error) {
      console.warn('Logout request failed:', error)
    } finally {
      setUser(null)
      setOrganizations([])
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('organization_id')
    }
  }

  const updateOrganizations = (orgs: Organization[]) => {
    console.log('🔧 [AUTH PROVIDER DEBUG] Updating organizations from external call:', orgs.length)
    setOrganizations(orgs)
  }

  const value = useMemo<AuthContextValue>(() => ({
    user,
    organizations,
    isAuthenticated: authDisabled ? true : !!user,
    loading,
    login,
    logout,
    refreshUser,
    updateOrganizations
  }), [user, organizations, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
