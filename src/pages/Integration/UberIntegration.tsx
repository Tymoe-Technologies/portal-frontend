import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CheckCircle2, Unplug, Store as StoreIcon, Info, RefreshCw, Search,
} from 'lucide-react'
import { uberService, UberIntegrationStatus, UberStore, UberActivatedStore } from '@/services/uber'
import StoreManagement from './StoreManagement'
import MenuSync from './MenuSync'
import {
  PageHeader, SectionCard, Btn, Badge, AlertBox, Spinner, EmptyState,
  Modal, ConfirmDialog, Tabs,
} from '@/components/ui-kit'

/**
 * Uber 集成配置页面
 * 允许商家连接/断开 Uber 账户，以及选择和管理店铺
 */
const UberIntegration: React.FC = () => {
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(false)
  const [integrationStatus, setIntegrationStatus] = useState<UberIntegrationStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [showDetailedStatus, setShowDetailedStatus] = useState(false)

  // 店铺选择相关状态
  const [showStoreSelection, setShowStoreSelection] = useState(false)
  const [stores, setStores] = useState<UberStore[]>([])
  const [storesLoading, setStoresLoading] = useState(false)
  const [activatedStore, setActivatedStore] = useState<UberActivatedStore | null>(null)
  const [activatingStoreId, setActivatingStoreId] = useState<string | null>(null)

  // 弹窗
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [confirmUnbind, setConfirmUnbind] = useState(false)
  const [debugData, setDebugData] = useState<any | null>(null)
  const [innerTab, setInnerTab] = useState('store')

  const merchantId = localStorage.getItem('organization_id') || ''

  const loadIntegrationStatus = async () => {
    if (!merchantId) {
      setErrorMessage('无法获取商家 ID')
      setStatusLoading(false)
      return
    }
    try {
      setStatusLoading(true)
      const status = await uberService.getIntegrationStatus(merchantId)
      setIntegrationStatus(status)
      if (status.isConnected) setErrorMessage('')
    } catch {
      // 优雅降级：假设未连接
      setIntegrationStatus({ isConnected: false })
    } finally {
      setStatusLoading(false)
    }
  }

  // 处理 OAuth 回调参数
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (success === 'true') {
      setSuccessMessage('Uber 连接成功！')
      window.history.replaceState({}, document.title, window.location.pathname)
      setTimeout(() => { loadIntegrationStatus(); setSuccessMessage('') }, 2000)
    } else if (error) {
      setErrorMessage(`授权失败: ${errorDescription || error}`)
      window.history.replaceState({}, document.title, window.location.pathname)
      setTimeout(() => setErrorMessage(''), 5000)
    }
  }, [searchParams])

  const loadAvailableStores = async () => {
    if (!merchantId || !integrationStatus?.isConnected) return
    try {
      setStoresLoading(true)
      const availableStores = await uberService.discoverStores(merchantId)
      setStores(availableStores)
      const activated = await uberService.getActivatedStore(merchantId)
      setActivatedStore(activated)
    } catch (error: any) {
      setErrorMessage(error.message || '加载店铺列表失败')
    } finally {
      setStoresLoading(false)
    }
  }

  const handleSelectStore = async (store: UberStore) => {
    if (!merchantId) { setErrorMessage('无法获取商家 ID'); return }
    try {
      setActivatingStoreId(store.id)
      await uberService.selectAndActivateStore(merchantId, store.id, store.name, store)
      setSuccessMessage(`店铺 "${store.name}" 已成功激活！`)
      setTimeout(() => { loadAvailableStores(); setShowStoreSelection(false); setSuccessMessage('') }, 1500)
    } catch (error: any) {
      setErrorMessage(error.message || '激活店铺失败')
    } finally {
      setActivatingStoreId(null)
    }
  }

  const handleUnbindStore = async () => {
    if (!merchantId) return
    try {
      setLoading(true)
      await uberService.unbindStore(merchantId)
      setSuccessMessage('店铺已解绑')
      setActivatedStore(null)
      setTimeout(() => { setSuccessMessage(''); loadAvailableStores() }, 1500)
    } catch (error: any) {
      setErrorMessage(error.message || '解绑店铺失败')
    } finally {
      setLoading(false)
      setConfirmUnbind(false)
    }
  }

  useEffect(() => { loadIntegrationStatus() }, [merchantId])
  useEffect(() => { loadAvailableStores() }, [integrationStatus?.isConnected, merchantId])

  const handleDebugStores = async () => {
    if (!merchantId) { setErrorMessage('无法获取商家 ID'); return }
    try {
      setStoresLoading(true)
      const backendUrl = uberService.getBaseUrl()
      const response = await fetch(`${backendUrl}/api/uber/v1/stores/debug`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
        body: JSON.stringify({ merchantId }),
      })
      const data = await response.json()
      setDebugData(data.debug || {})
    } catch (error: any) {
      setErrorMessage('诊断失败: ' + error.message)
    } finally {
      setStoresLoading(false)
    }
  }

  const handleConnectUber = async () => {
    if (!merchantId) { setErrorMessage('无法获取商家 ID'); return }
    try {
      setConnecting(true)
      const authorizationUrl = await uberService.generateAuthorizationUrl(merchantId)
      window.location.href = authorizationUrl
    } catch (error: any) {
      setErrorMessage(error.message || '生成授权 URL 失败')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!merchantId) return
    try {
      setLoading(true)
      await uberService.disconnect(merchantId)
      setSuccessMessage('Uber 连接已断开')
      setIntegrationStatus(null)
      setTimeout(() => setSuccessMessage(''), 3000)
      await loadIntegrationStatus()
    } catch (error: any) {
      setErrorMessage(error.message || '断开连接失败')
    } finally {
      setLoading(false)
      setConfirmDisconnect(false)
    }
  }

  // ── 内容 ───────────────────────────────────────────────────

  const renderContent = () => {
    if (statusLoading) return <Spinner />

    if (!integrationStatus?.isConnected) {
      return (
        <SectionCard>
          <EmptyState
            icon={<StoreIcon className="w-10 h-10" />}
            title="未连接 Uber"
            description="连接您的 Uber 账户以启用订单、菜单和商店管理功能"
            action={<Btn variant="primary" loading={connecting} onClick={handleConnectUber}>连接 Uber</Btn>}
          />
        </SectionCard>
      )
    }

    return (
      <div className="space-y-4">
        {/* 连接状态条 */}
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="font-medium text-slate-800">Uber 已连接</span>
            </div>
            <div className="flex items-center gap-3">
              {integrationStatus.lastUsedAt && (
                <span className="text-xs text-slate-400" title={new Date(integrationStatus.lastUsedAt).toLocaleString('zh-CN')}>
                  最后使用: {new Date(integrationStatus.lastUsedAt).toLocaleDateString('zh-CN')}
                </span>
              )}
              <button
                onClick={() => setShowDetailedStatus(v => !v)}
                className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
                title="详细信息"
              >
                <Info className="w-4 h-4" />
              </button>
              <button
                onClick={() => setConfirmDisconnect(true)}
                className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                title="断开 Uber 连接"
              >
                <Unplug className="w-4 h-4" />
              </button>
            </div>
          </div>
          {showDetailedStatus && integrationStatus.connectedAt && (
            <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400">
              连接时间: {new Date(integrationStatus.connectedAt).toLocaleString('zh-CN')}
            </div>
          )}
        </div>

        {/* 店铺管理 */}
        <SectionCard title={<span className="inline-flex items-center gap-2"><StoreIcon className="w-4 h-4 text-slate-400" />店铺管理</span>}>
          {activatedStore ? (
            <div>
              {/* 店铺信息 */}
              <div className="pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium text-slate-700">店铺：</span>
                  <Badge variant="green">{activatedStore.storeName}</Badge>
                  <div className="ml-auto">
                    <Btn variant="ghost" size="sm" loading={loading} onClick={() => setConfirmUnbind(true)}>解绑</Btn>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activatedStore.storeEmail && (
                    <div>
                      <div className="text-xs text-slate-400">邮箱</div>
                      <div className="text-sm text-slate-700 mt-0.5">{activatedStore.storeEmail}</div>
                    </div>
                  )}
                  {activatedStore.storeAddress && (
                    <div>
                      <div className="text-xs text-slate-400">地址</div>
                      <div className="text-sm text-slate-700 mt-0.5">{activatedStore.storeAddress}</div>
                    </div>
                  )}
                  {activatedStore.cuisines && activatedStore.cuisines.length > 0 && (
                    <div className="sm:col-span-2">
                      <div className="text-xs text-slate-400 mb-1">菜系</div>
                      <div className="flex flex-wrap gap-1.5">
                        {activatedStore.cuisines.map(c => <Badge key={c} variant="blue">{c}</Badge>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 功能标签页 */}
              <Tabs
                value={innerTab}
                onChange={setInnerTab}
                items={[
                  { key: 'store', label: '店铺管理', icon: <StoreIcon className="w-4 h-4" /> },
                  { key: 'menu', label: '菜单同步', icon: <RefreshCw className="w-4 h-4" /> },
                ]}
              />
              <div className="mt-4">
                {innerTab === 'store' ? (
                  <StoreManagement
                    merchantId={merchantId}
                    storeId={activatedStore.storeId}
                    storeName={activatedStore.storeName}
                  />
                ) : (
                  <MenuSync
                    merchantId={merchantId}
                    storeId={activatedStore.storeId}
                    storeName={activatedStore.storeName}
                    integrationId={activatedStore.integrationId}
                  />
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<StoreIcon className="w-10 h-10" />}
              title="还未绑定任何店铺"
              action={
                <div className="flex items-center gap-2">
                  <Btn variant="primary" icon={<StoreIcon className="w-3.5 h-3.5" />} loading={storesLoading} onClick={() => { setShowStoreSelection(true); loadAvailableStores() }}>
                    选择店铺
                  </Btn>
                  <Btn variant="secondary" icon={<Search className="w-3.5 h-3.5" />} loading={storesLoading} onClick={handleDebugStores}>诊断</Btn>
                </div>
              }
            />
          )}
        </SectionCard>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <PageHeader title="Uber 集成" description="连接 Uber 账户以启用订单管理、菜单同步和商店信息管理功能。" />

      <div className="space-y-4">
        {successMessage && <AlertBox type="success" title={successMessage} />}
        {errorMessage && <AlertBox type="error" title={errorMessage} />}
        {renderContent()}
      </div>

      {/* 店铺选择弹窗 */}
      <Modal
        open={showStoreSelection}
        onOpenChange={v => !v && setShowStoreSelection(false)}
        title="选择和绑定店铺"
        size="lg"
        footer={
          <>
            <Btn variant="ghost" icon={<Search className="w-3.5 h-3.5" />} loading={storesLoading} onClick={handleDebugStores}>诊断店铺列表</Btn>
            <div className="flex-1" />
            <Btn variant="secondary" onClick={() => setShowStoreSelection(false)}>关闭</Btn>
          </>
        }
      >
        {storesLoading ? (
          <Spinner />
        ) : stores.length === 0 ? (
          <EmptyState title="没有可用的店铺" />
        ) : (
          <div className="space-y-2">
            {stores.map(store => (
              <div key={store.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <StoreIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{store.name}</span>
                    {activatedStore?.storeId === store.id && <Badge variant="green">当前绑定</Badge>}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 space-y-0.5">
                    {store.email && <div>📧 {store.email}</div>}
                    {store.address && <div>📍 {store.address}</div>}
                    {store.cuisines && store.cuisines.length > 0 && <div>🍴 {store.cuisines.join(', ')}</div>}
                  </div>
                </div>
                <Btn
                  variant="primary"
                  size="sm"
                  loading={activatingStoreId === store.id}
                  disabled={activatingStoreId !== null}
                  onClick={() => handleSelectStore(store)}
                >
                  绑定此店铺
                </Btn>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* 诊断结果弹窗 */}
      <Modal open={!!debugData} onOpenChange={v => !v && setDebugData(null)} title="店铺列表诊断结果" size="lg">
        {debugData && <DebugResult debug={debugData} />}
      </Modal>

      {/* 断开连接确认 */}
      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title="断开 Uber 连接"
        description="确定要断开 Uber 连接吗？断开后，您将无法在此平台上使用 Uber 订单服务。"
        confirmText="确定断开"
        danger
        loading={loading}
        onConfirm={handleDisconnect}
      />

      {/* 解绑店铺确认 */}
      <ConfirmDialog
        open={confirmUnbind}
        onOpenChange={setConfirmUnbind}
        title="解绑店铺"
        description={`确定要解绑店铺 "${activatedStore?.storeName ?? ''}" 吗？解绑后可以绑定其他店铺。`}
        confirmText="确定解绑"
        danger
        loading={loading}
        onConfirm={handleUnbindStore}
      />
    </div>
  )
}

// 诊断结果展示
const DebugResult: React.FC<{ debug: any }> = ({ debug }) => {
  const database = debug.database || {}
  const uber = debug.uber || {}
  const hasStores = uber.storesFound > 0

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-start gap-3 py-1.5 border-b border-slate-100 last:border-0 text-sm">
      <span className="w-40 shrink-0 text-slate-400">{label}</span>
      <span className="text-slate-700 min-w-0 break-all">{children}</span>
    </div>
  )

  return (
    <div className="space-y-4 text-sm">
      <AlertBox
        type={hasStores ? 'success' : 'warning'}
        title={hasStores ? '店铺检测成功' : '未检测到店铺'}
        description={hasStores ? `检测到 ${uber.storesFound} 个店铺` : '未从 Uber API 获取到任何店铺'}
      />

      <div>
        <p className="font-medium text-slate-700 mb-1">📊 数据库状态</p>
        <div className="rounded-lg border border-slate-200 px-3 py-1">
          <Row label="集成已创建">{database.hasMerchantIntegration ? '✅ 是' : '❌ 否'}</Row>
          <Row label="Access Token">{database.hasAccessToken ? '✅ 已保存' : '❌ 缺失'}</Row>
          <Row label="Token 过期时间">{database.tokenExpiresAt ? new Date(database.tokenExpiresAt).toLocaleString() : '无'}</Row>
          <Row label="Token 有效性">{database.tokenValid ? '✅ 有效' : '❌ 已过期或无效'}</Row>
          <Row label="已绑定店铺">{database.platformStoreId ? `${database.platformStoreName} (${database.platformStoreId})` : '未绑定'}</Row>
        </div>
      </div>

      <div>
        <p className="font-medium text-slate-700 mb-1">🌐 Uber API 响应</p>
        <div className="rounded-lg border border-slate-200 px-3 py-1">
          <Row label="检测到的店铺数"><strong>{uber.storesFound ?? 0}</strong></Row>
          {uber.storesFound > 0 && (
            <Row label="店铺列表">
              <div className="space-y-0.5">
                {uber.stores?.map((s: any) => <div key={s.id}>{s.name} ({s.id})</div>)}
              </div>
            </Row>
          )}
          {uber.error && <Row label="错误信息"><span className="text-red-600">{uber.error}</span></Row>}
          {uber.errorDetails && (
            <Row label="错误详情">
              <pre className="text-[11px] text-red-600 overflow-auto max-w-full">{JSON.stringify(uber.errorDetails, null, 2)}</pre>
            </Row>
          )}
        </div>
      </div>

      {!hasStores && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-800">
          <p className="font-medium mb-1">💡 可能的原因和解决方案</p>
          <ul className="list-disc pl-5 space-y-1 text-[13px]">
            <li><strong>最可能：</strong>你的 Uber Eats 账户中还没有添加任何店铺</li>
            <li>
              检查步骤：访问 <a href="https://partners.uber.com" target="_blank" rel="noopener noreferrer" className="underline">partners.uber.com</a> → 登录 → 在 "Stores"/"Restaurants" 中检查是否有店铺 → 若没有请先创建 → 然后重新授权此应用
            </li>
            <li>如果已有店铺但仍无法显示，可能是权限问题，请重新授权</li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default UberIntegration
