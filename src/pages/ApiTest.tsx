import React, { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { httpService } from '../services/http'
import { register, verifyEmail, resendVerificationCode, login, getOAuthToken, getOrganizations, createOrganization, type RegisterPayload, type UserTokenRequest, type CreateOrganizationPayload } from '../services/auth'
import { SectionCard, Btn, TextInput, SelectInput, AlertBox, ConfirmDialog, toast } from '@/components/ui-kit'

const ApiTest: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [clearingData, setClearingData] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [error, setError] = useState<string>('')
  const [testEmail, setTestEmail] = useState<string>('')
  const [testPassword, setTestPassword] = useState<string>('')
  const [verificationCode, setVerificationCode] = useState<string>('')
  const [orgName, setOrgName] = useState<string>('')
  const [orgType, setOrgType] = useState<string>('MAIN')

  const testServiceInfo = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await httpService.get('/')
      setResult(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as any
        setResult({
          status: axiosError.response?.status,
          data: axiosError.response?.data,
          headers: axiosError.response?.headers,
          note: "这可能是因为根路径 / 不在代理配置中"
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const testHealthCheck = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await httpService.get('/healthz')
      setResult(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const testRegisterEndpoint = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const timestamp = Date.now()
      const testData = {
        email: `test${timestamp}@gmail.com`,
        password: "Password123!",
        name: "张三",
        phone: "+8613812345678",
        organizationName: "我的公司"
      }

      const response = await httpService.post('/api/auth-service/v1/identity/register', testData)
      setResult(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as any
        setResult({
          status: axiosError.response?.status,
          error_data: axiosError.response?.data,
          headers: axiosError.response?.headers
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const testDirectAPI = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const testData = {
        email: "test@example.com",
        password: "TestPassword123!",
        name: "Test User",
        phone: "+8613800000000",
        organizationName: "Test Organization"
      }

      const response = await fetch('https://tymoe.com/api/auth-service/v1/identity/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      })

      const responseText = await response.text()
      let responseData
      try {
        responseData = JSON.parse(responseText)
      } catch {
        responseData = responseText
      }

      setResult({
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        headers: Object.fromEntries(response.headers.entries())
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setResult({ error: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  const testCaptchaStatus = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const email = "test@example.com"
      const response = await httpService.get(`/api/auth-service/v1/identity/captcha-status?email=${encodeURIComponent(email)}`)
      setResult(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as any
        setResult({
          status: axiosError.response?.status,
          error_data: axiosError.response?.data,
          headers: axiosError.response?.headers
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const testNewRegisterAPI = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const timestamp = Date.now()
      const payload: RegisterPayload = {
        email: `newapi${timestamp}@gmail.com`,
        password: "Password123!",
        name: "新API测试用户",
        phone: "+8613812345678"
      }

      const response = await register(payload, 'beauty')
      setResult(response)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Unknown error')
      setResult({
        error: err?.response?.data?.detail || err.message || 'Unknown error',
        status: err?.response?.status,
        data: err?.response?.data
      })
    } finally {
      setLoading(false)
    }
  }

  const testEmailVerification = async () => {
    if (!testEmail || !verificationCode) {
      setError('请先填写邮箱和验证码')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await verifyEmail(testEmail, verificationCode)
      setResult(response)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Unknown error')
      setResult({
        error: err?.response?.data?.detail || err.message || 'Unknown error',
        status: err?.response?.status,
        data: err?.response?.data
      })
    } finally {
      setLoading(false)
    }
  }

  const testResendCode = async () => {
    if (!testEmail) {
      setError('请先填写邮箱')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await resendVerificationCode(testEmail, 'signup')
      setResult(response)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Unknown error')
      setResult({
        error: err?.response?.data?.detail || err.message || 'Unknown error',
        status: err?.response?.status,
        data: err?.response?.data
      })
    } finally {
      setLoading(false)
    }
  }

  const testLoginAPI = async () => {
    if (!testEmail || !testPassword) {
      setError('请先填写邮箱和密码')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await login({ email: testEmail, password: testPassword }, 'beauty')
      setResult(response)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Unknown error')
      setResult({
        error: err?.response?.data?.detail || err.message || 'Unknown error',
        status: err?.response?.status,
        data: err?.response?.data
      })
    } finally {
      setLoading(false)
    }
  }

  const testOAuthToken = async () => {
    if (!testEmail || !testPassword) {
      setError('请先填写邮箱和密码')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const tokenRequest: UserTokenRequest = {
        grant_type: 'password',
        username: testEmail,
        password: testPassword,
        client_id: 'tymoe-web'
      }

      const response = await getOAuthToken(tokenRequest, 'beauty')
      setResult(response)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Unknown error')
      setResult({
        error: err?.response?.data?.detail || err.message || 'Unknown error',
        status: err?.response?.status,
        data: err?.response?.data
      })
    } finally {
      setLoading(false)
    }
  }

  const testGetOrganizations = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await getOrganizations({}, 'beauty')
      setResult(response)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Unknown error')
      setResult({
        error: err?.response?.data?.detail || err.message || 'Unknown error',
        status: err?.response?.status,
        data: err?.response?.data
      })
    } finally {
      setLoading(false)
    }
  }

  const testCreateOrganization = async () => {
    if (!orgName) {
      setError('请先填写组织名称')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const payload: CreateOrganizationPayload = {
        orgName: orgName,
        orgType: orgType as 'MAIN' | 'BRANCH' | 'FRANCHISE',
        description: `测试${orgType === 'MAIN' ? '主店' : orgType === 'BRANCH' ? '分店' : '加盟店'}`,
        location: '测试地址',
        phone: '+1234567890',
        email: 'test@example.com'
      }

      const response = await createOrganization(payload, 'beauty')
      setResult(response)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Unknown error')
      setResult({
        error: err?.response?.data?.detail || err.message || 'Unknown error',
        status: err?.response?.status,
        data: err?.response?.data
      })
    } finally {
      setLoading(false)
    }
  }

  const clearAuthState = () => {
    // 清除所有认证相关的存储
    localStorage.clear()
    sessionStorage.clear()

    // 更彻底地清除 Cookie
    const cookies = document.cookie.split(";")
    cookies.forEach(function(cookie) {
      const eqPos = cookie.indexOf("=")
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()

      const domains = ['', '.tymoe.com', '.localhost', 'localhost', 'tymoe.com']
      const paths = ['/', '/api', '/auth']

      domains.forEach(domain => {
        paths.forEach(path => {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; domain=${domain}`
        })
      })
    })

    const authCookies = [
      'fusionauth.at', 'fusionauth.rt', 'fusionauth.sso', 'fusionauth.remember-device',
      'account.at', 'account.rt', 'refreshToken', 'accessToken'
    ]

    authCookies.forEach(cookieName => {
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=tymoe.com`
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.tymoe.com`
    })

    setResult({
      message: '✅ 认证状态已彻底清除！请重新测试注册。如果仍有问题，请刷新页面。',
      clearedCookies: cookies.length
    })
    setError('')
  }

  // 清除测试数据
  const handleClearTestData = async () => {
    setClearingData(true)
    try {
      const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || ''
      const tenantId = localStorage.getItem('organization_id') || ''
      const gatewayBase = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

      const [financeRes, orderRes] = await Promise.all([
        fetch(`${gatewayBase}/api/finance/v1/admin/dev/clear-test-data`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${gatewayBase}/api/order/v1/admin/dev/clear-test-data`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}`, 'X-Merchant-Id': tenantId },
        }),
      ])

      const [financeData, orderData] = await Promise.all([financeRes.json(), orderRes.json()])
      setResult({ finance: financeData, order: orderData })
      toast.success('测试数据已清除')
    } catch (err: any) {
      toast.error(err.message || '清除失败')
    } finally {
      setClearingData(false)
      setClearConfirmOpen(false)
    }
  }

  // 避免未使用告警：保留旧版调试函数供开发时手动接线
  void testServiceInfo
  void testHealthCheck
  void testDirectAPI

  return (
    <div className="mx-auto max-w-4xl p-6">
      <SectionCard title="新版用户管理API测试">
        <div className="space-y-6">
          <div>
            <h4 className="mb-3 text-base font-semibold text-slate-800">新版API端点测试</h4>
            <div className="flex flex-wrap gap-2">
              <Btn variant="danger" onClick={clearAuthState} loading={loading}>🧹 清除认证状态</Btn>
              <Btn variant="primary" onClick={testNewRegisterAPI} loading={loading}>🆕 测试新版注册API</Btn>
              <Btn variant="primary" onClick={testLoginAPI} loading={loading}>🔑 测试登录API</Btn>
              <Btn variant="primary" onClick={testOAuthToken} loading={loading}>🎫 测试OAuth Token</Btn>
            </div>
            <div className="mt-4 rounded-lg bg-slate-100 p-3">
              <span className="text-sm text-slate-500">💡 新版API测试：包含X-Product-Type请求头，支持完整的用户注册和登录流程</span>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-base font-semibold text-slate-800">测试数据输入</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700">测试邮箱:</span>
                <div className="w-72"><TextInput value={testEmail} onChange={setTestEmail} placeholder="输入测试邮箱" /></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700">测试密码:</span>
                <div className="w-72"><TextInput type="password" value={testPassword} onChange={setTestPassword} placeholder="输入测试密码" /></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700">验证码:</span>
                <div className="w-40"><TextInput value={verificationCode} onChange={setVerificationCode} placeholder="输入6位验证码" maxLength={6} /></div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-base font-semibold text-slate-800">组织管理测试</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700">组织名称:</span>
                <div className="w-52"><TextInput value={orgName} onChange={setOrgName} placeholder="输入组织名称" /></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700">组织类型:</span>
                <div className="w-40">
                  <SelectInput
                    value={orgType}
                    onChange={setOrgType}
                    options={[
                      { value: 'MAIN', label: '主店' },
                      { value: 'BRANCH', label: '分店' },
                      { value: 'FRANCHISE', label: '加盟店' }
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-base font-semibold text-slate-800">组织管理测试</h4>
            <div className="flex flex-wrap gap-2">
              <Btn variant="primary" onClick={testGetOrganizations} loading={loading}>🏢 获取组织列表</Btn>
              <Btn variant="primary" onClick={testCreateOrganization} loading={loading}>➕ 创建组织</Btn>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-base font-semibold text-slate-800">验证码相关测试</h4>
            <div className="flex flex-wrap gap-2">
              <Btn variant="primary" onClick={testEmailVerification} loading={loading}>📧 测试邮箱验证</Btn>
              <Btn variant="primary" onClick={testResendCode} loading={loading}>🔄 重新发送验证码</Btn>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-base font-semibold text-slate-800">旧版API测试（对比用）</h4>
            <div className="flex flex-wrap gap-2">
              <Btn variant="primary" onClick={testCaptchaStatus} loading={loading}>✅ 测试验证码状态</Btn>
              <Btn variant="danger" onClick={testRegisterEndpoint} loading={loading}>🔴 测试旧版注册API</Btn>
            </div>
          </div>

          {error && <AlertBox type="error" title="错误信息" description={error} />}

          {result && (
            <div>
              <h5 className="mb-2 text-sm font-semibold text-slate-800">响应结果:</h5>
              <pre className="max-h-96 overflow-auto rounded bg-slate-100 p-4 text-xs text-slate-700">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          {/* ─── 开发工具：清除测试数据 ─── */}
          <div className="mt-6 rounded-lg border border-dashed border-red-400 bg-red-50 p-4">
            <div className="mb-2 font-semibold text-red-500">⚠️ 开发工具 — 清除测试数据</div>
            <div className="space-y-3">
              <span className="text-sm text-slate-500">清除当前商户在 Finance Service 和 Order Service 中的所有测试数据（仅开发环境可用）</span>
              <div>
                <Btn variant="danger" icon={<Trash2 size={16} />} loading={clearingData} onClick={() => setClearConfirmOpen(true)}>
                  清除所有测试数据
                </Btn>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h5 className="mb-2 text-sm font-semibold text-slate-800">当前环境变量:</h5>
            <div className="flex flex-col gap-1 text-sm text-slate-600">
              <span><strong>VITE_API_BASE:</strong> {import.meta.env.VITE_API_BASE}</span>
              <span><strong>VITE_AUTH_BASE:</strong> {import.meta.env.VITE_AUTH_BASE}</span>
              <span><strong>VITE_AUTH_DISABLED:</strong> {import.meta.env.VITE_AUTH_DISABLED}</span>
              <span><strong>VITE_TURNSTILE_SITE_KEY:</strong> {import.meta.env.VITE_TURNSTILE_SITE_KEY}</span>
            </div>
          </div>
        </div>
      </SectionCard>

      <ConfirmDialog
        open={clearConfirmOpen}
        onOpenChange={(o) => { if (!o && !clearingData) setClearConfirmOpen(false) }}
        title="确认清除所有测试数据？"
        description="此操作不可撤销，将删除所有礼品卡、支付记录、订单等数据。"
        confirmText="确认删除"
        danger
        loading={clearingData}
        onConfirm={handleClearTestData}
      />
    </div>
  )
}

export default ApiTest
