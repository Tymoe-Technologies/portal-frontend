import React, { useState, useEffect } from 'react'
import { Card, Button, Spin, Empty, Message, Tag, Divider, Row, Col, Form, Modal, Space, List, Avatar, Tooltip, Tabs } from 'antd'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { LoadingOutlined, CheckCircleOutlined, DisconnectOutlined, ExclamationCircleOutlined, ShopOutlined, InfoCircleOutlined, MenuOutlined } from '@ant-design/icons'
import { uberService, UberIntegrationStatus, UberStore, UberActivatedStore } from '@/services/uber'
import StoreManagement from './StoreManagement'
import MenuSync from './MenuSync'
import './UberIntegration.css'

/**
 * Uber 集成配置页面
 * 允许商家连接/断开 Uber 账户，以及选择和管理店铺
 */
const UberIntegration: React.FC = () => {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()

  // 状态管理
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

  // 获取 merchantId（从 localStorage 或其他来源）
  const getMerchantId = (): string => {
    // 这里可以从 localStorage、URL 参数或其他来源获取
    // 暂时使用 localStorage 中的 organization_id 作为 merchantId
    return localStorage.getItem('organization_id') || ''
  }

  const merchantId = getMerchantId()

  /**
   * 加载集成状态
   */
  const loadIntegrationStatus = async () => {
    if (!merchantId) {
      setErrorMessage('无法获取商家 ID')
      setStatusLoading(false)
      return
    }

    try {
      setStatusLoading(true)
      console.log('📡 开始加载集成状态:', { merchantId })
      const status = await uberService.getIntegrationStatus(merchantId)
      console.log('📊 集成状态加载完成:', { status })
      setIntegrationStatus(status)
      // 如果已连接，清除任何之前的错误消息
      if (status.isConnected) {
        setErrorMessage('')
      }
    } catch (error: any) {
      console.error('❌ 加载集成状态出错:', error)
      // 优雅降级：假设未连接，而不是显示错误
      setIntegrationStatus({ isConnected: false })
      // 只在首次加载时显示错误提示（而不是每次都显示）
      // setErrorMessage(error.message || '加载集成状态失败')
    } finally {
      setStatusLoading(false)
    }
  }

  /**
   * 处理 OAuth 回调参数
   */
  useEffect(() => {
    // 检查 URL 中的 success 参数
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (success === 'true') {
      setSuccessMessage('✅ Uber 连接成功!')
      // 清除 URL 参数
      window.history.replaceState({}, document.title, window.location.pathname)
      // 重新加载状态
      setTimeout(() => {
        loadIntegrationStatus()
        setSuccessMessage('')
      }, 2000)
    } else if (error) {
      setErrorMessage(`❌ 授权失败: ${errorDescription || error}`)
      window.history.replaceState({}, document.title, window.location.pathname)
      setTimeout(() => setErrorMessage(''), 5000)
    }
  }, [searchParams])

  /**
   * 加载可用的店铺列表
   * 仅在已连接的情况下调用
   */
  const loadAvailableStores = async () => {
    if (!merchantId || !integrationStatus?.isConnected) {
      // 未连接时不加载店铺列表
      return
    }

    try {
      setStoresLoading(true)
      console.log('📡 开始加载可用店铺列表...')
      const availableStores = await uberService.discoverStores(merchantId)
      console.log('✓ 获取可用店铺:', availableStores)
      setStores(availableStores)

      // 同时加载已激活的店铺
      console.log('📡 查询已激活的店铺...')
      const activated = await uberService.getActivatedStore(merchantId)
      console.log('✓ 已激活店铺:', activated)
      setActivatedStore(activated)
    } catch (error: any) {
      console.error('❌ 加载店铺列表出错:', error)
      setErrorMessage(error.message || '加载店铺列表失败')
    } finally {
      setStoresLoading(false)
    }
  }

  /**
   * 选择并激活店铺
   */
  const handleSelectStore = async (store: UberStore) => {
    if (!merchantId) {
      setErrorMessage('无法获取商家 ID')
      return
    }

    try {
      setActivatingStoreId(store.id)
      await uberService.selectAndActivateStore(merchantId, store.id, store.name, store)
      setSuccessMessage(`✅ 店铺 "${store.name}" 已成功激活！`)

      // 重新加载店铺状态
      setTimeout(() => {
        loadAvailableStores()
        setShowStoreSelection(false)
        setSuccessMessage('')
      }, 1500)
    } catch (error: any) {
      setErrorMessage(error.message || '激活店铺失败')
    } finally {
      setActivatingStoreId(null)
    }
  }

  /**
   * 解绑当前店铺
   */
  const handleUnbindStore = () => {
    Modal.confirm({
      title: '解绑店铺',
      icon: <ExclamationCircleOutlined />,
      content: `确定要解绑店铺 "${activatedStore?.storeName}" 吗？解绑后可以绑定其他店铺。`,
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!merchantId) return

        try {
          setLoading(true)
          await uberService.unbindStore(merchantId)
          setSuccessMessage('✅ 店铺已解绑')
          setActivatedStore(null)
          setTimeout(() => {
            setSuccessMessage('')
            loadAvailableStores()
          }, 1500)
        } catch (error: any) {
          setErrorMessage(error.message || '解绑店铺失败')
        } finally {
          setLoading(false)
        }
      }
    })
  }

  /**
   * 初始化：加载集成状态
   */
  useEffect(() => {
    loadIntegrationStatus()
  }, [merchantId])

  /**
   * 当集成状态变化时，加载店铺列表
   */
  useEffect(() => {
    loadAvailableStores()
  }, [integrationStatus?.isConnected, merchantId])

  /**
   * 调试：诊断店铺列表问题
   */
  const handleDebugStores = async () => {
    if (!merchantId) {
      setErrorMessage('无法获取商家 ID')
      return
    }

    try {
      setStoresLoading(true)
      console.log('🔍 开始诊断店铺列表问题...')
      const backendUrl = uberService.getBaseUrl()
      const response = await fetch(
        `${backendUrl}/api/uber/v1/stores/debug`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
          },
          body: JSON.stringify({ merchantId })
        }
      )

      const debugData = await response.json()
      console.log('🔍 诊断结果:', debugData)

      const debugInfo = debugData.debug || {}
      const database = debugInfo.database || {}
      const uber = debugInfo.uber || {}
      const hasStores = uber.storesFound > 0

      // 显示诊断信息
      Modal.info({
        title: '店铺列表诊断结果',
        width: 900,
        content: (
          <div style={{ maxHeight: '500px', overflowY: 'auto', fontSize: '12px' }}>
            <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: hasStores ? '#f6ffed' : '#fff1f0', borderLeft: `4px solid ${hasStores ? '#52c41a' : '#ff4d4f'}` }}>
              <strong>{hasStores ? '✅ 店铺检测成功' : '⚠️ 未检测到店铺'}</strong>
              <p>{hasStores ? `检测到 ${uber.storesFound} 个店铺` : '未从 Uber API 获取到任何店铺'}</p>
            </div>

            <h4>📊 数据库状态：</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '5px', width: '40%' }}>集成已创建：</td>
                  <td>{database.hasMerchantIntegration ? '✅ 是' : '❌ 否'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '5px' }}>Access Token：</td>
                  <td>{database.hasAccessToken ? '✅ 已保存' : '❌ 缺失'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '5px' }}>Token 过期时间：</td>
                  <td>{database.tokenExpiresAt ? new Date(database.tokenExpiresAt).toLocaleString() : '无'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '5px' }}>Token 有效性：</td>
                  <td>{database.tokenValid ? '✅ 有效' : '❌ 已过期或无效'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '5px' }}>已绑定店铺：</td>
                  <td>{database.platformStoreId ? `${database.platformStoreName} (${database.platformStoreId})` : '未绑定'}</td>
                </tr>
              </tbody>
            </table>

            <h4>🌐 Uber API 响应：</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '5px', width: '40%' }}>检测到的店铺数：</td>
                  <td><strong>{uber.storesFound}</strong></td>
                </tr>
                {uber.storesFound > 0 && (
                  <tr style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '5px' }}>店铺列表：</td>
                    <td>
                      {uber.stores?.map((store: any) => (
                        <div key={store.id}>{store.name} ({store.id})</div>
                      ))}
                    </td>
                  </tr>
                )}
                {uber.error && (
                  <tr style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '5px' }}>错误信息：</td>
                    <td style={{ color: 'red' }}>{uber.error}</td>
                  </tr>
                )}
                {uber.errorDetails && (
                  <tr style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '5px' }}>错误详情：</td>
                    <td style={{ color: 'red', fontSize: '11px' }}>
                      <pre style={{ margin: 0, maxWidth: '300px', overflow: 'auto' }}>{JSON.stringify(uber.errorDetails, null, 2)}</pre>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {!hasStores && (
              <div style={{ padding: '10px', backgroundColor: '#fffbe6', border: '1px solid #ffe58f', borderRadius: '4px', marginTop: '15px' }}>
                <h4 style={{ marginTop: 0 }}>💡 可能的原因和解决方案：</h4>
                <ul style={{ marginBottom: 0 }}>
                  <li><strong>最可能：</strong> 你的 Uber Eats 账户中还没有添加任何店铺</li>
                  <li>检查步骤：
                    <ol style={{ marginTop: '5px' }}>
                      <li>访问 <a href="https://partners.uber.com" target="_blank" rel="noopener noreferrer">https://partners.uber.com</a></li>
                      <li>登录你的 Uber 账户</li>
                      <li>在"Stores"或"Restaurants"菜单中检查是否有店铺</li>
                      <li>如果没有，请先创建一个店铺</li>
                      <li>然后重新授权此应用</li>
                    </ol>
                  </li>
                  <li>如果已有店铺但仍无法显示，可能是权限问题，请重新授权</li>
                </ul>
              </div>
            )}
          </div>
        ),
        okText: '关闭',
      })
    } catch (error: any) {
      console.error('❌ 诊断失败:', error)
      setErrorMessage('诊断失败: ' + error.message)
    } finally {
      setStoresLoading(false)
    }
  }

  /**
   * 点击连接 Uber 按钮
   */
  const handleConnectUber = async () => {
    if (!merchantId) {
      setErrorMessage('无法获取商家 ID')
      return
    }

    try {
      setConnecting(true)
      const authorizationUrl = await uberService.generateAuthorizationUrl(merchantId)
      // 重定向到 Uber 授权页面
      window.location.href = authorizationUrl
    } catch (error: any) {
      setErrorMessage(error.message || '生成授权 URL 失败')
    } finally {
      setConnecting(false)
    }
  }

  /**
   * 点击断开连接按钮
   */
  const handleDisconnect = () => {
    Modal.confirm({
      title: '断开 Uber 连接',
      icon: <ExclamationCircleOutlined />,
      content: '确定要断开 Uber 连接吗?断开后，您将无法在此平台上使用 Uber 订单服务。',
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!merchantId) return

        try {
          setLoading(true)
          await uberService.disconnect(merchantId)
          setSuccessMessage('✅ Uber 连接已断开')
          setIntegrationStatus(null)
          setTimeout(() => setSuccessMessage(''), 3000)
          // 重新加载状态
          await loadIntegrationStatus()
        } catch (error: any) {
          setErrorMessage(error.message || '断开连接失败')
        } finally {
          setLoading(false)
        }
      }
    })
  }

  // 页面内容
  const renderContent = () => {
    if (statusLoading) {
      return (
        <div className="uber-loading-container">
          <Spin
            indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />}
            tip="正在加载集成状态..."
          />
        </div>
      )
    }

    if (!integrationStatus?.isConnected) {
      return (
        <div className="uber-empty-container">
          <Empty
            description="未连接 Uber"
            style={{ marginTop: '50px' }}
          >
            <p style={{ color: '#999', marginBottom: '20px' }}>
              连接您的 Uber 账户以启用订单、菜单和商店管理功能
            </p>
            <Button
              type="primary"
              size="large"
              loading={connecting}
              onClick={handleConnectUber}
            >
              连接 Uber
            </Button>
          </Empty>
        </div>
      )
    }

    // 已连接状态
    return (
      <div className="uber-connected-container">
        {/* 集成状态 - 紧凑信息条 */}
        <div className="integration-status-bar">
          <Row align="middle" justify="space-between" gutter={[16, 16]}>
            <Col flex="auto">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '18px' }} />
                <div style={{ fontWeight: '500', color: '#333' }}>Uber 已连接</div>
              </div>
            </Col>
            <Col>
              <Space size="middle">
                {integrationStatus.lastUsedAt && (
                  <Tooltip title={new Date(integrationStatus.lastUsedAt).toLocaleString('zh-CN')}>
                    <span style={{ fontSize: '12px', color: '#999' }}>
                      最后使用: {new Date(integrationStatus.lastUsedAt).toLocaleDateString('zh-CN')}
                    </span>
                  </Tooltip>
                )}
                <Button
                  type="text"
                  size="small"
                  icon={<InfoCircleOutlined />}
                  onClick={() => setShowDetailedStatus(!showDetailedStatus)}
                />
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DisconnectOutlined />}
                  onClick={handleDisconnect}
                  loading={loading}
                  title="断开 Uber 连接"
                />
              </Space>
            </Col>
          </Row>

          {/* 详细信息 - 可展开 */}
          {showDetailedStatus && integrationStatus.connectedAt && (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0f0f0', fontSize: '12px', color: '#999' }}>
              连接时间: {new Date(integrationStatus.connectedAt).toLocaleString('zh-CN')}
            </div>
          )}
        </div>

        {/* 店铺绑定状态卡片 */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShopOutlined style={{ color: '#1890ff', fontSize: '20px' }} />
              <span>店铺管理</span>
            </div>
          }
          variant="filled"
          style={{ marginBottom: '20px' }}
        >
          {activatedStore ? (
            // 已绑定店铺
            <div>
              {/* 店铺信息 - 顶部显示 */}
              <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #f0f0f0' }}>
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span style={{ fontWeight: '500', color: '#333' }}>店铺：</span>
                      <Tag color="green">{activatedStore.storeName}</Tag>
                      <Button
                        type="text"
                        danger
                        size="small"
                        onClick={handleUnbindStore}
                        loading={loading}
                        style={{ marginLeft: 'auto' }}
                      >
                        解绑
                      </Button>
                    </div>
                  </Col>

                  {activatedStore.storeEmail && (
                    <Col span={12}>
                      <div style={{ fontSize: '12px', color: '#999' }}>邮箱</div>
                      <div style={{ fontSize: '14px', color: '#333', marginTop: '4px' }}>{activatedStore.storeEmail}</div>
                    </Col>
                  )}

                  {activatedStore.storeAddress && (
                    <Col span={12}>
                      <div style={{ fontSize: '12px', color: '#999' }}>地址</div>
                      <div style={{ fontSize: '14px', color: '#333', marginTop: '4px' }}>{activatedStore.storeAddress}</div>
                    </Col>
                  )}

                  {activatedStore.cuisines && activatedStore.cuisines.length > 0 && (
                    <Col span={24}>
                      <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>菜系</div>
                      <div>
                        {activatedStore.cuisines.map((cuisine) => (
                          <Tag key={cuisine} color="blue" style={{ marginRight: '5px' }}>
                            {cuisine}
                          </Tag>
                        ))}
                      </div>
                    </Col>
                  )}
                </Row>
              </div>

              {/* 功能标签页 */}
              <Divider style={{ margin: '24px 0' }} />
              <Tabs
                defaultActiveKey="store"
                type="card"
                items={[
                  {
                    key: 'store',
                    label: (
                      <span>
                        <ShopOutlined />
                        店铺管理
                      </span>
                    ),
                    children: (
                      <StoreManagement
                        merchantId={merchantId}
                        storeId={activatedStore.storeId}
                        storeName={activatedStore.storeName}
                      />
                    )
                  },
                  {
                    key: 'menu',
                    label: (
                      <span>
                        <MenuOutlined />
                        菜单同步
                      </span>
                    ),
                    children: (
                      <MenuSync
                        merchantId={merchantId}
                        storeId={activatedStore.storeId}
                        storeName={activatedStore.storeName}
                        integrationId={activatedStore.integrationId}
                      />
                    )
                  }
                ]}
              />
            </div>
          ) : (
            // 未绑定店铺
            <Empty
              description="还未绑定任何店铺"
              style={{ marginTop: '20px' }}
            >
              <Space>
                <Button
                  type="primary"
                  icon={<ShopOutlined />}
                  onClick={() => {
                    setShowStoreSelection(true)
                    loadAvailableStores()
                  }}
                  loading={storesLoading}
                >
                  选择店铺
                </Button>
                <Button
                  type="default"
                  onClick={handleDebugStores}
                  loading={storesLoading}
                >
                  🔍 诊断
                </Button>
              </Space>
            </Empty>
          )}
        </Card>

        {/* 店铺选择模态框 */}
        <Modal
          title="选择和绑定店铺"
          open={showStoreSelection}
          onCancel={() => setShowStoreSelection(false)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button
                type="text"
                onClick={handleDebugStores}
                loading={storesLoading}
              >
                🔍 诊断店铺列表
              </Button>
              <Button onClick={() => setShowStoreSelection(false)}>
                关闭
              </Button>
            </div>
          }
          width={600}
        >
          <Spin spinning={storesLoading} fullscreen={false}>
            {stores.length === 0 ? (
              <Empty
                description="没有可用的店铺"
                style={{ marginTop: '30px', marginBottom: '30px' }}
              />
            ) : (
              <List
                dataSource={stores}
                renderItem={(store) => (
                  <List.Item
                    key={store.id}
                    extra={
                      <Button
                        type="primary"
                        loading={activatingStoreId === store.id}
                        onClick={() => handleSelectStore(store)}
                        disabled={activatingStoreId !== null}
                      >
                        绑定此店铺
                      </Button>
                    }
                  >
                    <List.Item.Meta
                      avatar={<Avatar icon={<ShopOutlined />} />}
                      title={
                        <div>
                          <strong>{store.name}</strong>
                          {activatedStore?.storeId === store.id && (
                            <Tag color="green" style={{ marginLeft: '10px' }}>
                              当前绑定
                            </Tag>
                          )}
                        </div>
                      }
                      description={
                        <div style={{ fontSize: '12px' }}>
                          {store.email && <div>📧 {store.email}</div>}
                          {store.address && <div>📍 {store.address}</div>}
                          {store.cuisines && store.cuisines.length > 0 && (
                            <div style={{ marginTop: '5px' }}>
                              🍴 {store.cuisines.join(', ')}
                            </div>
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Spin>
        </Modal>
      </div>
    )
  }

  return (
    <div className="uber-integration-page">
      {/* <Card
        title="Uber 集成"
        variant="filled"
        style={{ marginBottom: '20px' }}
      >
        <p style={{ color: '#666', marginBottom: '0' }}>
          连接您的 Uber 账户以启用订单管理、菜单同步和商店信息管理功能。
        </p>
      </Card> */}

      {/* 成功消息 */}
      {successMessage && (
        <div className="success-message" style={{ marginBottom: '20px' }}>
          <Card style={{ backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}>
            {successMessage}
          </Card>
        </div>
      )}

      {/* 错误消息 */}
      {errorMessage && (
        <div className="error-message" style={{ marginBottom: '20px' }}>
          <Card style={{ backgroundColor: '#fff2f0', borderColor: '#ffccc7' }}>
            {errorMessage}
          </Card>
        </div>
      )}

      {/* 主要内容 */}
      {renderContent()}
    </div>
  )
}

export default UberIntegration
