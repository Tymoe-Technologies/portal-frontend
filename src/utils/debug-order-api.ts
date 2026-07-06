/**
 * 订单API调试工具
 * 用于诊断401错误
 */

export function debugOrderApiAuth() {
  console.group('🔍 订单API认证调试信息')
  
  // 1. 检查localStorage中的认证信息
  const token = localStorage.getItem('access_token')
  const orgId = localStorage.getItem('organization_id')
  const refreshToken = localStorage.getItem('refresh_token')
  
  console.log('1️⃣ 本地存储的认证信息:')
  console.log('   Token存在:', !!token)
  console.log('   Token长度:', token?.length || 0)
  console.log('   Token前20字符:', token?.substring(0, 20) + '...')
  console.log('   组织ID:', orgId)
  console.log('   Refresh Token存在:', !!refreshToken)
  
  // 2. 解析JWT token
  if (token) {
    try {
      const parts = token.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]))
        console.log('2️⃣ Token解析结果:')
        console.log('   用户ID:', payload.sub || payload.user_id)
        console.log('   过期时间:', new Date((payload.exp || 0) * 1000).toLocaleString())
        console.log('   是否过期:', Date.now() > (payload.exp || 0) * 1000)
        console.log('   完整payload:', payload)
      }
    } catch (e) {
      console.error('   ❌ Token解析失败:', e)
    }
  }
  
  // 3. 检查请求头配置
  console.log('3️⃣ 预期的请求头:')
  console.log('   Authorization:', token ? `Bearer ${token.substring(0, 20)}...` : '❌ 缺失')
  console.log('   X-Organization-Id:', orgId || '❌ 缺失')
  console.log('   X-Tenant-Id:', orgId || '❌ 缺失')
  
  // 4. 环境变量检查
  console.log('4️⃣ 环境变量:')
  console.log('   VITE_ORDER_API_BASE:', import.meta.env.VITE_ORDER_API_BASE)
  console.log('   当前环境:', import.meta.env.MODE)
  
  console.groupEnd()
  
  return {
    hasToken: !!token,
    hasOrgId: !!orgId,
    tokenValid: token ? checkTokenExpiry(token) : false
  }
}

function checkTokenExpiry(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    
    const payload = JSON.parse(atob(parts[1]))
    const exp = payload.exp || 0
    return Date.now() < exp * 1000
  } catch {
    return false
  }
}

/**
 * 测试订单API连接
 */
export async function testOrderApiConnection() {
  console.group('🧪 测试订单API连接')
  
  const token = localStorage.getItem('access_token')
  const orgId = localStorage.getItem('organization_id')
  
  if (!token) {
    console.error('❌ 缺少access_token,无法测试')
    console.groupEnd()
    return
  }
  
  if (!orgId) {
    console.error('❌ 缺少organization_id,无法测试')
    console.groupEnd()
    return
  }
  
  const testUrl = '/api/order/v1/print-settings'
  
  console.log('📡 发送测试请求到:', testUrl)
  console.log('📋 请求头:')
  console.log('   Authorization: Bearer', token.substring(0, 20) + '...')
  console.log('   X-Organization-Id:', orgId)
  console.log('   X-Tenant-Id:', orgId)
  
  try {
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Organization-Id': orgId,
        'X-Tenant-Id': orgId,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })
    
    console.log('📊 响应状态:', response.status, response.statusText)
    console.log('📋 响应头:', Object.fromEntries(response.headers.entries()))
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ 请求成功!')
      console.log('📦 响应数据:', data)
    } else {
      const text = await response.text()
      console.error('❌ 请求失败!')
      console.error('📦 错误响应:', text)
      
      if (response.status === 401) {
        console.error('💡 401错误可能的原因:')
        console.error('   1. 后端订单服务未启动 (localhost:3002)')
        console.error('   2. 后端JWT密钥配置不匹配')
        console.error('   3. 后端未正确验证token')
        console.error('   4. 后端需要额外的认证配置')
      }
    }
  } catch (error) {
    console.error('❌ 请求异常:', error)
    console.error('💡 可能的原因:')
    console.error('   1. 后端服务未启动')
    console.error('   2. 网络连接问题')
    console.error('   3. CORS配置问题')
  }
  
  console.groupEnd()
}

/**
 * 在浏览器控制台中使用:
 * 
 * import { debugOrderApiAuth, testOrderApiConnection } from '@/utils/debug-order-api'
 * 
 * // 查看认证信息
 * debugOrderApiAuth()
 * 
 * // 测试API连接
 * await testOrderApiConnection()
 */

// 导出到window对象,方便在控制台使用
if (typeof window !== 'undefined') {
  (window as any).debugOrderApi = {
    auth: debugOrderApiAuth,
    test: testOrderApiConnection
  }
  
  console.log('💡 调试工具已加载,在控制台使用:')
  console.log('   window.debugOrderApi.auth()     - 查看认证信息')
  console.log('   window.debugOrderApi.test()     - 测试API连接')
}
