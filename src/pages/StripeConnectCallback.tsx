import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import { getStripeConnectStatus } from '@/services/payment-provider'
import { Btn, Spinner } from '@/components/ui-kit'

/**
 * Stripe Connect Onboarding 回调页面
 *
 * 用途：
 * 1. /merchants/stripe/complete - 商家完成 Stripe onboarding 后返回
 * 2. /merchants/stripe/reauth - 商家需要重新认证时返回
 */
const StripeConnectCallback: React.FC = () => {
  useSearchParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'success' | 'pending' | 'error'>('pending')
  const [message, setMessage] = useState('')

  const isReauth = window.location.pathname.includes('reauth')

  useEffect(() => {
    checkStripeStatus()
  }, [])

  const checkStripeStatus = async () => {
    try {
      setLoading(true)
      const tenantId = localStorage.getItem('organization_id')
      if (!tenantId) {
        setStatus('error')
        setMessage('无法获取商家信息，请重新登录')
        setLoading(false)
        return
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
      const stripeStatus = await getStripeConnectStatus(tenantId)

      if (stripeStatus.status === 'active' && stripeStatus.chargesEnabled) {
        setStatus('success')
        setMessage('Stripe 账户设置成功！您现在可以接收在线支付了。')
      } else if (stripeStatus.status === 'pending' || !stripeStatus.onboardingCompleted) {
        setStatus('pending')
        setMessage('您的 Stripe 账户正在审核中，请稍后再试。或者可能还需要补充一些信息。')
      } else {
        setStatus('error')
        setMessage('Stripe 账户设置失败，请联系客服或重新尝试。')
      }
    } catch (error: any) {
      console.error('[Stripe Callback] 检查 Stripe 状态失败:', error)
      setStatus('error')
      setMessage(error.message || '检查 Stripe 状态失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleGoToSettings = () => navigate('/payment-settings')

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-100">
        <div className="w-[400px] bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
          <Spinner className="w-10 h-10 mx-auto text-slate-400" />
          <div className="mt-5 text-base text-slate-700">正在验证您的 Stripe 账户状态...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-100 p-5">
      <div className="max-w-xl w-full bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-14 h-14 mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-semibold text-slate-800 mb-1">Stripe 账户设置成功！</h2>
            <p className="text-slate-500 mb-6">{message}</p>
            <Btn variant="primary" onClick={handleGoToSettings}>前往支付设置</Btn>
          </>
        )}

        {status === 'pending' && (
          <>
            <RefreshCw className="w-14 h-14 mx-auto text-amber-500 mb-4 animate-spin" />
            <h2 className="text-xl font-semibold text-slate-800 mb-1">{isReauth ? 'Stripe 账户需要重新认证' : 'Stripe 账户设置进行中'}</h2>
            <p className="text-slate-500 mb-6">{message}</p>
            <div className="flex justify-center gap-2">
              <Btn variant="secondary" onClick={checkStripeStatus}>重新检查状态</Btn>
              <Btn variant="primary" onClick={handleGoToSettings}>前往支付设置</Btn>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-14 h-14 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-slate-800 mb-1">Stripe 账户设置失败</h2>
            <p className="text-slate-500 mb-6">{message}</p>
            <div className="flex justify-center gap-2">
              <Btn variant="secondary" onClick={checkStripeStatus}>重新检查状态</Btn>
              <Btn variant="primary" onClick={handleGoToSettings}>返回支付设置</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default StripeConnectCallback
