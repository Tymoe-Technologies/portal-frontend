import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, RotateCcw } from 'lucide-react'
import {
  getPickupNumberConfig,
  updatePickupNumberConfig,
  type PickupNumberConfig as PickupNumberConfigType,
} from '../../services/print-settings'
import { getSalesChannels } from '../../services/order-config'
import { getOnlineOrderConfig } from '../../services/onlineOrder'
import {
  PageHeader, SectionCard, FormRow, AlertBox, Switch, NumberInput,
  TextInput, Btn, Badge, Spinner, Table, type Column,
} from '../../components/ui-kit'

// 各终端的默认标识
const DEFAULT_PREFIX: Record<string, string> = {
  POS: 'P',
  WEB: 'W',
  KIOSK: 'K',
}

// 终端显示名称与徽章配色
const TERMINAL_DISPLAY: Record<string, { label: string; variant: 'blue' | 'green' | 'gold' }> = {
  POS: { label: 'POS 收银', variant: 'blue' },
  WEB: { label: '在线点单', variant: 'green' },
  KIOSK: { label: '自助点单', variant: 'gold' },
}

interface TerminalRow {
  terminal: string   // 订单终端类型：POS / WEB / KIOSK
  displayName: string
}

const PickupNumberConfig: React.FC = () => {
  const navigate = useNavigate()

  const [config, setConfig] = useState<PickupNumberConfigType>({ startAt: 1, showPrefix: true, channelPrefixes: {}, queueDisplayEnabled: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [editStartAt, setEditStartAt] = useState(1)
  const [editShowPrefix, setEditShowPrefix] = useState(true)
  const [editPrefixes, setEditPrefixes] = useState<Record<string, string>>({})
  const [editQueueDisplay, setEditQueueDisplay] = useState(false)

  // 当前组织下启用的终端行（POS 固定显示，WEB/KIOSK 按配置动态显示）
  const [terminalRows, setTerminalRows] = useState<TerminalRow[]>([])
  const [terminalsLoading, setTerminalsLoading] = useState(false)

  // 内联提示
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const notify = (type: 'success' | 'error', msg: string) => {
    setFlash({ type, msg })
    setTimeout(() => setFlash(null), type === 'success' ? 3000 : 5000)
  }

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const data = await getPickupNumberConfig()
      setConfig(data)
      setEditStartAt(data.startAt)
      setEditShowPrefix(data.showPrefix)
      setEditPrefixes({ ...(data.channelPrefixes ?? {}) })
      setEditQueueDisplay(data.queueDisplayEnabled ?? false)
    } catch {
      notify('error', '获取取餐号配置失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载终端列表：POS 固定，WEB 看在线点单开关，KIOSK 看销售渠道中是否有激活的 SELF_SERVICE
  const fetchTerminals = async () => {
    try {
      setTerminalsLoading(true)

      const orgId = localStorage.getItem('organization_id')
      const [channels, onlineConfig] = await Promise.all([
        getSalesChannels().catch(() => []),
        orgId ? getOnlineOrderConfig(orgId).catch(() => null) : Promise.resolve(null),
      ])

      const rows: TerminalRow[] = []

      // POS 终端固定显示
      rows.push({ terminal: 'POS', displayName: 'POS 收银' })

      // WEB 终端：在线点单功能开启时显示
      if (onlineConfig?.enabled) {
        rows.push({ terminal: 'WEB', displayName: '在线点单' })
      }

      // KIOSK 终端：销售渠道中有激活的 SELF_SERVICE 时显示
      const kioskChannel = channels.find(c => c.isActive && c.sourceType === 'SELF_SERVICE')
      if (kioskChannel) {
        rows.push({ terminal: 'KIOSK', displayName: kioskChannel.sourceName })
      }

      setTerminalRows(rows)
    } catch {
      // 出错时至少保留 POS
      setTerminalRows([{ terminal: 'POS', displayName: 'POS 收银' }])
    } finally {
      setTerminalsLoading(false)
    }
  }

  useEffect(() => { fetchConfig() }, [])
  useEffect(() => { fetchTerminals() }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      // 只保存当前可见终端的前缀，过滤掉空值
      const channelPrefixes: Record<string, string> = {}
      for (const row of terminalRows) {
        const val = (editPrefixes[row.terminal] ?? '').trim()
        if (val) channelPrefixes[row.terminal] = val
      }
      await updatePickupNumberConfig({ startAt: editStartAt, showPrefix: editShowPrefix, channelPrefixes, queueDisplayEnabled: editQueueDisplay })
      notify('success', '取餐号配置已保存')
      fetchConfig()
    } catch {
      notify('error', '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setEditStartAt(config.startAt)
    setEditShowPrefix(config.showPrefix)
    setEditPrefixes({ ...(config.channelPrefixes ?? {}) })
    setEditQueueDisplay(config.queueDisplayEnabled ?? false)
  }

  const hasChanges =
    editStartAt !== config.startAt ||
    editShowPrefix !== config.showPrefix ||
    editQueueDisplay !== (config.queueDisplayEnabled ?? false) ||
    JSON.stringify(editPrefixes) !== JSON.stringify(config.channelPrefixes ?? {})

  const formatPreview = (n: number, terminal: string) => {
    if (!editShowPrefix) return String(n)
    const prefix = (editPrefixes[terminal] ?? '').trim() || DEFAULT_PREFIX[terminal] || ''
    return prefix ? `${prefix}-${n}` : String(n)
  }

  const previewNums = [editStartAt, editStartAt + 1, editStartAt + 2]

  const terminalColumns: Column<TerminalRow>[] = [
    {
      key: 'terminal',
      title: '终端',
      width: 220,
      render: row => (
        <div className="flex items-center gap-2">
          <Badge variant={TERMINAL_DISPLAY[row.terminal]?.variant ?? 'default'}>
            {TERMINAL_DISPLAY[row.terminal]?.label ?? row.terminal}
          </Badge>
          <span className="text-xs text-slate-400 truncate">{row.displayName}</span>
        </div>
      ),
    },
    {
      key: 'prefix',
      title: '终端标识',
      width: 160,
      render: row => (
        <div className="w-32">
          <TextInput
            value={editPrefixes[row.terminal] ?? DEFAULT_PREFIX[row.terminal] ?? ''}
            onChange={val => setEditPrefixes(prev => ({ ...prev, [row.terminal]: val.slice(0, 5) }))}
            placeholder={`默认：${DEFAULT_PREFIX[row.terminal] ?? row.terminal}`}
            maxLength={5}
          />
        </div>
      ),
    },
    {
      key: 'preview',
      title: '预览效果',
      render: row => (
        <span className="text-slate-500 font-mono text-xs">
          {previewNums.map(n => formatPreview(n, row.terminal)).join('  →  ')}
        </span>
      ),
    },
  ]

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <PageHeader
        title="取餐号配置"
        description="所有终端共享一个递增计数器，每天自动重置，通过终端标识区分订单终端类型。"
        onBack={() => navigate('/order-config')}
      />

      <div className="space-y-4">
        {flash && <AlertBox type={flash.type === 'success' ? 'success' : 'error'} title={flash.msg} />}

        <AlertBox
          type="info"
          title="修改起始号后，当天已生成的取餐号不受影响，从下一个订单起生效。"
        />

        {loading ? (
          <Spinner />
        ) : (
          <>
            {/* 基础配置 */}
            <SectionCard title="基础配置">
              <FormRow label="当日起始号" hint="每天第一单的取餐号">
                <NumberInput value={editStartAt} onChange={v => v > 0 && setEditStartAt(v)} min={1} max={99999} />
              </FormRow>

              <FormRow
                label="显示终端标识"
                hint={editShowPrefix ? '开启：取餐号前加终端标识' : '关闭：仅显示数字'}
              >
                <Switch checked={editShowPrefix} onCheckedChange={setEditShowPrefix} />
              </FormRow>

              <FormRow
                label="叫号屏模式"
                hint={editQueueDisplay ? '已开启：订单需经过 制作中 → 待取餐 流程' : '已关闭：订单可直接完成'}
              >
                <Switch checked={editQueueDisplay} onCheckedChange={setEditQueueDisplay} />
              </FormRow>

              {editQueueDisplay && (
                <div className="pt-3">
                  <AlertBox
                    type="warning"
                    title="开启后，POS 订单不能直接完成，必须依次流转：确认 → 制作中 → 待取餐 → 完成"
                  />
                </div>
              )}
            </SectionCard>

            {/* 终端标识配置 / 预览 */}
            <SectionCard title="终端标识配置" description={terminalsLoading ? '加载终端中…' : undefined}>
              {editShowPrefix ? (
                <Table
                  columns={terminalColumns}
                  data={terminalRows}
                  rowKey={row => row.terminal}
                  empty="暂无可配置的终端"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="text-slate-400">预览效果：</span>
                  <span className="font-mono">{previewNums.join('  →  ')}</span>
                  <span className="text-xs text-slate-400">（所有终端共享）</span>
                </div>
              )}
            </SectionCard>

            {/* 操作按钮 */}
            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="secondary" icon={<RotateCcw className="w-3.5 h-3.5" />} onClick={handleReset} disabled={saving}>
                重置
              </Btn>
              <Btn variant="primary" icon={<Save className="w-3.5 h-3.5" />} loading={saving} disabled={!hasChanges} onClick={handleSave}>
                保存配置
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default PickupNumberConfig
