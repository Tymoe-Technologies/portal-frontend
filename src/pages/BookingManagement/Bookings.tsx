import { useEffect, useState, useMemo } from 'react'
import {
  Search, LayoutGrid, List as ListIcon, Clock, User, Mail, Users, FileText, DollarSign,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { bookingsApi } from '@/services/booking'
import type { Booking, BookingStatus } from '@/types/booking'
import {
  Table, type Column, Modal, Textarea, SelectInput, Btn, Spinner, toast,
} from '@/components/ui-kit'
import BookingPageLayout from './BookingPageLayout'
import { StatusBadge } from './bookingUi'

type ViewMode = 'kanban' | 'list'

// 看板列（NO_SHOW 原紫色，改 slate；严禁紫色）
const KANBAN_COLUMNS: { status: BookingStatus; dot: string }[] = [
  { status: 'PENDING', dot: 'bg-amber-500' },
  { status: 'CONFIRMED', dot: 'bg-green-500' },
  { status: 'COMPLETED', dot: 'bg-slate-400' },
  { status: 'CANCELLED', dot: 'bg-red-500' },
  { status: 'NO_SHOW', dot: 'bg-slate-500' },
]

// 押金状态 → Tailwind 徽章配色
const DEPOSIT_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-600 ring-amber-200',
  AUTHORIZED: 'bg-blue-50 text-blue-600 ring-blue-200',
  CAPTURED: 'bg-green-50 text-green-600 ring-green-200',
  REFUNDED: 'bg-cyan-50 text-cyan-600 ring-cyan-200',
  FAILED: 'bg-red-50 text-red-600 ring-red-200',
}

