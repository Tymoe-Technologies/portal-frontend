import React, { useState, useEffect, useCallback } from 'react'
import {
  Users, Gift, Trophy, Settings, RotateCw, Plus, Pencil, Trash2,
  History, DollarSign, Crown, Calendar, User,
} from 'lucide-react'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import {
  memberApi, levelApi, configApi, pointsRuleApi,
  rewardApi, birthdayRuleApi, grantedRewardApi, birthdayGrantApi,
  type Member, type MemberLevel, type MemberConfig,
  type CreateLevelPayload, type LevelBenefit, type PointTransaction,
  type PointsRule, type CreatePointsRulePayload,
  type Reward, type CreateBirthdayRulePayload,
  type BirthdayRewardRule,
  type GrantedReward,
} from '@/services/memberAdmin'
import { isRateLimited } from '@/services/http'
import RewardManagement from '@/pages/RewardManagement'
import RewardFields, { buildRewardPayload, type LinkedItemLite, type RewardFormValues } from '@/pages/RewardManagement/RewardFields'
import {
  Btn, Badge, TextInput, Textarea, SelectInput, Switch, Checkbox,
  Modal, Drawer, ConfirmDialog, Table, type Column, Tabs, Field,
  SectionCard, AlertBox, EmptyState, Spinner, toast,
} from '@/components/ui-kit'

// ─────────────────────────────────────────────────────────────────────────────
// 通用小工具：带前后缀的可空数字输入（空 → undefined）
// ─────────────────────────────────────────────────────────────────────────────

