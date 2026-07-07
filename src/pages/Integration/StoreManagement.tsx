import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Power } from 'lucide-react'
import { uberStoreStatusService, StoreInfo, StoreStatus } from '@/services/uberStoreStatus'
import dayjs from 'dayjs'
import { SectionCard, Btn, Spinner, Modal, AlertBox } from '@/components/ui-kit'

interface StoreManagementProps {
  merchantId: string
  storeId: string
  storeName: string
}

interface DetailedStoreStatus {
  status: 'ONLINE' | 'OFFLINE'
  isOfflineUntil?: string
  offlineReason?: string
  offlineReasonMetadata?: string
}

// 单选组（替代 antd Radio.Group）
function RadioGroup({ value, onChange, options }: {
  value: number | null
  onChange: (v: number) => void
  options: { label: string; value: number }[]
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map(opt => (
        <label key={opt.value} className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="radio" checked={value === opt.value} onChange={() => onChange(opt.value)} className="w-4 h-4 accent-slate-900" />
          {opt.label}
        </label>
      ))}
    </div>
  )
}

/**
 * 店铺管理组件
 * 展示店铺基本信息和管理店铺状态
 */
const StoreManagement: React.FC<StoreManagementProps> = ({ merchantId, storeId }) => {
  const { t } = useTranslation()

  const [loading, setLoading] = useState(false)
  const [, setStoreInfo] = useState<StoreInfo | null>(null)
  const [, setStoreStatus] = useState<StoreStatus | null>(null)
  const [detailedStatus, setDetailedStatus] = useState<DetailedStoreStatus | null>(null)

  // 暂停接单
  const [showPauseModal, setShowPauseModal] = useState(false)
  const [pauseLoading, setPauseLoading] = useState(false)
  const [pauseMinutes, setPauseMinutes] = useState<number | null>(null)

  // 忙碌模式
  const [showBusyModeModal, setShowBusyModeModal] = useState(false)
  const [busyModeLoading, setBusyModeLoading] = useState(false)
  const [busyModeDuration, setBusyModeDuration] = useState<number | null>(null)
  const [delayDuration, setDelayDuration] = useState<number | null>(null)

  // 消息
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [modalError, setModalError] = useState('')

  useEffect(() => {
    const loadStoreData = async () => {
      try {
        setLoading(true)
        const info = await uberStoreStatusService.getStoreInfo(merchantId, storeId)
        setStoreInfo(info)
        const status = await uberStoreStatusService.getStoreStatus(merchantId, storeId)
        setStoreStatus(status)
        const detailedSt = await uberStoreStatusService.getStoreStatusDetailed(merchantId, storeId)
        setDetailedStatus(detailedSt)
      } catch (error: any) {
        setErrorMessage(error.message || t('pages.storeManagement.loadStoreInfoFailed'))
      } finally {
        setLoading(false)
      }
    }
    if (merchantId && storeId) loadStoreData()
  }, [merchantId, storeId])

  const handlePauseOrders = async () => {
    if (!pauseMinutes) { setModalError(t('pages.storeManagement.pleaseSelectPauseDuration')); return }
    setModalError('')
    try {
      setPauseLoading(true)
      const pauseUntil = dayjs().add(pauseMinutes, 'minute')
      await uberStoreStatusService.pauseOrders(merchantId, storeId, pauseUntil.toISOString())
      setSuccessMessage(t('pages.storeManagement.pauseSuccessMessage', { minutes: pauseMinutes }))
      setShowPauseModal(false)
      setPauseMinutes(null)
      const newDetailedStatus = await uberStoreStatusService.getStoreStatusDetailed(merchantId, storeId)
      setDetailedStatus(newDetailedStatus)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      setErrorMessage(error.message || t('pages.storeManagement.pauseOrdersFailed'))
    } finally {
      setPauseLoading(false)
    }
  }

  const handleResumeOrders = async () => {
    try {
      setLoading(true)
      await uberStoreStatusService.resumeOrders(merchantId, storeId)
      setSuccessMessage(t('pages.storeManagement.resumeSuccessMessage'))
      const newDetailedStatus = await uberStoreStatusService.getStoreStatusDetailed(merchantId, storeId)
      setDetailedStatus(newDetailedStatus)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      setErrorMessage(error.message || t('pages.storeManagement.resumeOrdersFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleSetBusyMode = async () => {
    if (!busyModeDuration) { setModalError(t('pages.storeManagement.pleaseSelectBusyModeDuration')); return }
    if (!delayDuration) { setModalError(t('pages.storeManagement.pleaseSelectDelayDuration')); return }
    setModalError('')
    try {
      setBusyModeLoading(true)
      const delayUntil = dayjs().add(busyModeDuration, 'minute')
      await uberStoreStatusService.setBusyMode(merchantId, storeId, delayUntil.toISOString(), delayDuration)
      setSuccessMessage(t('pages.storeManagement.busyModeSuccessMessage', { duration: busyModeDuration, delay: delayDuration }))
      setShowBusyModeModal(false)
      setBusyModeDuration(null)
      setDelayDuration(null)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      setErrorMessage(error.message || t('pages.storeManagement.setBusyModeFailed'))
    } finally {
      setBusyModeLoading(false)
    }
  }

  const handleClearBusyMode = async () => {
    try {
      setLoading(true)
      await uberStoreStatusService.clearBusyMode(merchantId, storeId)
      setSuccessMessage(t('pages.storeManagement.clearBusyModeSuccessMessage'))
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      setErrorMessage(error.message || t('pages.storeManagement.clearBusyModeFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12"><Spinner className="w-10 h-10 mx-auto text-slate-400" /></div>
  }

  const online = detailedStatus?.status === 'ONLINE'

  return (
    <div className="store-management space-y-5">
      {successMessage && <AlertBox type="success" description={successMessage} />}
      {errorMessage && <AlertBox type="error" description={errorMessage} />}

      {/* 店铺状态管理 */}
      <SectionCard title={<span className="inline-flex items-center gap-2.5"><Power className="w-5 h-5 text-blue-500" />{t('pages.storeManagement.sectionTitle')}</span>}>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-slate-600">{t('pages.storeManagement.currentStatusLabel')}</label>
            <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 ${online ? 'bg-green-50 text-green-600 ring-green-200' : 'bg-red-50 text-red-600 ring-red-200'}`}>
              {online ? t('pages.storeManagement.online') : t('pages.storeManagement.offline')}
            </span>
          </div>

          {detailedStatus?.isOfflineUntil && (
            <div className="flex justify-between"><label className="text-slate-600">{t('pages.storeManagement.offlineUntilLabel')}</label><span className="text-slate-700">{detailedStatus.isOfflineUntil}</span></div>
          )}
          {detailedStatus?.offlineReason && (
            <div className="flex justify-between"><label className="text-slate-600">{t('pages.storeManagement.offlineReasonLabel')}</label><span className="text-slate-700">{detailedStatus.offlineReason}</span></div>
          )}

          <div className="flex flex-wrap gap-2">
            <Btn variant="secondary" loading={pauseLoading} onClick={() => { setModalError(''); setShowPauseModal(true) }}>{t('pages.storeManagement.pauseOrdersBtn')}</Btn>
            {detailedStatus?.status === 'OFFLINE' && detailedStatus?.isOfflineUntil && (
              <Btn variant="secondary" loading={loading} onClick={handleResumeOrders}>{t('pages.storeManagement.resumeOrdersBtn')}</Btn>
            )}
            <Btn variant="secondary" loading={busyModeLoading} onClick={() => { setModalError(''); setShowBusyModeModal(true) }}>{t('pages.storeManagement.busyModeBtn')}</Btn>
            <Btn variant="secondary" loading={loading} onClick={handleClearBusyMode}>{t('pages.storeManagement.clearBusyModeBtn')}</Btn>
          </div>

          <p className="text-xs text-slate-400 mb-0">
            <strong>{t('pages.storeManagement.helpText.pauseOrders')}</strong>{t('pages.storeManagement.helpText.pauseOrdersDesc')}<br />
            <strong>{t('pages.storeManagement.helpText.resumeOrders')}</strong>{t('pages.storeManagement.helpText.resumeOrdersDesc')}<br />
            <strong>{t('pages.storeManagement.helpText.busyMode')}</strong>{t('pages.storeManagement.helpText.busyModeDesc')}<br />
            <strong>{t('pages.storeManagement.helpText.clearBusyMode')}</strong>{t('pages.storeManagement.helpText.clearBusyModeDesc')}
          </p>
        </div>
      </SectionCard>

      {/* 暂停接单模态框 */}
      <Modal
        title={t('pages.storeManagement.pauseModalTitle')}
        open={showPauseModal}
        onOpenChange={(o) => { if (!o) { setShowPauseModal(false); setPauseMinutes(null) } }}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => { setShowPauseModal(false); setPauseMinutes(null) }}>{t('pages.storeManagement.cancelBtn')}</Btn>
            <Btn variant="primary" loading={pauseLoading} onClick={handlePauseOrders}>{t('pages.storeManagement.confirmBtn')}</Btn>
          </div>
        }
      >
        <div>
          <div className="text-sm text-slate-600 mb-2">{t('pages.storeManagement.selectPauseDurationLabel')}</div>
          <RadioGroup value={pauseMinutes} onChange={setPauseMinutes} options={[
            { label: t('pages.storeManagement.pauseDuration.min10') as string, value: 10 }, { label: t('pages.storeManagement.pauseDuration.min15') as string, value: 15 }, { label: t('pages.storeManagement.pauseDuration.min20') as string, value: 20 },
            { label: t('pages.storeManagement.pauseDuration.min25') as string, value: 25 }, { label: t('pages.storeManagement.pauseDuration.restOfDay') as string, value: 1440 },
          ]} />
          {modalError && <p className="text-sm text-red-500 mt-2">{modalError}</p>}
          <p className="text-xs text-slate-400 mt-4">{t('pages.storeManagement.pauseModalHint')}</p>
        </div>
      </Modal>

      {/* 忙碌模式模态框 */}
      <Modal
        title={t('pages.storeManagement.busyModeModalTitle')}
        open={showBusyModeModal}
        onOpenChange={(o) => { if (!o) { setShowBusyModeModal(false); setBusyModeDuration(null); setDelayDuration(null) } }}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => { setShowBusyModeModal(false); setBusyModeDuration(null); setDelayDuration(null) }}>{t('pages.storeManagement.cancelBtn')}</Btn>
            <Btn variant="primary" loading={busyModeLoading} onClick={handleSetBusyMode}>{t('pages.storeManagement.confirmBtn')}</Btn>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="text-sm text-slate-600 mb-2">{t('pages.storeManagement.busyModeDurationLabel')}</div>
            <RadioGroup value={busyModeDuration} onChange={setBusyModeDuration} options={[
              { label: t('pages.storeManagement.busyModeDuration.min15') as string, value: 15 }, { label: t('pages.storeManagement.busyModeDuration.min30') as string, value: 30 }, { label: t('pages.storeManagement.busyModeDuration.min45') as string, value: 45 }, { label: t('pages.storeManagement.busyModeDuration.min60') as string, value: 60 },
            ]} />
          </div>
          <div>
            <div className="text-sm text-slate-600 mb-2">{t('pages.storeManagement.delayDurationLabel')}</div>
            <RadioGroup value={delayDuration} onChange={setDelayDuration} options={[
              { label: t('pages.storeManagement.delayDuration.min5') as string, value: 300 }, { label: t('pages.storeManagement.delayDuration.min10') as string, value: 600 }, { label: t('pages.storeManagement.delayDuration.min15') as string, value: 900 },
              { label: t('pages.storeManagement.delayDuration.min20') as string, value: 1200 }, { label: t('pages.storeManagement.delayDuration.min30') as string, value: 1800 },
            ]} />
          </div>
          {modalError && <p className="text-sm text-red-500">{modalError}</p>}
          <p className="text-xs text-slate-400">{t('pages.storeManagement.busyModeModalHint')}</p>
        </div>
      </Modal>
    </div>
  )
}

export default StoreManagement
