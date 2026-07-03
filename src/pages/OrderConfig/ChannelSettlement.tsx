import { useState, useEffect, useCallback } from 'react'
import dayjs from 'dayjs'
import { CheckCircle2, History, DollarSign, CreditCard } from 'lucide-react'
import {
  channelSettlementService,
  ChannelReceivableGroup,
  ChannelReceivableItem,
  CreditStatus,
  CreditChannel,
} from '@/services/channel-settlement'
import {
  PageHeader, SectionCard, StatCard, Table, Badge, Btn, Modal, Spinner,
  EmptyState, ProgressBar, TextInput, FormRow, AlertBox, type Column,
} from '@/components/ui-kit'

function centsToDisplay(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

const ITEM_STATUS: Record<string, { variant: 'gold' | 'blue' | 'red' | 'green'; label: string }> = {
  UNPAID:         { variant: 'gold',  label: '未结清' },
  PARTIALLY_PAID: { variant: 'blue',  label: '部分付' },
  OVERDUE:        { variant: 'red',   label: '已逾期' },
  PAID:           { variant: 'green', label: '已结清' },
}

// 展开行：显示该渠道的所有未结订单
function ExpandedOrders({ items }: { items: ChannelReceivableItem[] }) {
  const totalBalance = items.reduce((s, i) => s + i.balance, 0)

  const cols: Column<ChannelReceivableItem>[] = [
    {
      key: 'orderNumber',
      title: '订单号',
      width: 180,
      render: r => (
        <div>
          <div className="font-mono text-[13px] tracking-wide text-slate-800">{r.orderNumber || '—'}</div>
          {!r.orderNumber && <div className="text-[11px] text-slate-400">{r.orderId.slice(0, 12)}…</div>}
        </div>
      ),
    },
    {
      key: 'createdAt',
      title: '下单时间',
      width: 130,
      render: r => (
        <div>
          <div className="text-[13px]">{dayjs(r.createdAt).format('MM月DD日')}</div>
          <div className="text-[11px] text-slate-400">{dayjs(r.createdAt).format('HH:mm')}</div>
        </div>
      ),
    },
    { key: 'amount', title: '订单金额', width: 110, render: r => <span className="text-[13px]">{centsToDisplay(r.amount)}</span> },
    {
      key: 'balance',
      title: '未结金额',
      width: 120,
      render: r => (
        <div>
          <div className="text-[13px] font-semibold text-red-600">{centsToDisplay(r.balance)}</div>
          {r.balance < r.amount && <div className="text-[11px] text-slate-400">已收 {centsToDisplay(r.amount - r.balance)}</div>}
        </div>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 90,
      render: r => {
        const cfg = ITEM_STATUS[r.status] ?? { variant: 'default' as const, label: r.status }
        return <Badge variant={cfg.variant as any}>{cfg.label}</Badge>
      },
    },
  ]

  return (
    <div className="rounded-lg bg-white border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs text-slate-400">共 {items.length} 笔未结账单</span>
        <span className="text-[13px] text-slate-600">
          合计欠款：<span className="font-semibold text-red-600">{centsToDisplay(totalBalance)}</span>
        </span>
      </div>
      <Table columns={cols} data={items} rowKey={r => r.id} />
    </div>
  )
}

// 结算历史弹窗
function HistoryModal({ channelId, channelName, open, onClose }: {
  channelId: string
  channelName: string
  open: boolean
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ChannelReceivableItem[]>([])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    channelSettlementService.getSettlementHistory(channelId)
      .then(r => setData(r?.items ?? []))
      .finally(() => setLoading(false))
  }, [open, channelId])

  const cols: Column<ChannelReceivableItem>[] = [
    { key: 'orderNumber', title: '订单号', render: r => <span className="font-mono text-[11px] text-slate-600">{r.orderNumber || r.orderId.slice(0, 8) + '…'}</span> },
    { key: 'amount', title: '金额', render: r => centsToDisplay(r.amount) },
    { key: 'paidAt', title: '结清时间', render: r => r.paidAt ? dayjs(r.paidAt).format('YYYY-MM-DD HH:mm') : '-' },
  ]

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()} title={`结算历史 — ${channelName}`} size="lg">
      {loading ? (
        <Spinner />
      ) : data.length === 0 ? (
        <EmptyState title="暂无结算记录" />
      ) : (
        <Table columns={cols} data={data} rowKey={r => r.id} />
      )}
    </Modal>
  )
}

