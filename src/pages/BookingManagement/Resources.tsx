import { useEffect, useState, useMemo } from 'react'
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Select, Switch, Tag, Space,
  Segmented, message, Popconfirm, Spin, Row, Col, Typography,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  AppstoreOutlined, UnorderedListOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { resourcesApi, settingsApi } from '@/services/booking'
import type { BookableResource, ResourceType, BookingSettings } from '@/types/booking'

const { TextArea } = Input
const { Text } = Typography

const RESOURCE_TYPE_KEYS: ResourceType[] = [
  'TABLE', 'ROOM', 'BED', 'CHAIR', 'DOCTOR', 'INSTRUCTOR', 'CLASS', 'TIMESLOT',
]

const RESOURCE_TYPE_TAG_COLORS: Record<ResourceType, string> = {
  TABLE: 'gold',
  ROOM: 'blue',
  BED: 'cyan',
  CHAIR: 'purple',
  DOCTOR: 'green',
  INSTRUCTOR: 'magenta',
  CLASS: 'volcano',
  TIMESLOT: 'geekblue',
}

function TypeSpecificFields({ type, t }: { type: ResourceType; t: (key: string) => string }) {
  switch (type) {
    case 'TABLE':
      return (
        <>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={t('pages.booking.resources.floor')} name={['metadata', 'floor']}>
                <InputNumber style={{ width: '100%' }} placeholder="1" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('pages.booking.resources.section')} name={['metadata', 'section']}>
                <Input placeholder="e.g. Window, Terrace" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label={t('pages.booking.resources.hasView')} name={['metadata', 'hasView']} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label={t('pages.booking.resources.outdoorLabel')} name={['metadata', 'isOutdoor']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </>
      )
    case 'ROOM':
      return (
        <>
          <Form.Item label={t('pages.booking.resources.floor')} name={['metadata', 'floor']}>
            <InputNumber style={{ width: '100%' }} placeholder="1" />
          </Form.Item>
          <Form.Item label={t('pages.booking.resources.projector')} name={['metadata', 'hasProjector']} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label={t('pages.booking.resources.soundSystem')} name={['metadata', 'hasSoundSystem']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </>
      )
    case 'CHAIR':
      return (
        <>
          <Form.Item label={t('pages.booking.resources.stationCode')} name={['metadata', 'station']}>
            <Input placeholder="e.g. A1, B2" />
          </Form.Item>
          <Form.Item label={t('pages.booking.resources.mirror')} name={['metadata', 'hasMirror']} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label={t('pages.booking.resources.washBasin')} name={['metadata', 'hasWashBasin']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </>
      )
    case 'DOCTOR':
      return (
        <>
          <Form.Item label={t('pages.booking.resources.specialty')} name={['metadata', 'specialty']}>
            <Input placeholder="e.g. General Practice" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={t('pages.booking.resources.licenseNo')} name={['metadata', 'licenseNo']}>
                <Input placeholder="MD-2024-001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('pages.booking.resources.yearsExp')} name={['metadata', 'yearsExp']}>
                <InputNumber style={{ width: '100%' }} placeholder="5" />
              </Form.Item>
            </Col>
          </Row>
        </>
      )
    case 'INSTRUCTOR':
      return (
        <>
          <Form.Item label={t('pages.booking.resources.specialties')} name={['metadata', 'specialties']}>
            <Input placeholder="e.g. Yoga, Pilates" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={t('pages.booking.resources.certification')} name={['metadata', 'certification']}>
                <Input placeholder="e.g. RYT-500" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('pages.booking.resources.rating')} name={['metadata', 'rating']}>
                <InputNumber style={{ width: '100%' }} step={0.1} max={5} min={0} placeholder="4.5" />
              </Form.Item>
            </Col>
          </Row>
        </>
      )
    case 'TIMESLOT':
      return (
        <>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={t('pages.booking.resources.defaultStart')} name={['metadata', 'defaultStart']}>
                <Input type="time" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('pages.booking.resources.defaultEnd')} name={['metadata', 'defaultEnd']}>
                <Input type="time" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label={t('pages.booking.resources.recurring')} name={['metadata', 'recurring']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </>
      )
    default:
      return null
  }
}

export default function BookingResources() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [resources, setResources] = useState<BookableResource[]>([])
  const [settings, setSettings] = useState<BookingSettings | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ResourceType | 'ALL'>('ALL')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingResource, setEditingResource] = useState<BookableResource | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [r, s] = await Promise.all([
        resourcesApi.list(),
        settingsApi.get(),
      ])
      setResources(r)
      setSettings(s)
    } catch (err) {
      message.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.description ?? '').toLowerCase().includes(search.toLowerCase())
      const matchesType = typeFilter === 'ALL' || r.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [resources, search, typeFilter])

  const handleAdd = () => {
    setEditingResource(null)
    form.resetFields()
    form.setFieldsValue({ type: settings?.resourceType ?? 'TABLE', capacity: 1, isActive: true, metadata: {} })
    setModalOpen(true)
  }

  const handleEdit = (resource: BookableResource) => {
    setEditingResource(resource)
    form.setFieldsValue({
      name: resource.name,
      type: resource.type,
      description: resource.description,
      capacity: resource.capacity,
      isActive: resource.isActive,
      metadata: resource.metadata,
    })
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await resourcesApi.delete(id)
      setResources((prev) => prev.filter((r) => r.id !== id))
      message.success(t('common.success'))
    } catch {
      message.error(t('common.error'))
    }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      // Handle specialties string → array
      if (typeof values.metadata?.specialties === 'string') {
        values.metadata.specialties = values.metadata.specialties
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      }

      if (editingResource) {
        const updated = await resourcesApi.update(editingResource.id, values)
        setResources((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      } else {
        const created = await resourcesApi.create(values)
        setResources((prev) => [...prev, created])
      }
      message.success(t('common.success'))
      setModalOpen(false)
    } catch {
      message.error(t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const resourceType = Form.useWatch('type', form) as ResourceType | undefined

  const columns = [
    {
      title: t('pages.booking.resources.nameLabel'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: BookableResource) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>
          )}
        </div>
      ),
    },
    {
      title: t('pages.booking.resources.resourceTypeLabel'),
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: ResourceType) => (
        <Tag color={RESOURCE_TYPE_TAG_COLORS[type]}>
          {t(`pages.booking.resourceType.${type}`)}
        </Tag>
      ),
    },
    {
      title: t('pages.booking.resources.capacityLabel'),
      dataIndex: 'capacity',
      key: 'capacity',
      width: 80,
      align: 'center' as const,
    },
    {
      title: t('common.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'default'}>
          {isActive ? t('pages.booking.public.active') : t('pages.booking.public.inactive')}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: BookableResource) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm
            title={t('common.confirm')}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Spin spinning={loading}>
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
              {t('pages.booking.resources.title')}
            </h2>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t('pages.booking.resources.resourceCount', {
                total: resources.length,
                active: resources.filter((r) => r.isActive).length,
              })}
            </Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            {t('pages.booking.resources.addResource')}
          </Button>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder={t('pages.booking.resources.searchPlaceholder')}
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 300 }}
            allowClear
          />
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 160 }}
            options={[
              { value: 'ALL', label: t('pages.booking.resources.allTypes') },
              ...RESOURCE_TYPE_KEYS.map((rt) => ({
                value: rt,
                label: t(`pages.booking.resourceType.${rt}`),
              })),
            ]}
          />
          <div style={{ marginLeft: 'auto' }}>
            <Segmented
              value={viewMode}
              onChange={(v) => setViewMode(v as 'grid' | 'list')}
              options={[
                { value: 'list', icon: <UnorderedListOutlined /> },
                { value: 'grid', icon: <AppstoreOutlined /> },
              ]}
            />
          </div>
        </div>

        {/* Content */}
        {viewMode === 'list' ? (
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="id"
            pagination={false}
            locale={{ emptyText: t('pages.booking.resources.noResources') }}
          />
        ) : (
          <Row gutter={[16, 16]}>
            {filtered.map((resource) => (
              <Col key={resource.id} xs={24} sm={12} lg={8}>
                <Card
                  size="small"
                  actions={[
                    <EditOutlined key="edit" onClick={() => handleEdit(resource)} />,
                    <Popconfirm
                      key="delete"
                      title={t('common.confirm')}
                      onConfirm={() => handleDelete(resource.id)}
                    >
                      <DeleteOutlined />
                    </Popconfirm>,
                  ]}
                >
                  <Card.Meta
                    title={
                      <Space>
                        {resource.name}
                        {!resource.isActive && <Tag>{t('pages.booking.public.inactive')}</Tag>}
                      </Space>
                    }
                    description={
                      <div>
                        <div>{resource.description}</div>
                        <Space style={{ marginTop: 8 }}>
                          <Tag color={RESOURCE_TYPE_TAG_COLORS[resource.type]}>
                            {t(`pages.booking.resourceType.${resource.type}`)}
                          </Tag>
                          <span style={{ fontSize: 12, color: '#999' }}>
                            {t('pages.booking.resources.capacityLabel')}: {resource.capacity}
                          </span>
                        </Space>
                      </div>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}

        {/* Add/Edit Modal */}
        <Modal
          title={editingResource ? t('pages.booking.resources.editResource') : t('pages.booking.resources.addResourceTitle')}
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          onOk={handleSave}
          confirmLoading={saving}
          width={520}
          destroyOnClose
        >
          <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item
              label={t('pages.booking.resources.resourceTypeLabel')}
              name="type"
              rules={[{ required: true }]}
            >
              <Select
                options={RESOURCE_TYPE_KEYS.map((rt) => ({
                  value: rt,
                  label: t(`pages.booking.resourceType.${rt}`),
                }))}
              />
            </Form.Item>
            <Form.Item
              label={t('pages.booking.resources.nameLabel')}
              name="name"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item label={t('pages.booking.resources.descriptionLabel')} name="description">
              <TextArea rows={2} />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label={t('pages.booking.resources.capacityLabel')} name="capacity">
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={t('pages.booking.public.active')} name="isActive" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            </Row>

            {resourceType && (
              <>
                <div style={{ margin: '8px 0 16px', fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {t('pages.booking.resources.attributes', { type: t(`pages.booking.resourceType.${resourceType}`) })}
                </div>
                <TypeSpecificFields type={resourceType} t={t} />
              </>
            )}
          </Form>
        </Modal>
      </div>
    </Spin>
  )
}
