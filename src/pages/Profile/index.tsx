import React, { useState, useEffect } from 'react'
import { User, Phone, Mail, Pencil, Check, X, Lock } from 'lucide-react'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import '../../styles/phone-input.css'
import { useTranslation } from 'react-i18next'
import { useAuthContext } from '../../auth/AuthProvider'
import { updateProfile, changePassword } from '../../services/auth'
import { changeOwnAccountPassword } from '../../services/account'
import { SectionCard, Btn, AlertBox, Field, TextInput } from '@/components/ui-kit'

const PHONE_RE = /^\+?[1-9]\d{1,14}$/

// 带左侧图标的输入框
function IconInput({ icon, value, onChange, placeholder, disabled }: {
  icon?: React.ReactNode
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div className="relative">
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
      <input
        value={value}
        disabled={disabled}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={`w-full h-10 rounded-lg border border-slate-200 ${icon ? 'pl-10' : 'pl-3'} pr-3 text-sm text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0 disabled:bg-slate-50 disabled:text-slate-400`}
      />
    </div>
  )
}

const Profile: React.FC = () => {
  const { t } = useTranslation()
  const { user, refreshUser } = useAuthContext()

  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  // 修改密码：USER 走 /identity/change-password，ACCOUNT（有 username，即开通了后台登录）
  // 走 /accounts/change-password；PIN-only 的员工账号没有密码，不显示这个区块
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  // 初始化表单数据
  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setPhone(user.phone || '')
    }
  }, [user])

  const handleEdit = () => { setEditing(true); setError(''); setSuccess('') }

  const handleCancel = () => {
    setEditing(false)
    setError('')
    setSuccess('')
    if (user) { setName(user.name || ''); setPhone(user.phone || '') }
  }

  const handleSave = async () => {
    if (!name || name.length < 2) { setError(t('pages.profile.nameMinLength')); return }
    if (phone && !PHONE_RE.test(phone)) { setError(t('pages.profile.phoneInvalid')); return }
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await updateProfile({ name, phone })
      await refreshUser()
      setSuccess(t('pages.profile.updateSuccess'))
      setEditing(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      if (error instanceof Error) setError(error.message)
      else setError(t('pages.profile.updateFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 新密码要满足的规则——跟后端 identity.ts/account.ts 的校验逻辑保持一致，
  // 前端实时勾选展示，避免提交后才发现某条没满足
  const passwordRules = [
    { key: 'passwordRuleLength', met: newPassword.length >= 8 },
    { key: 'passwordRuleUppercase', met: /[A-Z]/.test(newPassword) },
    { key: 'passwordRuleLowercase', met: /[a-z]/.test(newPassword) },
    { key: 'passwordRuleDigit', met: /\d/.test(newPassword) },
  ]
  const allPasswordRulesMet = passwordRules.every(r => r.met)

  const handleChangePassword = async () => {
    setPasswordError('')
    setPasswordSuccess('')
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('pages.profile.passwordRequired'))
      return
    }
    if (!allPasswordRulesMet) {
      setPasswordError(t('pages.profile.passwordRequirementsNotMet'))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('pages.profile.passwordMismatch'))
      return
    }
    setPasswordLoading(true)
    try {
      if (user?.userType === 'ACCOUNT') {
        await changeOwnAccountPassword(currentPassword, newPassword)
      } else {
        await changePassword(currentPassword, newPassword)
      }
      setPasswordSuccess(t('pages.profile.passwordChangeSuccess'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(''), 3000)
    } catch (error: any) {
      setPasswordError(error?.response?.data?.detail || error?.message || t('pages.profile.passwordChangeFailed'))
    } finally {
      setPasswordLoading(false)
    }
  }

  const getUserInitials = (name: string) => (name ? name.charAt(0).toUpperCase() : 'U')
  const formatDate = (dateString?: string) => (!dateString ? t('pages.profile.unknown') : new Date(dateString).toLocaleDateString())

  if (!user) {
    return <div className="p-6"><AlertBox type="error" title={t('pages.profile.noUserInfo')} /></div>
  }

  const emailVerified = user.emailVerified

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <SectionCard>
        {/* 头部信息 */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-slate-900 text-white text-3xl font-semibold flex items-center justify-center mx-auto mb-4">
            {getUserInitials(user.name)}
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 m-0">{user.name}</h2>
          <p className="text-slate-500">{user.email}</p>
        </div>

        <div className="border-t border-slate-100 my-6" />

        {/* 表单区域 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <div className="text-sm text-slate-600 mb-1.5">{t('pages.profile.name')}</div>
            <IconInput icon={<User className="w-4 h-4" />} value={name} onChange={setName} placeholder={t('pages.profile.namePlaceholder')} disabled={!editing} />
          </div>
          <div>
            <div className="text-sm text-slate-600 mb-1.5">{t('pages.profile.phone')}</div>
            {editing ? (
              <div className="border border-slate-200 rounded-lg px-2 py-1 flex items-center bg-white h-10 focus-within:outline-2 focus-within:outline-slate-900 focus-within:outline-offset-0">
                <PhoneInput
                  international
                  countryCallingCodeEditable={false}
                  defaultCountry="CA"
                  placeholder={t('pages.profile.phonePlaceholder')}
                  className="PhoneInput"
                  value={phone}
                  onChange={(value) => setPhone(value || '')}
                  style={{ border: 'none', width: '100%', height: '38px' }}
                />
              </div>
            ) : (
              <IconInput icon={<Phone className="w-4 h-4" />} value={phone} disabled />
            )}
          </div>
        </div>

        <div className="mt-6">
          <div className="text-sm text-slate-600 mb-1.5">{t('pages.profile.email')}</div>
          <IconInput icon={<Mail className="w-4 h-4" />} value={user.email} disabled />
        </div>

        {/* 消息提示 */}
        {error && <div className="mt-4"><AlertBox type="error" title={error} /></div>}
        {success && <div className="mt-4"><AlertBox type="success" title={success} /></div>}

        {/* 操作按钮 */}
        <div className="mt-6">
          {!editing ? (
            <Btn variant="primary" icon={<Pencil className="w-3.5 h-3.5" />} onClick={handleEdit}>{t('pages.profile.editProfile')}</Btn>
          ) : (
            <div className="flex gap-2">
              <Btn variant="primary" icon={<Check className="w-3.5 h-3.5" />} loading={loading} onClick={handleSave}>{t('pages.profile.saveProfile')}</Btn>
              <Btn variant="secondary" icon={<X className="w-3.5 h-3.5" />} onClick={handleCancel}>{t('pages.profile.cancel')}</Btn>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 my-6" />

        {/* 账户信息 */}
        <div>
          <h4 className="text-base font-semibold text-slate-800 mb-3">{t('pages.profile.accountInfo')}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-slate-500">{t('pages.profile.emailVerification')}</div>
              <div className={emailVerified ? 'text-green-600' : 'text-amber-600'}>
                {emailVerified ? t('pages.profile.verified') : t('pages.profile.unverified')}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500">{t('pages.profile.registerTime')}</div>
              <div className="text-slate-700">{formatDate(user.createdAt)}</div>
            </div>
          </div>
        </div>

        {/* 修改密码：PIN-only 的员工账号没有密码，不显示这个区块 */}
        {(user.userType === 'USER' || user.username) && (
          <>
            <div className="border-t border-slate-100 my-6" />
            <div>
              <h4 className="text-base font-semibold text-slate-800 mb-3">{t('pages.profile.changePassword')}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl">
                <div className="sm:col-span-2">
                  <Field label={t('pages.profile.currentPassword')}>
                    <TextInput type="password" value={currentPassword} onChange={setCurrentPassword} placeholder={t('pages.profile.currentPasswordPlaceholder')} />
                  </Field>
                </div>
                <div>
                  <Field label={t('pages.profile.newPassword')}>
                    <TextInput type="password" value={newPassword} onChange={setNewPassword} placeholder={t('pages.profile.newPasswordPlaceholder')} />
                  </Field>
                  {newPassword.length > 0 && (
                    <ul className="mt-4 space-y-1.5">
                      {passwordRules.map(rule => (
                        <li key={rule.key} className={`flex items-center gap-1.5 text-xs ${rule.met ? 'text-green-600' : 'text-slate-400'}`}>
                          {rule.met ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                          {t(`pages.profile.${rule.key}`)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Field label={t('pages.profile.confirmPassword')}>
                  <TextInput type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder={t('pages.profile.confirmPasswordPlaceholder')} />
                </Field>
              </div>

              {passwordError && <div className="mt-4 max-w-xl"><AlertBox type="error" title={passwordError} /></div>}
              {passwordSuccess && <div className="mt-4 max-w-xl"><AlertBox type="success" title={passwordSuccess} /></div>}

              <div className="mt-4">
                <Btn variant="primary" icon={<Lock className="w-3.5 h-3.5" />} loading={passwordLoading} onClick={handleChangePassword}>
                  {t('pages.profile.changePasswordBtn')}
                </Btn>
              </div>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  )
}

export default Profile
