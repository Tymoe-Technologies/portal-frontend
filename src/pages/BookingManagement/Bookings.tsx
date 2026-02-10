import { useEffect, useState, useMemo } from 'react'
import {
  Card, Table, Button, Modal, Input, Select, Tag, Space, Badge,
  Segmented, message, Spin, Typography, Descriptions, Divider,
} from 'antd'
import {
  SearchOutlined, AppstoreOutlined, UnorderedListOutlined,
  ClockCircleOutlined, UserOutlined, MailOutlined,
  TeamOutlined, FileTextOutlined, DollarOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { bookingsApi } from '@/services/booking'
import type { Booking, BookingStatus } from '@/types/booking'
import { BOOKING_STATUS_COLORS, DEPOSIT_STATUS_COLORS } from '@/types/booking'

const { Text } = Typography
const { TextArea } = Input

type ViewMode = 'kanban' | 'list'

const KANBAN_COLUMNS: { status: BookingStatus; color: string }[] = [
  { status: 'PENDING', color: '#fa8c16' },
  { status: 'CONFIRMED', color: '#52c41a' },
  { status: 'COMPLETED', color: '#999' },
  { status: 'CANCELLED', color: '#f5222d' },
  { status: 'NO_SHOW', color: '#722ed1' },
]

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
      message.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      const matchesSearch =
        b.customerName.toLowerCase().includes(search.toLowerCase()) ||
        b.resourceName.toLowerCase().includes(search.toLowerCase())
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
      message.success(t('common.success'))
    } catch {
      message.error(t('common.error'))
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
      message.success(t('common.success'))
    } catch {
      message.error(t('common.error'))
    } finally {
      setActionLoading(false)
    }
  }

  const columns = [
    {
      title: t('pages.booking.public.guest'),
      key: 'customer',
      render: (_: unknown, record: Booking) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.customerName}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.customerPhone}</Text>
        </div>
      ),
    },
    {
      title: t('pages.booking.bookings.resource'),
      key: 'resource',
      render: (_: unknown, record: Booking) => (
        <div>
          <div>{record.resourceName}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t(`pages.booking.resourceType.${record.resourceType}`)}
          </Text>
        </div>
      ),
    },
    {
      title: t('pages.booking.public.time'),
      key: 'time',
      width: 120,
      render: (_: unknown, record: Booking) => (
        <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
          {record.startTime}–{record.endTime}
        </span>
      ),
    },
    {
      title: t('pages.booking.public.party'),
      dataIndex: 'partySize',
      key: 'partySize',
      width: 80,
      render: (v: number | undefined) =>
        v ? t('pages.booking.bookings.guests', { count: v }) : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: BookingStatus) => (
        <Tag color={BOOKING_STATUS_COLORS[status]}>
          {t(`pages.booking.status.${status}`)}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: unknown, record: Booking) => (
        <Button type="link" size="small" onClick={() => handleView(record)}>
          {t('common.edit')}
        </Button>
      ),
    },
  ]

  // Kanban card
  const KanbanCard = ({ booking }: { booking: Booking }) => (
    <Card
      size="small"
      hoverable
      onClick={() => handleView(booking)}
      style={{ marginBottom: 8, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text strong style={{ fontSize: 13 }}>{booking.customerName}</Text>
        <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
          {booking.startTime}
        </Text>
      </div>
      <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{booking.resourceName}</div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <span style={{ fontSize: 11, color: '#999' }}>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          {booking.startTime}–{booking.endTime}
        </span>
        {booking.partySize && (
          <span style={{ fontSize: 11, color: '#999' }}>
            <TeamOutlined style={{ marginRight: 4 }} />
            {booking.partySize}
          </span>
        )}
      </div>
    </Card>
  )

  return (
    <Spin spinning={loading}>
      <div>
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
            {t('pages.booking.bookings.title')}
          </h2>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('pages.booking.bookings.totalAndConfirmed', {
              total: bookings.length,
              confirmed: bookings.filter((b) => b.status === 'CONFIRMED').length,
            })}
          </Text>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder={t('pages.booking.bookings.searchPlaceholder')}
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 300 }}
            allowClear
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 140 }}
            options={[
              { value: 'ALL', label: t('pages.booking.bookings.allStatus') },
              ...KANBAN_COLUMNS.map((col) => ({
                value: col.status,
                label: t(`pages.booking.status.${col.status}`),
              })),
            ]}
          />
          <div style={{ marginLeft: 'auto' }}>
            <Segmented
              value={viewMode}
              onChange={(v) => setViewMode(v as ViewMode)}
              options={[
                { value: 'kanban', icon: <AppstoreOutlined /> },
                { value: 'list', icon: <UnorderedListOutlined /> },
              ]}
            />
          </div>
        </div>

        {/* Content */}
        {viewMode === 'kanban' ? (
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
            {KANBAN_COLUMNS.map((column) => {
              const columnBookings = filtered.filter((b) => b.status === column.status)
              return (
                <div key={column.status} style={{ minWidth: 280, flex: '0 0 280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Badge color={column.color} />
                    <Text strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                      {t(`pages.booking.status.${column.status}`)}
                    </Text>
                    <Tag style={{ marginLeft: 'auto' }}>{columnBookings.length}</Tag>
                  </div>
                  <div>
                    {columnBookings.map((booking) => (
                      <KanbanCard key={booking.id} booking={booking} />
                    ))}
                    {columnBookings.length === 0 && (
                      <Card
                        size="small"
                        style={{ borderStyle: 'dashed', textAlign: 'center', color: '#999' }}
                      >
                        {t('pages.booking.bookings.noBookings')}
                      </Card>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="id"
            pagination={false}
            locale={{ emptyText: t('pages.booking.bookings.noBookings') }}
          />
        )}

        {/* Detail Modal */}
        <Modal
          title={t('pages.booking.bookings.bookingDetails')}
          open={detailOpen}
          onCancel={() => setDetailOpen(false)}
          footer={null}
          width={520}
        >
          {detailBooking && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', background: '#f5f5f5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <UserOutlined style={{ fontSize: 18, color: '#999' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 500 }}>{detailBooking.customerName}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{detailBooking.customerPhone}</Text>
                </div>
                <Tag color={BOOKING_STATUS_COLORS[detailBooking.status]} style={{ marginLeft: 'auto' }}>
                  {t(`pages.booking.status.${detailBooking.status}`)}
                </Tag>
              </div>

              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label={t('pages.booking.bookings.resource')}>
                  {detailBooking.resourceName}
                </Descriptions.Item>
                <Descriptions.Item label={t(`pages.booking.resourceType.${detailBooking.resourceType}`)}>
                  {t(`pages.booking.resourceType.${detailBooking.resourceType}`)}
                </Descriptions.Item>
                <Descriptions.Item label={t('pages.booking.public.date')}>
                  {detailBooking.date}
                </Descriptions.Item>
                <Descriptions.Item label={t('pages.booking.public.time')}>
                  {detailBooking.startTime} – {detailBooking.endTime}
                </Descriptions.Item>
              </Descriptions>

              {detailBooking.customerEmail && (
                <div style={{ marginTop: 12, fontSize: 13, color: '#666' }}>
                  <MailOutlined style={{ marginRight: 8 }} />
                  {detailBooking.customerEmail}
                </div>
              )}

              {detailBooking.partySize && (
                <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
                  <TeamOutlined style={{ marginRight: 8 }} />
                  {t('pages.booking.bookings.guests', { count: detailBooking.partySize })}
                </div>
              )}

              {detailBooking.notes && (
                <Card size="small" style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>
                    <FileTextOutlined style={{ marginRight: 4 }} />
                    {t('pages.booking.bookings.notes')}
                  </div>
                  <div style={{ fontSize: 13 }}>{detailBooking.notes}</div>
                </Card>
              )}

              {/* Deposit Info */}
              {detailBooking.depositRequired && (
                <Card size="small" style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>
                    <DollarOutlined style={{ marginRight: 4 }} />
                    {t('pages.booking.bookings.deposit')}
                  </div>
                  <Space>
                    {detailBooking.depositAmount && (
                      <Text strong>${detailBooking.depositAmount}</Text>
                    )}
                    {detailBooking.depositStatus && (
                      <Tag color={DEPOSIT_STATUS_COLORS[detailBooking.depositStatus]}>
                        {t(`pages.booking.depositStatus.${detailBooking.depositStatus}`)}
                      </Tag>
                    )}
                    {detailBooking.depositStatus === 'PENDING' && detailBooking.stripeSessionUrl && (
                      <Button
                        type="link"
                        size="small"
                        onClick={() => window.open(detailBooking.stripeSessionUrl, '_blank')}
                      >
                        {t('pages.booking.bookings.payDeposit')}
                      </Button>
                    )}
                  </Space>
                </Card>
              )}

              {/* Action buttons */}
              <Divider />
              <Space wrap>
                {detailBooking.status === 'PENDING' && (
                  <Button
                    type="primary"
                    loading={actionLoading}
                    onClick={() => handleStatusAction(detailBooking.id, 'CONFIRMED')}
                  >
                    {t('pages.booking.bookings.confirmAction')}
                  </Button>
                )}
                {detailBooking.status === 'CONFIRMED' && (
                  <>
                    <Button
                      type="primary"
                      loading={actionLoading}
                      onClick={() => handleStatusAction(detailBooking.id, 'COMPLETED')}
                    >
                      {t('pages.booking.bookings.completeAction')}
                    </Button>
                    <Button
                      loading={actionLoading}
                      onClick={() => handleStatusAction(detailBooking.id, 'NO_SHOW')}
                    >
                      {t('pages.booking.bookings.noShowAction')}
                    </Button>
                  </>
                )}
                {(detailBooking.status === 'PENDING' || detailBooking.status === 'CONFIRMED') && (
                  <Button
                    danger
                    onClick={() => setCancelModalOpen(true)}
                  >
                    {t('pages.booking.bookings.cancelAction')}
                  </Button>
                )}
              </Space>
            </div>
          )}
        </Modal>

        {/* Cancel Modal */}
        <Modal
          title={t('pages.booking.bookings.cancelAction')}
          open={cancelModalOpen}
          onCancel={() => setCancelModalOpen(false)}
          onOk={handleCancel}
          confirmLoading={actionLoading}
        >
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">{t('pages.booking.bookings.cancelReason')}</Text>
            <TextArea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t('pages.booking.bookings.cancelReasonPlaceholder')}
              style={{ marginTop: 8 }}
            />
          </div>
        </Modal>
      </div>
    </Spin>
  )
}
