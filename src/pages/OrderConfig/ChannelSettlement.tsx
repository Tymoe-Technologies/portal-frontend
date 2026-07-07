import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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

const getItemStatusMap = (t: (key: string) => string): Record<string, { variant: 'gold' | 'blue' | 'red' | 'green'; label: string }> => ({
  UNPAID:         { variant: 'gold',  label: t('pages.orderConfig.settlement.statusUnpaid') },
  PARTIALLY_PAID: { variant: 'blue',  label: t('pages.orderConfig.settlement.statusPartiallyPaid') },
  OVERDUE:        { variant: 'red',   label: t('pages.orderConfig.settlement.statusOverdue') },
  PAID:           { variant: 'green', label: t('pages.orderConfig.settlement.statusPaid') },
})

// 展开行：显示该渠道的所有未结订单
function ExpandedOrders({ items }: { items: ChannelReceivableItem[] }) {
  const { t } = useTranslation()
  const totalBalance = items.reduce((s, i) => s + i.balance, 0)
  const itemStatusMap = getItemStatusMap(t)

  const cols: Column<ChannelReceivableItem>[] = [
    {
      key: 'orderNumber',
      title: t('pages.orderConfig.settlement.orderNumberColumn'),
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
      title: t('pages.orderConfig.settlement.orderedAtColumn'),
      width: 130,
      render: r => (
        <div>
          <div className="text-[13px]">{dayjs(r.createdAt).format('MM/DD')}</div>
          <div className="text-[11px] text-slate-400">{dayjs(r.createdAt).format('HH:mm')}</div>
        </div>
      ),
    },
    { key: 'amount', title: t('pages.orderConfig.settlement.orderAmountColumn'), width: 110, render: r => <span className="text-[13px]">{centsToDisplay(r.amount)}</span> },
    {
      key: 'balance',
      title: t('pages.orderConfig.settlement.balanceColumn'),
      width: 120,
      render: r => (
        <div>
          <div className="text-[13px] font-semibold text-red-600">{centsToDisplay(r.balance)}</div>
          {r.balance < r.amount && <div className="text-[11px] text-slate-400">{t('pages.orderConfig.settlement.receivedAmount', { amount: centsToDisplay(r.amount - r.balance) })}</div>}
        </div>
      ),
    },
    {
      key: 'status',
      title: t('pages.orderConfig.settlement.statusColumn'),
      width: 90,
      render: r => {
        const cfg = itemStatusMap[r.status] ?? { variant: 'default' as const, label: r.status }
        return <Badge variant={cfg.variant as any}>{cfg.label}</Badge>
      },
    },
  ]

  return (
    <div className="rounded-lg bg-white border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs text-slate-400">{t('pages.orderConfig.settlement.unpaidBillsCount', { count: items.length })}</span>
        <span className="text-[13px] text-slate-600">
          {t('pages.orderConfig.settlement.totalOwedLabel')}<span className="font-semibold text-red-600">{centsToDisplay(totalBalance)}</span>
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
  const { t } = useTranslation()
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
    { key: 'orderNumber', title: t('pages.orderConfig.settlement.orderNumberColumn'), render: r => <span className="font-mono text-[11px] text-slate-600">{r.orderNumber || r.orderId.slice(0, 8) + '…'}</span> },
    { key: 'amount', title: t('pages.orderConfig.settlement.amountColumn'), render: r => centsToDisplay(r.amount) },
    { key: 'paidAt', title: t('pages.orderConfig.settlement.paidAtColumn'), render: r => r.paidAt ? dayjs(r.paidAt).format('YYYY-MM-DD HH:mm') : '-' },
  ]

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()} title={t('pages.orderConfig.settlement.historyModalTitle', { name: channelName })} size="lg">
      {loading ? (
        <Spinner />
      ) : data.length === 0 ? (
        <EmptyState title={t('pages.orderConfig.settlement.noHistoryRecords')} />
      ) : (
        <Table columns={cols} data={data} rowKey={r => r.id} />
      )}
    </Modal>
  )
}

