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
  useTranslation()

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
        setErrorMessage(error.message || '加载店铺信息失败')
      } finally {
        setLoading(false)
      }
    }
    if (merchantId && storeId) loadStoreData()
  }, [merchantId, storeId])

  const handlePauseOrders = async () => {
    if (!pauseMinutes) { setModalError('请选择暂停时间'); return }
    setModalError('')
    try {
      setPauseLoading(true)
      const pauseUntil = dayjs().add(pauseMinutes, 'minute')
      await uberStoreStatusService.pauseOrders(merchantId, storeId, pauseUntil.toISOString())
      setSuccessMessage(`✅ 接单已暂停 ${pauseMinutes} 分钟`)
      setShowPauseModal(false)
      setPauseMinutes(null)
      const newDetailedStatus = await uberStoreStatusService.getStoreStatusDetailed(merchantId, storeId)
      setDetailedStatus(newDetailedStatus)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      setErrorMessage(error.message || '暂停接单失败')
    } finally {
      setPauseLoading(false)
    }
  }

  const handleResumeOrders = async () => {
    try {
      setLoading(true)
      await uberStoreStatusService.resumeOrders(merchantId, storeId)
      setSuccessMessage('✅ 接单已恢复')
      const newDetailedStatus = await uberStoreStatusService.getStoreStatusDetailed(merchantId, storeId)
      setDetailedStatus(newDetailedStatus)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      setErrorMessage(error.message || '恢复接单失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSetBusyMode = async () => {
    if (!busyModeDuration) { setModalError('请选择忙碌模式持续时间'); return }
    if (!delayDuration) { setModalError('请选择额外准备时间'); return }
    setModalError('')
    try {
      setBusyModeLoading(true)
      const delayUntil = dayjs().add(busyModeDuration, 'minute')
      await uberStoreStatusService.setBusyMode(merchantId, storeId, delayUntil.toISOString(), delayDuration)
      setSuccessMessage(`✅ 已设置 ${busyModeDuration} 分钟的高需求模式，额外准备时间 ${delayDuration} 秒`)
      setShowBusyModeModal(false)
      setBusyModeDuration(null)
      setDelayDuration(null)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      setErrorMessage(error.message || '设置忙碌模式失败')
    } finally {
      setBusyModeLoading(false)
    }
  }

  const handleClearBusyMode = async () => {
    try {
      setLoading(true)
      await uberStoreStatusService.clearBusyMode(merchantId, storeId)
      setSuccessMessage('✅ 忙碌模式已清除，已恢复正常准备时间')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      setErrorMessage(error.message || '清除忙碌模式失败')
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
      <SectionCard title={<span className="inline-flex items-center gap-2.5"><Power className="w-5 h-5 text-blue-500" />店铺状态管理</span>}>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-slate-600">当前状态</label>
            <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 ${online ? 'bg-green-50 text-green-600 ring-green-200' : 'bg-red-50 text-red-600 ring-red-200'}`}>
              {online ? '在线' : '离线'}
            </span>
          </div>

          {detailedStatus?.isOfflineUntil && (
            <div className="flex justify-between"><label className="text-slate-600">离线直到</label><span className="text-slate-700">{detailedStatus.isOfflineUntil}</span></div>
          )}
          {detailedStatus?.offlineReason && (
            <div className="flex justify-between"><label className="text-slate-600">离线原因</label><span className="text-slate-700">{detailedStatus.offlineReason}</span></div>
          )}

          <div className="flex flex-wrap gap-2">
            <Btn variant="secondary" loading={pauseLoading} onClick={() => { setModalError(''); setShowPauseModal(true) }}>暂停接单</Btn>
            {detailedStatus?.status === 'OFFLINE' && detailedStatus?.isOfflineUntil && (
              <Btn variant="secondary" loading={loading} onClick={handleResumeOrders}>恢复接单</Btn>
            )}
            <Btn variant="secondary" loading={busyModeLoading} onClick={() => { setModalError(''); setShowBusyModeModal(true) }}>忙碌模式</Btn>
            <Btn variant="secondary" loading={loading} onClick={handleClearBusyMode}>清除忙碌</Btn>
          </div>

          <p className="text-xs text-slate-400 mb-0">
            <strong>暂停接单：</strong>指定时间内暂停接收订单。<br />
            <strong>恢复接单：</strong>从暂停状态恢复。<br />
            <strong>忙碌模式：</strong>临时增加订单准备时间。<br />
            <strong>清除忙碌：</strong>恢复默认准备时间。
          </p>
        </div>
      </SectionCard>

      {/* 暂停接单模态框 */}
      <Modal
        title="暂停接单"
        open={showPauseModal}
        onOpenChange={(o) => { if (!o) { setShowPauseModal(false); setPauseMinutes(null) } }}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => { setShowPauseModal(false); setPauseMinutes(null) }}>取消</Btn>
            <Btn variant="primary" loading={pauseLoading} onClick={handlePauseOrders}>确定</Btn>
          </div>
        }
      >
        <div>
          <div className="text-sm text-slate-600 mb-2">选择暂停时长</div>
          <RadioGroup value={pauseMinutes} onChange={setPauseMinutes} options={[
            { label: '10分钟', value: 10 }, { label: '15分钟', value: 15 }, { label: '20分钟', value: 20 },
            { label: '25分钟', value: 25 }, { label: '今天不再接单', value: 1440 },
          ]} />
          {modalError && <p className="text-sm text-red-500 mt-2">{modalError}</p>}
          <p className="text-xs text-slate-400 mt-4">选择暂停时间后，店铺将停止接收新订单，直到指定时间后恢复。</p>
        </div>
      </Modal>

      {/* 忙碌模式模态框 */}
      <Modal
        title="设置忙碌模式"
        open={showBusyModeModal}
        onOpenChange={(o) => { if (!o) { setShowBusyModeModal(false); setBusyModeDuration(null); setDelayDuration(null) } }}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => { setShowBusyModeModal(false); setBusyModeDuration(null); setDelayDuration(null) }}>取消</Btn>
            <Btn variant="primary" loading={busyModeLoading} onClick={handleSetBusyMode}>确定</Btn>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="text-sm text-slate-600 mb-2">忙碌模式持续时间</div>
            <RadioGroup value={busyModeDuration} onChange={setBusyModeDuration} options={[
              { label: '15分钟', value: 15 }, { label: '30分钟', value: 30 }, { label: '45分钟', value: 45 }, { label: '60分钟', value: 60 },
            ]} />
          </div>
          <div>
            <div className="text-sm text-slate-600 mb-2">额外准备时间</div>
            <RadioGroup value={delayDuration} onChange={setDelayDuration} options={[
              { label: '5分钟（300秒）', value: 300 }, { label: '10分钟（600秒）', value: 600 }, { label: '15分钟（900秒）', value: 900 },
              { label: '20分钟（1200秒）', value: 1200 }, { label: '30分钟（1800秒）', value: 1800 },
            ]} />
          </div>
          {modalError && <p className="text-sm text-red-500">{modalError}</p>}
          <p className="text-xs text-slate-400">选择高需求模式的持续时间和额外准备时间。在此期间内每个新订单都会增加指定的准备时间。</p>
        </div>
      </Modal>
    </div>
  )
}

export default StoreManagement
