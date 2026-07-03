import React, { useState } from 'react'
import { User, Lock, Mail, ShieldCheck } from 'lucide-react'
import { Turnstile } from '@marsidev/react-turnstile'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import '../../styles/phone-input.css'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { register, verifyEmail, resendVerificationCode, type RegisterPayload, type RegisterResponse, type EmailVerificationResponse } from '../../services/auth'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import AuthBackground from '../../components/AuthBackground'
import { Btn, AlertBox } from '@/components/ui-kit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PWD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/

type RegistrationStep = 'register' | 'verify'

// 带左侧图标的输入框
function IconInput({ icon, type = 'text', value, onChange, placeholder, maxLength, className }: {
  icon?: React.ReactNode
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  className?: string
}) {
  return (
    <div className="relative">
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full h-10 rounded-lg border border-slate-200 bg-white ${icon ? 'pl-10' : 'pl-3'} pr-3 text-sm text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0 ${className ?? ''}`}
      />
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-slate-600 mb-1.5">{children}</div>
}

const Register: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [, setCaptchaToken] = useState<string>('')
  const [step, setStep] = useState<RegistrationStep>('register')
  const [registeredEmail, setRegisteredEmail] = useState<string>('')
  const [resendLoading, setResendLoading] = useState(false)

  // 表单字段（受控）
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string

  const handleRegister = async () => {
    if (!email) { setError(t('auth.register.emailRequired')); return }
    if (!EMAIL_RE.test(email)) { setError(t('auth.register.emailInvalid')); return }
    if (!name || name.length < 2) { setError(t('auth.register.nameMinLength')); return }
    if (!password || password.length < 8) { setError(t('auth.register.passwordMinLength')); return }
    if (!PWD_RE.test(password)) { setError(t('auth.register.passwordPattern')); return }
    if (password !== confirmPassword) { setError(t('auth.register.confirmPasswordMismatch')); return }

    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const payload: RegisterPayload = { email, password, name, phone }
      const response: RegisterResponse = await register(payload, 'beauty')
      if (response.success) {
        setSuccess(response.message || t('auth.register.registrationSuccess'))
        setRegisteredEmail(email)
        setStep('verify')
        setError('')
      } else {
        setError('注册失败，请稍后重试')
      }
    } catch (error: any) {
      if (error?.response?.data?.detail) setError(error.response.data.detail)
      else if (error instanceof Error) setError(error.message)
      else setError('注册失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!code || !/^\d{6}$/.test(code)) { setError(t('auth.verify.codePattern')); return }
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const response: EmailVerificationResponse = await verifyEmail(registeredEmail, code)
      if (response.success) {
        setSuccess(response.message || t('auth.verify.verifySuccess'))
        setTimeout(() => {
          navigate('/login', { state: { message: t('auth.verify.loginMessage'), email: registeredEmail } })
        }, 2000)
      } else {
        setError(t('auth.verify.verifyFailed'))
      }
    } catch (error: any) {
      if (error?.response?.data?.detail) setError(error.response.data.detail)
      else if (error instanceof Error) setError(error.message)
      else setError('验证失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleBackToRegister = () => {
    setStep('register')
    setError('')
    setSuccess('')
    setRegisteredEmail('')
  }

  const handleResendCode = async () => {
    setResendLoading(true)
    setError('')
    setSuccess('')
    try {
      const response = await resendVerificationCode(registeredEmail, 'signup')
      if (response.success) setSuccess(response.message || '验证码已重新发送，请检查您的邮箱')
      else setError('重新发送失败，请稍后重试')
    } catch (error: any) {
      if (error?.response?.data?.detail) setError(error.response.data.detail)
      else if (error instanceof Error) setError(error.message)
      else setError('重新发送失败，请稍后重试')
    } finally {
      setResendLoading(false)
    }
  }

  const handleCaptchaSuccess = (token: string) => setCaptchaToken(token)
  const handleCaptchaError = () => { setCaptchaToken(''); setError(t('auth.register.captchaFailed')) }

  const cardW = step === 'register' ? 'w-[500px]' : 'w-[400px]'

  return (
    <>
      <AuthBackground />
      <div className="min-h-screen bg-transparent">
        <div className="fixed top-6 right-6 z-[1000]"><LanguageSwitcher /></div>
        <div className="flex items-center justify-center min-h-screen px-4 py-5">
          <div className={`${cardW} max-w-[95vw] bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] p-6`}>
            <div className={`text-center ${step === 'register' ? 'mb-6' : 'mb-8'}`}>
              <h2 className="text-2xl font-semibold text-slate-800 m-0">{step === 'register' ? t('auth.register.title') : t('auth.verify.title')}</h2>
              <p className="text-sm text-slate-500 mt-1">{step === 'register' ? t('auth.register.subtitle') : t('auth.verify.subtitle')}</p>
            </div>

            {step === 'register' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>{t('auth.register.email')}</FieldLabel>
                    <IconInput icon={<Mail className="w-4 h-4" />} value={email} onChange={setEmail} placeholder={t('auth.register.emailPlaceholder')} />
                  </div>
                  <div>
                    <FieldLabel>{t('auth.register.name')}</FieldLabel>
                    <IconInput icon={<User className="w-4 h-4" />} value={name} onChange={setName} placeholder={t('auth.register.namePlaceholder')} />
                  </div>
                </div>

                <div>
                  <FieldLabel>{t('auth.register.phone')}</FieldLabel>
                  <div className="phone-input-wrapper border border-slate-200 rounded-lg overflow-hidden h-10 flex items-center bg-white focus-within:outline-2 focus-within:outline-slate-900 focus-within:outline-offset-0">
                    <PhoneInput
                      international
                      countryCallingCodeEditable={false}
                      defaultCountry="CA"
                      placeholder={t('auth.register.phonePlaceholder')}
                      className="PhoneInput"
                      style={{ border: 'none', width: '100%', height: '38px' }}
                      value={phone}
                      onChange={(value) => setPhone(value || '')}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>{t('auth.register.password')}</FieldLabel>
                    <IconInput icon={<Lock className="w-4 h-4" />} type="password" value={password} onChange={setPassword} placeholder={t('auth.register.passwordPlaceholder')} />
                  </div>
                  <div>
                    <FieldLabel>{t('auth.register.confirmPassword')}</FieldLabel>
                    <IconInput icon={<Lock className="w-4 h-4" />} type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder={t('auth.register.confirmPasswordPlaceholder')} />
                  </div>
                </div>

                {turnstileSiteKey && (
                  <div className="flex justify-center">
                    <Turnstile siteKey={turnstileSiteKey} onSuccess={handleCaptchaSuccess} onError={handleCaptchaError} options={{ theme: 'light', size: 'flexible' }} />
                  </div>
                )}

                {error && <AlertBox type="error" description={error} />}
                {success && <AlertBox type="success" description={success} />}

                <Btn variant="primary" className="w-full h-11 text-base" loading={loading} onClick={handleRegister}>{t('auth.register.registerButton')}</Btn>

                {/* 临时测试按钮 */}
                <Btn variant="secondary" className="w-full" onClick={() => {
                  const testEmail = email || 'test@example.com'
                  setRegisteredEmail(testEmail)
                  setStep('verify')
                  setSuccess('测试模式：跳转到验证步骤')
                }}>🧪 测试验证界面</Btn>

                <div className="text-center">
                  <span className="text-slate-500 mr-2 text-sm">{t('auth.register.hasAccount')}</span>
                  <Btn variant="link" onClick={() => navigate('/login')}>{t('auth.register.backToLogin')}</Btn>
                </div>
              </div>
            ) : (
              // 验证码验证页面
              <div>
                <div className="mb-6 text-center">
                  <ShieldCheck className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                  <div className="mb-2"><span className="font-semibold text-base text-slate-800">{t('auth.verify.description')}</span></div>
                  <div className="mb-4"><span className="text-sm text-slate-500">{registeredEmail}</span></div>
                  <span className="text-sm text-slate-500">{t('auth.verify.instruction')}</span>
                </div>

                <div className="space-y-5">
                  <div>
                    <FieldLabel>{t('auth.verify.code')}</FieldLabel>
                    <input
                      value={code}
                      maxLength={6}
                      onChange={e => setCode(e.target.value)}
                      placeholder={t('auth.verify.codePlaceholder')}
                      className="w-full h-[50px] rounded-lg border border-slate-200 bg-white px-3 text-center text-lg tracking-[4px] text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
                    />
                  </div>

                  {error && <AlertBox type="error" description={error} />}
                  {success && <AlertBox type="success" description={success} />}

                  <Btn variant="primary" className="w-full h-11 text-base" loading={loading} onClick={handleVerify}>{t('auth.verify.verifyButton')}</Btn>
                  <Btn variant="secondary" className="w-full" loading={resendLoading} disabled={loading} onClick={handleResendCode}>重新发送验证码</Btn>
                  <div className="text-center">
                    <Btn variant="link" disabled={loading} onClick={handleBackToRegister}>{t('auth.verify.backToRegister')}</Btn>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default Register
