import React, { useState, useEffect } from 'react'
import { Mail, Lock, Eye, EyeOff, KeyRound, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Turnstile } from '@marsidev/react-turnstile'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthContext } from '../../auth/AuthProvider'
import { login, getCaptchaStatus, forgotPassword, resetPassword, getOAuthToken, type LoginPayload, type CaptchaStatus, type UserTokenRequest } from '../../services/auth'
import { Btn, AlertBox } from '@/components/ui-kit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 认证画布专用语言切换：玻璃质感分段控件，融入深色背景（全站白色 LanguageSwitcher 不适合深底）
function AuthLangSwitcher() {
  const { i18n } = useTranslation()
  const langs: { label: string; value: string }[] = [
    { label: 'EN', value: 'en' },
    { label: '简', value: 'zh-CN' },
    { label: '繁', value: 'zh-TW' },
    { label: 'FR', value: 'fr' },
  ]
  const change = (lng: string) => {
    try { localStorage.setItem('app.lng', lng) } catch {}
    i18n.changeLanguage(lng)
  }
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10 backdrop-blur-sm">
      {langs.map(l => {
        const active = i18n.language === l.value
        return (
          <button
            key={l.value}
            type="button"
            onClick={() => change(l.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${active ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white/85'}`}
          >
            {l.label}
          </button>
        )
      })}
    </div>
  )
}

// 带左侧图标的输入框（可选密码可见切换）
function IconInput({ icon, type = 'text', value, onChange, placeholder, maxLength, onRawChange, revealable }: {
  icon?: React.ReactNode
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  onRawChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  revealable?: boolean
}) {
  const [reveal, setReveal] = useState(false)
  const realType = revealable ? (reveal ? 'text' : 'password') : type
  return (
    <div className="relative">
      {icon && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
      <input
        type={realType}
        value={value}
        maxLength={maxLength}
        onChange={e => { onChange(e.target.value); onRawChange?.(e) }}
        placeholder={placeholder}
        className={`h-12 w-full rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 transition-colors ${icon ? 'pl-11' : 'pl-4'} ${revealable ? 'pr-11' : 'pr-4'} placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-900/5`}
      />
      {revealable && (
        <button
          type="button"
          onClick={() => setReveal(v => !v)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
          tabIndex={-1}
        >
          {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-sm font-medium text-slate-700">{children}</div>
}

// 沉浸式品牌画布：暖色深底 + 有机柔光 + 抽象茶杯环（无网格、无紫色）
function AuthCanvas() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* 暖色渐层底：slate-950 → 带琥珀暖调的深色 */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 90% at 82% 12%, #3b2a17 0%, #1a2233 42%, #0b1120 100%)' }}
      />
      {/* 顶部暖光（像热饮的暖意透过来） */}
      <div className="absolute -right-24 -top-32 h-[34rem] w-[34rem] rounded-full bg-amber-500/20 blur-[120px]" />
      <div className="absolute right-1/3 -top-16 h-72 w-72 rounded-full bg-orange-400/10 blur-[90px]" />
      {/* 左下冷调平衡光 */}
      <div className="absolute -bottom-40 -left-32 h-[30rem] w-[30rem] rounded-full bg-sky-500/10 blur-[120px]" />
      {/* 抽象同心环：奶茶杯口俯视意象 */}
      <div className="absolute -bottom-56 -left-40 h-[42rem] w-[42rem] rounded-full border border-white/[0.05]" />
      <div className="absolute -bottom-40 -left-24 h-[34rem] w-[34rem] rounded-full border border-white/[0.06]" />
      <div className="absolute -bottom-24 -left-8 h-[26rem] w-[26rem] rounded-full border border-amber-200/[0.06]" />
      {/* 细腻点状颗粒，替代规则网格 */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1.4px)',
          backgroundSize: '22px 22px',
        }}
      />
    </div>
  )
}

// 左侧品牌叙事：大标语 + 能力清单 + 注册引导（仅大屏显示）
function BrandHero() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const phrases = (t('auth.brand.phrases', { returnObjects: true }) as string[]) || []
  const chips = phrases.slice(0, 6)

  return (
    <div className="relative hidden max-w-md flex-col justify-center text-white lg:flex">
      <h1 className="text-[40px] font-semibold leading-[1.15] tracking-tight">
        {t('auth.brand.headline')}
      </h1>
      <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-slate-300/90">
        {t('auth.brand.subtitle')}
      </p>

      <ul className="mt-9 grid grid-cols-2 gap-x-6 gap-y-3.5">
        {chips.map((p, i) => (
          <li key={i} className="flex items-center gap-2.5 text-sm text-slate-200/85">
            <span className="h-1.5 w-1.5 flex-none rounded-full bg-amber-400" />
            {p}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => navigate('/register')}
        className="group mt-11 inline-flex items-center gap-2 self-start text-sm font-medium text-white/90 transition-colors hover:text-white"
      >
        {t('auth.login.registerNow')}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  )
}

// 沉浸式外壳：整屏品牌画布 + 左侧叙事 + 右侧浮动登录卡
// 注意：必须定义在 Login 外部（模块顶层），否则每次 render 都是新组件引用，
// 会导致整棵子树（含 Turnstile）反复卸载重挂，表现为「页面一直刷新」。
const Shell: React.FC<{ heading: string; sub: React.ReactNode; children: React.ReactNode }> = ({ heading, sub, children }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950">
      <AuthCanvas />

      {/* 语言切换：右上角浮层 */}
      <div className="absolute right-5 top-5 z-20 sm:right-8 sm:top-7"><AuthLangSwitcher /></div>

      {/* 内容区：大屏左右分布，小屏仅卡片居中 */}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center gap-16 px-6 py-16 lg:justify-between lg:px-10">
        <BrandHero />

        {/* 浮动登录卡 */}
        <div className="mx-auto w-full max-w-[420px] lg:mx-0">
          <div className="rounded-2xl border border-white/60 bg-white/95 p-7 shadow-2xl shadow-slate-950/40 backdrop-blur-sm sm:p-9">
            {/* 卡内品牌标 */}
            <div className="mb-6 flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-sm font-bold text-white">T</div>
              <span className="text-[15px] font-semibold text-slate-900">Tymoe</span>
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{heading}</h2>
            <div className="mt-1.5 text-sm text-slate-500">{sub}</div>
            <div className="mt-7">{children}</div>
          </div>

          {/* 小屏下的注册引导 */}
          <p className="mt-5 text-center text-sm text-slate-400 lg:hidden">
            {t('auth.login.noAccount')}{' '}
            <button type="button" onClick={() => navigate('/register')} className="font-medium text-amber-300 underline underline-offset-4 hover:text-amber-200">
              {t('auth.login.registerNow')}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

const submitBtn = 'h-12 w-full rounded-xl! text-[15px]'

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
      else setError('邮箱或密码错误，请重试')
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

  if (showForgotPassword) {
    const fpSuccess = forgotPasswordMessage.includes('发送') || forgotPasswordMessage.includes('已发送') || forgotPasswordMessage.includes('成功')
    return (
      <Shell
        heading={forgotPasswordStep === 'email' ? t('auth.forgotPassword.title') : '重置密码'}
        sub={forgotPasswordStep === 'email' ? t('auth.forgotPassword.description') : `验证码已发送到 ${forgotPasswordEmail}`}
      >
        {forgotPasswordStep === 'email' ? (
          <div className="space-y-5">
            <div>
              <FieldLabel>{t('auth.login.email')}</FieldLabel>
              <IconInput icon={<Mail className="h-4 w-4" />} value={fpEmail} onChange={setFpEmail} placeholder={t('auth.login.emailPlaceholder')} />
            </div>
            {forgotPasswordMessage && <AlertBox type={fpSuccess ? 'success' : 'error'} title={forgotPasswordMessage} />}
            <Btn variant="primary" className={submitBtn} loading={forgotPasswordLoading} onClick={handleForgotPassword}>
              {t('auth.forgotPassword.sendButton')}
            </Btn>
            <Btn variant="link" className="w-full" onClick={() => setShowForgotPassword(false)}>{t('auth.forgotPassword.backToLogin')}</Btn>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <FieldLabel>验证码</FieldLabel>
              <IconInput icon={<KeyRound className="h-4 w-4" />} value={rsCode} onChange={setRsCode} placeholder="请输入6位验证码" maxLength={6} />
            </div>
            <div>
              <FieldLabel>新密码</FieldLabel>
              <IconInput icon={<Lock className="h-4 w-4" />} revealable value={rsNew} onChange={setRsNew} placeholder="请输入新密码" />
            </div>
            <div>
              <FieldLabel>确认密码</FieldLabel>
              <IconInput icon={<Lock className="h-4 w-4" />} revealable value={rsConfirm} onChange={setRsConfirm} placeholder="请再次输入新密码" />
            </div>
            {forgotPasswordMessage && <AlertBox type={forgotPasswordMessage.includes('成功') ? 'success' : 'error'} title={forgotPasswordMessage} />}
            <Btn variant="primary" className={submitBtn} loading={forgotPasswordLoading} onClick={handleResetPassword}>重置密码</Btn>
            <div className="flex justify-between">
              <Btn variant="link" onClick={() => { setForgotPasswordStep('email'); setForgotPasswordMessage('') }}>返回上一步</Btn>
              <Btn variant="link" onClick={() => { setShowForgotPassword(false); setForgotPasswordStep('email'); setForgotPasswordMessage('') }}>返回登录</Btn>
            </div>
          </div>
        )}
      </Shell>
    )
  }

  return (
    <Shell
      heading={t('auth.login.title')}
      sub={
        <span>
          {t('auth.login.noAccount')}{' '}
          <button type="button" onClick={() => navigate('/register')} className="font-medium text-slate-900 underline underline-offset-4 hover:text-slate-700">
            {t('auth.login.registerNow')}
          </button>
        </span>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel>{t('auth.login.email')}</FieldLabel>
          <IconInput icon={<Mail className="h-4 w-4" />} value={email} onChange={setEmail} onRawChange={handleEmailChange} placeholder={t('auth.login.emailPlaceholder')} />
        </div>

        <div>
          <FieldLabel>{t('auth.login.password')}</FieldLabel>
          <IconInput icon={<Lock className="h-4 w-4" />} revealable value={password} onChange={setPassword} placeholder={t('auth.login.passwordPlaceholder')} />
        </div>

        {/* 验证码组件 */}
        {turnstileSiteKey && (
          <div className="flex justify-center">
            <Turnstile siteKey={turnstileSiteKey} onSuccess={handleCaptchaSuccess} onError={handleCaptchaError} options={{ theme: 'light', size: 'flexible' }} />
          </div>
        )}

        {/* 固定高度提示区，有无提示都不改变卡片尺寸 */}
        <div className="h-8">
          {(fieldError || error) && (
            <div className="flex h-8 items-center gap-1.5 rounded-lg bg-red-50 px-3 text-xs font-medium text-red-600 ring-1 ring-red-100">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{fieldError || error}</span>
            </div>
          )}
          {success && !fieldError && !error && (
            <div className="flex h-8 items-center gap-1.5 rounded-lg bg-green-50 px-3 text-xs font-medium text-green-700 ring-1 ring-green-100">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{success}</span>
            </div>
          )}
        </div>

        <Btn variant="primary" className={submitBtn} loading={loading} onClick={handleLogin}>{t('auth.login.loginButton')}</Btn>

        {/* 分隔线 */}
        <div className="flex items-center gap-3 py-1 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          {t('common.or') || '或'}
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <Btn variant="secondary" className={submitBtn} onClick={() => setShowForgotPassword(true)}>{t('auth.login.forgotPassword')}</Btn>
      </div>
    </Shell>
  )
}

export default Login
