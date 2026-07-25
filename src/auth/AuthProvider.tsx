import React, { createContext, useContext, useMemo, useRef, useState, useEffect } from 'react'
import { getOrganizations, getUserInfo, logout as authLogout, refreshOAuthToken, type Organization } from '../services/auth'
import { isTokenExpired, parseJWTPayload } from '../services/http'
import type { PortalRole } from './permissions'
import { Modal, Btn } from '@/components/ui-kit'
import { useTranslation } from 'react-i18next'

export interface UserInfo {
  id: string
  email: string
  name: string
  phone?: string
  createdAt?: string
  emailVerified?: boolean
  roles?: string[]
  userType: 'USER' | 'ACCOUNT'
  // 仅 ACCOUNT 有意义：有 username 才是开通了 Portal 后台登录（有密码可改）；
  // PIN-only 的员工账号没有 username，也没有密码
  username?: string
}

interface AuthContextValue {
  user: UserInfo | null
  organizations: Organization[]
  role: PortalRole
  permissions: string[]
  isAuthenticated: boolean
  loading: boolean
  login: (token?: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  updateOrganizations: (orgs: Organization[]) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// 临时硬编码为 false 以确保认证流程启用
const authDisabled = false // (import.meta.env.VITE_AUTH_DISABLED ?? 'false') === 'true'

// 统一的空组织形状占位符：/userinfo 的 ACCOUNT 分支不返回 createdAt/updatedAt，
// 但 Organization 类型要求这两个字段，这里补空字符串，不影响 RequireOrganization
// 等"是否至少有一个组织"的判断，也不会被 ACCOUNT 专属页面用到这两个字段。
function toOrganization(o: {
  id: string; orgName: string; orgType: string
  parentOrgId: string | null; status: string
}): Organization {
  return {
    id: o.id,
    orgName: o.orgName,
    orgType: o.orgType as Organization['orgType'],
    parentOrgId: o.parentOrgId ?? undefined,
    status: o.status as Organization['status'],
    createdAt: '',
    updatedAt: '',
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  // 上一次确认过的组织快照（orgType/parentOrgId）——用来跟"当前登录 token 里的认知"做对比，
  // 检测主店有没有把当前登录的加盟店解除关联。access token 里的 orgType/parentOrgId 是签发时的
  // 快照，不会随着 auth-service 数据库变化而更新，所以不能直接用 token，要单独轮询 getOrganizations()
  const orgSnapshotRef = useRef<Map<string, { orgType: string; parentOrgId: string | null }>>(new Map())
  const [dissociatedOrg, setDissociatedOrg] = useState<{ id: string; orgName: string } | null>(null)
  const [confirmingDissociation, setConfirmingDissociation] = useState(false)

  const updateOrgSnapshot = (orgs: Organization[]) => {
    orgSnapshotRef.current = new Map(orgs.map(o => [o.id, { orgType: o.orgType, parentOrgId: o.parentOrgId ?? null }]))
  }

  // 统一的"我是谁"流程：同时支持 USER（老板，邮箱登录）和 ACCOUNT（员工，用户名登录）
  const fetchWhoAmI = async (): Promise<boolean> => {
    const info = await getUserInfo()
    const token = localStorage.getItem('access_token')
    const jwtSub = token ? parseJWTPayload(token)?.sub : undefined

    if (info.userType === 'USER') {
      setUser({
        id: jwtSub ?? '',
        email: info.data.email ?? '',
        name: info.data.name ?? info.data.email?.split('@')[0] ?? '',
        phone: info.data.phone,
        createdAt: info.data.createdAt,
        emailVerified: info.data.emailVerified,
        userType: 'USER',
      })
      setPermissions([]) // USER 不受权限集限制

      try {
        const userOrganizations = await getOrganizations()
        setOrganizations(userOrganizations)
        updateOrgSnapshot(userOrganizations)
        const currentOrgId = localStorage.getItem('organization_id')
        if (!currentOrgId && userOrganizations.length > 0) {
          localStorage.setItem('organization_id', userOrganizations[0].id)
        }
      } catch (orgError) {
        console.warn('Failed to get organizations:', orgError)
        setOrganizations([])
      }
    } else {
      // ACCOUNT：加盟店 OWNER / 店长 MANAGER，用户名登录
      setUser({
        id: jwtSub ?? '',
        email: info.data.email ?? '',
        name: info.data.name ?? info.data.username ?? '',
        phone: info.data.phone,
        createdAt: info.data.createdAt,
        userType: 'ACCOUNT',
        username: info.data.username,
      })
      setPermissions(info.data.permissions ?? [])

      const org = info.data.organization
      if (org) {
        const orgs = [toOrganization(org)]
        setOrganizations(orgs)
        updateOrgSnapshot(orgs)
        localStorage.setItem('organization_id', org.id)
      } else {
        setOrganizations([])
      }
    }
    return true
  }

  // 定期用实时数据核对当前登录 token 里"认为"的组织关系是否还成立——
  // 主要是为了发现"主店把我这个加盟店解除关联了"这种别人操作导致的、
  // 自己 token 里没有及时反映的变化（access token 是登录/刷新那一刻的快照）
  const checkForDissociation = async () => {
    if (dissociatedOrg) return // 已经在等用户确认了，不用重复检测
    try {
      const liveOrgs = await getOrganizations()
      for (const live of liveOrgs) {
        const prev = orgSnapshotRef.current.get(live.id)
        if (prev && prev.orgType === 'FRANCHISE' && prev.parentOrgId && live.orgType !== 'FRANCHISE') {
          setDissociatedOrg({ id: live.id, orgName: live.orgName })
          return
        }
      }
    } catch {
      // 静默失败即可，下一轮轮询再试
    }
  }

  // 只有名下确实拥有 FRANCHISE 组织的 USER 才可能被"解除关联"——
  // 主店老板（只有 MAIN/BRANCH）和 ACCOUNT 员工都不可能触发这个场景，没必要陪着轮询
  const hasFranchiseOrg = user?.userType === 'USER' && organizations.some(o => o.orgType === 'FRANCHISE')

  useEffect(() => {
    if (authDisabled || !user || !hasFranchiseOrg) return

    // 标签页切到后台时暂停轮询，切回来立即补一次检查，不用干等下一个整点
    let interval: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (interval) return
      checkForDissociation()
      interval = setInterval(checkForDissociation, 120000)
    }
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null }
    }
    const handleVisibility = () => { document.visibilityState === 'visible' ? start() : stop() }

    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [user, hasFranchiseOrg, dissociatedOrg])

  // 用户在弹窗里确认后：拿 refresh_token 换一个新 access token（里面的 orgType/parentOrgId
  // 才是解除关联之后的最新值），然后整页刷新，确保所有页面的内部状态都跟着重置
  const handleConfirmDissociation = async () => {
    setConfirmingDissociation(true)
    try {
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        const tokenResponse = await refreshOAuthToken({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: 'tymoe-web',
        })
        localStorage.setItem('access_token', tokenResponse.access_token)
        if (tokenResponse.refresh_token) {
          localStorage.setItem('refresh_token', tokenResponse.refresh_token)
        }
      }
    } catch (error) {
      console.warn('Failed to refresh token after dissociation:', error)
    } finally {
      window.location.reload()
    }
  }

