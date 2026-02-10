import { useEffect, useState } from 'react'
import {
  Card, Form, TimePicker, InputNumber, Switch, Button, Space, message, Spin, Typography,
} from 'antd'
import {
  ClockCircleOutlined, CalendarOutlined, SettingOutlined,
  SaveOutlined, UndoOutlined, DollarOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { settingsApi } from '@/services/booking'
import type { BookingSettings } from '@/types/booking'

const { Text } = Typography

export default function BookingSettingsPage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<BookingSettings | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await settingsApi.get()
      setSettings(data)
      form.setFieldsValue({
        openTime: data.openTime ? dayjs(data.openTime, 'HH:mm') : null,
        closeTime: data.closeTime ? dayjs(data.closeTime, 'HH:mm') : null,
        slotDurationMinutes: data.slotDurationMinutes,
        advanceBookingDays: data.advanceBookingDays,
        maxPartySize: data.maxPartySize,
        requireStaffSelection: data.requireStaffSelection,
        allowWalkIn: data.allowWalkIn,
        autoConfirm: data.autoConfirm,
        allowAutoAssignment: data.allowAutoAssignment,
        depositRequired: data.depositRequired,
        depositAmount: data.depositAmount,
      })
    } catch {
      message.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload: Partial<BookingSettings> = {
        openTime: values.openTime?.format('HH:mm'),
        closeTime: values.closeTime?.format('HH:mm'),
        slotDurationMinutes: values.slotDurationMinutes,
        advanceBookingDays: values.advanceBookingDays,
        maxPartySize: values.maxPartySize,
        requireStaffSelection: values.requireStaffSelection,
        allowWalkIn: values.allowWalkIn,
        autoConfirm: values.autoConfirm,
        allowAutoAssignment: values.allowAutoAssignment,
        depositRequired: values.depositRequired,
        depositAmount: values.depositAmount,
      }
      await settingsApi.update(payload)
      message.success(t('common.saveSuccess'))
    } catch {
      message.error(t('common.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (settings) {
      form.setFieldsValue({
        openTime: settings.openTime ? dayjs(settings.openTime, 'HH:mm') : null,
        closeTime: settings.closeTime ? dayjs(settings.closeTime, 'HH:mm') : null,
        slotDurationMinutes: settings.slotDurationMinutes,
        advanceBookingDays: settings.advanceBookingDays,
        maxPartySize: settings.maxPartySize,
        requireStaffSelection: settings.requireStaffSelection,
        allowWalkIn: settings.allowWalkIn,
        autoConfirm: settings.autoConfirm,
        allowAutoAssignment: settings.allowAutoAssignment,
        depositRequired: settings.depositRequired,
        depositAmount: settings.depositAmount,
      })
    }
  }

  return (
    <Spin spinning={loading}>
      <div style={{ maxWidth: 640 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
              {t('pages.booking.settings.title')}
            </h2>
            {settings && (
              <Text type="secondary" style={{ fontSize: 13 }}>
                {t('pages.booking.settings.description', { name: settings.businessName })}
              </Text>
            )}
          </div>
          <Space>
            <Button icon={<UndoOutlined />} onClick={handleReset}>
              {t('common.reset')}
            </Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
              {t('common.save')}
            </Button>
          </Space>
        </div>

        <Form form={form} layout="vertical">
          {/* Business Hours */}
          <Card
            size="small"
            title={
              <Space>
                <ClockCircleOutlined />
                {t('pages.booking.settings.businessHours')}
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <div style={{ display: 'flex', gap: 16 }}>
              <Form.Item label={t('pages.booking.settings.openingTime')} name="openTime" style={{ flex: 1 }}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label={t('pages.booking.settings.closingTime')} name="closeTime" style={{ flex: 1 }}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </div>
            <Form.Item label={t('pages.booking.settings.slotDuration')} name="slotDurationMinutes">
              <InputNumber min={5} max={240} step={5} style={{ width: 200 }} />
            </Form.Item>
          </Card>

          {/* Booking Rules */}
          <Card
            size="small"
            title={
              <Space>
                <CalendarOutlined />
                {t('pages.booking.settings.bookingRules')}
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <div style={{ display: 'flex', gap: 16 }}>
              <Form.Item label={t('pages.booking.settings.advanceBookingDays')} name="advanceBookingDays" style={{ flex: 1 }}>
                <InputNumber min={1} max={90} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label={t('pages.booking.settings.maxPartySize')} name="maxPartySize" style={{ flex: 1 }}>
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </div>
          </Card>

          {/* Features */}
          <Card
            size="small"
            title={
              <Space>
                <SettingOutlined />
                {t('pages.booking.settings.features')}
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <SettingToggle
                name="requireStaffSelection"
                label={t('pages.booking.settings.requireStaff')}
                description={t('pages.booking.settings.requireStaffDesc')}
              />
              <SettingToggle
                name="allowWalkIn"
                label={t('pages.booking.settings.allowWalkIn')}
                description={t('pages.booking.settings.allowWalkInDesc')}
              />
              <SettingToggle
                name="allowAutoAssignment"
                label={t('pages.booking.settings.autoAssign')}
                description={t('pages.booking.settings.autoAssignDesc')}
              />
              <SettingToggle
                name="autoConfirm"
                label={t('pages.booking.settings.autoConfirm')}
                description={t('pages.booking.settings.autoConfirmDesc')}
              />
            </div>
          </Card>

          {/* Deposit Configuration */}
          <Card
            size="small"
            title={
              <Space>
                <DollarOutlined />
                {t('pages.booking.settings.depositConfig')}
              </Space>
            }
          >
            <SettingToggle
              name="depositRequired"
              label={t('pages.booking.settings.depositRequired')}
              description={t('pages.booking.settings.depositRequiredDesc')}
            />
            <Form.Item label={t('pages.booking.settings.depositAmount')} name="depositAmount">
              <InputNumber min={0} step={1} prefix="$" style={{ width: 200 }} />
            </Form.Item>
          </Card>
        </Form>
      </div>
    </Spin>
  )
}

function SettingToggle({
  name,
  label,
  description,
}: {
  name: string
  label: string
  description: string
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid #f0f0f0',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{description}</div>
      </div>
      <Form.Item name={name} valuePropName="checked" noStyle>
        <Switch />
      </Form.Item>
    </div>
  )
}
