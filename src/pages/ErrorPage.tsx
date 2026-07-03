import React from 'react'
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom'
import { Btn } from '@/components/ui-kit'

interface RouteError {
  status?: number
  statusText?: string
  data?: any
  message?: string
}

const ErrorPage: React.FC = () => {
  const error = useRouteError() as RouteError
  const navigate = useNavigate()

  let errorStatus = 500
  let errorTitle = '应用发生错误'
  let errorSubtitle = '抱歉，应用遇到了一个意外错误'
  let errorDetails = ''

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status
    errorTitle = error.statusText || '错误'

    switch (error.status) {
      case 404:
        errorTitle = '页面未找到'
        errorSubtitle = '抱歉，您访问的页面不存在'
        break
      case 401:
        errorTitle = '未授权'
        errorSubtitle = '您需要登录才能访问此页面'
        break
      case 403:
        errorTitle = '禁止访问'
        errorSubtitle = '您没有权限访问此页面'
        break
      case 500:
        errorTitle = '服务器错误'
        errorSubtitle = '服务器遇到了一个错误'
        break
      default:
        errorSubtitle = `错误代码: ${error.status}`
    }

    if (error.data?.message) errorDetails = error.data.message
  } else if (error instanceof Error) {
    errorDetails = error.message
  }

  const handleGoBack = () => navigate(-1)
  const handleGoHome = () => navigate('/')
  const handleReload = () => window.location.reload()

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-12">
      <div className="text-center max-w-lg">
        <div className="text-7xl font-bold text-slate-300 mb-4">{errorStatus}</div>
        <h1 className="text-xl font-semibold text-slate-800 mb-2">{errorTitle}</h1>
        <p className="text-slate-500">{errorSubtitle}</p>

        {errorDetails && process.env.NODE_ENV === 'development' && (
          <details className="mt-5 p-3 bg-slate-50 rounded-md text-left">
            <summary className="cursor-pointer font-bold text-slate-700">错误详情（仅开发环境显示）</summary>
            <pre className="mt-2.5 text-xs whitespace-pre-wrap break-words max-h-52 overflow-auto text-slate-600">{errorDetails}</pre>
          </details>
        )}

        <div className="flex items-center justify-center gap-2.5 mt-6">
          <Btn variant="secondary" onClick={handleGoBack}>返回上一页</Btn>
          <Btn variant="primary" onClick={handleGoHome}>返回首页</Btn>
          <Btn variant="secondary" onClick={handleReload}>刷新页面</Btn>
        </div>
      </div>
    </div>
  )
}

export default ErrorPage