  // 初始化时检查是否已登录
  useEffect(() => {
    const initAuth = async () => {
      if (authDisabled) {
        setUser({ id: 'placeholder', email: 'guest@example.com', name: 'Guest', userType: 'USER' })
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
          await fetchWhoAmI()
        } catch (error) {
          console.warn('Failed to get user info:', error)
          // Token 可能已过期，清除本地存储
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [])

  const refreshUser = async () => {
    if (authDisabled) return
    try {
      await fetchWhoAmI()
    } catch (error) {
      console.warn('Failed to refresh user info:', error)
      setUser(null)
      setOrganizations([])
    }
  }

  const login = async (token?: string) => {
    if (authDisabled) {
      setUser({ id: 'placeholder', email: 'guest@example.com', name: 'Guest', userType: 'USER' })
      return
    }

    try {
      if (token) {
        localStorage.setItem('access_token', token)
      }
      await fetchWhoAmI()
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
      setPermissions([])
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('organization_id')
    }
  }

  const updateOrganizations = (orgs: Organization[]) => {
    setOrganizations(orgs)
  }

  const role: PortalRole = user?.userType === 'ACCOUNT' ? 'ACCOUNT' : 'USER'

  const value = useMemo<AuthContextValue>(() => ({
    user,
    organizations,
    role,
    permissions,
    isAuthenticated: authDisabled ? true : !!user,
    loading,
    login,
    logout,
    refreshUser,
    updateOrganizations
  }), [user, organizations, loading, role, permissions])

  return (
    <AuthContext.Provider value={value}>
      {children}
      {/* 加盟关联被主店解除后的强制确认弹窗——不能通过点击遮罩/ESC 关闭，
          必须点确认才能继续，确认时会强制刷新 token 并整页重载 */}
      <Modal
        open={!!dissociatedOrg}
        onOpenChange={() => {}}
      >
        <h3 className="text-base font-semibold text-slate-900">{t('auth.dissociationTitle')}</h3>
        <p className="mt-2 text-sm text-slate-600">
          {t('auth.dissociationMessage', { orgName: dissociatedOrg?.orgName })}
        </p>
        <div className="mt-5 flex justify-end">
          <Btn variant="primary" loading={confirmingDissociation} onClick={handleConfirmDissociation}>
            {t('auth.dissociationConfirm')}
          </Btn>
        </div>
      </Modal>
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
