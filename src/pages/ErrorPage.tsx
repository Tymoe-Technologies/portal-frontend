import React from 'react'
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Btn } from '@/components/ui-kit'

interface RouteError {
  status?: number
  statusText?: string
  data?: any
  message?: string
}

const ErrorPage: React.FC = () => {
  const { t } = useTranslation()
  const error = useRouteError() as RouteError
  const navigate = useNavigate()

  let errorStatus = 500
  let errorTitle = t('pages.errorPage.genericErrorTitle')
  let errorSubtitle = t('pages.errorPage.genericErrorSubtitle')
  let errorDetails = ''

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status
    errorTitle = error.statusText || t('pages.errorPage.errorTitle')

    switch (error.status) {
      case 404:
        errorTitle = t('pages.errorPage.notFoundTitle')
        errorSubtitle = t('pages.errorPage.notFoundSubtitle')
        break
      case 401:
        errorTitle = t('pages.errorPage.unauthorizedTitle')
        errorSubtitle = t('pages.errorPage.unauthorizedSubtitle')
        break
      case 403:
        errorTitle = t('pages.errorPage.forbiddenTitle')
        errorSubtitle = t('pages.errorPage.forbiddenSubtitle')
        break
      case 500:
        errorTitle = t('pages.errorPage.serverErrorTitle')
        errorSubtitle = t('pages.errorPage.serverErrorSubtitle')
        break
      default:
        errorSubtitle = t('pages.errorPage.errorCodeSubtitle', { code: error.status })
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
            <summary className="cursor-pointer font-bold text-slate-700">{t('pages.errorPage.errorDetailsSummary')}</summary>
            <pre className="mt-2.5 text-xs whitespace-pre-wrap break-words max-h-52 overflow-auto text-slate-600">{errorDetails}</pre>
          </details>
        )}

        <div className="flex items-center justify-center gap-2.5 mt-6">
          <Btn variant="secondary" onClick={handleGoBack}>{t('pages.errorPage.goBack')}</Btn>
          <Btn variant="primary" onClick={handleGoHome}>{t('pages.errorPage.goHome')}</Btn>
          <Btn variant="secondary" onClick={handleReload}>{t('pages.errorPage.reload')}</Btn>
        </div>
      </div>
    </div>
  )
}

export default ErrorPage
