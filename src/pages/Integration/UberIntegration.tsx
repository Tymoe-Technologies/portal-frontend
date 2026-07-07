import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      setErrorMessage(t('pages.uberIntegration.failedToGetMerchantId'))
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
      setSuccessMessage(t('pages.uberIntegration.connectSuccess'))
      window.history.replaceState({}, document.title, window.location.pathname)
      setTimeout(() => { loadIntegrationStatus(); setSuccessMessage('') }, 2000)
    } else if (error) {
      setErrorMessage(t('pages.uberIntegration.authFailed', { reason: errorDescription || error }))
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
      setErrorMessage(error.message || t('pages.uberIntegration.loadStoresFailed'))
    } finally {
      setStoresLoading(false)
    }
  }

  const handleSelectStore = async (store: UberStore) => {
    if (!merchantId) { setErrorMessage(t('pages.uberIntegration.failedToGetMerchantId')); return }
    try {
      setActivatingStoreId(store.id)
      await uberService.selectAndActivateStore(merchantId, store.id, store.name, store)
      setSuccessMessage(t('pages.uberIntegration.storeActivatedSuccess', { name: store.name }))
      setTimeout(() => { loadAvailableStores(); setShowStoreSelection(false); setSuccessMessage('') }, 1500)
    } catch (error: any) {
      setErrorMessage(error.message || t('pages.uberIntegration.activateStoreFailed'))
    } finally {
      setActivatingStoreId(null)
    }
  }

  const handleUnbindStore = async () => {
    if (!merchantId) return
    try {
      setLoading(true)
      await uberService.unbindStore(merchantId)
      setSuccessMessage(t('pages.uberIntegration.storeUnbound'))
      setActivatedStore(null)
      setTimeout(() => { setSuccessMessage(''); loadAvailableStores() }, 1500)
    } catch (error: any) {
      setErrorMessage(error.message || t('pages.uberIntegration.unbindStoreFailed'))
    } finally {
      setLoading(false)
      setConfirmUnbind(false)
    }
  }

  useEffect(() => { loadIntegrationStatus() }, [merchantId])
  useEffect(() => { loadAvailableStores() }, [integrationStatus?.isConnected, merchantId])

  const handleDebugStores = async () => {
    if (!merchantId) { setErrorMessage(t('pages.uberIntegration.failedToGetMerchantId')); return }
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
      setErrorMessage(t('pages.uberIntegration.diagnosisFailed', { message: error.message }))
    } finally {
      setStoresLoading(false)
    }
  }

  const handleConnectUber = async () => {
    if (!merchantId) { setErrorMessage(t('pages.uberIntegration.failedToGetMerchantId')); return }
    try {
      setConnecting(true)
      const authorizationUrl = await uberService.generateAuthorizationUrl(merchantId)
      window.location.href = authorizationUrl
    } catch (error: any) {
      setErrorMessage(error.message || t('pages.uberIntegration.generateAuthUrlFailed'))
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!merchantId) return
    try {
      setLoading(true)
      await uberService.disconnect(merchantId)
      setSuccessMessage(t('pages.uberIntegration.disconnectSuccess'))
      setIntegrationStatus(null)
      setTimeout(() => setSuccessMessage(''), 3000)
      await loadIntegrationStatus()
    } catch (error: any) {
      setErrorMessage(error.message || t('pages.uberIntegration.disconnectFailed'))
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
            title={t('pages.uberIntegration.notConnectedTitle')}
            description={t('pages.uberIntegration.notConnectedDescription')}
            action={<Btn variant="primary" loading={connecting} onClick={handleConnectUber}>{t('pages.uberIntegration.connectUberBtn')}</Btn>}
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
              <span className="font-medium text-slate-800">{t('pages.uberIntegration.connectedLabel')}</span>
            </div>
            <div className="flex items-center gap-3">
              {integrationStatus.lastUsedAt && (
                <span className="text-xs text-slate-400" title={new Date(integrationStatus.lastUsedAt).toLocaleString('zh-CN')}>
                  {t('pages.uberIntegration.lastUsed', { date: new Date(integrationStatus.lastUsedAt).toLocaleDateString('zh-CN') })}
                </span>
              )}
              <button
                onClick={() => setShowDetailedStatus(v => !v)}
                className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
                title={t('pages.uberIntegration.detailedInfo')}
              >
                <Info className="w-4 h-4" />
              </button>
              <button
                onClick={() => setConfirmDisconnect(true)}
                className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                title={t('pages.uberIntegration.disconnectUberTitle')}
              >
                <Unplug className="w-4 h-4" />
              </button>
            </div>
          </div>
          {showDetailedStatus && integrationStatus.connectedAt && (
            <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400">
              {t('pages.uberIntegration.connectedAt', { date: new Date(integrationStatus.connectedAt).toLocaleString('zh-CN') })}
            </div>
          )}
        </div>

        {/* 店铺管理 */}
        <SectionCard title={<span className="inline-flex items-center gap-2"><StoreIcon className="w-4 h-4 text-slate-400" />{t('pages.uberIntegration.storeManagementTitle')}</span>}>
          {activatedStore ? (
            <div>
              {/* 店铺信息 */}
              <div className="pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium text-slate-700">{t('pages.uberIntegration.storeLabel')}</span>
                  <Badge variant="green">{activatedStore.storeName}</Badge>
                  <div className="ml-auto">
                    <Btn variant="ghost" size="sm" loading={loading} onClick={() => setConfirmUnbind(true)}>{t('pages.uberIntegration.unbindBtn')}</Btn>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activatedStore.storeEmail && (
                    <div>
                      <div className="text-xs text-slate-400">{t('pages.uberIntegration.emailLabel')}</div>
                      <div className="text-sm text-slate-700 mt-0.5">{activatedStore.storeEmail}</div>
                    </div>
                  )}
                  {activatedStore.storeAddress && (
                    <div>
                      <div className="text-xs text-slate-400">{t('pages.uberIntegration.addressLabel')}</div>
                      <div className="text-sm text-slate-700 mt-0.5">{activatedStore.storeAddress}</div>
                    </div>
                  )}
                  {activatedStore.cuisines && activatedStore.cuisines.length > 0 && (
                    <div className="sm:col-span-2">
                      <div className="text-xs text-slate-400 mb-1">{t('pages.uberIntegration.cuisinesLabel')}</div>
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
                  { key: 'store', label: t('pages.uberIntegration.storeManagementTab'), icon: <StoreIcon className="w-4 h-4" /> },
                  { key: 'menu', label: t('pages.uberIntegration.menuSyncTab'), icon: <RefreshCw className="w-4 h-4" /> },
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
              title={t('pages.uberIntegration.noStoreBoundTitle')}
              action={
                <div className="flex items-center gap-2">
                  <Btn variant="primary" icon={<StoreIcon className="w-3.5 h-3.5" />} loading={storesLoading} onClick={() => { setShowStoreSelection(true); loadAvailableStores() }}>
                    {t('pages.uberIntegration.selectStoreBtn')}
                  </Btn>
                  <Btn variant="secondary" icon={<Search className="w-3.5 h-3.5" />} loading={storesLoading} onClick={handleDebugStores}>{t('pages.uberIntegration.diagnoseBtn')}</Btn>
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
      <PageHeader title={t('pages.uberIntegration.pageTitle')} description={t('pages.uberIntegration.pageDescription')} />

      <div className="space-y-4">
        {successMessage && <AlertBox type="success" title={successMessage} />}
        {errorMessage && <AlertBox type="error" title={errorMessage} />}
        {renderContent()}
      </div>

      {/* 店铺选择弹窗 */}
      <Modal
        open={showStoreSelection}
        onOpenChange={v => !v && setShowStoreSelection(false)}
        title={t('pages.uberIntegration.selectStoreModalTitle')}
        size="lg"
        footer={
          <>
            <Btn variant="ghost" icon={<Search className="w-3.5 h-3.5" />} loading={storesLoading} onClick={handleDebugStores}>{t('pages.uberIntegration.diagnoseStoreListBtn')}</Btn>
            <div className="flex-1" />
            <Btn variant="secondary" onClick={() => setShowStoreSelection(false)}>{t('pages.uberIntegration.closeBtn')}</Btn>
          </>
        }
      >
        {storesLoading ? (
          <Spinner />
        ) : stores.length === 0 ? (
          <EmptyState title={t('pages.uberIntegration.noStoresAvailable')} />
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
                    {activatedStore?.storeId === store.id && <Badge variant="green">{t('pages.uberIntegration.currentlyBoundBadge')}</Badge>}
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
                  {t('pages.uberIntegration.bindThisStoreBtn')}
                </Btn>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* 诊断结果弹窗 */}
      <Modal open={!!debugData} onOpenChange={v => !v && setDebugData(null)} title={t('pages.uberIntegration.diagnosisResultModalTitle')} size="lg">
        {debugData && <DebugResult debug={debugData} />}
      </Modal>

      {/* 断开连接确认 */}
      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title={t('pages.uberIntegration.disconnectUberTitle')}
        description={t('pages.uberIntegration.disconnectConfirmDescription')}
        confirmText={t('pages.uberIntegration.confirmDisconnectBtn')}
        danger
        loading={loading}
        onConfirm={handleDisconnect}
      />

      {/* 解绑店铺确认 */}
      <ConfirmDialog
        open={confirmUnbind}
        onOpenChange={setConfirmUnbind}
        title={t('pages.uberIntegration.unbindStoreModalTitle')}
        description={t('pages.uberIntegration.unbindStoreConfirmDescription', { name: activatedStore?.storeName ?? '' })}
        confirmText={t('pages.uberIntegration.confirmUnbindBtn')}
        danger
        loading={loading}
        onConfirm={handleUnbindStore}
      />
    </div>
  )
}

// 诊断结果展示
const DebugResult: React.FC<{ debug: any }> = ({ debug }) => {
  const { t } = useTranslation()
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
        title={hasStores ? t('pages.uberIntegration.storesDetectedSuccess') : t('pages.uberIntegration.noStoresDetected')}
        description={hasStores ? t('pages.uberIntegration.storesDetectedCount', { count: uber.storesFound }) : t('pages.uberIntegration.noStoresFromUberApi')}
      />

      <div>
        <p className="font-medium text-slate-700 mb-1">📊 {t('pages.uberIntegration.databaseStatusTitle')}</p>
        <div className="rounded-lg border border-slate-200 px-3 py-1">
          <Row label={t('pages.uberIntegration.integrationCreatedLabel')}>{database.hasMerchantIntegration ? `✅ ${t('pages.uberIntegration.yes')}` : `❌ ${t('pages.uberIntegration.no')}`}</Row>
          <Row label={t('pages.uberIntegration.accessTokenLabel')}>{database.hasAccessToken ? `✅ ${t('pages.uberIntegration.savedLabel')}` : `❌ ${t('pages.uberIntegration.missingLabel')}`}</Row>
          <Row label={t('pages.uberIntegration.tokenExpiresAtLabel')}>{database.tokenExpiresAt ? new Date(database.tokenExpiresAt).toLocaleString() : t('pages.uberIntegration.noneLabel')}</Row>
          <Row label={t('pages.uberIntegration.tokenValidityLabel')}>{database.tokenValid ? `✅ ${t('pages.uberIntegration.validLabel')}` : `❌ ${t('pages.uberIntegration.expiredOrInvalidLabel')}`}</Row>
          <Row label={t('pages.uberIntegration.boundStoreLabel')}>{database.platformStoreId ? `${database.platformStoreName} (${database.platformStoreId})` : t('pages.uberIntegration.notBoundLabel')}</Row>
        </div>
      </div>

      <div>
        <p className="font-medium text-slate-700 mb-1">🌐 {t('pages.uberIntegration.uberApiResponseTitle')}</p>
        <div className="rounded-lg border border-slate-200 px-3 py-1">
          <Row label={t('pages.uberIntegration.storesDetectedCountLabel')}><strong>{uber.storesFound ?? 0}</strong></Row>
          {uber.storesFound > 0 && (
            <Row label={t('pages.uberIntegration.storeListLabel')}>
              <div className="space-y-0.5">
                {uber.stores?.map((s: any) => <div key={s.id}>{s.name} ({s.id})</div>)}
              </div>
            </Row>
          )}
          {uber.error && <Row label={t('pages.uberIntegration.errorMessageLabel')}><span className="text-red-600">{uber.error}</span></Row>}
          {uber.errorDetails && (
            <Row label={t('pages.uberIntegration.errorDetailsLabel')}>
              <pre className="text-[11px] text-red-600 overflow-auto max-w-full">{JSON.stringify(uber.errorDetails, null, 2)}</pre>
            </Row>
          )}
        </div>
      </div>

      {!hasStores && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-800">
          <p className="font-medium mb-1">💡 {t('pages.uberIntegration.possibleReasonsTitle')}</p>
          <ul className="list-disc pl-5 space-y-1 text-[13px]">
            <li>{t('pages.uberIntegration.mostLikelyReason')}</li>
            <li>
              {t('pages.uberIntegration.checkStepsHintPrefix')}{' '}
              <a href="https://partners.uber.com" target="_blank" rel="noopener noreferrer" className="underline">partners.uber.com</a>
              {' '}{t('pages.uberIntegration.checkStepsHintSuffix')}
            </li>
            <li>{t('pages.uberIntegration.permissionIssueHint')}</li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default UberIntegration
