import React, { useEffect, useState } from 'react'
import { Mail, Lock, User as UserIcon, Store, ShieldCheck, KeyRound } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  getFranchiseInvitationPublic,
  acceptFranchiseInvitation,
  type FranchiseInvitationPublicInfo,
} from '../../services/auth'
import type { AddressSuggestion } from '../../services/address'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import AuthBackground from '../../components/AuthBackground'
import AddressAutocomplete from '../../components/AddressAutocomplete'
import { Btn, AlertBox, Spinner } from '@/components/ui-kit'

const PWD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/

// PIN 码是登录 POS 用的 4 位数字，跟员工账号一样由系统随机生成，不给自己选（防止选 1234 这类弱码）
function generatePinCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

function getContextValue(context: Array<{ id: string; text: string }> | undefined, prefix: string): string {
  return context?.find(c => c.id.startsWith(prefix))?.text || ''
}

function IconInput({ icon, type = 'text', value, onChange, placeholder, maxLength, disabled }: {
  icon?: React.ReactNode
  type?: string
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  maxLength?: number
  disabled?: boolean
}) {
  return (
    <div className="relative">
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={`w-full h-10 rounded-lg border border-slate-200 ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-700'} ${icon ? 'pl-10' : 'pl-3'} pr-3 text-sm focus:outline-2 focus:outline-slate-900 focus:outline-offset-0`}
      />
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-slate-600 mb-1.5">{children}</div>
}

type LoadState = 'loading' | 'ready' | 'invalid'

const FranchiseInvitationAccept: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { token } = useParams<{ token: string }>()

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [invitation, setInvitation] = useState<FranchiseInvitationPublicInfo | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // 门店信息
  const [orgName, setOrgName] = useState('')
  const [location, setLocation] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [province, setProvince] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('')
  const [latitude, setLatitude] = useState<number | undefined>()
  const [longitude, setLongitude] = useState<number | undefined>()
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  // 账号信息（加盟店 owner 是 User 身份：邮箱+密码登录 Portal，PIN 码登录 POS，
  // 不再需要 username/accountCode——那是 Account 员工账号的概念）
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  // PIN 码不给自己输入，系统随机生成，提交成功后展示一次
  const [generatedPinCode, setGeneratedPinCode] = useState('')
  // 挂靠到已有账号时，提交的 pinCode 可能被后端忽略（对方已经有 PIN 了），要按实际结果展示
  const [pinCodeApplied, setPinCodeApplied] = useState(true)

  useEffect(() => {
    if (!token) { setLoadState('invalid'); return }
    (async () => {
      try {
        const info = await getFranchiseInvitationPublic(token)
        setInvitation(info)
        setEmail(info.email)
        setOrgName(info.proposedOrgName || '')
        setLoadState('ready')
      } catch {
        setLoadState('invalid')
      }
    })()
  }, [token])

  const handleAddressSelect = (address: AddressSuggestion) => {
    const houseNumber = (address as any).address || ''
    const streetName = (address as any).text || ''
    setStreet(houseNumber ? `${houseNumber} ${streetName}` : streetName)
    setCity(getContextValue(address.context, 'place'))
    setProvince(getContextValue(address.context, 'region'))
    setPostalCode(getContextValue(address.context, 'postcode'))
    setCountry(getContextValue(address.context, 'country'))
    setLatitude(parseFloat(address.lat))
    setLongitude(parseFloat(address.lon))
  }

  const emailHasAccount = !!invitation?.emailHasAccount

  const handleSubmit = async () => {
    if (!token) return
    if (!orgName.trim()) { setError(t('franchiseInvitationAccept.orgNameRequired')); return }
    if (!password) { setError(t('franchiseInvitationAccept.passwordMinLength')); return }
    if (!emailHasAccount) {
      // 新建账号：这里才是真正设置新密码，需要强度和二次确认校验
      if (password.length < 8) { setError(t('franchiseInvitationAccept.passwordMinLength')); return }
      if (!PWD_RE.test(password)) { setError(t('franchiseInvitationAccept.passwordPattern')); return }
      if (password !== confirmPassword) { setError(t('franchiseInvitationAccept.confirmPasswordMismatch')); return }
    }
    setSubmitting(true)
    setError('')
    try {
      const pinCode = generatePinCode()
      const result = await acceptFranchiseInvitation(token, {
        orgName: orgName.trim(),
        street: street.trim() || undefined,
        city: city.trim() || undefined,
        province: province.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        country: country.trim() || undefined,
        latitude,
        longitude,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        password,
        pinCode,
        name: name.trim() || undefined,
      })
      setGeneratedPinCode(pinCode)
      setPinCodeApplied(result.pinCodeApplied)
      setSuccess(true)
    } catch (err: any) {
      const code = err?.response?.data?.error
      if (code === 'invalid_credentials') setError(t('franchiseInvitationAccept.wrongPassword'))
      else if (err?.response?.data?.detail) setError(err.response.data.detail)
      else setError(t('franchiseInvitationAccept.submitFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <AuthBackground />
      <div className="min-h-screen bg-transparent">
        <div className="fixed top-6 right-6 z-[1000]"><LanguageSwitcher /></div>
        <div className="flex items-center justify-center min-h-screen px-4 py-10">
          <div className="w-[560px] max-w-[95vw] bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] p-6">
            {loadState === 'loading' && (
              <div className="flex justify-center py-10"><Spinner /></div>
            )}

            {loadState === 'invalid' && (
              <AlertBox type="error" title={t('franchiseInvitationAccept.subtitle')} description={t('franchiseInvitationAccept.invalidInvitation')} />
            )}

            {loadState === 'ready' && invitation && !success && (
              <>
                {invitation.status !== 'PENDING' ? (
                  <AlertBox
                    type="error"
                    title={invitation.brand || ''}
                    description={t(`franchiseInvitationAccept.status${invitation.status}`)}
                  />
                ) : (
                  <div>
                    <div className="text-center mb-6">
                      <Store className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                      <h2 className="text-2xl font-semibold text-slate-800 m-0">
                        {t('franchiseInvitationAccept.title', { brand: invitation.brand })}
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">{t('franchiseInvitationAccept.subtitle')}</p>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('franchiseInvitationAccept.storeSectionTitle')}</h3>
                        <div className="space-y-4">
                          <div>
                            <FieldLabel>{t('franchiseInvitationAccept.orgName')}</FieldLabel>
                            <IconInput icon={<Store className="w-4 h-4" />} value={orgName} onChange={setOrgName} placeholder={t('franchiseInvitationAccept.orgNamePlaceholder')} />
                          </div>
                          <div>
                            <FieldLabel>{t('franchiseInvitationAccept.address')}</FieldLabel>
                            <AddressAutocomplete
                              value={location}
                              placeholder={t('franchiseInvitationAccept.addressPlaceholder')}
                              onChange={setLocation}
                              onSelect={handleAddressSelect}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <FieldLabel>{t('franchiseInvitationAccept.phone')}</FieldLabel>
                              <IconInput value={phone} onChange={setPhone} placeholder={t('franchiseInvitationAccept.phonePlaceholder')} />
                            </div>
                            <div>
                              <FieldLabel>{t('franchiseInvitationAccept.storeEmail')}</FieldLabel>
                              <IconInput icon={<Mail className="w-4 h-4" />} value={email} disabled placeholder={t('franchiseInvitationAccept.storeEmailPlaceholder')} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">
                          {t(emailHasAccount ? 'franchiseInvitationAccept.linkAccountSectionTitle' : 'franchiseInvitationAccept.accountSectionTitle')}
                        </h3>
                        {emailHasAccount && (
                          <AlertBox type="info" title="" description={t('franchiseInvitationAccept.linkAccountHint', { email: invitation.email })} />
                        )}
                        <div className="space-y-4 mt-3">
                          {!emailHasAccount && (
                            <div>
                              <FieldLabel>{t('franchiseInvitationAccept.name')}</FieldLabel>
                              <IconInput icon={<UserIcon className="w-4 h-4" />} value={name} onChange={setName} placeholder={t('franchiseInvitationAccept.namePlaceholder')} />
                            </div>
                          )}
                          <div className={emailHasAccount ? '' : 'grid grid-cols-2 gap-4'}>
                            <div>
                              <FieldLabel>{t(emailHasAccount ? 'franchiseInvitationAccept.existingPassword' : 'franchiseInvitationAccept.password')}</FieldLabel>
                              <IconInput icon={<Lock className="w-4 h-4" />} type="password" value={password} onChange={setPassword} placeholder={t(emailHasAccount ? 'franchiseInvitationAccept.existingPasswordPlaceholder' : 'franchiseInvitationAccept.passwordPlaceholder')} />
                            </div>
                            {!emailHasAccount && (
                              <div>
                                <FieldLabel>{t('franchiseInvitationAccept.confirmPassword')}</FieldLabel>
                                <IconInput icon={<Lock className="w-4 h-4" />} type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder={t('franchiseInvitationAccept.confirmPasswordPlaceholder')} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {error && <AlertBox type="error" title="" description={error} />}

                      <Btn variant="primary" className="w-full h-11 text-base" loading={submitting} onClick={handleSubmit}>
                        {t('franchiseInvitationAccept.submitButton')}
                      </Btn>
                    </div>
                  </div>
                )}
              </>
            )}

            {success && (
              <div className="text-center py-6">
                <ShieldCheck className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-slate-800 m-0 mb-2">{t('franchiseInvitationAccept.successTitle')}</h2>
                <p className="text-sm text-slate-500 mb-4">{t('franchiseInvitationAccept.successDescription')}</p>
                {pinCodeApplied ? (
                  <>
                    <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-6">
                      <KeyRound className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-600">{t('franchiseInvitationAccept.pinCode')}:</span>
                      <span className="text-lg font-mono font-semibold tracking-widest text-slate-800">{generatedPinCode}</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-4">{t('franchiseInvitationAccept.pinCodeSaveHint')}</p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 mb-6">{t('franchiseInvitationAccept.pinCodeUnchangedHint')}</p>
                )}
                <Btn variant="primary" onClick={() => navigate('/login')}>{t('franchiseInvitationAccept.goToLogin')}</Btn>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default FranchiseInvitationAccept