// 授信额度展示
function CreditStatusCell({ channelId }: { channelId: string }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<CreditStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    channelSettlementService.getChannelCreditStatus(channelId)
      .then(setStatus)
      .finally(() => setLoading(false))
  }, [channelId])

  if (loading) return <span className="text-xs text-slate-400">{t('pages.orderConfig.settlement.loadingEllipsis')}</span>
  if (!status) return <span className="text-xs text-slate-400">{t('pages.orderConfig.settlement.creditNotConfigured')}</span>

  const usedPct = status.cycleLimit > 0 ? Math.min(100, Math.round(status.usedAmount / status.cycleLimit * 100)) : 0
  const isWarning = usedPct >= 80
  const hasPreviousUnpaid = status.previousUnpaid > 0
  const cycleLabel: Record<string, string> = {
    WEEKLY: t('pages.orderConfig.settlement.cycleWeekly'),
    BIWEEKLY: t('pages.orderConfig.settlement.cycleBiweekly'),
    MONTHLY: t('pages.orderConfig.settlement.cycleMonthly'),
  }
  const tone = hasPreviousUnpaid || isWarning ? 'danger' : 'default'

  return (
    <div className="min-w-[220px] max-w-[260px]">
      {hasPreviousUnpaid && (
        <div className="mb-1.5 rounded-md bg-red-50 border border-red-200 px-2 py-1 text-[11px] text-red-700">
          {t('pages.orderConfig.settlement.previousUnpaidWarning', { amount: centsToDisplay(status.previousUnpaid) })}
        </div>
      )}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">{t('pages.orderConfig.settlement.cycleCreditLimit', { cycle: cycleLabel[status.billingCycle] || status.billingCycle })}</span>
        <span className="text-xs font-medium text-slate-700">
          {centsToDisplay(status.usedAmount)} / {centsToDisplay(status.cycleLimit)}
        </span>
      </div>
      <ProgressBar percent={usedPct} tone={tone} />
      <div className={`text-[11px] mt-1 ${status.availableAmount <= 0 || hasPreviousUnpaid ? 'text-red-600' : 'text-slate-400'}`}>
        {hasPreviousUnpaid ? t('pages.orderConfig.settlement.orderingSuspendedHint') : t('pages.orderConfig.settlement.remainingAmount', { amount: centsToDisplay(status.availableAmount) })}
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
  const { t } = useTranslation()
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
      .catch(() => notify('error', t('pages.orderConfig.settlement.loadFailed')))
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
      notify('success', t('pages.orderConfig.settlement.settledSuccessMsg', { count: result.settledCount, amount: centsToDisplay(result.totalAmount) }))
      setConfirmTarget(null)
      setNoteInput('')
      load()
    } catch {
      notify('error', t('pages.orderConfig.settlement.settleFailed'))
    } finally {
      setSettling(null)
    }
  }

  const columns: Column<ChannelReceivableGroup>[] = [
    { key: 'channelName', title: t('pages.orderConfig.settlement.channelColumn'), render: r => <span className="font-medium text-slate-800">{r.channelName || t('pages.orderConfig.settlement.unknownChannel')}</span> },
    {
      key: 'credit',
      title: t('pages.orderConfig.settlement.creditLimitColumn'),
      render: r => r.channelId ? <CreditStatusCell channelId={r.channelId} /> : <span className="text-xs text-slate-400">-</span>,
    },
    { key: 'orderCount', title: t('pages.orderConfig.settlement.unpaidOrderCountColumn'), render: r => <Badge variant="gold">{t('pages.orderConfig.settlement.ordersCountUnit', { count: r.orderCount })}</Badge> },
    { key: 'totalAmount', title: t('pages.orderConfig.settlement.unpaidAmountColumn'), render: r => <span className="font-semibold text-red-600">{centsToDisplay(r.totalAmount)}</span> },
    {
      key: 'actions',
      title: t('pages.orderConfig.actions'),
      render: r => (
        <div className="flex items-center gap-2">
          <Btn
            variant="primary"
            size="sm"
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            disabled={r.totalAmount === 0}
            onClick={() => { setConfirmTarget(r); setNoteInput('') }}
          >
            {t('pages.orderConfig.settlement.manualSettleBtn')}
          </Btn>
          <Btn
            variant="secondary"
            size="sm"
            icon={<History className="w-3.5 h-3.5" />}
            onClick={() => setHistoryTarget({ id: r.channelId!, name: r.channelName || '' })}
          >
            {t('pages.orderConfig.settlement.historyBtn')}
          </Btn>
        </div>
      ),
    },
  ]

  return (
    <div className="px-1 py-2">
      <PageHeader
        title={t('pages.orderConfig.settlement.pageTitle')}
        description={t('pages.orderConfig.settlement.pageDesc')}
      />

      <div className="space-y-4">
        {flash && <AlertBox type={flash.type} title={flash.msg} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <StatCard title={t('pages.orderConfig.settlement.pendingChannelsCount')} value={pendingCount} icon={<CreditCard className="w-5 h-5" />} />
          <StatCard
            title={t('pages.orderConfig.settlement.totalOutstandingAmount')}
            value={centsToDisplay(totalOutstanding)}
            icon={<DollarSign className="w-5 h-5" />}
            tone={totalOutstanding > 0 ? 'danger' : 'default'}
          />
        </div>

        <SectionCard title={t('pages.orderConfig.settlement.channelReceivablesTitle')} bodyClassName="p-0">
          <div className="p-4">
            <Table
              loading={loading}
              columns={columns}
              data={groups}
              rowKey={r => r.channelId || 'none'}
              empty={t('pages.orderConfig.settlement.allSettledEmpty')}
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
        title={t('pages.orderConfig.settlement.confirmSettleTitle')}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setConfirmTarget(null)}>{t('pages.orderConfig.cancel')}</Btn>
            <Btn variant="danger" loading={settling === confirmTarget?.channelId} onClick={handleSettle}>{t('pages.orderConfig.settlement.confirmSettleBtn')}</Btn>
          </>
        }
      >
        {confirmTarget && (
          <div className="space-y-3">
            <FormRow label={t('pages.orderConfig.settlement.channelColumn')}>{confirmTarget.channelName}</FormRow>
            <FormRow label={t('pages.orderConfig.settlement.orderCountLabel')}>{t('pages.orderConfig.settlement.ordersCountUnit', { count: confirmTarget.orderCount })}</FormRow>
            <FormRow label={t('pages.orderConfig.settlement.settleAmountLabel')}>
              <span className="font-semibold text-red-600">{centsToDisplay(confirmTarget.totalAmount)}</span>
            </FormRow>
            <div className="pt-1">
              <TextInput
                value={noteInput}
                onChange={setNoteInput}
                placeholder={t('pages.orderConfig.settlement.notePlaceholder')}
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
