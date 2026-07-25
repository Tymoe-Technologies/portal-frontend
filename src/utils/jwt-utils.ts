// JWT工具函数
export const parseJWT = (token: string) => {
  try {
    // 使用浏览器兼容的方式解析JWT
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    }).join(''))
    const payload = JSON.parse(jsonPayload)
    return payload
  } catch (error) {
    console.error('Failed to parse JWT:', error)
    return null
  }
}

export const getJWTInfo = () => {
  const token = localStorage.getItem('access_token')
  if (!token) {
    console.log('❌ No access token found')
    return null
  }
  
  const payload = parseJWT(token)
  if (!payload) {
    console.log('❌ Failed to parse JWT')
    return null
  }
  
  console.log('🔍 [JWT DEBUG] ==========================================')
  console.log('📋 [JWT DEBUG] User ID:', payload.sub)
  console.log('📧 [JWT DEBUG] Email:', payload.email)
  console.log('👤 [JWT DEBUG] User Type:', payload.userType)
  console.log('🏢 [JWT DEBUG] Organization IDs:', payload.organizationIds)
  console.log('🏢 [JWT DEBUG] Current Organization ID:', payload.organizationId)
  console.log('🔑 [JWT DEBUG] Permissions:', payload.permissions)
  console.log('⏰ [JWT DEBUG] Issued At:', new Date(payload.iat * 1000).toISOString())
  console.log('⏰ [JWT DEBUG] Expires At:', new Date(payload.exp * 1000).toISOString())
  console.log('🔍 [JWT DEBUG] ==========================================')
  
  return payload
}

export const checkJWTOrganizationInfo = () => {
  const jwtInfo = getJWTInfo()
  if (!jwtInfo) return false
  
  const hasOrganizations = jwtInfo.organizationIds && jwtInfo.organizationIds.length > 0
  const hasCurrentOrg = jwtInfo.organizationId !== null
  
  console.log('🔍 [JWT ORG CHECK] ==========================================')
  console.log('🏢 [JWT ORG CHECK] Has Organizations:', hasOrganizations)
  console.log('🏢 [JWT ORG CHECK] Has Current Org:', hasCurrentOrg)
  console.log('🏢 [JWT ORG CHECK] Organization Count:', jwtInfo.organizationIds?.length || 0)
  
  // 如果JWT中有组织但没有当前组织ID，尝试从localStorage获取
  if (hasOrganizations && !hasCurrentOrg) {
    const orgIdFromStorage = localStorage.getItem('organization_id')
    if (orgIdFromStorage) {
      console.log('🔧 [JWT ORG CHECK] Using organization ID from localStorage:', orgIdFromStorage)
      return true
    }
  }
  
  console.log('🔍 [JWT ORG CHECK] ==========================================')
  
  return hasOrganizations && (hasCurrentOrg || localStorage.getItem('organization_id'))
}
