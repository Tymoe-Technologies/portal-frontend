import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthContext } from './AuthProvider'
import { isPathAllowed } from './permissions'

// 临时硬编码为 false 以确保认证流程启用
const authDisabled = false // (import.meta.env.VITE_AUTH_DISABLED ?? 'false') === 'true'

export const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, loading, role, permissions } = useAuthContext()
  const location = useLocation()

  if (authDisabled) return children

  // 在加载过程中显示loading，避免不必要的重定向
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>加载中...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // 前端角色限制（UX 层，非安全边界）：OWNER/MANAGER 不能访问 USER 专属页面
  if (!isPathAllowed(location.pathname, role, permissions)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
