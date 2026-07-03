import { useEffect, useState } from 'react'
import { Calendar, CheckCircle2, Gauge, LayoutGrid, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { bookingsApi, resourcesApi } from '@/services/booking'
import type { Booking, BookableResource } from '@/types/booking'
import { SectionCard, StatCard, ProgressBar, Spinner, toast } from '@/components/ui-kit'
import BookingPageLayout from './BookingPageLayout'
import { StatusBadge } from './bookingUi'

export default function BookingDashboard() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [resources, setResources] = useState<BookableResource[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [b, r] = await Promise.all([bookingsApi.list(), resourcesApi.list()])
      setBookings(b)
      setResources(r)
    } catch (err) {
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const todayBookings = bookings.filter((b) => b.date === today)
  const confirmedCount = todayBookings.filter((b) => b.status === 'CONFIRMED').length
  const activeResources = resources.filter((r) => r.isActive)
  const utilizationRate = resources.length > 0
    ? Math.round((activeResources.length / resources.length) * 100)
    : 0

  const utilItems = [
    { label: t('pages.booking.dashboard.tables'), value: 85 },
    { label: t('pages.booking.dashboard.rooms'), value: 60 },
    { label: t('pages.booking.dashboard.chairs'), value: 92 },
    { label: t('pages.booking.dashboard.staff'), value: 70 },
    { label: t('pages.booking.dashboard.timeSlots'), value: 45 },
  ]

  return (
    <BookingPageLayout>
      {loading ? (
        <div className="py-16 text-center"><Spinner className="w-8 h-8 mx-auto text-slate-400" /></div>
      ) : (
        <div>
          <h2 className="mb-6 text-xl font-semibold text-slate-800">{t('pages.booking.dashboard.title')}</h2>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <StatCard title={t('pages.booking.dashboard.todayBookings')} value={todayBookings.length} icon={<Calendar className="w-5 h-5" />} />
            <StatCard title={t('pages.booking.dashboard.confirmed')} value={`${confirmedCount} / ${todayBookings.length}`} icon={<CheckCircle2 className="w-5 h-5" />} />
            <StatCard title={t('pages.booking.dashboard.utilization')} value={`${utilizationRate}%`} icon={<Gauge className="w-5 h-5" />} />
            <StatCard title={t('pages.booking.dashboard.activeResources')} value={`${activeResources.length} / ${resources.length}`} icon={<LayoutGrid className="w-5 h-5" />} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Today's Schedule */}
            <div className="xl:col-span-2">
              <SectionCard
                title={t('pages.booking.dashboard.todaySchedule')}
                action={<span className="text-xs px-2 py-0.5 rounded ring-1 bg-slate-100 text-slate-600 ring-slate-200">{t('pages.booking.dashboard.bookingsCount', { count: todayBookings.length })}</span>}
              >
                {todayBookings.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">{t('pages.booking.bookings.noBookings')}</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {todayBookings.slice(0, 8).map((booking) => (
                      <li key={booking.id} className="flex items-center gap-3 py-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          <Clock className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-800 font-medium">{booking.customerName}</span>
                            <StatusBadge status={booking.status}>{t(`pages.booking.status.${booking.status}`)}</StatusBadge>
                          </div>
                          <div className="text-sm text-slate-500 truncate">
                            {`${booking.primaryResource?.name ?? ''} · ${booking.startTime}–${booking.endTime}`}
                          </div>
                        </div>
                        <span className="font-mono text-slate-400 text-[13px]">{booking.startTime}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>

            {/* Resource Utilization */}
            <div>
              <SectionCard title={t('pages.booking.dashboard.resourceUtilization')}>
                <div className="flex flex-col gap-4">
                  {utilItems.map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[13px] text-slate-600">{item.label}</span>
                        <span className="text-[13px] font-medium text-slate-700">{item.value}%</span>
                      </div>
                      <ProgressBar percent={item.value} />
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>
        </div>
      )}
    </BookingPageLayout>
  )
}
