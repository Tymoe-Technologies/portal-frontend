import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { orderService, Order } from '@/services/orderService'
import { SectionCard, Btn, SelectInput, EmptyState, Spinner, toast } from '@/components/ui-kit'

type OrderView = 'all' | 'pending'
type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'PICKED_UP' | 'COMPLETED' | 'CANCELLED'

// 订单状态徽章配色
const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-600 ring-amber-200',
  CONFIRMED: 'bg-blue-50 text-blue-600 ring-blue-200',
  PREPARING: 'bg-cyan-50 text-cyan-600 ring-cyan-200',
  READY: 'bg-green-50 text-green-600 ring-green-200',
  PICKED_UP: 'bg-slate-100 text-slate-600 ring-slate-200',
  COMPLETED: 'bg-green-50 text-green-600 ring-green-200',
  CANCELLED: 'bg-red-50 text-red-600 ring-red-200',
}

// 状态筛选下拉选项，需要在组件内传入 t 生成
const getStatusOptions = (t: (key: string) => string) => [
  { label: t('pages.uberOrders.statusOptions.all'), value: 'ALL' },
  { label: t('pages.uberOrders.statusOptions.pending'), value: 'PENDING' },
  { label: t('pages.uberOrders.statusOptions.confirmed'), value: 'CONFIRMED' },
  { label: t('pages.uberOrders.statusOptions.preparing'), value: 'PREPARING' },
  { label: t('pages.uberOrders.statusOptions.ready'), value: 'READY' },
  { label: t('pages.uberOrders.statusOptions.pickedUp'), value: 'PICKED_UP' },
  { label: t('pages.uberOrders.statusOptions.completed'), value: 'COMPLETED' },
  { label: t('pages.uberOrders.statusOptions.cancelled'), value: 'CANCELLED' },
]

