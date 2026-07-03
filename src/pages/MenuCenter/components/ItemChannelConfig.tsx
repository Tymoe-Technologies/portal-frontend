/**
 * ItemChannelConfig - 商品可售范围配置弹窗
 *
 * 可售范围判断逻辑：
 *   POS / DELIVERY / CUSTOM → order-service order_source_configs（isActive）
 *   ONLINE（在线点单）       → order-service merchants/:id/config（enabled）
 *   KIOSK（自助点餐）        → auth-service devices（存在 KIOSK 类型设备）
 */
import React, { useEffect, useState } from 'react'
import { useAuthContext } from '../../../auth/AuthProvider'
import { storeMenuService, type StoreItemChannel } from '../../../services/store-menu'
import { getSalesChannels, type SalesChannel } from '../../../services/order-config'
import { getOnlineOrderConfig } from '../../../services/onlineOrder'
import { getDevices } from '../../../services/device'
import { Modal, Table, Switch, Badge, Btn, Spinner, EmptyState, toast, type Column } from '@/components/ui-kit'

// sourceType → channel_code 映射
const SOURCE_TYPE_TO_CODE: Record<string, string> = {
  POS: 'pos',
  ONLINE: 'online',
  DELIVERY: 'delivery',
  SELF_SERVICE: 'kiosk',
  CUSTOM: 'custom',
}

type BadgeVariant = 'default' | 'blue' | 'green' | 'gold'
// 可售范围徽章配色（去紫：kiosk 原为 purple → gold）
const CHANNEL_VARIANT: Record<string, BadgeVariant> = {
  pos: 'blue',
  online: 'green',
  self_delivery: 'blue',
  delivery: 'gold',
  kiosk: 'gold',
  custom: 'default',
}

interface ChannelRow {
  channelCode: string
  label: string
  variant: BadgeVariant
  isVisible: boolean
}

interface Props {
  open: boolean
  itemId: string
  itemName: string
  onClose: () => void
}

const ItemChannelConfig: React.FC<Props> = ({ open, itemId, itemName, onClose }) => {
  const { organizations } = useAuthContext()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<ChannelRow[]>([])

  const currentOrgId = localStorage.getItem('organization_id') ?? ''
  // 保留：当前 org 上下文（供后续扩展）
  organizations.find(o => o.id === currentOrgId)

  useEffect(() => {
    if (!open) return
    setLoading(true)

    Promise.all([
      getSalesChannels().catch(() => [] as SalesChannel[]),
      getOnlineOrderConfig(currentOrgId).catch(() => null),
      getDevices({ orgId: currentOrgId, deviceType: 'KIOSK' }).catch(() => ({ data: [] })),
      storeMenuService.getItemChannels(itemId),
    ])
      .then(([sources, onlineConfig, kioskDevices, existingChannels]) => {
        const activeRows: ChannelRow[] = []

        // POS / DELIVERY / CUSTOM
        const orderSourceRows = (sources as SalesChannel[])
          .filter(s => s.isActive && ['POS', 'DELIVERY', 'CUSTOM'].includes(s.sourceType))
          .map(s => {
            const code = SOURCE_TYPE_TO_CODE[s.sourceType] ?? s.sourceType.toLowerCase()
            const existing = existingChannels.find((c: StoreItemChannel) => c.channelCode === code)
            return {
              channelCode: code,
              label: s.sourceName,
              variant: CHANNEL_VARIANT[code] ?? 'default',
              isVisible: existing ? existing.isVisible : true,
            }
          })
        activeRows.push(...orderSourceRows)

        // ONLINE：网页下单 + 自配送
        if ((onlineConfig as any)?.enabled) {
          const existingOnline = existingChannels.find((c: StoreItemChannel) => c.channelCode === 'online')
          activeRows.push({
            channelCode: 'online',
            label: '网页下单',
            variant: CHANNEL_VARIANT.online,
            isVisible: existingOnline ? existingOnline.isVisible : true,
          })
          if ((onlineConfig as any)?.allowDelivery) {
            const existingSD = existingChannels.find((c: StoreItemChannel) => c.channelCode === 'self_delivery')
            activeRows.push({
              channelCode: 'self_delivery',
              label: '自配送',
              variant: CHANNEL_VARIANT.self_delivery,
              isVisible: existingSD ? existingSD.isVisible : true,
            })
          }
        }

        // KIOSK
        const kioskCount = ((kioskDevices as any)?.data ?? []).length
        if (kioskCount > 0) {
          const existing = existingChannels.find((c: StoreItemChannel) => c.channelCode === 'kiosk')
          activeRows.push({
            channelCode: 'kiosk',
            label: `自助点餐 (${kioskCount} 台)`,
            variant: CHANNEL_VARIANT.kiosk,
            isVisible: existing ? existing.isVisible : true,
          })
        }

        const ORDER = ['pos', 'online', 'self_delivery', 'kiosk', 'delivery', 'custom']
        activeRows.sort((a, b) => {
          const ai = ORDER.indexOf(a.channelCode)
          const bi = ORDER.indexOf(b.channelCode)
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
        })

        setRows(activeRows)
      })
      .catch(() => toast.error('加载可售范围失败'))
      .finally(() => setLoading(false))
  }, [open, itemId, currentOrgId])

  const handleToggle = (code: string, val: boolean) => {
    setRows(prev => prev.map(r => r.channelCode === code ? { ...r, isVisible: val } : r))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await storeMenuService.batchSetItemChannels(itemId, rows.map(r => ({ channelCode: r.channelCode, isVisible: r.isVisible })))
      toast.success('可售范围已保存')
      onClose()
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const columns: Column<ChannelRow>[] = [
    { key: 'label', title: '入口', render: r => <Badge variant={r.variant}>{r.label}</Badge> },
    {
      key: 'isVisible', title: '本店可见', width: 120,
      render: r => <Switch checked={r.isVisible} onCheckedChange={v => handleToggle(r.channelCode, v)} />,
    },
  ]

  return (
    <Modal
      open={open}
      onOpenChange={v => !v && onClose()}
      title={<span>可售范围 <span className="text-sm font-normal text-slate-400">— {itemName}</span></span>}
      size="lg"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>取消</Btn>
          <Btn variant="primary" loading={saving} disabled={rows.length === 0} onClick={handleSave}>保存</Btn>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-400">
          显示已开通的入口：POS/第三方配送/自定义来自订单配置；网页下单/自配送来自在线点单配置；自助点餐来自设备管理。
        </p>
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState title="暂无已开通入口" />
        ) : (
          <Table columns={columns} data={rows} rowKey={r => r.channelCode} />
        )}
      </div>
    </Modal>
  )
}

export default ItemChannelConfig