export default function BookingList() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'ALL'>('ALL')
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await bookingsApi.list()
      setBookings(data)
    } catch {
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      const matchesSearch =
        b.customerName.toLowerCase().includes(search.toLowerCase()) ||
        (b.primaryResource?.name ?? '').toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [bookings, search, statusFilter])

  const handleView = (booking: Booking) => {
    setDetailBooking(booking)
    setDetailOpen(true)
  }

  const handleStatusAction = async (id: string, status: string) => {
    setActionLoading(true)
    try {
      const updated = await bookingsApi.updateStatus(id, status)
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
      setDetailBooking(updated)
      toast.success(t('common.success'))
    } catch {
      toast.error(t('common.error'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!detailBooking) return
    setActionLoading(true)
    try {
      const updated = await bookingsApi.cancel(detailBooking.id, cancelReason)
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
      setDetailBooking(updated)
      setCancelModalOpen(false)
      setCancelReason('')
      toast.success(t('common.success'))
    } catch {
      toast.error(t('common.error'))
    } finally {
      setActionLoading(false)
    }
  }

  const columns: Column<Booking>[] = [
    {
      key: 'customer',
      title: t('pages.booking.public.guest'),
      render: (record) => (
        <div>
          <div className="font-medium text-slate-700">{record.customerName}</div>
          <div className="text-xs text-slate-400">{record.customerPhone}</div>
        </div>
      ),
    },
    {
      key: 'resource',
      title: t('pages.booking.bookings.resource'),
      render: (record) => (
        <div>
          <div className="text-slate-700">{record.primaryResource?.name ?? ''}</div>
          <div className="text-xs text-slate-400">{t(`pages.booking.resourceType.${record.primaryResource?.resourceType}`)}</div>
        </div>
      ),
    },
    {
      key: 'time',
      title: t('pages.booking.public.time'),
      width: 120,
      render: (record) => <span className="font-mono text-[13px] text-slate-600">{record.startTime}–{record.endTime}</span>,
    },
    {
      key: 'partySize',
      title: t('pages.booking.public.party'),
      width: 80,
      render: (record) => (record.partySize ? t('pages.booking.bookings.guests', { count: record.partySize }) : '—'),
    },
    {
      key: 'status',
      title: 'Status',
      width: 100,
      render: (record) => <StatusBadge status={record.status}>{t(`pages.booking.status.${record.status}`)}</StatusBadge>,
    },
    {
      key: 'actions',
      title: '',
      width: 60,
      render: (record) => <Btn variant="link" onClick={() => handleView(record)}>{t('common.edit')}</Btn>,
    },
  ]

  // Kanban card
  const KanbanCard = ({ booking }: { booking: Booking }) => (
    <div onClick={() => handleView(booking)}
      className="mb-2 rounded-lg border border-slate-200 bg-white p-3 cursor-pointer hover:shadow-sm hover:border-slate-300 transition-all">
      <div className="flex justify-between items-start">
        <span className="font-semibold text-[13px] text-slate-700">{booking.customerName}</span>
        <span className="text-[11px] text-slate-400 font-mono">{booking.startTime}</span>
      </div>
      <div className="text-xs text-slate-400 mt-0.5">{booking.primaryResource?.name ?? ''}</div>
      <div className="flex gap-3 mt-2">
        <span className="text-[11px] text-slate-400 inline-flex items-center gap-1"><Clock className="w-3 h-3" />{booking.startTime}–{booking.endTime}</span>
        {booking.partySize && (
          <span className="text-[11px] text-slate-400 inline-flex items-center gap-1"><Users className="w-3 h-3" />{booking.partySize}</span>
        )}
      </div>
    </div>
  )

  const confirmedTotal = bookings.filter((b) => b.status === 'CONFIRMED').length

  return (
    <BookingPageLayout>
      {loading ? (
        <div className="py-16 text-center"><Spinner className="w-8 h-8 mx-auto text-slate-400" /></div>
      ) : (
        <div>
          {/* Header */}
          <div className="mb-4">
            <h2 className="m-0 text-xl font-semibold text-slate-800">{t('pages.booking.bookings.title')}</h2>
            <p className="text-[13px] text-slate-400">
              {t('pages.booking.bookings.totalAndConfirmed', { total: bookings.length, confirmed: confirmedTotal })}
            </p>
          </div>

          {/* Toolbar */}
          <div className="flex gap-2 mb-4 flex-wrap items-center">
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                placeholder={t('pages.booking.bookings.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
              />
            </div>
            <div className="w-36">
              <SelectInput
                className="w-full"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as BookingStatus | 'ALL')}
                options={[
                  { value: 'ALL', label: t('pages.booking.bookings.allStatus') },
                  ...KANBAN_COLUMNS.map((col) => ({ value: col.status, label: t(`pages.booking.status.${col.status}`) })),
                ]}
              />
            </div>
            <div className="ml-auto inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
              <button onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-md cursor-pointer ${viewMode === 'kanban' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md cursor-pointer ${viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          {viewMode === 'kanban' ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {KANBAN_COLUMNS.map((column) => {
                const columnBookings = filtered.filter((b) => b.status === column.status)
                return (
                  <div key={column.status} className="min-w-[280px] shrink-0 basis-[280px]">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${column.dot}`} />
                      <span className="font-semibold text-xs uppercase tracking-wider text-slate-600">{t(`pages.booking.status.${column.status}`)}</span>
                      <span className="ml-auto text-xs px-2 py-0.5 rounded ring-1 bg-slate-100 text-slate-600 ring-slate-200">{columnBookings.length}</span>
                    </div>
                    <div>
                      {columnBookings.map((booking) => <KanbanCard key={booking.id} booking={booking} />)}
                      {columnBookings.length === 0 && (
                        <div className="rounded-lg border border-dashed border-slate-300 text-center text-slate-400 text-sm py-4">
                          {t('pages.booking.bookings.noBookings')}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <Table
              columns={columns}
              data={filtered}
              rowKey={(b) => b.id}
              empty={t('pages.booking.bookings.noBookings')}
            />
          )}

          {/* Detail Modal */}
          <Modal
            title={t('pages.booking.bookings.bookingDetails')}
            open={detailOpen}
            onOpenChange={(o) => !o && setDetailOpen(false)}
            size="md"
          >
            {detailBooking && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <User className="w-[18px] h-[18px] text-slate-400" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-700">{detailBooking.customerName}</div>
                    <div className="text-xs text-slate-400">{detailBooking.customerPhone}</div>
                  </div>
                  <div className="ml-auto">
                    <StatusBadge status={detailBooking.status}>{t(`pages.booking.status.${detailBooking.status}`)}</StatusBadge>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-px bg-slate-200 rounded-lg overflow-hidden border border-slate-200 text-sm">
                  <div className="bg-white p-2.5"><dt className="text-xs text-slate-400">{t('pages.booking.bookings.resource')}</dt><dd className="text-slate-700 mt-0.5">{detailBooking.primaryResource?.name ?? ''}</dd></div>
                  <div className="bg-white p-2.5"><dt className="text-xs text-slate-400">{t(`pages.booking.resourceType.${detailBooking.primaryResource?.resourceType}`)}</dt><dd className="text-slate-700 mt-0.5">{t(`pages.booking.resourceType.${detailBooking.primaryResource?.resourceType}`)}</dd></div>
                  <div className="bg-white p-2.5"><dt className="text-xs text-slate-400">{t('pages.booking.public.date')}</dt><dd className="text-slate-700 mt-0.5">{detailBooking.date}</dd></div>
                  <div className="bg-white p-2.5"><dt className="text-xs text-slate-400">{t('pages.booking.public.time')}</dt><dd className="text-slate-700 mt-0.5">{detailBooking.startTime} – {detailBooking.endTime}</dd></div>
                </dl>

                {detailBooking.customerEmail && (
                  <div className="mt-3 text-[13px] text-slate-600 inline-flex items-center gap-2"><Mail className="w-4 h-4" />{detailBooking.customerEmail}</div>
                )}

                {detailBooking.partySize && (
                  <div className="mt-2 text-[13px] text-slate-600 inline-flex items-center gap-2"><Users className="w-4 h-4" />{t('pages.booking.bookings.guests', { count: detailBooking.partySize })}</div>
                )}

                {detailBooking.notes && (
                  <div className="mt-3 rounded-lg border border-slate-200 p-3">
                    <div className="text-[11px] text-slate-400 uppercase mb-1 inline-flex items-center gap-1"><FileText className="w-3 h-3" />{t('pages.booking.bookings.notes')}</div>
                    <div className="text-[13px] text-slate-700">{detailBooking.notes}</div>
                  </div>
                )}

                {/* Deposit Info */}
                {detailBooking.depositRequired && (
                  <div className="mt-3 rounded-lg border border-slate-200 p-3">
                    <div className="text-[11px] text-slate-400 uppercase mb-1 inline-flex items-center gap-1"><DollarSign className="w-3 h-3" />{t('pages.booking.bookings.deposit')}</div>
                    <div className="flex items-center gap-2">
                      {detailBooking.depositAmount && <span className="font-semibold text-slate-700">${(detailBooking.depositAmount / 100).toFixed(2)}</span>}
                      {detailBooking.depositStatus && (
                        <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 ${DEPOSIT_BADGE[detailBooking.depositStatus] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                          {t(`pages.booking.depositStatus.${detailBooking.depositStatus}`)}
                        </span>
                      )}
                      {detailBooking.depositStatus === 'PENDING' && (
                        <Btn variant="link">{t('pages.booking.bookings.payDeposit')}</Btn>
                      )}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="border-t border-slate-100 my-4" />
                <div className="flex flex-wrap gap-2">
                  {detailBooking.status === 'PENDING' && (
                    <Btn variant="primary" loading={actionLoading} onClick={() => handleStatusAction(detailBooking.id, 'CONFIRMED')}>
                      {t('pages.booking.bookings.confirmAction')}
                    </Btn>
                  )}
                  {detailBooking.status === 'CONFIRMED' && (
                    <>
                      <Btn variant="primary" loading={actionLoading} onClick={() => handleStatusAction(detailBooking.id, 'COMPLETED')}>
                        {t('pages.booking.bookings.completeAction')}
                      </Btn>
                      <Btn variant="secondary" loading={actionLoading} onClick={() => handleStatusAction(detailBooking.id, 'NO_SHOW')}>
                        {t('pages.booking.bookings.noShowAction')}
                      </Btn>
                    </>
                  )}
                  {(detailBooking.status === 'PENDING' || detailBooking.status === 'CONFIRMED') && (
                    <Btn variant="danger" onClick={() => setCancelModalOpen(true)}>{t('pages.booking.bookings.cancelAction')}</Btn>
                  )}
                </div>
              </div>
            )}
          </Modal>

          {/* Cancel Modal */}
          <Modal
            title={t('pages.booking.bookings.cancelAction')}
            open={cancelModalOpen}
            onOpenChange={(o) => !o && setCancelModalOpen(false)}
            size="sm"
            footer={
              <div className="flex justify-end gap-2">
                <Btn variant="secondary" onClick={() => setCancelModalOpen(false)}>{t('common.cancel')}</Btn>
                <Btn variant="primary" loading={actionLoading} onClick={handleCancel}>{t('common.confirm')}</Btn>
              </div>
            }
          >
            <div>
              <p className="text-sm text-slate-500">{t('pages.booking.bookings.cancelReason')}</p>
              <Textarea className="w-full mt-2" rows={3} value={cancelReason} onChange={setCancelReason}
                placeholder={t('pages.booking.bookings.cancelReasonPlaceholder')} />
            </div>
          </Modal>
        </div>
      )}
    </BookingPageLayout>
  )
}