// 授信额度展示
function CreditStatusCell({ channelId }: { channelId: string }) {
  const [status, setStatus] = useState<CreditStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    channelSettlementService.getChannelCreditStatus(channelId)
      .then(setStatus)
      .finally(() => setLoading(false))
  }, [channelId])

  if (loading) return <span className="text-xs text-slate-400">加载中…</span>
  if (!status) return <span className="text-xs text-slate-400">未配置额度</span>

  const usedPct = status.cycleLimit > 0 ? Math.min(100, Math.round(status.usedAmount / status.cycleLimit * 100)) : 0
  const isWarning = usedPct >= 80
  const hasPreviousUnpaid = status.previousUnpaid > 0
  const cycleLabel: Record<string, string> = { WEEKLY: '周', BIWEEKLY: '双周', MONTHLY: '月' }
  const tone = hasPreviousUnpaid || isWarning ? 'danger' : 'default'

  return (
    <div className="min-w-[220px] max-w-[260px]">
      {hasPreviousUnpaid && (
        <div className="mb-1.5 rounded-md bg-red-50 border border-red-200 px-2 py-1 text-[11px] text-red-700">
          ⚠ 上期欠款 {centsToDisplay(status.previousUnpaid)}，已暂停下单
        </div>
      )}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">{cycleLabel[status.billingCycle] || status.billingCycle}度额度</span>
        <span className="text-xs font-medium text-slate-700">
          {centsToDisplay(status.usedAmount)} / {centsToDisplay(status.cycleLimit)}
        </span>
      </div>
      <ProgressBar percent={usedPct} tone={tone} />
      <div className={`text-[11px] mt-1 ${status.availableAmount <= 0 || hasPreviousUnpaid ? 'text-red-600' : 'text-slate-400'}`}>
        {hasPreviousUnpaid ? '下单已暂停，请先结清上期' : `剩余 ${centsToDisplay(status.availableAmount)}`}
      </div>
    </div>
  )
}

// 把渠道列表和 receivables 合并成统一的展示行
function mergeChannels(channels: CreditChannel[], groups: ChannelReceivableGroup[]): ChannelReceivableGroup[] {
  const groupMap = new Map(groups.map(g => [g.channelId, g]))
  return channels.map(ch => groupMap.get(ch.id) ?? {
    channelId: ch.id,
    channelName: ch.sourceName,
    orderCount: 0,
    totalAmount: 0,
    items: [],
  })
}

