import React, { useState, useEffect } from 'react'
import { User, Lock, Mail } from 'lucide-react'
import { Turnstile } from '@marsidev/react-turnstile'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthContext } from '../../auth/AuthProvider'
import { login, getCaptchaStatus, forgotPassword, resetPassword, getOAuthToken, type LoginPayload, type CaptchaStatus, type UserTokenRequest } from '../../services/auth'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import AuthBackground from '../../components/AuthBackground'
import { Btn, AlertBox } from '@/components/ui-kit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 带左侧图标的输入框（替代 antd Input prefix）
function IconInput({ icon, type = 'text', value, onChange, placeholder, maxLength, onRawChange }: {
  icon?: React.ReactNode
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  onRawChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="relative">
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={e => { onChange(e.target.value); onRawChange?.(e) }}
        placeholder={placeholder}
        className={`w-full h-11 rounded-lg border border-slate-200 bg-white ${icon ? 'pl-10' : 'pl-3'} pr-3 text-sm text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0`}
      />
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-slate-600 mb-1.5">{children}</div>
}

const Login: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { login: authLogin } = useAuthContext()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [, setCaptchaStatus] = useState<CaptchaStatus | null>(null)
  const [, setCaptchaToken] = useState<string>('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'email' | 'reset'>('email')
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState<string>('')
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState<string>('')

  // 表单字段（受控）
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [fpEmail, setFpEmail] = useState('')
  const [rsCode, setRsCode] = useState('')
  const [rsNew, setRsNew] = useState('')
  const [rsConfirm, setRsConfirm] = useState('')

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string

  // 检查来自注册页面的状态消息
  useEffect(() => {
    const state = location.state as { message?: string; email?: string }
    if (state?.message) {
      setSuccess(state.message)
      if (state.email) setEmail(state.email)
    }
  }, [location.state])

  // 检查是否需要验证码
  const checkCaptchaRequired = async (email: string) => {
    if (!email) return
    try {
      const status = await getCaptchaStatus(email)
      setCaptchaStatus(status)
    } catch (error) {
      console.warn('Failed to check captcha status:', error)
    }
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    if (v.includes('@')) checkCaptchaRequired(v)
  }

  const handleLogin = async () => {
    // 校验
    if (!email) { setFieldError(t('auth.login.emailRequired')); return }
    if (!EMAIL_RE.test(email)) { setFieldError(t('auth.login.emailInvalid')); return }
    if (!password) { setFieldError(t('auth.login.passwordRequired')); return }
    setFieldError('')
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const payload: LoginPayload = { email, password }
      const loginResponse = await login(payload, 'beverage')

      if (!loginResponse.success) {
        setError('登录失败，请检查邮箱和密码')
        return
      }

      const tokenRequest: UserTokenRequest = {
        grant_type: 'password',
        username: email,
        password,
        client_id: 'tymoe-web',
      }
      const tokenResponse = await getOAuthToken(tokenRequest, 'beverage')
      const { access_token, refresh_token } = tokenResponse

      if (access_token) {
        localStorage.setItem('access_token', access_token)
        if (refresh_token) localStorage.setItem('refresh_token', refresh_token)

        const userWithOrgs = { ...loginResponse.user, organizations: loginResponse.organizations }
        await authLogin(access_token, userWithOrgs)

        const from = (location.state as any)?.from || '/'
        navigate(from, { replace: true })
      } else {
        setError('登录成功但未收到访问令牌，请重试')
      }
    } catch (error: any) {
      console.error('Login error:', error)
      if (error?.response?.data?.detail) setError(error.response.data.detail)
      else if (error instanceof Error) setError(error.message)
      else setError('登录失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!fpEmail) { setForgotPasswordMessage(t('auth.login.emailRequired')); return }
    if (!EMAIL_RE.test(fpEmail)) { setForgotPasswordMessage(t('auth.login.emailInvalid')); return }
    setForgotPasswordLoading(true)
    setForgotPasswordMessage('')
    try {
      const response = await forgotPassword(fpEmail)
      if (response.success) {
        setForgotPasswordEmail(fpEmail)
        setForgotPasswordStep('reset')
        setForgotPasswordMessage(response.message || t('auth.forgotPassword.emailSent'))
      } else {
        setForgotPasswordMessage('发送失败，请稍后重试')
      }
    } catch (error: any) {
      if (error?.response?.data?.detail) setForgotPasswordMessage(error.response.data.detail)
      else if (error instanceof Error) setForgotPasswordMessage(error.message)
      else setForgotPasswordMessage('发送失败，请稍后重试')
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!rsCode || rsCode.length !== 6) { setForgotPasswordMessage('验证码为6位数字'); return }
    if (!rsNew || rsNew.length < 8) { setForgotPasswordMessage('密码至少8位'); return }
    if (rsNew !== rsConfirm) { setForgotPasswordMessage('两次输入的密码不一致'); return }
    setForgotPasswordLoading(true)
    setForgotPasswordMessage('')
    try {
      const response = await resetPassword(forgotPasswordEmail, rsCode, rsNew)
      if (response.success) {
        setForgotPasswordMessage(response.message || '密码重置成功，请使用新密码登录')
        setTimeout(() => {
          setShowForgotPassword(false)
          setForgotPasswordStep('email')
          setForgotPasswordEmail('')
          setForgotPasswordMessage('')
          setRsCode(''); setRsNew(''); setRsConfirm('')
        }, 2000)
      } else {
        setForgotPasswordMessage('密码重置失败，请重试')
      }
    } catch (error: any) {
      if (error?.response?.data?.detail) setForgotPasswordMessage(error.response.data.detail)
      else if (error instanceof Error) setForgotPasswordMessage(error.message)
      else setForgotPasswordMessage('密码重置失败，请重试')
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  const handleCaptchaSuccess = (token: string) => setCaptchaToken(token)
  const handleCaptchaError = () => { setCaptchaToken(''); setError(t('auth.login.captchaFailed')) }

  const cardCls = 'w-[400px] max-w-[90vw] bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] p-6'

  if (showForgotPassword) {
    const fpSuccess = forgotPasswordMessage.includes('发送') || forgotPasswordMessage.includes('已发送') || forgotPasswordMessage.includes('成功')
    return (
      <>
        <AuthBackground />
        <div className="min-h-screen bg-transparent">
          <div className="fixed top-6 right-6 z-[1000]"><LanguageSwitcher /></div>
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className={cardCls}>
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-slate-800 m-0">
                  {forgotPasswordStep === 'email' ? t('auth.forgotPassword.title') : '重置密码'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {forgotPasswordStep === 'email' ? t('auth.forgotPassword.description') : `验证码已发送到 ${forgotPasswordEmail}`}
                </p>
              </div>

              {forgotPasswordStep === 'email' ? (
                <div className="space-y-5">
                  <div>
                    <FieldLabel>{t('auth.login.email')}</FieldLabel>
                    <IconInput icon={<Mail className="w-4 h-4" />} value={fpEmail} onChange={setFpEmail} placeholder={t('auth.login.emailPlaceholder')} />
                  </div>
                  {forgotPasswordMessage && <AlertBox type={fpSuccess ? 'success' : 'error'} description={forgotPasswordMessage} />}
                  <Btn variant="primary" className="w-full h-11" loading={forgotPasswordLoading} onClick={handleForgotPassword}>
                    {t('auth.forgotPassword.sendButton')}
                  </Btn>
                  <Btn variant="link" className="w-full" onClick={() => setShowForgotPassword(false)}>{t('auth.forgotPassword.backToLogin')}</Btn>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <FieldLabel>验证码</FieldLabel>
                    <IconInput value={rsCode} onChange={setRsCode} placeholder="请输入6位验证码" maxLength={6} />
                  </div>
                  <div>
                    <FieldLabel>新密码</FieldLabel>
                    <IconInput icon={<Lock className="w-4 h-4" />} type="password" value={rsNew} onChange={setRsNew} placeholder="请输入新密码" />
                  </div>
                  <div>
                    <FieldLabel>确认密码</FieldLabel>
                    <IconInput icon={<Lock className="w-4 h-4" />} type="password" value={rsConfirm} onChange={setRsConfirm} placeholder="请再次输入新密码" />
                  </div>
                  {forgotPasswordMessage && <AlertBox type={forgotPasswordMessage.includes('成功') ? 'success' : 'error'} description={forgotPasswordMessage} />}
                  <Btn variant="primary" className="w-full h-11" loading={forgotPasswordLoading} onClick={handleResetPassword}>重置密码</Btn>
                  <div className="flex justify-between">
                    <Btn variant="link" onClick={() => { setForgotPasswordStep('email'); setForgotPasswordMessage('') }}>返回上一步</Btn>
                    <Btn variant="link" onClick={() => { setShowForgotPassword(false); setForgotPasswordStep('email'); setForgotPasswordMessage('') }}>返回登录</Btn>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <AuthBackground />
      <div className="min-h-screen bg-transparent">
        <div className="fixed top-6 right-6 z-[1000]"><LanguageSwitcher /></div>
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className={cardCls}>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 m-0">{t('auth.login.title')}</h2>
              <p className="text-sm text-slate-500 mt-1">{t('auth.login.subtitle')}</p>
            </div>

            <div className="space-y-5">
              <div>
                <FieldLabel>{t('auth.login.email')}</FieldLabel>
                <IconInput icon={<User className="w-4 h-4" />} value={email} onChange={setEmail} onRawChange={handleEmailChange} placeholder={t('auth.login.emailPlaceholder')} />
              </div>

              <div>
                <FieldLabel>{t('auth.login.password')}</FieldLabel>
                <IconInput icon={<Lock className="w-4 h-4" />} type="password" value={password} onChange={setPassword} placeholder={t('auth.login.passwordPlaceholder')} />
              </div>

              {/* 验证码组件 */}
              {turnstileSiteKey && (
                <div className="flex justify-center">
                  <Turnstile siteKey={turnstileSiteKey} onSuccess={handleCaptchaSuccess} onError={handleCaptchaError} options={{ theme: 'light', size: 'flexible' }} />
                </div>
              )}

              {fieldError && <AlertBox type="error" description={fieldError} />}
              {error && <AlertBox type="error" description={error} />}
              {success && <AlertBox type="success" description={success} />}

              <Btn variant="primary" className="w-full h-11 text-base" loading={loading} onClick={handleLogin}>{t('auth.login.loginButton')}</Btn>

              <div className="flex">
                <Btn variant="link" className="flex-1" onClick={() => setShowForgotPassword(true)}>{t('auth.login.forgotPassword')}</Btn>
                <Btn variant="link" className="flex-1" onClick={() => navigate('/register')}>{t('auth.login.registerNow')}</Btn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Login
