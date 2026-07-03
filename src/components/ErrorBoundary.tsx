import React, { ReactNode, ReactElement } from 'react'
import { Btn } from '@/components/ui-kit'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: { componentStack: string } | null
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
    }
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // 记录错误到控制台和错误追踪服务
    console.error('❌ ErrorBoundary caught an error:', error)
    console.error('📍 Component Stack:', errorInfo.componentStack)

    this.setState({
      error,
      errorInfo,
    })

    // 可以在这里集成错误追踪服务（如 Sentry）
    // logErrorToService(error, errorInfo)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  render(): ReactElement {
    if (this.state.hasError) {
      return (
        <div className="px-5 py-12 min-h-screen flex items-center justify-center">
          <div className="text-center max-w-lg">
            <div className="text-7xl font-bold text-slate-300 mb-4">500</div>
            <h1 className="text-xl font-semibold text-slate-800 mb-2">应用发生错误</h1>
            <p className="text-slate-500">抱歉，应用遇到了一个意外错误，请尝试刷新页面或返回重试。</p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-5 p-3 bg-slate-50 rounded-md text-left max-h-72 overflow-auto">
                <summary className="cursor-pointer font-bold text-slate-700">错误详情（仅开发环境显示）</summary>
                <pre className="mt-2.5 text-xs whitespace-pre-wrap break-words text-slate-600">
                  <strong>错误信息：</strong>
                  {this.state.error.toString()}
                  {'\n\n'}
                  <strong>堆栈跟踪：</strong>
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex items-center justify-center gap-2.5 mt-6">
              <Btn variant="primary" onClick={this.handleReset}>返回并重试</Btn>
              <Btn variant="secondary" onClick={this.handleReload}>刷新页面</Btn>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children as ReactElement
  }
}

export default ErrorBoundary