const UberOrders: React.FC = () => {
  const { t } = useTranslation()
  const [orders, setOrders] = useState<Order[]>([])
  const [, setAllOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null)
  const [merchantId, setMerchantId] = useState<string>('')
  const [viewMode, setViewMode] = useState<OrderView>('pending')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL')

  useEffect(() => {
    const id =
      localStorage.getItem('merchant_id') ||
      localStorage.getItem('merchantId') ||
      localStorage.getItem('organization_id') ||
      'unknown'
    setMerchantId(id)
  }, [])

  const fetchOrders = async () => {
    if (!merchantId || merchantId === 'unknown') return
    try {
      setRefreshing(true)
      if (viewMode === 'pending') {
        const data = await orderService.getPendingOrders(merchantId)
        setOrders(data || [])
      } else {
        const statusToFilter = statusFilter !== 'ALL' ? statusFilter : undefined
        const data = await orderService.getAllOrders(merchantId, statusToFilter)
        setAllOrders(data || [])
        setOrders(data || [])
      }
    } catch (error) {
      console.error(t('pages.uberOrders.fetchOrdersError'), error)
      toast.error(t('pages.uberOrders.fetchOrdersErrorToast'))
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!merchantId || merchantId === 'unknown') return
    fetchOrders()
    const interval = setInterval(() => fetchOrders(), 5000)
    return () => clearInterval(interval)
  }, [merchantId, viewMode, statusFilter])

  const handleAccept = async (orderId: string) => {
    try {
      setProcessingOrderId(orderId)
      setLoading(true)
      await orderService.acceptOrder(orderId)
      toast.success(t('pages.uberOrders.acceptSuccess'))
      setOrders(orders.filter(o => o.id !== orderId))
    } catch (error) {
      console.error(t('pages.uberOrders.acceptError'), error)
      toast.error(t('pages.uberOrders.acceptErrorToast'))
    } finally {
      setLoading(false)
      setProcessingOrderId(null)
    }
  }

  const handleReject = async (orderId: string) => {
    try {
      setProcessingOrderId(orderId)
      setLoading(true)
      await orderService.rejectOrder(orderId, 'Restaurant rejected')
      toast.success(t('pages.uberOrders.rejectSuccess'))
      setOrders(orders.filter(o => o.id !== orderId))
    } catch (error) {
      console.error(t('pages.uberOrders.rejectError'), error)
      toast.error(t('pages.uberOrders.rejectErrorToast'))
    } finally {
      setLoading(false)
      setProcessingOrderId(null)
    }
  }

  const statusBadge = (status: string) => (
    <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 ${STATUS_BADGE[status] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>{status}</span>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {merchantId === 'unknown' && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="font-semibold text-slate-800 mb-2">{t('pages.uberOrders.configHint.title')}</div>
          <div className="text-sm text-slate-600">
            <strong>merchantId</strong> {t('pages.uberOrders.configHint.notSetPrefix')}
            <ul className="list-disc ml-5 mt-1">
              <li>{t('pages.uberOrders.configHint.loggedIn')}</li>
              <li>{t('pages.uberOrders.configHint.orgSelected')}</li>
              <li>
                {t('pages.uberOrders.configHint.setInStorage', {
                  merchantIdKey: 'merchant_id',
                  merchantIdKey2: 'merchantId',
                })}
              </li>
            </ul>
            {t('pages.uberOrders.configHint.currentMerchantId')} <code className="bg-slate-100 px-1 rounded">{merchantId}</code>
          </div>
        </div>
      )}

      <SectionCard
        title={
          <span className="inline-flex items-center gap-2">
            <span>{t('pages.uberOrders.title')}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ring-1 ${viewMode === 'pending' ? 'bg-red-50 text-red-600 ring-red-200' : 'bg-blue-50 text-blue-600 ring-blue-200'}`}>{orders.length}</span>
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
              <button onClick={() => setViewMode('pending')} className={`px-3 py-1 rounded-md text-sm cursor-pointer ${viewMode === 'pending' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{t('pages.uberOrders.viewMode.pending')}</button>
              <button onClick={() => setViewMode('all')} className={`px-3 py-1 rounded-md text-sm cursor-pointer ${viewMode === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{t('pages.uberOrders.viewMode.all')}</button>
            </div>
            {viewMode === 'all' && (
              <div className="w-32"><SelectInput className="w-full" value={statusFilter} onChange={(v) => setStatusFilter(v as OrderStatus | 'ALL')} options={getStatusOptions(t)} /></div>
            )}
            <Btn variant="primary" loading={refreshing} onClick={fetchOrders}>{t('pages.uberOrders.refresh')}</Btn>
          </div>
        }
      >
        {orders.length === 0 ? (
          <div className="py-12"><EmptyState title={refreshing ? t('pages.uberOrders.emptyLoading') : viewMode === 'pending' ? t('pages.uberOrders.emptyPending') : t('pages.uberOrders.emptyAll')} /></div>
        ) : (
          <div className="relative">
            {loading && <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10"><Spinner className="w-6 h-6 text-slate-400" /></div>}
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="rounded-lg border border-slate-200 border-l-4 border-l-red-400 shadow-sm p-4">
                  {/* 订单基本信息 */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <h5 className="text-base font-semibold text-slate-800 m-0">{t('pages.uberOrders.orderNumber', { displayId: order.displayId })}</h5>
                      {statusBadge(order.status)}
                    </div>
                    <div className="text-lg font-semibold text-slate-900">${order.totalAmount.toFixed(2)}</div>
                  </div>

                  <div className="border-t border-slate-100 my-3" />

                  {/* 顾客信息 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-sm">
                    <div className="flex gap-2"><span className="font-medium min-w-[48px] text-slate-500">{t('pages.uberOrders.customer')}</span><span className="text-slate-700 flex-1">{order.consumerName}</span></div>
                    <div className="flex gap-2"><span className="font-medium min-w-[48px] text-slate-500">{t('pages.uberOrders.phone')}</span><span className="text-slate-700 flex-1">{order.consumerPhone}</span></div>
                  </div>

                  {order.specialInstructions && (
                    <div className="flex gap-2 mb-3 text-sm"><span className="font-medium min-w-[48px] text-slate-500">{t('pages.uberOrders.note')}</span><span className="text-slate-700 flex-1">{order.specialInstructions}</span></div>
                  )}

                  {/* 商品列表 */}
                  <div className="mb-3">
                    <span className="font-semibold text-slate-700 text-sm">{t('pages.uberOrders.items')}</span>
                    <ul className="mt-2 list-none">
                      {order.items.map((item) => (
                        <li key={item.id} className="mb-3 pb-2 border-b border-slate-100">
                          <div className="flex justify-between mb-1">
                            <span className="font-medium text-slate-700">{item.name} <span className="text-slate-400 text-xs">x{item.quantity}</span></span>
                            <span className="text-blue-600 font-medium">${(item.unitPrice * item.quantity).toFixed(2)}</span>
                          </div>

                          {item.modifiers && item.modifiers.length > 0 && (
                            <div className="ml-3 mt-2 mb-2 pl-3 border-l-2 border-green-500">
                              <span className="text-green-600 text-xs font-medium">{t('pages.uberOrders.customOptions')}</span>
                              {item.modifiers.map((group, groupIndex) => (
                                <div key={groupIndex} className="mt-1 text-xs">
                                  <div className="text-slate-500 font-medium">{group.title}:</div>
                                  <ul className="mt-0.5 mb-1 pl-4 text-slate-700 list-disc">
                                    {group.selectedItems.map((selectedItem, itemIndex) => (
                                      <li key={itemIndex}>
                                        {selectedItem.title} x{selectedItem.quantity}
                                        {selectedItem.price > 0 && <span className="text-orange-500 ml-1">+${selectedItem.price.toFixed(2)}</span>}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          )}

                          {item.specialInstructions && (
                            <div className="text-red-400 text-xs mt-1">{t('pages.uberOrders.specialInstructions', { instructions: item.specialInstructions })}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border-t border-slate-100 my-3" />

                  {/* 操作按钮 */}
                  <div className="flex justify-end gap-2">
                    {order.status === 'PENDING' ? (
                      <>
                        <Btn variant="danger" loading={processingOrderId === order.id && loading} disabled={processingOrderId !== null && processingOrderId !== order.id} onClick={() => handleReject(order.id)}>{t('pages.uberOrders.reject')}</Btn>
                        <Btn variant="primary" loading={processingOrderId === order.id && loading} disabled={processingOrderId !== null && processingOrderId !== order.id} onClick={() => handleAccept(order.id)}>{t('pages.uberOrders.accept')}</Btn>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">{t('pages.uberOrders.statusLabel', { status: order.status })}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* 说明文字 */}
      <div className="mt-4">
        <SectionCard title={t('pages.uberOrders.infoTitle')}>
          <ul className="m-0 pl-5 list-disc text-sm text-slate-600 space-y-1">
            <li><strong>{t('pages.uberOrders.infoPendingMode')}</strong>：{t('pages.uberOrders.infoPendingModeDesc')}</li>
            <li><strong>{t('pages.uberOrders.infoAllMode')}</strong>：{t('pages.uberOrders.infoAllModeDesc')}</li>
            <li>{t('pages.uberOrders.infoAutoRefresh')}</li>
            <li>{t('pages.uberOrders.infoAutoReject')}</li>
            <li>{t('pages.uberOrders.infoActionsLimit')}</li>
          </ul>
        </SectionCard>
      </div>
    </div>
  )
}

export default UberOrders