export default function ChannelSettlement() {
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState<ChannelReceivableGroup[]>([])
  const [settling, setSettling] = useState<string | null>(null)
  const [noteInput, setNoteInput] = useState('')
  const [confirmTarget, setConfirmTarget] = useState<ChannelReceivableGroup | null>(null)
  const [historyTarget, setHistoryTarget] = useState<{ id: string; name: string } | null>(null)
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const notify = (type: 'success' | 'error', msg: string) => {
    setFlash({ type, msg }); setTimeout(() => setFlash(null), type === 'success' ? 3500 : 5000)
  }

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      channelSettlementService.listCreditChannels(),
      channelSettlementService.listChannelReceivables(),
    ])
      .then(([channels, receivables]) => setGroups(mergeChannels(channels, receivables)))
      .catch(() => notify('error', '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const totalOutstanding = groups.reduce((s, g) => s + g.totalAmount, 0)
  const pendingCount = groups.filter(g => g.totalAmount > 0).length

  async function handleSettle() {
    if (!confirmTarget?.channelId) return
    setSettling(confirmTarget.channelId)
    try {
      const result = await channelSettlementService.settleChannel(confirmTarget.channelId, noteInput || undefined)
      notify('success', `已结清 ${result.settledCount} 笔订单，合计 ${centsToDisplay(result.totalAmount)}`)
      setConfirmTarget(null)
      setNoteInput('')
      load()
    } catch {
      notify('error', '结算失败，请重试')
    } finally {
      setSettling(null)
    }
  }

  const columns: Column<ChannelReceivableGroup>[] = [
    { key: 'channelName', title: '渠道', render: r => <span className="font-medium text-slate-800">{r.channelName || '未知渠道'}</span> },
    {
      key: 'credit',
      title: '授信额度',
      render: r => r.channelId ? <CreditStatusCell channelId={r.channelId} /> : <span className="text-xs text-slate-400">-</span>,
    },
    { key: 'orderCount', title: '未结订单数', render: r => <Badge variant="gold">{r.orderCount} 笔</Badge> },
    { key: 'totalAmount', title: '未结金额', render: r => <span className="font-semibold text-red-600">{centsToDisplay(r.totalAmount)}</span> },
    {
      key: 'actions',
      title: '操作',
      render: r => (
        <div className="flex items-center gap-2">
          <Btn
            variant="primary"
            size="sm"
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            disabled={r.totalAmount === 0}
            onClick={() => { setConfirmTarget(r); setNoteInput('') }}
          >
            手动结清
          </Btn>
          <Btn
            variant="secondary"
            size="sm"
            icon={<History className="w-3.5 h-3.5" />}
            onClick={() => setHistoryTarget({ id: r.channelId!, name: r.channelName || '' })}
          >
            历史记录
          </Btn>
        </div>
      ),
    },
  ]

  return (
    <div className="px-1 py-2">
      <PageHeader
        title="渠道账期结算"
        description="管理记账渠道的应收账款，结清后授信额度自动恢复。"
      />

      <div className="space-y-4">
        {flash && <AlertBox type={flash.type} title={flash.msg} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <StatCard title="待结清渠道数" value={pendingCount} icon={<CreditCard className="w-5 h-5" />} />
          <StatCard
            title="未结清总金额"
            value={centsToDisplay(totalOutstanding)}
            icon={<DollarSign className="w-5 h-5" />}
            tone={totalOutstanding > 0 ? 'danger' : 'default'}
          />
        </div>

        <SectionCard title="渠道应收账款" bodyClassName="p-0">
          <div className="p-4">
            <Table
              loading={loading}
              columns={columns}
              data={groups}
              rowKey={r => r.channelId || 'none'}
              empty="所有渠道账单均已结清"
              expandable={{
                rowExpandable: r => r.items.length > 0 && r.totalAmount > 0,
                render: r => <ExpandedOrders items={r.items} />,
              }}
            />
          </div>
        </SectionCard>
      </div>

      {/* 手动结清确认弹窗 */}
      <Modal
        open={!!confirmTarget}
        onOpenChange={v => !v && setConfirmTarget(null)}
        title="确认结清账单"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setConfirmTarget(null)}>取消</Btn>
            <Btn variant="danger" loading={settling === confirmTarget?.channelId} onClick={handleSettle}>确认结清</Btn>
          </>
        }
      >
        {confirmTarget && (
          <div className="space-y-3">
            <FormRow label="渠道">{confirmTarget.channelName}</FormRow>
            <FormRow label="订单数">{confirmTarget.orderCount} 笔</FormRow>
            <FormRow label="结清金额">
              <span className="font-semibold text-red-600">{centsToDisplay(confirmTarget.totalAmount)}</span>
            </FormRow>
            <div className="pt-1">
              <TextInput
                value={noteInput}
                onChange={setNoteInput}
                placeholder="备注（可选，如：微信转账 2026-06-08）"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* 历史记录弹窗 */}
      {historyTarget && (
        <HistoryModal
          channelId={historyTarget.id}
          channelName={historyTarget.name}
          open={!!historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  )
}
