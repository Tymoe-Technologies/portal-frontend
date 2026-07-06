import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Store, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useAuthContext } from '@/auth/AuthProvider'
import { createOrganization } from '@/services/auth'
import { Btn, SectionCard, Spinner } from '@/components/ui-kit'

// 首次登录无组织时显示的欢迎引导
function OnboardingGuide() {
  const { t } = useTranslation()
  const { refreshUser } = useAuthContext()
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleCreate = async () => {
    const name = orgName.trim()
    if (!name) { setError('请输入店铺名称'); return }
    if (name.length < 2) { setError('名称至少 2 个字符'); return }
    setError('')
    setLoading(true)
    try {
      const org = await createOrganization({ orgName: name, orgType: 'MAIN' }, 'beverage')
      localStorage.setItem('organization_id', org.id)
      setDone(true)
      // 刷新 AuthProvider 里的 user + organizations，让顶部切换器和导航更新
      await refreshUser()
    } catch (err: any) {
      setError(err?.response?.data?.detail || '创建失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 ring-1 ring-green-100">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">店铺创建成功！</h2>
        <p className="max-w-xs text-sm text-slate-500">你可以继续完善店铺信息，或直接开始配置菜单和订单。</p>
        <Btn variant="primary" icon={<ArrowRight className="h-4 w-4" />} onClick={() => window.location.reload()}>
          进入控制台
        </Btn>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* 图标 */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900">
            <Store className="h-7 w-7 text-white" />
          </div>
        </div>

        {/* 标题 */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            欢迎使用 Tymoe
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            先创建你的第一家店铺，只需要一个名字，其他信息可以稍后补充。
          </p>
        </div>

        {/* 表单卡片 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">店铺名称</label>
          <input
            type="text"
            value={orgName}
            onChange={e => { setOrgName(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="例：Tymoe 旗舰店"
            maxLength={100}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-900/5"
          />

          {/* 固定高度错误区 */}
          <div className="mt-2 h-4">
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          <Btn
            variant="primary"
            className="mt-3 h-11 w-full rounded-xl! text-[15px]"
            loading={loading}
            onClick={handleCreate}
          >
            创建店铺
            <ArrowRight className="ml-1 h-4 w-4" />
          </Btn>
        </div>

        {/* 跳过提示 */}
        <p className="mt-4 text-center text-xs text-slate-400">
          可以先{' '}
          <a href="/organizations" className="underline underline-offset-2 hover:text-slate-600">
            前往组织管理
          </a>
          {' '}进行更详细的配置
        </p>
      </div>
    </div>
  )
}

const Dashboard: React.FC = () => {
  const { t } = useTranslation()
  const { organizations, loading } = useAuthContext()
  // AuthProvider 有多个异步 effect 会延迟填充 organizations，
  // 用本地稳定计时器：AuthProvider loading 结束后再等 1.5s，
  // 若仍为空才认定是「真正无组织的新用户」，避免误显引导。
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (loading) { setSettled(false); return }
    const t = setTimeout(() => setSettled(true), 1500)
    return () => clearTimeout(t)
  }, [loading])

  if (!settled) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-6 w-6 text-slate-400" />
      </div>
    )
  }

  if (organizations.length === 0) {
    return <OnboardingGuide />
  }

  return (
    <SectionCard title={t('pages.dashboard.title')}>
      <p className="text-sm text-slate-500">{t('pages.dashboard.desc')}</p>
    </SectionCard>
  )
}

export default Dashboard
