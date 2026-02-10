import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, List, Progress, Tag, Spin, message } from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  AppstoreOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { bookingsApi, resourcesApi } from '@/services/booking'
import type { Booking, BookableResource } from '@/types/booking'
import { BOOKING_STATUS_COLORS } from '@/types/booking'

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
      const [b, r] = await Promise.all([
        bookingsApi.list(),
        resourcesApi.list(),
      ])
      setBookings(b)
      setResources(r)
    } catch (err) {
      message.error(t('common.error'))
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

  return (
    <Spin spinning={loading}>
      <div>
        <h2 style={{ marginBottom: 24, fontSize: 20, fontWeight: 600 }}>
          {t('pages.booking.dashboard.title')}
        </h2>

        {/* Stats Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} xl={6}>
            <Card>
              <Statistic
                title={t('pages.booking.dashboard.todayBookings')}
                value={todayBookings.length}
                prefix={<CalendarOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card>
              <Statistic
                title={t('pages.booking.dashboard.confirmed')}
                value={confirmedCount}
                suffix={`/ ${todayBookings.length}`}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card>
              <Statistic
                title={t('pages.booking.dashboard.utilization')}
                value={utilizationRate}
                suffix="%"
                prefix={<DashboardOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card>
              <Statistic
                title={t('pages.booking.dashboard.activeResources')}
                value={activeResources.length}
                suffix={`/ ${resources.length}`}
                prefix={<AppstoreOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          {/* Today's Schedule */}
          <Col xs={24} xl={16}>
            <Card
              title={t('pages.booking.dashboard.todaySchedule')}
              extra={
                <Tag>{t('pages.booking.dashboard.bookingsCount', { count: todayBookings.length })}</Tag>
              }
            >
              <List
                dataSource={todayBookings.slice(0, 8)}
                locale={{ emptyText: t('pages.booking.bookings.noBookings') }}
                renderItem={(booking) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          background: '#f5f5f5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <ClockCircleOutlined style={{ fontSize: 16, color: '#999' }} />
                        </div>
                      }
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{booking.customerName}</span>
                          <Tag color={BOOKING_STATUS_COLORS[booking.status]}>
                            {t(`pages.booking.status.${booking.status}`)}
                          </Tag>
                        </div>
                      }
                      description={`${booking.resourceName} · ${booking.startTime}–${booking.endTime}`}
                    />
                    <span style={{ fontFamily: 'monospace', color: '#999', fontSize: 13 }}>
                      {booking.startTime}
                    </span>
                  </List.Item>
                )}
              />
            </Card>
          </Col>

          {/* Resource Utilization */}
          <Col xs={24} xl={8}>
            <Card title={t('pages.booking.dashboard.resourceUtilization')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { label: t('pages.booking.dashboard.tables'), value: 85 },
                  { label: t('pages.booking.dashboard.rooms'), value: 60 },
                  { label: t('pages.booking.dashboard.chairs'), value: 92 },
                  { label: t('pages.booking.dashboard.staff'), value: 70 },
                  { label: t('pages.booking.dashboard.timeSlots'), value: 45 },
                ].map((item) => (
                  <div key={item.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13 }}>{item.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{item.value}%</span>
                    </div>
                    <Progress
                      percent={item.value}
                      showInfo={false}
                      strokeColor="#1677ff"
                      size="small"
                    />
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </Spin>
  )
}