function OptNumber({ value, onChange, min, max, step, suffix, addonAfter, placeholder, className }: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  addonAfter?: string
  placeholder?: string
  className?: string
}) {
  return (
    <div className={`flex items-center gap-1.5 ${className ?? 'w-full'}`}>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className="flex-1 min-w-0 text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
      />
      {addonAfter && <span className="text-xs text-slate-500 shrink-0">{addonAfter}</span>}
      {suffix && <span className="text-xs text-slate-400 shrink-0">{suffix}</span>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 券钱包子组件（Drawer 内嵌）
// ─────────────────────────────────────────────────────────────────────────────

type BadgeVariant = 'default' | 'gold' | 'blue' | 'green' | 'red'

// 状态/来源徽章 map 需要 t()，改成函数在组件内调用
const getRewardStatusMap = (t: (k: string) => string): Record<string, { label: string; variant: BadgeVariant }> => ({
  ACTIVE:    { label: t('pages.memberManagement.rewardStatus.active'),    variant: 'green'   },
  USED:      { label: t('pages.memberManagement.rewardStatus.used'),      variant: 'blue'    },
  EXPIRED:   { label: t('pages.memberManagement.rewardStatus.expired'),   variant: 'default' },
  REVOKED:   { label: t('pages.memberManagement.rewardStatus.revoked'),   variant: 'red'     },
  CANCELLED: { label: t('pages.memberManagement.rewardStatus.cancelled'), variant: 'default' },
})

// 来源徽章（严禁紫色：BIRTHDAY/MEMBER_EXCLUSIVE 原为洋红/紫，改 slate 系）
const getSourceMap = (t: (k: string) => string): Record<string, { label: string; variant: BadgeVariant }> => ({
  POINTS_REDEEM:    { label: t('pages.memberManagement.rewardSource.pointsRedeem'),    variant: 'gold'    },
  BIRTHDAY:         { label: t('pages.memberManagement.rewardSource.birthday'),        variant: 'default' },
  MEMBER_EXCLUSIVE: { label: t('pages.memberManagement.rewardSource.memberExclusive'), variant: 'default' },
  CAMPAIGN:         { label: t('pages.memberManagement.rewardSource.campaign'),        variant: 'blue'    },
  MANUAL:           { label: t('pages.memberManagement.rewardSource.manual'),          variant: 'blue'    },
})

const CouponWallet: React.FC<{
  coupons: GrantedReward[]
  loading: boolean
  onRevokeClick: (c: GrantedReward) => void
  onManualIssueClick: () => void
}> = ({ coupons, loading, onRevokeClick, onManualIssueClick }) => {
  const { t } = useTranslation()
  const describe = (c: GrantedReward) => {
    if (c.rewardType === 'DISCOUNT_AMOUNT' && c.discountAmount) {
      return t('pages.memberManagement.couponWallet.discountAmountLabel', { amount: (c.discountAmount / 100).toFixed(2) })
    }
    if (c.rewardType === 'DISCOUNT_PERCENTAGE' && c.discountPercentage) {
      return `${parseFloat(c.discountPercentage)}% off`
    }
    if (c.rewardType === 'FREE_ITEM') return t('pages.memberManagement.couponWallet.freeItem')
    return c.rewardName
  }
  const rewardStatusMap = getRewardStatusMap(t)
  const sourceMap = getSourceMap(t)

  return (
    <>
      <div className="flex justify-end mb-3">
        <Btn size="sm" variant="secondary" icon={<Calendar className="w-3.5 h-3.5" />} onClick={onManualIssueClick}>
          {t('pages.memberManagement.couponWallet.manualIssueBtn')}
        </Btn>
      </div>

      {loading ? (
        <div className="text-center text-sm text-slate-400 py-6">{t('pages.memberManagement.couponWallet.loading')}</div>
      ) : coupons.length === 0 ? (
        <EmptyState icon={<Gift className="w-8 h-8" />} title={t('pages.memberManagement.couponWallet.emptyTitle')} />
      ) : (
        <div className="divide-y divide-slate-100">
          {coupons.map((c) => {
            const s = rewardStatusMap[c.status] ?? { label: c.status, variant: 'default' as BadgeVariant }
            const src = sourceMap[c.source] ?? { label: c.source, variant: 'default' as BadgeVariant }
            const canRevoke = c.status === 'ACTIVE'
            return (
              <div key={c.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant={s.variant}>{s.label}</Badge>
                    <Badge variant={src.variant}>{src.label}</Badge>
                    <span className="text-sm font-semibold text-slate-800">{c.rewardName}</span>
                  </div>
                  <div className="text-xs text-slate-600">{describe(c)}</div>
                  <div className="text-[11px] text-slate-400">
                    {t('pages.memberManagement.couponWallet.issuedOn')} {dayjs(c.createdAt).format('YYYY-MM-DD')}
                    {c.expiresAt && ` · ${t('pages.memberManagement.couponWallet.expiresOn')} ${dayjs(c.expiresAt).format('YYYY-MM-DD')}`}
                  </div>
                  {c.status === 'REVOKED' && c.revokedReason && (
                    <div className="text-[11px] text-slate-400">{t('pages.memberManagement.couponWallet.revokedReasonLabel')}{c.revokedReason}</div>
                  )}
                  {c.status === 'USED' && c.usedAt && (
                    <div className="text-[11px] text-slate-400">
                      {t('pages.memberManagement.couponWallet.usedOn')} {dayjs(c.usedAt).format('YYYY-MM-DD HH:mm')}
                    </div>
                  )}
                </div>
                {canRevoke && (
                  <Btn size="sm" variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => onRevokeClick(c)}>
                    {t('pages.memberManagement.couponWallet.revokeBtn')}
                  </Btn>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 会员列表 Tab
// ─────────────────────────────────────────────────────────────────────────────

const MemberListTab: React.FC = () => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  // 等级开关：关闭时冻结，前端不展示等级
  const [levelsEnabled, setLevelsEnabled] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [birthdayFilter, setBirthdayFilter] = useState<'today' | 'thisWeek' | 'thisMonth' | 'next7' | ''>('')

  // 会员详情 Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [detailTab, setDetailTab] = useState('points')
  const [txHistory, setTxHistory] = useState<PointTransaction[]>([])
  const [txLoading, setTxLoading] = useState(false)

  // 会员券钱包
  const [coupons, setCoupons] = useState<GrantedReward[]>([])
  const [couponsLoading, setCouponsLoading] = useState(false)

  // 撤销券 Modal
  const [revokeTarget, setRevokeTarget] = useState<GrantedReward | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [revoking, setRevoking] = useState(false)

  // 补发生日券 Modal
  const [manualIssueOpen, setManualIssueOpen] = useState(false)
  const [issueYear, setIssueYear] = useState<number>(new Date().getFullYear())
  const [issueReason, setIssueReason] = useState('')
  const [issuing, setIssuing] = useState(false)

  // 积分手动调整
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState<number | undefined>()
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustNotes, setAdjustNotes] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  const fetchMembers = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const res = await memberApi.list({
        page: p, limit: pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
        birthdayWithin: birthdayFilter || undefined,
        sortBy: 'createdAt', sortOrder: 'desc',
      })
      const body = res.data as any
      setMembers(body.data ?? [])
      setTotal(body.pagination?.total ?? 0)
    } catch (e) {
      if (isRateLimited(e)) return
      toast.error(t('pages.memberManagement.memberList.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, statusFilter, birthdayFilter])

  useEffect(() => {
    fetchMembers()
    // 读取等级开关
    configApi.get()
      .then(res => setLevelsEnabled(!!(res.data as any).data?.enableMemberLevels))
      .catch(() => setLevelsEnabled(false))
  }, [])

  const openMemberDrawer = async (member: Member) => {
    setSelectedMember(member)
    setDetailTab('points')
    setDrawerOpen(true)
    // 并行加载积分历史 + 券钱包
    setTxLoading(true)
    setCouponsLoading(true)
    Promise.all([
      memberApi.pointHistory(member.id, { limit: 30 }).then(r => (r.data as any).data ?? []),
      grantedRewardApi.list(member.id).then(r => (r.data as any).data ?? []),
    ]).then(([tx, cps]) => {
      setTxHistory(tx)
      setCoupons(cps)
    }).catch(() => {
      setTxHistory([])
      setCoupons([])
    }).finally(() => {
      setTxLoading(false)
      setCouponsLoading(false)
    })
  }

  const refreshCoupons = async () => {
    if (!selectedMember) return
    setCouponsLoading(true)
    try {
      const r = await grantedRewardApi.list(selectedMember.id)
      setCoupons((r.data as any).data ?? [])
    } finally {
      setCouponsLoading(false)
    }
  }

  const openManualIssue = () => {
    setIssueYear(new Date().getFullYear())
    setIssueReason('')
    setManualIssueOpen(true)
  }

  const handleManualIssue = async () => {
    if (!selectedMember) return
    if (!issueYear) { toast.warning(t('pages.memberManagement.manualIssueModal.toastYearRequired')); return }
    if (!issueReason.trim() || issueReason.trim().length < 2) { toast.warning(t('pages.memberManagement.manualIssueModal.toastReasonRequired')); return }
    setIssuing(true)
    try {
      await birthdayGrantApi.manualIssue({
        memberId: selectedMember.id,
        birthdayYear: issueYear,
        reason: issueReason.trim(),
      })
      toast.success(t('pages.memberManagement.manualIssueModal.toastSuccess'))
      setManualIssueOpen(false)
      await refreshCoupons()
    } catch (err: any) {
      if (isRateLimited(err)) return
      const code = err?.response?.data?.error?.code
      if (code === 'NO_RULE') {
        toast.error(t('pages.memberManagement.manualIssueModal.toastNoRule'))
      } else if (code === 'COUPON_UNAVAILABLE') {
        toast.error(t('pages.memberManagement.manualIssueModal.toastCouponUnavailable'))
      } else {
        toast.error(err?.response?.data?.error?.message ?? t('pages.memberManagement.manualIssueModal.toastFailed'))
      }
    } finally {
      setIssuing(false)
    }
  }

  const handleRevokeReward = async () => {
    if (!revokeTarget) return
    if (!revokeReason.trim() || revokeReason.trim().length < 2) {
      toast.warning(t('pages.memberManagement.revokeModal.toastReasonRequired'))
      return
    }
    setRevoking(true)
    try {
      await grantedRewardApi.revoke(revokeTarget.id, revokeReason.trim())
      toast.success(t('pages.memberManagement.revokeModal.toastSuccess'))
      setRevokeTarget(null)
      setRevokeReason('')
      await refreshCoupons()
    } catch (err: any) {
      if (isRateLimited(err)) return
      toast.error(err?.response?.data?.error?.message ?? t('pages.memberManagement.revokeModal.toastFailed'))
    } finally {
      setRevoking(false)
    }
  }

  const handleAdjustPoints = async () => {
    if (!selectedMember) return
    if (adjustAmount == null || Number.isNaN(adjustAmount)) { toast.warning(t('pages.memberManagement.adjustModal.toastAmountRequired')); return }
    setAdjusting(true)
    try {
      await memberApi.adjustPoints(selectedMember.id, {
        amount: adjustAmount,
        reason: adjustReason || undefined,
        notes: adjustNotes || undefined,
      })
      toast.success(t('pages.memberManagement.adjustModal.toastSuccess'))
      setAdjustModalOpen(false)
      setAdjustAmount(undefined)
      setAdjustReason('')
      setAdjustNotes('')
      // 刷新积分历史和会员数据
      openMemberDrawer(selectedMember)
      fetchMembers()
    } catch (err: any) {
      if (isRateLimited(err)) return
      toast.error(err?.response?.data?.error?.message ?? t('pages.memberManagement.adjustModal.toastFailed'))
    } finally {
      setAdjusting(false)
    }
  }

  const TX_TYPE_MAP: Record<string, [string, BadgeVariant]> = {
    EARN:   [t('pages.memberManagement.txTypes.earn'), 'green'],
    REDEEM: [t('pages.memberManagement.txTypes.redeem'), 'red'],
    ADJUST: [t('pages.memberManagement.txTypes.adjust'), 'blue'],
    EXPIRE: [t('pages.memberManagement.txTypes.expire'), 'default'],
    CANCEL: [t('pages.memberManagement.txTypes.cancel'), 'gold'],
  }

  const columns: Column<Member>[] = [
    {
      key: 'memberNo',
      title: t('pages.memberManagement.memberList.columns.memberNo'),
      width: 120,
      render: (r) => <code className="text-xs bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">{r.memberNo}</code>,
    },
    {
      key: 'info',
      title: t('pages.memberManagement.memberList.columns.nameOrPhone'),
      render: (r) => (
        <div className="min-w-0">
          <div className="font-semibold text-slate-800">{r.name || '—'}</div>
          <div className="text-xs text-slate-400">{r.areaCode} {r.phoneNumber}</div>
        </div>
      ),
    },
    {
      key: 'points',
      title: t('pages.memberManagement.memberList.columns.points'),
      width: 100,
      render: (r) => <span className="font-semibold text-slate-800">{r.points.toLocaleString()}</span>,
    },
    {
      key: 'totalSpent',
      title: t('pages.memberManagement.memberList.columns.totalSpent'),
      width: 110,
      render: (r) => `$${parseFloat(r.totalSpent).toFixed(2)}`,
    },
    // 等级列仅在开启时显示（关闭=冻结，不展示残留等级）
    ...(levelsEnabled ? [{
      key: 'level',
      title: t('pages.memberManagement.memberList.columns.level'),
      width: 100,
      render: (r: Member) => r.level
        ? <Badge variant="blue">{r.level.name}</Badge>
        : <span className="text-slate-400">—</span>,
    } as Column<Member>] : []),
    {
      key: 'status',
      title: t('pages.memberManagement.memberList.columns.status'),
      width: 80,
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
          <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'ACTIVE' ? 'bg-green-500' : 'bg-slate-300'}`} />
          {r.status === 'ACTIVE' ? t('pages.memberManagement.memberList.active') : t('pages.memberManagement.memberList.inactive')}
        </span>
      ),
    },
    {
      key: 'lastPurchase',
      title: t('pages.memberManagement.memberList.columns.lastPurchase'),
      width: 120,
      render: (r) => r.lastPurchase ? dayjs(r.lastPurchase).format('MM/DD HH:mm') : '—',
    },
    {
      key: 'actions',
      title: t('pages.memberManagement.memberList.columns.actions'),
      width: 100,
      render: (r) => (
        <Btn size="sm" variant="secondary" icon={<History className="w-3.5 h-3.5" />} onClick={() => openMemberDrawer(r)}>
          {t('pages.memberManagement.memberList.columns.viewBtn')}
        </Btn>
      ),
    },
  ]

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); setTimeout(() => fetchMembers(1), 0) }}
        >
          <TextInput
            className="w-60"
            value={searchInput}
            onChange={setSearchInput}
            placeholder={t('pages.memberManagement.memberList.searchPlaceholder')}
          />
          <Btn variant="secondary" type="submit">{t('pages.memberManagement.memberList.searchBtn')}</Btn>
        </form>
        <SelectInput
          className="w-32"
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); setTimeout(() => fetchMembers(1), 0) }}
          placeholder={t('pages.memberManagement.memberList.statusFilterPlaceholder')}
          options={[
            { label: t('pages.memberManagement.memberList.allStatus'), value: '' },
            { label: t('pages.memberManagement.memberList.active'), value: 'ACTIVE' },
            { label: t('pages.memberManagement.memberList.inactive'), value: 'INACTIVE' },
          ]}
        />
        <SelectInput
          className="w-40"
          value={birthdayFilter}
          onChange={(v) => { setBirthdayFilter(v); setPage(1); setTimeout(() => fetchMembers(1), 0) }}
          placeholder={t('pages.memberManagement.memberList.birthdayFilterPlaceholder')}
          options={[
            { label: t('pages.memberManagement.memberList.allBirthday'), value: '' },
            { label: t('pages.memberManagement.memberList.birthdayToday'), value: 'today' },
            { label: t('pages.memberManagement.memberList.birthdayNext7'), value: 'next7' },
            { label: t('pages.memberManagement.memberList.birthdayThisWeek'), value: 'thisWeek' },
            { label: t('pages.memberManagement.memberList.birthdayThisMonth'), value: 'thisMonth' },
          ]}
        />
        <Btn variant="secondary" icon={<RotateCw className="w-3.5 h-3.5" />} onClick={() => fetchMembers()}>{t('pages.memberManagement.memberList.refreshBtn')}</Btn>
      </div>

      <Table
        columns={columns}
        data={members}
        rowKey={(r) => r.id}
        loading={loading}
        empty={t('pages.memberManagement.memberList.emptyTable')}
      />

      {total > 0 && (
        <div className="flex items-center justify-between mt-3 text-sm text-slate-500">
          <span>{t('pages.memberManagement.memberList.totalCount', { count: total })}</span>
          <div className="flex items-center gap-2">
            <Btn size="sm" variant="secondary" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); fetchMembers(p) }}>{t('pages.memberManagement.memberList.prevPage')}</Btn>
            <span>{page} / {totalPages}</span>
            <Btn size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); fetchMembers(p) }}>{t('pages.memberManagement.memberList.nextPage')}</Btn>
          </div>
        </div>
      )}

      {/* 会员详情 Drawer */}
      <Drawer
        title={
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white text-sm font-medium">
              {selectedMember?.name?.[0]?.toUpperCase() ?? <User className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-slate-900">{selectedMember?.name || t('pages.memberManagement.memberList.noNameFilled')}</div>
              <div className="text-xs text-slate-400">{selectedMember?.areaCode} {selectedMember?.phoneNumber}</div>
            </div>
          </div>
        }
        width={540}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        footer={
          <Btn variant="primary" size="sm" icon={<DollarSign className="w-3.5 h-3.5" />} onClick={() => setAdjustModalOpen(true)}>
            {t('pages.memberManagement.memberList.adjustPointsBtn')}
          </Btn>
        }
      >
        {selectedMember && (
          <>
            <div className={`grid gap-3 mb-4 ${levelsEnabled ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div className="rounded-lg border border-slate-200 px-4 py-3">
                <div className="text-xs text-slate-400">{t('pages.memberManagement.memberList.currentPointsLabel')}</div>
                <div className="text-xl font-semibold text-slate-900 mt-0.5">{selectedMember.points.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border border-slate-200 px-4 py-3">
                <div className="text-xs text-slate-400">{t('pages.memberManagement.memberList.totalSpentLabel')}</div>
                <div className="text-xl font-semibold text-slate-900 mt-0.5">${parseFloat(selectedMember.totalSpent).toFixed(2)}</div>
              </div>
              {levelsEnabled && (
                <div className="rounded-lg border border-slate-200 px-4 py-3">
                  <div className="text-xs text-slate-400">{t('pages.memberManagement.memberList.levelLabel')}</div>
                  <div className="text-lg font-semibold text-slate-900 mt-0.5">{selectedMember.level?.name ?? t('pages.memberManagement.memberList.noLevel')}</div>
                </div>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-slate-200 p-4 mb-4 text-sm">
              <div>
                <dt className="text-xs text-slate-400">{t('pages.memberManagement.memberList.memberNoLabel')}</dt>
                <dd className="text-slate-700 mt-0.5">{selectedMember.memberNo}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">{t('pages.memberManagement.memberList.emailLabel')}</dt>
                <dd className="text-slate-700 mt-0.5">{selectedMember.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">{t('pages.memberManagement.memberList.sourceLabel')}</dt>
                <dd className="text-slate-700 mt-0.5">{selectedMember.source}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">{t('pages.memberManagement.memberList.registeredAtLabel')}</dt>
                <dd className="text-slate-700 mt-0.5">{dayjs(selectedMember.createdAt).format('YYYY-MM-DD')}</dd>
              </div>
            </dl>

            <Tabs
              value={detailTab}
              onChange={setDetailTab}
              items={[
                { key: 'points', label: t('pages.memberManagement.memberList.detailTabPoints') },
                {
                  key: 'coupons',
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      {t('pages.memberManagement.memberList.detailTabCoupons')}
                      {coupons.filter(c => c.status === 'ACTIVE').length > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold">
                          {coupons.filter(c => c.status === 'ACTIVE').length}
                        </span>
                      )}
                    </span>
                  ),
                },
              ]}
            />

            <div className="mt-4">
              {detailTab === 'points' && (
                txLoading ? (
                  <div className="text-center text-sm text-slate-400 py-6">{t('pages.memberManagement.memberList.loadingTx')}</div>
                ) : txHistory.length === 0 ? (
                  <EmptyState icon={<History className="w-8 h-8" />} title={t('pages.memberManagement.memberList.emptyTxTitle')} />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {txHistory.map((tx) => {
                      const [label, variant] = TX_TYPE_MAP[tx.type] ?? [tx.type, 'default' as BadgeVariant]
                      return (
                        <div key={tx.id} className="flex items-start justify-between gap-3 py-2.5">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant={variant}>{label}</Badge>
                              {tx.reason && <span className="text-xs text-slate-500">{tx.reason}</span>}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {t('pages.memberManagement.memberList.balanceLine', { before: tx.balanceBefore, after: tx.balanceAfter, date: dayjs(tx.createdAt).format('MM/DD HH:mm') })}
                            </div>
                          </div>
                          <span className={`text-sm font-semibold shrink-0 ${tx.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              )}

              {detailTab === 'coupons' && (
                <CouponWallet
                  coupons={coupons}
                  loading={couponsLoading}
                  onRevokeClick={setRevokeTarget}
                  onManualIssueClick={openManualIssue}
                />
              )}
            </div>
          </>
        )}
      </Drawer>

      {/* 手动补发生日券 Modal */}
      <Modal
        title={t('pages.memberManagement.manualIssueModal.title')}
        open={manualIssueOpen}
        onOpenChange={setManualIssueOpen}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setManualIssueOpen(false)}>{t('pages.memberManagement.manualIssueModal.cancelBtn')}</Btn>
            <Btn variant="primary" loading={issuing} onClick={handleManualIssue}>{t('pages.memberManagement.manualIssueModal.confirmBtn')}</Btn>
          </>
        }
      >
        <p className="text-sm text-slate-500 mb-4">
          {t('pages.memberManagement.manualIssueModal.desc')}
        </p>
        <div className="space-y-4">
          <Field label={t('pages.memberManagement.manualIssueModal.yearLabel')} hint={t('pages.memberManagement.manualIssueModal.yearHint')} required>
            <OptNumber value={issueYear} onChange={(v) => setIssueYear(v ?? new Date().getFullYear())} min={2020} max={2100} className="w-52" />
          </Field>
          <Field label={t('pages.memberManagement.manualIssueModal.reasonLabel')} required>
            <Textarea
              rows={3}
              value={issueReason}
              onChange={setIssueReason}
              placeholder={t('pages.memberManagement.manualIssueModal.reasonPlaceholder')}
            />
          </Field>
        </div>
      </Modal>

      {/* 撤销券 Modal */}
      <Modal
        title={revokeTarget ? t('pages.memberManagement.revokeModal.titleWithName', { name: revokeTarget.rewardName ?? '—' }) : t('pages.memberManagement.revokeModal.titleDefault')}
        open={!!revokeTarget}
        onOpenChange={(o) => { if (!o) { setRevokeTarget(null); setRevokeReason('') } }}
        footer={
          <>
            <Btn variant="secondary" onClick={() => { setRevokeTarget(null); setRevokeReason('') }}>{t('pages.memberManagement.revokeModal.cancelBtn')}</Btn>
            <Btn variant="danger" loading={revoking} onClick={handleRevokeReward}>{t('pages.memberManagement.revokeModal.confirmBtn')}</Btn>
          </>
        }
      >
        <AlertBox
          type="warning"
          title={t('pages.memberManagement.revokeModal.warning')}
        />
        <div className="mt-4">
          <Field label={t('pages.memberManagement.revokeModal.reasonLabel')} required>
            <Textarea
              rows={3}
              value={revokeReason}
              onChange={setRevokeReason}
              placeholder={t('pages.memberManagement.revokeModal.reasonPlaceholder')}
            />
          </Field>
        </div>
      </Modal>

      {/* 积分调整 Modal */}
      <Modal
        title={t('pages.memberManagement.adjustModal.title')}
        open={adjustModalOpen}
        onOpenChange={(o) => { if (!o) { setAdjustModalOpen(false); setAdjustAmount(undefined); setAdjustReason(''); setAdjustNotes('') } }}
        footer={
          <>
            <Btn variant="secondary" onClick={() => { setAdjustModalOpen(false); setAdjustAmount(undefined); setAdjustReason(''); setAdjustNotes('') }}>{t('pages.memberManagement.adjustModal.cancelBtn')}</Btn>
            <Btn variant="primary" loading={adjusting} onClick={handleAdjustPoints}>{t('pages.memberManagement.adjustModal.confirmBtn')}</Btn>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t('pages.memberManagement.adjustModal.amountLabel')} required>
            <OptNumber value={adjustAmount} onChange={setAdjustAmount} placeholder={t('pages.memberManagement.adjustModal.amountPlaceholder')} />
          </Field>
          <Field label={t('pages.memberManagement.adjustModal.reasonLabel')}>
            <TextInput value={adjustReason} onChange={setAdjustReason} placeholder={t('pages.memberManagement.adjustModal.reasonPlaceholder')} />
          </Field>
          <Field label={t('pages.memberManagement.adjustModal.notesLabel')}>
            <Textarea rows={2} value={adjustNotes} onChange={setAdjustNotes} placeholder={t('pages.memberManagement.adjustModal.notesPlaceholder')} />
          </Field>
        </div>
      </Modal>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 会员等级 Tab
// ─────────────────────────────────────────────────────────────────────────────

interface LevelFormState {
  name: string
  description: string
  rank: number
  color: string
  isDefault: boolean
  upgradeMinSpending: number | undefined
  maintenanceEnabled: boolean
  maintenanceMinSpending: number | undefined
  maintenancePeriodDays: number
}

const EMPTY_LEVEL_FORM: LevelFormState = {
  name: '', description: '', rank: 10, color: '', isDefault: false,
  upgradeMinSpending: undefined, maintenanceEnabled: false,
  maintenanceMinSpending: undefined, maintenancePeriodDays: 365,
}

const LevelManagementTab: React.FC = () => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [levels, setLevels] = useState<MemberLevel[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MemberLevel | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<LevelFormState>(EMPTY_LEVEL_FORM)
  const setF = (patch: Partial<LevelFormState>) => setForm(prev => ({ ...prev, ...patch }))

  // 等级开关（来自 MemberConfig.enableMemberLevels）
  const [levelsEnabled, setLevelsEnabled] = useState<boolean | null>(null)  // null = 加载中
  const [toggling, setToggling] = useState(false)

  // 内联权益编辑
  const [benefits, setBenefits] = useState<Omit<LevelBenefit, 'id'>[]>([])

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<MemberLevel | null>(null)

  const fetchLevels = async () => {
    setLoading(true)
    try {
      const res = await levelApi.list()
      const body = res.data as any
      setLevels(body.data ?? [])
    } catch (e) {
      if (isRateLimited(e)) return
      toast.error(t('pages.memberManagement.levelManagement.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const fetchEnabled = async () => {
    try {
      const res = await configApi.get()
      const data = (res.data as any).data
      setLevelsEnabled(!!data.enableMemberLevels)
    } catch {
      setLevelsEnabled(false)
    }
  }

  const handleToggleEnabled = async (checked: boolean) => {
    setToggling(true)
    try {
      await configApi.update({ enableMemberLevels: checked })
      setLevelsEnabled(checked)
      toast.success(checked ? t('pages.memberManagement.levelManagement.enabledToast') : t('pages.memberManagement.levelManagement.disabledToast'))
    } catch (err: any) {
      if (isRateLimited(err)) return
      toast.error(err?.response?.data?.error?.message ?? t('pages.memberManagement.levelManagement.updateFailedToast'))
    } finally {
      setToggling(false)
    }
  }

  useEffect(() => {
    fetchLevels()
    fetchEnabled()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setBenefits([])
    setForm({ ...EMPTY_LEVEL_FORM, rank: (levels.length + 1) * 10 })
    setModalOpen(true)
  }

  const openEdit = (level: MemberLevel) => {
    setEditing(level)
    setBenefits(level.benefits.map(({ id: _id, ...b }) => b))
    setForm({
      name: level.name,
      description: level.description ?? '',
      rank: level.rank,
      color: level.color ?? '',
      isDefault: level.isDefault,
      upgradeMinSpending: level.upgradeMinSpending ? parseFloat(level.upgradeMinSpending) : undefined,
      maintenanceEnabled: level.maintenanceEnabled ?? false,
      maintenanceMinSpending: level.maintenanceMinSpending ? parseFloat(level.maintenanceMinSpending) : undefined,
      maintenancePeriodDays: level.maintenancePeriodDays ?? 365,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.warning(t('pages.memberManagement.levelManagement.nameRequiredToast')); return }
    if (form.rank == null || Number.isNaN(form.rank)) { toast.warning(t('pages.memberManagement.levelManagement.rankRequiredToast')); return }
    if (form.maintenanceEnabled && (form.maintenanceMinSpending == null)) { toast.warning(t('pages.memberManagement.levelManagement.maintenanceAmountRequiredToast')); return }
    setSaving(true)
    try {
      const payload: CreateLevelPayload = {
        name: form.name,
        description: form.description || undefined,
        rank: form.rank,
        color: form.color || undefined,
        isDefault: form.isDefault,
        upgradeMinSpending: form.upgradeMinSpending,
        maintenanceEnabled: form.maintenanceEnabled,
        maintenanceMinSpending: form.maintenanceEnabled ? form.maintenanceMinSpending : undefined,
        maintenancePeriodDays: form.maintenanceEnabled ? form.maintenancePeriodDays : undefined,
        benefits,
      }
      if (editing) {
        await levelApi.update(editing.id, payload)
        toast.success(t('pages.memberManagement.levelManagement.updatedToast'))
      } else {
        await levelApi.create(payload)
        toast.success(t('pages.memberManagement.levelManagement.createdToast'))
      }
      setModalOpen(false)
      fetchLevels()
    } catch (err: any) {
      if (isRateLimited(err)) return
      toast.error(err?.response?.data?.error?.message ?? t('pages.memberManagement.levelManagement.saveFailedToast'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await levelApi.remove(id)
      toast.success(t('pages.memberManagement.levelManagement.deactivatedToast'))
      fetchLevels()
    } catch (e) {
      if (isRateLimited(e)) return
      toast.error(t('pages.memberManagement.levelManagement.actionFailedToast'))
    }
  }

  const addBenefit = () =>
    setBenefits(prev => [...prev, { name: '', type: 'CUSTOM' }])

  const updateBenefit = (i: number, patch: Partial<LevelBenefit>) =>
    setBenefits(prev => prev.map((b, idx) => idx === i ? { ...b, ...patch } : b))

  const removeBenefit = (i: number) =>
    setBenefits(prev => prev.filter((_, idx) => idx !== i))

  const BENEFIT_TYPE_LABELS: Record<string, string> = {
    POINTS_MULTIPLIER: t('pages.memberManagement.levelManagement.benefitTypes.pointsMultiplier'),
    DISCOUNT: t('pages.memberManagement.levelManagement.benefitTypes.discount'),
    FREE_ITEM: t('pages.memberManagement.levelManagement.benefitTypes.freeItem'),
    CUSTOM: t('pages.memberManagement.levelManagement.benefitTypes.custom'),
  }

  const columns: Column<MemberLevel>[] = [
    {
      key: 'name',
      title: t('pages.memberManagement.levelManagement.columns.name'),
      render: (r) => (
        <div className="flex items-center gap-2">
          <Crown className="w-[18px] h-[18px] shrink-0" style={{ color: r.color ?? '#f59e0b' }} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">{r.name}</span>
              {r.isDefault && <Badge variant="blue">{t('pages.memberManagement.levelManagement.columns.defaultBadge')}</Badge>}
            </div>
            {r.description && <div className="text-xs text-slate-400">{r.description}</div>}
          </div>
        </div>
      ),
    },
    { key: 'rank', title: t('pages.memberManagement.levelManagement.columns.rank'), width: 70, render: (r) => r.rank },
    {
      key: 'upgrade',
      title: t('pages.memberManagement.levelManagement.columns.upgradeCondition'),
      render: (r) => r.upgradeMinSpending
        ? <span className="text-xs text-slate-600">{t('pages.memberManagement.levelManagement.upgradeConditionText', { amount: parseFloat(r.upgradeMinSpending).toFixed(0) })}</span>
        : <span className="text-xs text-slate-400">{t('pages.memberManagement.levelManagement.columns.noCondition')}</span>,
    },
    {
      key: 'maintenance',
      title: t('pages.memberManagement.levelManagement.columns.maintenance'),
      render: (r) => {
        if (!r.maintenanceEnabled) return <span className="text-xs text-slate-400">{t('pages.memberManagement.levelManagement.columns.notEnabled')}</span>
        return (
          <span className="text-xs text-slate-600">
            {t('pages.memberManagement.levelManagement.maintenanceConditionText', { days: r.maintenancePeriodDays ?? 365, amount: r.maintenanceMinSpending ? parseFloat(r.maintenanceMinSpending).toFixed(0) : 0 })}
          </span>
        )
      },
    },
    {
      key: 'benefits',
      title: t('pages.memberManagement.levelManagement.columns.benefits'),
      render: (r) => r.benefits.length > 0
        ? <span className="text-slate-700">{r.benefits.map(b => b.name).join('、')}</span>
        : <span className="text-slate-400">—</span>,
    },
    {
      key: 'actions',
      title: t('pages.memberManagement.levelManagement.columns.actions'),
      width: 160,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Btn size="sm" variant="secondary" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openEdit(r)}>{t('pages.memberManagement.levelManagement.columns.editBtn')}</Btn>
          <Btn size="sm" variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setDeleteTarget(r)}>{t('pages.memberManagement.levelManagement.columns.deactivateBtn')}</Btn>
        </div>
      ),
    },
  ]

  return (
    <>
      <SectionCard>
        <div className="flex items-center gap-3 flex-wrap">
          <Switch
            checked={!!levelsEnabled}
            disabled={toggling || levelsEnabled === null}
            onCheckedChange={handleToggleEnabled}
          />
          <span className="text-sm font-medium text-slate-700">{t('pages.memberManagement.levelManagement.enableSwitchLabel')}</span>
          <span className="text-xs text-slate-400">
            {levelsEnabled
              ? t('pages.memberManagement.levelManagement.enabledHint')
              : t('pages.memberManagement.levelManagement.disabledHint')}
          </span>
        </div>
      </SectionCard>

      {levelsEnabled && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-4">
            <Btn variant="secondary" icon={<RotateCw className="w-3.5 h-3.5" />} onClick={fetchLevels}>{t('pages.memberManagement.levelManagement.refreshBtn')}</Btn>
            <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>{t('pages.memberManagement.levelManagement.createBtn')}</Btn>
          </div>

          <Table
            columns={columns}
            data={levels}
            rowKey={(r) => r.id}
            loading={loading}
            empty={t('pages.memberManagement.levelManagement.emptyTable')}
          />
        </div>
      )}

      <Modal
        title={editing ? t('pages.memberManagement.levelManagement.editTitle') : t('pages.memberManagement.levelManagement.createTitle')}
        open={modalOpen}
        onOpenChange={setModalOpen}
        size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>{t('pages.memberManagement.levelManagement.cancelBtn')}</Btn>
            <Btn variant="primary" loading={saving} onClick={handleSave}>{t('pages.memberManagement.levelManagement.saveBtn')}</Btn>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Field label={t('pages.memberManagement.levelManagement.nameFieldLabel')} required>
                <TextInput value={form.name} onChange={(v) => setF({ name: v })} placeholder={t('pages.memberManagement.levelManagement.namePlaceholder')} />
              </Field>
            </div>
            <Field label={t('pages.memberManagement.levelManagement.rankFieldLabel')} required>
              <OptNumber value={form.rank} onChange={(v) => setF({ rank: v ?? 0 })} min={0} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Field label={t('pages.memberManagement.levelManagement.descFieldLabel')}>
                <TextInput value={form.description} onChange={(v) => setF({ description: v })} placeholder={t('pages.memberManagement.levelManagement.descPlaceholder')} />
              </Field>
            </div>
            <Field label={t('pages.memberManagement.levelManagement.colorFieldLabel')}>
              <TextInput value={form.color} onChange={(v) => setF({ color: v })} placeholder="#f59e0b" />
            </Field>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.isDefault} onCheckedChange={(v) => setF({ isDefault: v })} />
            <span className="text-sm text-slate-700">{t('pages.memberManagement.levelManagement.defaultFieldLabel')}</span>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-sm font-medium text-slate-500 mb-2">{t('pages.memberManagement.levelManagement.upgradeSectionTitle')}</p>
            <Field label={t('pages.memberManagement.levelManagement.upgradeAmountLabel')} hint={t('pages.memberManagement.levelManagement.upgradeAmountHint')}>
              <OptNumber value={form.upgradeMinSpending} onChange={(v) => setF({ upgradeMinSpending: v })} min={0} placeholder={t('pages.memberManagement.levelManagement.upgradeAmountPlaceholder')} className="w-60" />
            </Field>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-sm font-medium text-slate-500 mb-2">{t('pages.memberManagement.levelManagement.maintenanceSectionTitle')}</p>
            <div className="flex items-center gap-2 mb-3">
              <Switch checked={form.maintenanceEnabled} onCheckedChange={(v) => setF({ maintenanceEnabled: v })} />
              <span className="text-sm text-slate-700">{t('pages.memberManagement.levelManagement.maintenanceEnableLabel')}</span>
              <span className="text-xs text-slate-400">{t('pages.memberManagement.levelManagement.maintenanceDisabledHint')}</span>
            </div>
            {form.maintenanceEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <Field label={t('pages.memberManagement.levelManagement.maintenancePeriodLabel')} required>
                  <SelectInput
                    className="w-full"
                    value={form.maintenancePeriodDays}
                    onChange={(v) => setF({ maintenancePeriodDays: Number(v) })}
                    options={[
                      { value: 30, label: t('pages.memberManagement.levelManagement.days30') },
                      { value: 60, label: t('pages.memberManagement.levelManagement.days60') },
                      { value: 90, label: t('pages.memberManagement.levelManagement.days90') },
                      { value: 180, label: t('pages.memberManagement.levelManagement.days180') },
                      { value: 365, label: t('pages.memberManagement.levelManagement.days365') },
                    ]}
                  />
                </Field>
                <Field label={t('pages.memberManagement.levelManagement.maintenanceAmountLabel')} hint={t('pages.memberManagement.levelManagement.maintenanceAmountHint')} required>
                  <OptNumber value={form.maintenanceMinSpending} onChange={(v) => setF({ maintenanceMinSpending: v })} min={0} />
                </Field>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-sm font-medium text-slate-500 mb-2">{t('pages.memberManagement.levelManagement.benefitsSectionTitle')}</p>
            {benefits.map((b, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3 mb-2">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <TextInput value={b.name} onChange={(v) => updateBenefit(i, { name: v })} placeholder={t('pages.memberManagement.levelManagement.benefitNamePlaceholder')} />
                  </div>
                  <div className="col-span-3">
                    <SelectInput
                      className="w-full"
                      value={b.type}
                      onChange={(v) => updateBenefit(i, { type: v })}
                      options={Object.entries(BENEFIT_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                    />
                  </div>
                  {b.type === 'POINTS_MULTIPLIER' && (
                    <div className="col-span-3">
                      <OptNumber value={b.pointsMultiplier} onChange={(v) => updateBenefit(i, { pointsMultiplier: v })} min={1} step={0.1} placeholder={t('pages.memberManagement.levelManagement.multiplierPlaceholder')} />
                    </div>
                  )}
                  {b.type === 'CUSTOM' && (
                    <div className="col-span-3">
                      <TextInput value={b.customValue ?? ''} onChange={(v) => updateBenefit(i, { customValue: v })} placeholder={t('pages.memberManagement.levelManagement.customValuePlaceholder')} />
                    </div>
                  )}
                  <div className="col-span-2 flex justify-end">
                    <Btn size="sm" variant="danger" onClick={() => removeBenefit(i)}>{t('pages.memberManagement.levelManagement.deleteBtn')}</Btn>
                  </div>
                </div>
              </div>
            ))}
            <Btn size="sm" variant="secondary" onClick={addBenefit}>{t('pages.memberManagement.levelManagement.addBenefitBtn')}</Btn>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t('pages.memberManagement.levelManagement.confirmDeactivateTitle')}
        danger
        confirmText={t('pages.memberManagement.levelManagement.confirmDeactivateBtn')}
        onConfirm={() => { const target = deleteTarget; setDeleteTarget(null); if (target) handleDelete(target.id) }}
      />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 生日券 Tab
// ─────────────────────────────────────────────────────────────────────────────

interface BirthdayRuleFormState extends RewardFormValues {
  levelId: string
  daysAheadOfBirthday: number
  status: string
}

const BirthdayRewardTab: React.FC = () => {
  const { t } = useTranslation()
  const [rules, setRules] = useState<BirthdayRewardRule[]>([])
  const [coupons, setCoupons] = useState<Reward[]>([])
  const [levels, setLevels] = useState<MemberLevel[]>([])
  const [levelsEnabled, setLevelsEnabled] = useState(false)  // 商家是否开启会员等级
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)

  // 规则编辑 modal（奖励内容 + 规则设置合并在一个表单）
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<BirthdayRewardRule | null>(null)
  const [form, setForm] = useState<BirthdayRuleFormState>({
    levelId: '', daysAheadOfBirthday: 7, status: 'ACTIVE',
    rewardType: 'FREE_ITEM', selectionMode: 'FIXED', stackingMode: 'STACKABLE',
    validityMode: 'DAYS', validityDays: 30,
  })
  const setF = (patch: Partial<BirthdayRuleFormState>) => setForm(prev => ({ ...prev, ...patch }))
  // 规则关联的奖励（编辑时 = 该规则的 reward；新建时 = null）
  const [editingReward, setEditingReward] = useState<Reward | null>(null)
  const [ruleLinkedItems, setRuleLinkedItems] = useState<LinkedItemLite[]>([])

  // 确认框
  const [scanConfirm, setScanConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BirthdayRewardRule | null>(null)

  const handleScanNow = async () => {
    setScanning(true)
    try {
      const res = await birthdayRuleApi.scanNow()
      const result = (res.data as any).data
      // result.status: SUCCEEDED / SKIPPED / FAILED
      if (result.status === 'SKIPPED') {
        toast.warning(t('pages.memberManagement.birthdayReward.scanBusyToast'))
      } else if (result.status === 'FAILED') {
        toast.error(t('pages.memberManagement.birthdayReward.scanFailedWithErrorToast', { error: result.error }))
      } else {
        const stats = result.stats ?? {}
        toast.success(
          t('pages.memberManagement.birthdayReward.scanCompletedToast', { count: stats.totalGranted ?? 0 }) +
          (stats.totalSkipped > 0 ? t('pages.memberManagement.birthdayReward.scanSkippedSuffix', { count: stats.totalSkipped }) : '') +
          (stats.totalErrors > 0 ? t('pages.memberManagement.birthdayReward.scanErrorsSuffix', { count: stats.totalErrors }) : '')
        )
      }
    } catch (err: any) {
      if (isRateLimited(err)) return
      toast.error(err?.response?.data?.error?.message ?? t('pages.memberManagement.birthdayReward.scanFailedToast'))
    } finally {
      setScanning(false)
    }
  }

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [rulesRes, couponsRes, levelsRes, configRes] = await Promise.all([
        birthdayRuleApi.list(),
        rewardApi.list({ isGrantable: true, activeOnly: true }),
        levelApi.list(),
        configApi.get(),
      ])
      setRules((rulesRes.data as any).data ?? [])
      setCoupons((couponsRes.data as any).data ?? [])
      setLevels((levelsRes.data as any).data ?? [])
      setLevelsEnabled(!!(configRes.data as any).data?.enableMemberLevels)
    } catch (e) {
      if (isRateLimited(e)) return
      toast.error(t('pages.memberManagement.birthdayReward.loadFailedToast'))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { fetchAll() }, [])

  const openCreateRule = () => {
    setEditingRule(null)
    setEditingReward(null)
    setRuleLinkedItems([])
    setForm({
      levelId: '',
      daysAheadOfBirthday: 7,
      status: 'ACTIVE',
      rewardType: 'FREE_ITEM',
      selectionMode: 'FIXED',
      stackingMode: 'STACKABLE',
      // 生日券默认 30 天有效（可改为永久）
      validityMode: 'DAYS',
      validityDays: 30,
    })
    setRuleModalOpen(true)
  }

  const openEditRule = async (r: BirthdayRewardRule) => {
    setEditingRule(r)
    // 加载该规则关联的奖励内容，填进合并表单
    let reward: Reward | null = null
    try {
      const res = await rewardApi.list({ activeOnly: false })
      reward = ((res.data as any).data ?? []).find((x: Reward) => x.id === r.rewardId) ?? null
    } catch { /* ignore */ }
    setEditingReward(reward)
    setRuleLinkedItems(reward?.linkedItems ?? [])
    setForm({
      levelId: r.levelId ?? '',
      daysAheadOfBirthday: r.daysAheadOfBirthday,
      status: r.status,
      // 奖励内容
      name: reward?.name,
      description: reward?.description,
      rewardType: reward?.rewardType ?? 'FREE_ITEM',
      selectionMode: reward?.selectionMode ?? 'FIXED',
      pickCount: reward?.pickCount,
      discountAmount: reward?.discountAmount != null ? reward.discountAmount / 100 : undefined,
      discountPercentage: reward?.discountPercentage != null ? parseFloat(reward.discountPercentage) : undefined,
      discountMaxAmount: reward?.discountMaxAmount != null ? reward.discountMaxAmount / 100 : undefined,
      stackingMode: reward?.stackingMode ?? 'STACKABLE',
      exclusionGroup: reward?.exclusionGroup,
      stock: reward?.stock,
      limitPerMember: reward?.limitPerMember,
      validityMode: reward?.validityDays != null ? 'DAYS' : 'PERMANENT',
      validityDays: reward?.validityDays ?? 30,
    })
    setRuleModalOpen(true)
  }

  const handleSaveRule = async () => {
    if (!form.name?.trim()) { toast.warning(t('pages.memberManagement.birthdayReward.rewardNameRequiredToast')); return }
    if (form.daysAheadOfBirthday == null || Number.isNaN(form.daysAheadOfBirthday)) { toast.warning(t('pages.memberManagement.birthdayReward.daysAheadRequiredToast')); return }
    setSaving(true)
    try {
      // 奖励 payload（isGrantable=true、不要积分）
      const rewardPayload = {
        ...buildRewardPayload(form, ruleLinkedItems),
        pointsCost: null,
        isGrantable: true,
        status: 'ACTIVE',
      }

      if (editingRule) {
        // 更新：先更新奖励，再更新规则
        if (editingReward) {
          await rewardApi.update(editingReward.id, rewardPayload)
        }
        await birthdayRuleApi.update(editingRule.id, {
          daysAheadOfBirthday: form.daysAheadOfBirthday,
          status: form.status,
        })
        toast.success(t('pages.memberManagement.birthdayReward.updatedToast'))
      } else {
        // 新建：先建奖励拿 id，再建规则引用它
        const rewardRes = await rewardApi.create(rewardPayload as any)
        const newReward = (rewardRes.data as any).data
        const createPayload: CreateBirthdayRulePayload = {
          levelId: form.levelId || null,
          rewardId: newReward.id,
          daysAheadOfBirthday: form.daysAheadOfBirthday,
          status: form.status,
        }
        await birthdayRuleApi.create(createPayload)
        toast.success(t('pages.memberManagement.birthdayReward.createdToast'))
      }
      setRuleModalOpen(false)
      fetchAll()
    } catch (err: any) {
      if (isRateLimited(err)) return
      toast.error(err?.response?.data?.error?.message ?? t('pages.memberManagement.birthdayReward.saveFailedToast'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRule = async (id: string) => {
    try {
      await birthdayRuleApi.remove(id)
      toast.success(t('pages.memberManagement.birthdayReward.deletedToast'))
      fetchAll()
    } catch (e) {
      if (isRateLimited(e)) return
      toast.error(t('pages.memberManagement.birthdayReward.deleteFailedToast'))
    }
  }

  const rewardLabelById = (id: string) => {
    const c = coupons.find(x => x.id === id)
    if (!c) return t('pages.memberManagement.birthdayReward.notFound')
    if (c.rewardType === 'DISCOUNT_AMOUNT' && c.discountAmount) return `${c.name}${t('pages.memberManagement.birthdayReward.discountAmountSuffix', { amount: (c.discountAmount / 100).toFixed(2) })}`
    if (c.rewardType === 'DISCOUNT_PERCENTAGE' && c.discountPercentage) return `${c.name}（${parseFloat(c.discountPercentage)}% off）`
    if (c.rewardType === 'FREE_ITEM') return `${c.name}${t('pages.memberManagement.birthdayReward.freeItemSuffix')}`
    return c.name
  }
  const levelName = (id: string) => levels.find(l => l.id === id)?.name ?? '?'

  const columns: Column<BirthdayRewardRule>[] = [
    // 仅开启等级的商家才显示"适用会员"列
    ...(levelsEnabled ? [{
      key: 'audience',
      title: t('pages.memberManagement.birthdayReward.columns.audience'),
      render: (r: BirthdayRewardRule) => r.levelId
        ? <Badge variant="blue">{t('pages.memberManagement.birthdayReward.columns.onlyLevel', { level: levelName(r.levelId) })}</Badge>
        : <Badge>{t('pages.memberManagement.birthdayReward.columns.allMembers')}</Badge>,
    } as Column<BirthdayRewardRule>] : []),
    {
      key: 'reward',
      title: t('pages.memberManagement.birthdayReward.columns.reward'),
      render: (r) => <span className="text-slate-700">{rewardLabelById(r.rewardId)}</span>,
    },
    {
      key: 'daysAhead',
      title: t('pages.memberManagement.birthdayReward.columns.daysAhead'),
      render: (r) => <Badge variant="gold">{t('pages.memberManagement.birthdayReward.columns.daysAheadBadge', { days: r.daysAheadOfBirthday })}</Badge>,
    },
    {
      key: 'status',
      title: t('pages.memberManagement.birthdayReward.columns.status'),
      render: (r) => <Badge variant={r.status === 'ACTIVE' ? 'green' : 'default'}>{r.status}</Badge>,
    },
    {
      key: 'action',
      title: t('pages.memberManagement.birthdayReward.columns.actions'),
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Btn size="sm" variant="secondary" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openEditRule(r)}>{t('pages.memberManagement.birthdayReward.columns.editBtn')}</Btn>
          <Btn size="sm" variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setDeleteTarget(r)}>{t('pages.memberManagement.birthdayReward.columns.deleteBtn')}</Btn>
        </div>
      ),
    },
  ]

  const levelOptions = [
    { label: t('pages.memberManagement.birthdayReward.allMembersOption'), value: '' },
    ...levels.map(l => ({ label: t('pages.memberManagement.birthdayReward.onlyLevelOption', { level: l.name }), value: l.id })),
  ]

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-slate-800">{t('pages.memberManagement.birthdayReward.sectionTitle')}</p>
            <p className="text-xs text-slate-500 mt-1">
              {t('pages.memberManagement.birthdayReward.sectionDesc')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Btn variant="secondary" loading={scanning} icon={<RotateCw className="w-3.5 h-3.5" />} onClick={() => setScanConfirm(true)}>{t('pages.memberManagement.birthdayReward.scanNowBtn')}</Btn>
            <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateRule}>{t('pages.memberManagement.birthdayReward.createBtn')}</Btn>
          </div>
        </div>
      </SectionCard>

      <Table
        columns={columns}
        data={rules}
        rowKey={(r) => r.id}
        loading={loading}
        empty={t('pages.memberManagement.birthdayReward.emptyTable')}
      />

      {/* 规则编辑 Modal：奖励内容 + 规则设置合并在一个表单 */}
      <Modal
        title={editingRule ? t('pages.memberManagement.birthdayReward.editTitle') : t('pages.memberManagement.birthdayReward.createTitle')}
        open={ruleModalOpen}
        onOpenChange={setRuleModalOpen}
        size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setRuleModalOpen(false)}>{t('pages.memberManagement.birthdayReward.cancelBtn')}</Btn>
            <Btn variant="primary" loading={saving} onClick={handleSaveRule}>{t('pages.memberManagement.birthdayReward.saveBtn')}</Btn>
          </>
        }
      >
        <div className="space-y-4">
          {/* ── 规则设置 ── */}
          <div className="grid grid-cols-2 gap-4">
            {/* 仅开启等级的商家才显示"适用会员"；未开启时规则默认面向全部会员 */}
            {levelsEnabled && (
              <div className="col-span-2">
                <Field label={t('pages.memberManagement.birthdayReward.audienceLabel')} hint={t('pages.memberManagement.birthdayReward.audienceHint')}>
                  <SelectInput
                    className="w-full"
                    value={form.levelId}
                    onChange={(v) => setF({ levelId: v })}
                    disabled={!!editingRule}
                    placeholder={t('pages.memberManagement.birthdayReward.audiencePlaceholder')}
                    options={levelOptions}
                  />
                </Field>
              </div>
            )}
            <Field label={t('pages.memberManagement.birthdayReward.daysAheadLabel')} hint={t('pages.memberManagement.birthdayReward.daysAheadHint')} required>
              <OptNumber value={form.daysAheadOfBirthday} onChange={(v) => setF({ daysAheadOfBirthday: v ?? 0 })} min={0} max={30} />
            </Field>
            <Field label={t('pages.memberManagement.birthdayReward.statusLabel')} required>
              <SelectInput
                className="w-full"
                value={form.status}
                onChange={(v) => setF({ status: v })}
                options={[
                  { label: t('pages.memberManagement.birthdayReward.statusActive'), value: 'ACTIVE' },
                  { label: t('pages.memberManagement.birthdayReward.statusInactive'), value: 'INACTIVE' },
                ]}
              />
            </Field>
          </div>

          <div className="flex items-center gap-2 my-1">
            <span className="text-[13px] text-slate-500">{t('pages.memberManagement.birthdayReward.rewardContentDivider')}</span>
            <div className="flex-1 border-t border-slate-100" />
          </div>

          {/* ── 奖励内容（嵌入共享字段）── */}
          <RewardFields
            values={form}
            setValue={setF}
            linkedItems={ruleLinkedItems}
            onLinkedItemsChange={setRuleLinkedItems}
            active={ruleModalOpen}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={scanConfirm}
        onOpenChange={setScanConfirm}
        title={t('pages.memberManagement.birthdayReward.confirmScanTitle')}
        description={t('pages.memberManagement.birthdayReward.confirmScanDesc')}
        confirmText={t('pages.memberManagement.birthdayReward.confirmScanBtn')}
        onConfirm={() => { setScanConfirm(false); handleScanNow() }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t('pages.memberManagement.birthdayReward.confirmDeleteTitle')}
        danger
        confirmText={t('pages.memberManagement.birthdayReward.confirmDeleteBtn')}
        onConfirm={() => { const target = deleteTarget; setDeleteTarget(null); if (target) handleDeleteRule(target.id) }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 系统配置 Tab
// ─────────────────────────────────────────────────────────────────────────────

interface ConfigFormState {
  membershipEnabled: boolean
  maxRewardsPerOrder: number | undefined
  maxPromotionsPerOrder: number | undefined
  pointsExpiryMode: string
  pointsExpiryDays: number | undefined
  pointsExpiryMonth: number
  pointsExpiryDay: number
}

interface RuleFormState {
  name: string
  description: string
  isDefault: boolean
  status: string
  pointsPerDollar: number | undefined
  earnMinAmount: number | undefined
  earnMaxPerTransaction: number | undefined
  timeLimitDaysOfWeek: number[]
  timeLimitStartTime: string
  timeLimitEndTime: string
  timeLimitValidFrom: string
  timeLimitValidTo: string
}

const EMPTY_RULE_FORM: RuleFormState = {
  name: '', description: '', isDefault: false, status: 'ACTIVE',
  pointsPerDollar: 1, earnMinAmount: undefined, earnMaxPerTransaction: undefined,
  timeLimitDaysOfWeek: [], timeLimitStartTime: '', timeLimitEndTime: '',
  timeLimitValidFrom: '', timeLimitValidTo: '',
}

const ConfigTab: React.FC = () => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<ConfigFormState>({
    membershipEnabled: false, maxRewardsPerOrder: undefined, maxPromotionsPerOrder: undefined,
    pointsExpiryMode: 'NEVER', pointsExpiryDays: undefined, pointsExpiryMonth: 12, pointsExpiryDay: 31,
  })
  const setC = (patch: Partial<ConfigFormState>) => setConfig(prev => ({ ...prev, ...patch }))

  // 积分规则状态
  const [rules, setRules] = useState<PointsRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<PointsRule | null>(null)
  const [ruleForm, setRuleForm] = useState<RuleFormState>(EMPTY_RULE_FORM)
  const setR = (patch: Partial<RuleFormState>) => setRuleForm(prev => ({ ...prev, ...patch }))
  const [ruleSaving, setRuleSaving] = useState(false)

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<PointsRule | null>(null)

  const fetchConfig = useCallback(() => {
    setLoading(true)
    configApi.get()
      .then(res => {
        const data = (res.data as any).data as MemberConfig & Record<string, any>
        setConfig({
          membershipEnabled: data.membershipEnabled,
          maxRewardsPerOrder: data.maxRewardsPerOrder ?? undefined,
          maxPromotionsPerOrder: data.maxPromotionsPerOrder ?? undefined,
          pointsExpiryMode: data.pointsExpiryMode ?? 'NEVER',
          pointsExpiryDays: data.pointsExpiryDays ?? undefined,
          pointsExpiryMonth: data.pointsExpiryMonth ?? 12,
          pointsExpiryDay: data.pointsExpiryDay ?? 31,
        })
      })
      .catch((e) => { if (!isRateLimited(e)) toast.error(t('pages.memberManagement.config.loadFailedToast')) })
      .finally(() => setLoading(false))
  }, [t])

  const fetchRules = useCallback(() => {
    setRulesLoading(true)
    pointsRuleApi.list('EARN')
      .then(res => setRules((res.data as any).data ?? []))
      .catch((e) => { if (!isRateLimited(e)) toast.error(t('pages.memberManagement.config.loadRulesFailedToast')) })
      .finally(() => setRulesLoading(false))
  }, [t])

  useEffect(() => {
    fetchConfig()
    fetchRules()
  }, [fetchConfig, fetchRules])

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      await configApi.update({
        membershipEnabled: config.membershipEnabled,
        maxRewardsPerOrder: config.maxRewardsPerOrder,
        maxPromotionsPerOrder: config.maxPromotionsPerOrder,
        pointsExpiryMode: config.pointsExpiryMode,
        pointsExpiryDays: config.pointsExpiryMode === 'ROLLING' ? config.pointsExpiryDays : undefined,
        pointsExpiryMonth: config.pointsExpiryMode === 'CALENDAR_YEAR' ? config.pointsExpiryMonth : undefined,
        pointsExpiryDay: config.pointsExpiryMode === 'CALENDAR_YEAR' ? config.pointsExpiryDay : undefined,
      } as any)
      toast.success(t('pages.memberManagement.config.saveSuccessToast'))
    } catch (err: any) {
      if (isRateLimited(err)) return
      toast.error(err?.response?.data?.error?.message ?? t('pages.memberManagement.config.saveFailedToast'))
    } finally {
      setSaving(false)
    }
  }

  const openRuleModal = (rule?: PointsRule) => {
    setEditingRule(rule ?? null)
    if (rule) {
      // earnConversionRate 存的是"每N元1积分"，UI显示"每$1得X积分" = 1/N
      const conversionRate = rule.earnConversionRate ? parseFloat(rule.earnConversionRate) : 1
      setRuleForm({
        name: rule.name,
        description: rule.description ?? '',
        isDefault: rule.isDefault,
        status: rule.status,
        pointsPerDollar: conversionRate > 0 ? parseFloat((1 / conversionRate).toFixed(2)) : 1,
        earnMinAmount: rule.earnMinAmount ? parseFloat(rule.earnMinAmount) : undefined,
        earnMaxPerTransaction: rule.earnMaxPerTransaction ?? undefined,
        timeLimitDaysOfWeek: rule.timeLimitDaysOfWeek ?? [],
        timeLimitStartTime: rule.timeLimitStartTime ?? '',
        timeLimitEndTime: rule.timeLimitEndTime ?? '',
        timeLimitValidFrom: rule.timeLimitValidFrom ? dayjs(rule.timeLimitValidFrom).format('YYYY-MM-DD') : '',
        timeLimitValidTo: rule.timeLimitValidTo ? dayjs(rule.timeLimitValidTo).format('YYYY-MM-DD') : '',
      })
    } else {
      setRuleForm(EMPTY_RULE_FORM)
    }
    setRuleModalOpen(true)
  }

  const handleSaveRule = async () => {
    if (!ruleForm.name.trim()) { toast.warning(t('pages.memberManagement.config.ruleNameRequiredToast')); return }
    if (ruleForm.pointsPerDollar == null || ruleForm.pointsPerDollar <= 0) { toast.warning(t('pages.memberManagement.config.pointsPerDollarRequiredToast')); return }
    setRuleSaving(true)
    try {
      // 转换表单值到 API payload
      const payload: CreatePointsRulePayload = {
        name: ruleForm.name,
        description: ruleForm.description || undefined,
        isDefault: ruleForm.isDefault,
        status: ruleForm.status,
        earnMinAmount: ruleForm.earnMinAmount,
        earnMaxPerTransaction: ruleForm.earnMaxPerTransaction,
        timeLimitDaysOfWeek: ruleForm.timeLimitDaysOfWeek,
        type: 'EARN',
        earnConversionRate: ruleForm.pointsPerDollar > 0 ? 1 / ruleForm.pointsPerDollar : 1,
        timeLimitStartTime: (ruleForm.timeLimitStartTime && ruleForm.timeLimitEndTime) ? ruleForm.timeLimitStartTime : null,
        timeLimitEndTime: (ruleForm.timeLimitStartTime && ruleForm.timeLimitEndTime) ? ruleForm.timeLimitEndTime : null,
        timeLimitValidFrom: (ruleForm.timeLimitValidFrom && ruleForm.timeLimitValidTo) ? dayjs(ruleForm.timeLimitValidFrom).toISOString() : null,
        timeLimitValidTo: (ruleForm.timeLimitValidFrom && ruleForm.timeLimitValidTo) ? dayjs(ruleForm.timeLimitValidTo).toISOString() : null,
      }
      if (editingRule) {
        await pointsRuleApi.update(editingRule.id, payload)
        toast.success(t('pages.memberManagement.config.ruleUpdatedToast'))
      } else {
        await pointsRuleApi.create(payload)
        toast.success(t('pages.memberManagement.config.ruleCreatedToast'))
      }
      setRuleModalOpen(false)
      fetchRules()
    } catch (err: any) {
      if (isRateLimited(err)) return
      toast.error(err?.response?.data?.error?.message ?? t('pages.memberManagement.config.saveFailedToast'))
    } finally {
      setRuleSaving(false)
    }
  }

  const handleDeleteRule = async (id: string) => {
    try {
      await pointsRuleApi.remove(id)
      toast.success(t('pages.memberManagement.config.ruleDeletedToast'))
      fetchRules()
    } catch (e) {
      if (isRateLimited(e)) return
      toast.error(t('pages.memberManagement.config.deleteFailedToast'))
    }
  }

  const toggleDayOfWeek = (day: number) =>
    setR({
      timeLimitDaysOfWeek: ruleForm.timeLimitDaysOfWeek.includes(day)
        ? ruleForm.timeLimitDaysOfWeek.filter(d => d !== day)
        : [...ruleForm.timeLimitDaysOfWeek, day],
    })

  const ruleColumns: Column<PointsRule>[] = [
    { key: 'name', title: t('pages.memberManagement.config.columns.name'), render: (r) => r.name },
    {
      key: 'rate',
      title: t('pages.memberManagement.config.columns.rate'),
      render: (r) => {
        const rate = r.earnConversionRate ? parseFloat(r.earnConversionRate) : 0
        return rate > 0 ? (1 / rate).toFixed(2) : '-'
      },
    },
    {
      key: 'min',
      title: t('pages.memberManagement.config.columns.min'),
      render: (r) => r.earnMinAmount ? `$${r.earnMinAmount}` : '-',
    },
    {
      key: 'time',
      title: t('pages.memberManagement.config.columns.time'),
      render: (r) => {
        const parts: string[] = []
        if (r.timeLimitDaysOfWeek?.length > 0) {
          const dayNames = [
            t('pages.memberManagement.dayNames.sun'), t('pages.memberManagement.dayNames.mon'), t('pages.memberManagement.dayNames.tue'),
            t('pages.memberManagement.dayNames.wed'), t('pages.memberManagement.dayNames.thu'), t('pages.memberManagement.dayNames.fri'),
            t('pages.memberManagement.dayNames.sat'),
          ]
          parts.push(r.timeLimitDaysOfWeek.map(d => dayNames[d]).join('、'))
        }
        if (r.timeLimitStartTime && r.timeLimitEndTime) {
          parts.push(`${r.timeLimitStartTime}~${r.timeLimitEndTime}`)
        }
        if (r.timeLimitValidFrom || r.timeLimitValidTo) {
          const from = r.timeLimitValidFrom ? dayjs(r.timeLimitValidFrom).format('MM/DD') : '...'
          const to = r.timeLimitValidTo ? dayjs(r.timeLimitValidTo).format('MM/DD') : '...'
          parts.push(`${from}-${to}`)
        }
        return parts.length > 0
          ? <Badge><span title={parts.join(' | ')}>{parts[0]}{parts.length > 1 ? '…' : ''}</span></Badge>
          : <span className="text-slate-400">{t('pages.memberManagement.config.unlimited')}</span>
      },
    },
    {
      key: 'status',
      title: t('pages.memberManagement.config.columns.status'),
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={r.status === 'ACTIVE' ? 'green' : 'default'}>{r.status}</Badge>
          {r.isDefault && <Badge variant="blue">{t('pages.memberManagement.levelManagement.columns.defaultBadge')}</Badge>}
        </div>
      ),
    },
    {
      key: 'action',
      title: t('pages.memberManagement.config.columns.actions'),
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Btn size="sm" variant="secondary" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openRuleModal(r)}>{t('pages.memberManagement.config.columns.editBtn')}</Btn>
          <Btn size="sm" variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setDeleteTarget(r)}>{t('pages.memberManagement.config.columns.deleteBtn')}</Btn>
        </div>
      ),
    },
  ]

  const DAYS_OF_WEEK = [
    { label: t('pages.memberManagement.dayNames.mon'), value: 1 }, { label: t('pages.memberManagement.dayNames.tue'), value: 2 },
    { label: t('pages.memberManagement.dayNames.wed'), value: 3 }, { label: t('pages.memberManagement.dayNames.thu'), value: 4 },
    { label: t('pages.memberManagement.dayNames.fri'), value: 5 }, { label: t('pages.memberManagement.dayNames.sat'), value: 6 },
    { label: t('pages.memberManagement.dayNames.sun'), value: 0 },
  ]

  return (
    <div className="space-y-4">
      {/* 基本配置 */}
      <div className="max-w-xl">
        <SectionCard title={t('pages.memberManagement.config.basicSettingsTitle')}>
          {loading ? <Spinner /> : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch checked={config.membershipEnabled} onCheckedChange={(v) => setC({ membershipEnabled: v })} />
                <span className="text-sm text-slate-700">{t('pages.memberManagement.config.enableMembershipLabel')}</span>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-sm font-medium text-slate-500 mb-2">{t('pages.memberManagement.config.redemptionLimitTitle')}</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label={t('pages.memberManagement.config.maxRewardsLabel')} hint={t('pages.memberManagement.config.maxRewardsHint')}>
                    <OptNumber value={config.maxRewardsPerOrder} onChange={(v) => setC({ maxRewardsPerOrder: v })} min={1} placeholder={t('pages.memberManagement.config.unlimited')} />
                  </Field>
                  <Field label={t('pages.memberManagement.config.maxPromotionsLabel')} hint={t('pages.memberManagement.config.maxPromotionsHint')}>
                    <OptNumber value={config.maxPromotionsPerOrder} onChange={(v) => setC({ maxPromotionsPerOrder: v })} min={1} placeholder={t('pages.memberManagement.config.unlimited')} />
                  </Field>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-sm font-medium text-slate-500 mb-2">{t('pages.memberManagement.config.pointsExpiryTitle')}</p>
                <Field label={t('pages.memberManagement.config.expiryModeLabel')} hint={t('pages.memberManagement.config.expiryModeHint')}>
                  <SelectInput
                    className="w-full"
                    value={config.pointsExpiryMode}
                    onChange={(v) => setC({ pointsExpiryMode: v })}
                    options={[
                      { value: 'NEVER', label: t('pages.memberManagement.config.expiryNever') },
                      { value: 'ROLLING', label: t('pages.memberManagement.config.expiryRolling') },
                      { value: 'CALENDAR_YEAR', label: t('pages.memberManagement.config.expiryCalendarYear') },
                    ]}
                  />
                </Field>
                {config.pointsExpiryMode === 'ROLLING' && (
                  <div className="mt-3">
                    <Field label={t('pages.memberManagement.config.expiryDaysLabel')} hint={t('pages.memberManagement.config.expiryDaysHint')} required>
                      <OptNumber value={config.pointsExpiryDays} onChange={(v) => setC({ pointsExpiryDays: v })} min={1} max={3650} placeholder={t('pages.memberManagement.config.expiryDaysPlaceholder')} className="w-52" />
                    </Field>
                  </div>
                )}
                {config.pointsExpiryMode === 'CALENDAR_YEAR' && (
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <Field label={t('pages.memberManagement.config.expiryMonthLabel')} required>
                      <OptNumber value={config.pointsExpiryMonth} onChange={(v) => setC({ pointsExpiryMonth: v ?? 12 })} min={1} max={12} />
                    </Field>
                    <Field label={t('pages.memberManagement.config.expiryDayLabel')} required>
                      <OptNumber value={config.pointsExpiryDay} onChange={(v) => setC({ pointsExpiryDay: v ?? 31 })} min={1} max={31} />
                    </Field>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3">
                <Btn variant="primary" loading={saving} onClick={handleSaveConfig}>{t('pages.memberManagement.config.saveConfigBtn')}</Btn>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* 积分规则 */}
      <SectionCard
        title={t('pages.memberManagement.config.earnRulesTitle')}
        action={<Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => openRuleModal()}>{t('pages.memberManagement.config.addRuleBtn')}</Btn>}
      >
        <Table
          columns={ruleColumns}
          data={rules}
          rowKey={(r) => r.id}
          loading={rulesLoading}
          empty={t('pages.memberManagement.config.emptyRules')}
        />
      </SectionCard>

      {/* 规则编辑 Modal */}
      <Modal
        title={editingRule ? t('pages.memberManagement.config.editRuleTitle') : t('pages.memberManagement.config.createRuleTitle')}
        open={ruleModalOpen}
        onOpenChange={setRuleModalOpen}
        size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setRuleModalOpen(false)}>{t('pages.memberManagement.config.cancelBtn')}</Btn>
            <Btn variant="primary" loading={ruleSaving} onClick={handleSaveRule}>{t('pages.memberManagement.config.saveBtn')}</Btn>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t('pages.memberManagement.config.ruleNameLabel')} required>
            <TextInput value={ruleForm.name} onChange={(v) => setR({ name: v })} placeholder={t('pages.memberManagement.config.ruleNamePlaceholder')} />
          </Field>
          <Field label={t('pages.memberManagement.config.ruleDescLabel')}>
            <TextInput value={ruleForm.description} onChange={(v) => setR({ description: v })} />
          </Field>
          <Field label={t('pages.memberManagement.config.pointsPerDollarLabel')} hint={t('pages.memberManagement.config.pointsPerDollarHint')} required>
            <OptNumber value={ruleForm.pointsPerDollar} onChange={(v) => setR({ pointsPerDollar: v })} min={0.01} step={0.5} addonAfter={t('pages.memberManagement.config.pointsPerDollarAddon')} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('pages.memberManagement.config.minAmountLabel')} hint={t('pages.memberManagement.config.minAmountHint')}>
              <OptNumber value={ruleForm.earnMinAmount} onChange={(v) => setR({ earnMinAmount: v })} min={0} step={1} placeholder={t('pages.memberManagement.config.unlimited')} />
            </Field>
            <Field label={t('pages.memberManagement.config.maxPerTxLabel')} hint={t('pages.memberManagement.config.maxPerTxHint')}>
              <OptNumber value={ruleForm.earnMaxPerTransaction} onChange={(v) => setR({ earnMaxPerTransaction: v })} min={1} placeholder={t('pages.memberManagement.config.unlimited')} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={ruleForm.isDefault} onCheckedChange={(v) => setR({ isDefault: v })} />
              <span className="text-sm text-slate-700">{t('pages.memberManagement.config.defaultRuleLabel')}</span>
            </div>
            <Field label={t('pages.memberManagement.config.statusLabel')}>
              <SelectInput
                className="w-full"
                value={ruleForm.status}
                onChange={(v) => setR({ status: v })}
                options={[
                  { label: t('pages.memberManagement.config.statusActive'), value: 'ACTIVE' },
                  { label: t('pages.memberManagement.config.statusInactive'), value: 'INACTIVE' },
                ]}
              />
            </Field>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-sm font-medium text-slate-500 mb-2">{t('pages.memberManagement.config.timeLimitSectionTitle')}</p>
            <Field label={t('pages.memberManagement.config.daysOfWeekLabel')}>
              <div className="flex flex-wrap gap-3">
                {DAYS_OF_WEEK.map(d => (
                  <Checkbox
                    key={d.value}
                    checked={ruleForm.timeLimitDaysOfWeek.includes(d.value)}
                    onCheckedChange={() => toggleDayOfWeek(d.value)}
                    label={d.label}
                  />
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <Field label={t('pages.memberManagement.config.timeRangeLabel')}>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    step={1800}
                    value={ruleForm.timeLimitStartTime}
                    onChange={(e) => setR({ timeLimitStartTime: e.target.value })}
                    className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
                  />
                  <span className="text-slate-400">~</span>
                  <input
                    type="time"
                    step={1800}
                    value={ruleForm.timeLimitEndTime}
                    onChange={(e) => setR({ timeLimitEndTime: e.target.value })}
                    className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
                  />
                </div>
              </Field>
              <Field label={t('pages.memberManagement.config.dateRangeLabel')}>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={ruleForm.timeLimitValidFrom}
                    onChange={(e) => setR({ timeLimitValidFrom: e.target.value })}
                    className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
                  />
                  <span className="text-slate-400">~</span>
                  <input
                    type="date"
                    value={ruleForm.timeLimitValidTo}
                    onChange={(e) => setR({ timeLimitValidTo: e.target.value })}
                    className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
                  />
                </div>
              </Field>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t('pages.memberManagement.config.confirmDeleteTitle')}
        danger
        confirmText={t('pages.memberManagement.config.confirmDeleteBtn')}
        onConfirm={() => { const target = deleteTarget; setDeleteTarget(null); if (target) handleDeleteRule(target.id) }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 主页面
// ─────────────────────────────────────────────────────────────────────────────

const MemberManagement: React.FC = () => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('members')

  const tabs = [
    { key: 'members', label: t('pages.memberManagement.tabs.members'), icon: <Users className="w-4 h-4" /> },
    { key: 'levels', label: t('pages.memberManagement.tabs.levels'), icon: <Trophy className="w-4 h-4" /> },
    { key: 'rewards', label: t('pages.memberManagement.tabs.rewards'), icon: <Gift className="w-4 h-4" /> },
    { key: 'birthday', label: t('pages.memberManagement.tabs.birthday'), icon: <Calendar className="w-4 h-4" /> },
    { key: 'config', label: t('pages.memberManagement.tabs.config'), icon: <Settings className="w-4 h-4" /> },
  ]

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-4 inline-flex items-center gap-2">
        <Users className="w-5 h-5" />
        {t('pages.memberManagement.pageTitle')}
      </h1>
      <Tabs items={tabs} value={activeTab} onChange={setActiveTab} />
      <div className="mt-4">
        {activeTab === 'members' && <MemberListTab />}
        {activeTab === 'levels' && <LevelManagementTab />}
        {activeTab === 'rewards' && <RewardManagement />}
        {activeTab === 'birthday' && <BirthdayRewardTab />}
        {activeTab === 'config' && <ConfigTab />}
      </div>
    </div>
  )
}

export default MemberManagement
