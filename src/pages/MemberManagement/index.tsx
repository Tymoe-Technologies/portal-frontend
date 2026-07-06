import React, { useState, useEffect, useCallback } from 'react'
import {
  Users, Gift, Trophy, Settings, RotateCw, Plus, Pencil, Trash2,
  History, DollarSign, Crown, Calendar, User,
} from 'lucide-react'
import dayjs from 'dayjs'
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

const REWARD_STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  ACTIVE:    { label: '可用',   variant: 'green'   },
  USED:      { label: '已使用', variant: 'blue'    },
  EXPIRED:   { label: '已过期', variant: 'default' },
  REVOKED:   { label: '已撤销', variant: 'red'     },
  CANCELLED: { label: '已取消', variant: 'default' },
}

// 来源徽章（严禁紫色：BIRTHDAY/MEMBER_EXCLUSIVE 原为洋红/紫，改 slate 系）
const SOURCE_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  POINTS_REDEEM:    { label: '积分兑换', variant: 'gold'    },
  BIRTHDAY:         { label: '生日礼',   variant: 'default' },
  MEMBER_EXCLUSIVE: { label: '会员专属', variant: 'default' },
  CAMPAIGN:         { label: '营销活动', variant: 'blue'    },
  MANUAL:           { label: '员工赠送', variant: 'blue'    },
}

const CouponWallet: React.FC<{
  coupons: GrantedReward[]
  loading: boolean
  onRevokeClick: (c: GrantedReward) => void
  onManualIssueClick: () => void
}> = ({ coupons, loading, onRevokeClick, onManualIssueClick }) => {
  const describe = (c: GrantedReward) => {
    if (c.rewardType === 'DISCOUNT_AMOUNT' && c.discountAmount) {
      return `减 $${(c.discountAmount / 100).toFixed(2)}`
    }
    if (c.rewardType === 'DISCOUNT_PERCENTAGE' && c.discountPercentage) {
      return `${parseFloat(c.discountPercentage)}% off`
    }
    if (c.rewardType === 'FREE_ITEM') return '免费商品'
    return c.rewardName
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <Btn size="sm" variant="secondary" icon={<Calendar className="w-3.5 h-3.5" />} onClick={onManualIssueClick}>
          手动补发生日券
        </Btn>
      </div>

      {loading ? (
        <div className="text-center text-sm text-slate-400 py-6">加载中...</div>
      ) : coupons.length === 0 ? (
        <EmptyState icon={<Gift className="w-8 h-8" />} title="该会员暂无优惠券" />
      ) : (
        <div className="divide-y divide-slate-100">
          {coupons.map((c) => {
            const s = REWARD_STATUS_MAP[c.status] ?? { label: c.status, variant: 'default' as BadgeVariant }
            const src = SOURCE_MAP[c.source] ?? { label: c.source, variant: 'default' as BadgeVariant }
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
                    发放 {dayjs(c.createdAt).format('YYYY-MM-DD')}
                    {c.expiresAt && ` · 到期 ${dayjs(c.expiresAt).format('YYYY-MM-DD')}`}
                  </div>
                  {c.status === 'REVOKED' && c.revokedReason && (
                    <div className="text-[11px] text-slate-400">撤销原因：{c.revokedReason}</div>
                  )}
                  {c.status === 'USED' && c.usedAt && (
                    <div className="text-[11px] text-slate-400">
                      使用于 {dayjs(c.usedAt).format('YYYY-MM-DD HH:mm')}
                    </div>
                  )}
                </div>
                {canRevoke && (
                  <Btn size="sm" variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => onRevokeClick(c)}>
                    撤销
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
      toast.error('加载会员列表失败')
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
    if (!issueYear) { toast.warning('请填写生日年份'); return }
    if (!issueReason.trim() || issueReason.trim().length < 2) { toast.warning('请填写原因（至少 2 个字）'); return }
    setIssuing(true)
    try {
      await birthdayGrantApi.manualIssue({
        memberId: selectedMember.id,
        birthdayYear: issueYear,
        reason: issueReason.trim(),
      })
      toast.success('已补发生日券')
      setManualIssueOpen(false)
      await refreshCoupons()
    } catch (err: any) {
      if (isRateLimited(err)) return
      const code = err?.response?.data?.error?.code
      if (code === 'NO_RULE') {
        toast.error('该会员匹配不到生日券规则（请先在生日券 Tab 配置）')
      } else if (code === 'COUPON_UNAVAILABLE') {
        toast.error('规则关联的券模板已停用')
      } else {
        toast.error(err?.response?.data?.error?.message ?? '补发失败')
      }
    } finally {
      setIssuing(false)
    }
  }

  const handleRevokeReward = async () => {
    if (!revokeTarget) return
    if (!revokeReason.trim() || revokeReason.trim().length < 2) {
      toast.warning('请填写撤销原因（至少 2 个字）')
      return
    }
    setRevoking(true)
    try {
      await grantedRewardApi.revoke(revokeTarget.id, revokeReason.trim())
      toast.success('券已撤销')
      setRevokeTarget(null)
      setRevokeReason('')
      await refreshCoupons()
    } catch (err: any) {
      if (isRateLimited(err)) return
      toast.error(err?.response?.data?.error?.message ?? '撤销失败')
    } finally {
      setRevoking(false)
    }
  }

  const handleAdjustPoints = async () => {
    if (!selectedMember) return
    if (adjustAmount == null || Number.isNaN(adjustAmount)) { toast.warning('请输入调整数量'); return }
    setAdjusting(true)
    try {
      await memberApi.adjustPoints(selectedMember.id, {
        amount: adjustAmount,
        reason: adjustReason || undefined,
        notes: adjustNotes || undefined,
      })
      toast.success('积分调整成功')
      setAdjustModalOpen(false)
      setAdjustAmount(undefined)
      setAdjustReason('')
      setAdjustNotes('')
      // 刷新积分历史和会员数据
      openMemberDrawer(selectedMember)
      fetchMembers()
    } catch (err: any) {
      if (isRateLimited(err)) return
      toast.error(err?.response?.data?.error?.message ?? '调整失败')
    } finally {
      setAdjusting(false)
    }
  }

  const TX_TYPE_MAP: Record<string, [string, BadgeVariant]> = {
    EARN:   ['积分获取', 'green'],
    REDEEM: ['积分兑换', 'red'],
    ADJUST: ['手动调整', 'blue'],
    EXPIRE: ['积分过期', 'default'],
    CANCEL: ['已取消',   'gold'],
  }

  const columns: Column<Member>[] = [
    {
      key: 'memberNo',
      title: '会员号',
      width: 120,
      render: (r) => <code className="text-xs bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">{r.memberNo}</code>,
    },
    {
      key: 'info',
      title: '姓名 / 电话',
      render: (r) => (
        <div className="min-w-0">
          <div className="font-semibold text-slate-800">{r.name || '—'}</div>
          <div className="text-xs text-slate-400">{r.areaCode} {r.phoneNumber}</div>
        </div>
      ),
    },
    {
      key: 'points',
      title: '积分',
      width: 100,
      render: (r) => <span className="font-semibold text-slate-800">{r.points.toLocaleString()}</span>,
    },
    {
      key: 'totalSpent',
      title: '累计消费',
      width: 110,
      render: (r) => `$${parseFloat(r.totalSpent).toFixed(2)}`,
    },
    // 等级列仅在开启时显示（关闭=冻结，不展示残留等级）
    ...(levelsEnabled ? [{
      key: 'level',
      title: '等级',
      width: 100,
      render: (r: Member) => r.level
        ? <Badge variant="blue">{r.level.name}</Badge>
        : <span className="text-slate-400">—</span>,
    } as Column<Member>] : []),
    {
      key: 'status',
      title: '状态',
      width: 80,
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
          <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'ACTIVE' ? 'bg-green-500' : 'bg-slate-300'}`} />
          {r.status === 'ACTIVE' ? '活跃' : '停用'}
        </span>
      ),
    },
    {
      key: 'lastPurchase',
      title: '最近消费',
      width: 120,
      render: (r) => r.lastPurchase ? dayjs(r.lastPurchase).format('MM/DD HH:mm') : '—',
    },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      render: (r) => (
        <Btn size="sm" variant="secondary" icon={<History className="w-3.5 h-3.5" />} onClick={() => openMemberDrawer(r)}>
          查看
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
            placeholder="搜索姓名 / 电话 / 会员号"
          />
          <Btn variant="secondary" type="submit">搜索</Btn>
        </form>
        <SelectInput
          className="w-32"
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); setTimeout(() => fetchMembers(1), 0) }}
          placeholder="状态筛选"
          options={[
            { label: '全部状态', value: '' },
            { label: '活跃', value: 'ACTIVE' },
            { label: '停用', value: 'INACTIVE' },
          ]}
        />
        <SelectInput
          className="w-40"
          value={birthdayFilter}
          onChange={(v) => { setBirthdayFilter(v); setPage(1); setTimeout(() => fetchMembers(1), 0) }}
          placeholder="生日筛选"
          options={[
            { label: '全部生日', value: '' },
            { label: '今天生日', value: 'today' },
            { label: '未来 7 天', value: 'next7' },
            { label: '本周生日', value: 'thisWeek' },
            { label: '本月生日', value: 'thisMonth' },
          ]}
        />
        <Btn variant="secondary" icon={<RotateCw className="w-3.5 h-3.5" />} onClick={() => fetchMembers()}>刷新</Btn>
      </div>

      <Table
        columns={columns}
        data={members}
        rowKey={(r) => r.id}
        loading={loading}
        empty="暂无会员"
      />

      {total > 0 && (
        <div className="flex items-center justify-between mt-3 text-sm text-slate-500">
          <span>共 {total} 位会员</span>
          <div className="flex items-center gap-2">
            <Btn size="sm" variant="secondary" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); fetchMembers(p) }}>上一页</Btn>
            <span>{page} / {totalPages}</span>
            <Btn size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); fetchMembers(p) }}>下一页</Btn>
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
              <div className="text-slate-900">{selectedMember?.name || '未填写姓名'}</div>
              <div className="text-xs text-slate-400">{selectedMember?.areaCode} {selectedMember?.phoneNumber}</div>
            </div>
          </div>
        }
        width={540}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        footer={
          <Btn variant="primary" size="sm" icon={<DollarSign className="w-3.5 h-3.5" />} onClick={() => setAdjustModalOpen(true)}>
            调整积分
          </Btn>
        }
      >
        {selectedMember && (
          <>
            <div className={`grid gap-3 mb-4 ${levelsEnabled ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div className="rounded-lg border border-slate-200 px-4 py-3">
                <div className="text-xs text-slate-400">当前积分</div>
                <div className="text-xl font-semibold text-slate-900 mt-0.5">{selectedMember.points.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border border-slate-200 px-4 py-3">
                <div className="text-xs text-slate-400">累计消费</div>
                <div className="text-xl font-semibold text-slate-900 mt-0.5">${parseFloat(selectedMember.totalSpent).toFixed(2)}</div>
              </div>
              {levelsEnabled && (
                <div className="rounded-lg border border-slate-200 px-4 py-3">
                  <div className="text-xs text-slate-400">等级</div>
                  <div className="text-lg font-semibold text-slate-900 mt-0.5">{selectedMember.level?.name ?? '无等级'}</div>
                </div>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-slate-200 p-4 mb-4 text-sm">
              <div>
                <dt className="text-xs text-slate-400">会员号</dt>
                <dd className="text-slate-700 mt-0.5">{selectedMember.memberNo}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">邮箱</dt>
                <dd className="text-slate-700 mt-0.5">{selectedMember.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">来源</dt>
                <dd className="text-slate-700 mt-0.5">{selectedMember.source}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">注册时间</dt>
                <dd className="text-slate-700 mt-0.5">{dayjs(selectedMember.createdAt).format('YYYY-MM-DD')}</dd>
              </div>
            </dl>

            <Tabs
              value={detailTab}
              onChange={setDetailTab}
              items={[
                { key: 'points', label: '积分记录' },
                {
                  key: 'coupons',
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      券钱包
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
                  <div className="text-center text-sm text-slate-400 py-6">加载中...</div>
                ) : txHistory.length === 0 ? (
                  <EmptyState icon={<History className="w-8 h-8" />} title="暂无积分记录" />
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
                              余额: {tx.balanceBefore} → {tx.balanceAfter} · {dayjs(tx.createdAt).format('MM/DD HH:mm')}
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
        title="手动补发生日券"
        open={manualIssueOpen}
        onOpenChange={setManualIssueOpen}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setManualIssueOpen(false)}>取消</Btn>
            <Btn variant="primary" loading={issuing} onClick={handleManualIssue}>确认补发</Btn>
          </>
        }
      >
        <p className="text-sm text-slate-500 mb-4">
          系统会根据该会员等级找匹配的生日券规则发放。同一年只能补发一次（数据库唯一约束）。
        </p>
        <div className="space-y-4">
          <Field label="哪一年的生日券" hint="通常是当前年份，仅在跨年补救时改" required>
            <OptNumber value={issueYear} onChange={(v) => setIssueYear(v ?? new Date().getFullYear())} min={2020} max={2100} className="w-52" />
          </Field>
          <Field label="补发原因" required>
            <Textarea
              rows={3}
              value={issueReason}
              onChange={setIssueReason}
              placeholder="例如：客户反馈生日录入错误，已修正后补发正确日期的生日券"
            />
          </Field>
        </div>
      </Modal>

      {/* 撤销券 Modal */}
      <Modal
        title={revokeTarget ? `撤销奖励：${revokeTarget.rewardName ?? '—'}` : '撤销奖励'}
        open={!!revokeTarget}
        onOpenChange={(o) => { if (!o) { setRevokeTarget(null); setRevokeReason('') } }}
        footer={
          <>
            <Btn variant="secondary" onClick={() => { setRevokeTarget(null); setRevokeReason('') }}>取消</Btn>
            <Btn variant="danger" loading={revoking} onClick={handleRevokeReward}>确认撤销</Btn>
          </>
        }
      >
        <AlertBox
          type="warning"
          title="撤销后这张券将立刻作废，用户钱包里不能再使用。此操作会被记录在审计日志。"
        />
        <div className="mt-4">
          <Field label="撤销原因" required>
            <Textarea
              rows={3}
              value={revokeReason}
              onChange={setRevokeReason}
              placeholder="例如：客户反馈生日录入错误，已修正后撤销错券"
            />
          </Field>
        </div>
      </Modal>

      {/* 积分调整 Modal */}
      <Modal
        title="手动调整积分"
        open={adjustModalOpen}
        onOpenChange={(o) => { if (!o) { setAdjustModalOpen(false); setAdjustAmount(undefined); setAdjustReason(''); setAdjustNotes('') } }}
        footer={
          <>
            <Btn variant="secondary" onClick={() => { setAdjustModalOpen(false); setAdjustAmount(undefined); setAdjustReason(''); setAdjustNotes('') }}>取消</Btn>
            <Btn variant="primary" loading={adjusting} onClick={handleAdjustPoints}>确认</Btn>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="调整积分（正数增加，负数减少）" required>
            <OptNumber value={adjustAmount} onChange={setAdjustAmount} placeholder="如 100 或 -50" />
          </Field>
          <Field label="原因（显示给会员）">
            <TextInput value={adjustReason} onChange={setAdjustReason} placeholder="如：生日奖励、投诉补偿" />
          </Field>
          <Field label="内部备注">
            <Textarea rows={2} value={adjustNotes} onChange={setAdjustNotes} placeholder="仅内部可见" />
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
      toast.error('加载等级失败')
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
      toast.success(checked ? '已启用会员等级' : '已关闭会员等级')
    } catch (err: any) {
      if (isRateLimited(err)) return
      toast.error(err?.response?.data?.error?.message ?? '更新失败')
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
    if (!form.name.trim()) { toast.warning('请填写等级名称'); return }
    if (form.rank == null || Number.isNaN(form.rank)) { toast.warning('请填写排名'); return }
    if (form.maintenanceEnabled && (form.maintenanceMinSpending == null)) { toast.warning('保级金额必填'); return }
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
        toast.success('等级已更新')
      } else {
        await levelApi.create(payload)
        toast.success('等级已创建')
      }
      setModalOpen(false)
      fetchLevels()
    } catch (err: any) {
      if (isRateLimited(err)) return
      toast.error(err?.response?.data?.error?.message ?? '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await levelApi.remove(id)
      toast.success('等级已停用')
      fetchLevels()
    } catch (e) {
      if (isRateLimited(e)) return
      toast.error('操作失败')
    }
  }

  const addBenefit = () =>
    setBenefits(prev => [...prev, { name: '', type: 'CUSTOM' }])

  const updateBenefit = (i: number, patch: Partial<LevelBenefit>) =>
    setBenefits(prev => prev.map((b, idx) => idx === i ? { ...b, ...patch } : b))

  const removeBenefit = (i: number) =>
    setBenefits(prev => prev.filter((_, idx) => idx !== i))

  const BENEFIT_TYPE_LABELS: Record<string, string> = {
    POINTS_MULTIPLIER: '积分倍率',
    DISCOUNT: '折扣',
    FREE_ITEM: '免费商品',
    CUSTOM: '自定义权益',
  }

  const columns: Column<MemberLevel>[] = [
    {
      key: 'name',
      title: '等级名称',
      render: (r) => (
        <div className="flex items-center gap-2">
          <Crown className="w-[18px] h-[18px] shrink-0" style={{ color: r.color ?? '#f59e0b' }} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">{r.name}</span>
              {r.isDefault && <Badge variant="blue">默认</Badge>}
            </div>
            {r.description && <div className="text-xs text-slate-400">{r.description}</div>}
          </div>
        </div>
      ),
    },
    { key: 'rank', title: '排名', width: 70, render: (r) => r.rank },
    {
      key: 'upgrade',
      title: '升级条件',
      render: (r) => r.upgradeMinSpending
        ? <span className="text-xs text-slate-600">累计消费满 ${parseFloat(r.upgradeMinSpending).toFixed(0)}</span>
        : <span className="text-xs text-slate-400">无条件</span>,
    },
    {
      key: 'maintenance',
      title: '保级',
      render: (r) => {
        if (!r.maintenanceEnabled) return <span className="text-xs text-slate-400">不启用</span>
        return (
          <span className="text-xs text-slate-600">
            {r.maintenancePeriodDays ?? 365} 天内 消费满 ${r.maintenanceMinSpending ? parseFloat(r.maintenanceMinSpending).toFixed(0) : 0}
          </span>
        )
      },
    },
    {
      key: 'benefits',
      title: '权益',
      render: (r) => r.benefits.length > 0
        ? <span className="text-slate-700">{r.benefits.map(b => b.name).join('、')}</span>
        : <span className="text-slate-400">—</span>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Btn size="sm" variant="secondary" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openEdit(r)}>编辑</Btn>
          <Btn size="sm" variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setDeleteTarget(r)}>停用</Btn>
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
          <span className="text-sm font-medium text-slate-700">启用会员等级</span>
          <span className="text-xs text-slate-400">
            {levelsEnabled
              ? '已启用：消费会自动触发升级，每日凌晨执行保级检查'
              : '未启用：仅追踪消费金额，不会自动升降级'}
          </span>
        </div>
      </SectionCard>

      {levelsEnabled && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-4">
            <Btn variant="secondary" icon={<RotateCw className="w-3.5 h-3.5" />} onClick={fetchLevels}>刷新</Btn>
            <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>新建等级</Btn>
          </div>

          <Table
            columns={columns}
            data={levels}
            rowKey={(r) => r.id}
            loading={loading}
            empty="暂无等级"
          />
        </div>
      )}

      <Modal
        title={editing ? '编辑会员等级' : '新建会员等级'}
        open={modalOpen}
        onOpenChange={setModalOpen}
        size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>取消</Btn>
            <Btn variant="primary" loading={saving} onClick={handleSave}>保存</Btn>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Field label="等级名称" required>
                <TextInput value={form.name} onChange={(v) => setF({ name: v })} placeholder="如：金卡、铂金" />
              </Field>
            </div>
            <Field label="排名（越小越低）" required>
              <OptNumber value={form.rank} onChange={(v) => setF({ rank: v ?? 0 })} min={0} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Field label="描述">
                <TextInput value={form.description} onChange={(v) => setF({ description: v })} placeholder="展示给会员的等级说明" />
              </Field>
            </div>
            <Field label="颜色">
              <TextInput value={form.color} onChange={(v) => setF({ color: v })} placeholder="#f59e0b" />
            </Field>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.isDefault} onCheckedChange={(v) => setF({ isDefault: v })} />
            <span className="text-sm text-slate-700">默认等级</span>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-sm font-medium text-slate-500 mb-2">升级条件</p>
            <Field label="累计消费（$）" hint="会员消费达到此金额即升入本等级。留空表示不可主动升级（如默认等级）">
              <OptNumber value={form.upgradeMinSpending} onChange={(v) => setF({ upgradeMinSpending: v })} min={0} placeholder="例：1000" className="w-60" />
            </Field>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-sm font-medium text-slate-500 mb-2">保级条件</p>
            <div className="flex items-center gap-2 mb-3">
              <Switch checked={form.maintenanceEnabled} onCheckedChange={(v) => setF({ maintenanceEnabled: v })} />
              <span className="text-sm text-slate-700">启用保级机制</span>
              <span className="text-xs text-slate-400">未启用时，会员升入本等级后永久保留</span>
            </div>
            {form.maintenanceEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="保级周期（天）" required>
                  <SelectInput
                    className="w-full"
                    value={form.maintenancePeriodDays}
                    onChange={(v) => setF({ maintenancePeriodDays: Number(v) })}
                    options={[
                      { value: 30, label: '30 天' },
                      { value: 60, label: '60 天' },
                      { value: 90, label: '90 天' },
                      { value: 180, label: '180 天' },
                      { value: 365, label: '365 天（一年）' },
                    ]}
                  />
                </Field>
                <Field label="周期内最低消费（$）" hint="周期到期时消费不达此值则降级" required>
                  <OptNumber value={form.maintenanceMinSpending} onChange={(v) => setF({ maintenanceMinSpending: v })} min={0} />
                </Field>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-sm font-medium text-slate-500 mb-2">等级权益</p>
            {benefits.map((b, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3 mb-2">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <TextInput value={b.name} onChange={(v) => updateBenefit(i, { name: v })} placeholder="权益名称" />
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
                      <OptNumber value={b.pointsMultiplier} onChange={(v) => updateBenefit(i, { pointsMultiplier: v })} min={1} step={0.1} placeholder="倍率如 1.5" />
                    </div>
                  )}
                  {b.type === 'CUSTOM' && (
                    <div className="col-span-3">
                      <TextInput value={b.customValue ?? ''} onChange={(v) => updateBenefit(i, { customValue: v })} placeholder="自定义值" />
                    </div>
                  )}
                  <div className="col-span-2 flex justify-end">
                    <Btn size="sm" variant="danger" onClick={() => removeBenefit(i)}>删</Btn>
                  </div>
                </div>
              </div>
            ))}
            <Btn size="sm" variant="secondary" onClick={addBenefit}>+ 添加权益</Btn>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="确认停用此等级？"
        danger
        confirmText="停用"
        onConfirm={() => { const t = deleteTarget; setDeleteTarget(null); if (t) handleDelete(t.id) }}
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
        toast.warning('已有扫描任务在跑，请稍后')
      } else if (result.status === 'FAILED') {
        toast.error(`扫描失败：${result.error}`)
      } else {
        const stats = result.stats ?? {}
        toast.success(
          `扫描完成：发券 ${stats.totalGranted ?? 0} 张` +
          (stats.totalSkipped > 0 ? `，跳过 ${stats.totalSkipped} 条` : '') +
          (stats.totalErrors > 0 ? `，失败 ${stats.totalErrors} 条` : '')
        )
      }
    } catch (err: any) {
      if (isRateLimited(err)) return
      toast.error(err?.response?.data?.error?.message ?? '扫描失败')
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
      toast.error('加载失败')
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
    if (!form.name?.trim()) { toast.warning('请填写奖励名称'); return }
    if (form.daysAheadOfBirthday == null || Number.isNaN(form.daysAheadOfBirthday)) { toast.warning('请填写提前天数'); return }
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
        toast.success('已更新')
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
        toast.success('已创建')
      }
      setRuleModalOpen(false)
      fetchAll()
    } catch (err: any) {
      if (isRateLimited(err)) return
      toast.error(err?.response?.data?.error?.message ?? '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRule = async (id: string) => {
    try {
      await birthdayRuleApi.remove(id)
      toast.success('规则已删除')
      fetchAll()
    } catch (e) {
      if (isRateLimited(e)) return
      toast.error('删除失败')
    }
  }

  const rewardLabelById = (id: string) => {
    const c = coupons.find(x => x.id === id)
    if (!c) return '(未找到)'
    if (c.rewardType === 'DISCOUNT_AMOUNT' && c.discountAmount) return `${c.name}（减 $${(c.discountAmount / 100).toFixed(2)}）`
    if (c.rewardType === 'DISCOUNT_PERCENTAGE' && c.discountPercentage) return `${c.name}（${parseFloat(c.discountPercentage)}% off）`
    if (c.rewardType === 'FREE_ITEM') return `${c.name}（免费商品）`
    return c.name
  }
  const levelName = (id: string) => levels.find(l => l.id === id)?.name ?? '?'

  const columns: Column<BirthdayRewardRule>[] = [
    // 仅开启等级的商家才显示"适用会员"列
    ...(levelsEnabled ? [{
      key: 'audience',
      title: '适用会员',
      render: (r: BirthdayRewardRule) => r.levelId
        ? <Badge variant="blue">仅 {levelName(r.levelId)}</Badge>
        : <Badge>全部会员</Badge>,
    } as Column<BirthdayRewardRule>] : []),
    {
      key: 'reward',
      title: '送什么',
      render: (r) => <span className="text-slate-700">{rewardLabelById(r.rewardId)}</span>,
    },
    {
      key: 'daysAhead',
      title: '提前天数',
      render: (r) => <Badge variant="gold">生日前 {r.daysAheadOfBirthday} 天发</Badge>,
    },
    {
      key: 'status',
      title: '状态',
      render: (r) => <Badge variant={r.status === 'ACTIVE' ? 'green' : 'default'}>{r.status}</Badge>,
    },
    {
      key: 'action',
      title: '操作',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Btn size="sm" variant="secondary" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openEditRule(r)}>编辑</Btn>
          <Btn size="sm" variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setDeleteTarget(r)}>删除</Btn>
        </div>
      ),
    },
  ]

  const levelOptions = [
    { label: '全部会员', value: '' },
    ...levels.map(l => ({ label: `仅 ${l.name}`, value: l.id })),
  ]

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-slate-800">生日券规则</p>
            <p className="text-xs text-slate-500 mt-1">
              系统每天早上 8 点自动扫描有生日的会员发放。优先匹配等级特定规则，无匹配时回落到"全员兜底"。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Btn variant="secondary" loading={scanning} icon={<RotateCw className="w-3.5 h-3.5" />} onClick={() => setScanConfirm(true)}>立即扫描</Btn>
            <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateRule}>新建生日券</Btn>
          </div>
        </div>
      </SectionCard>

      <Table
        columns={columns}
        data={rules}
        rowKey={(r) => r.id}
        loading={loading}
        empty="还未配置任何规则"
      />

      {/* 规则编辑 Modal：奖励内容 + 规则设置合并在一个表单 */}
      <Modal
        title={editingRule ? '编辑生日券' : '新建生日券'}
        open={ruleModalOpen}
        onOpenChange={setRuleModalOpen}
        size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setRuleModalOpen(false)}>取消</Btn>
            <Btn variant="primary" loading={saving} onClick={handleSaveRule}>保存</Btn>
          </>
        }
      >
        <div className="space-y-4">
          {/* ── 规则设置 ── */}
          <div className="grid grid-cols-2 gap-4">
            {/* 仅开启等级的商家才显示"适用会员"；未开启时规则默认面向全部会员 */}
            {levelsEnabled && (
              <div className="col-span-2">
                <Field label="适用会员" hint="默认全部会员；选具体等级则只发给该等级">
                  <SelectInput
                    className="w-full"
                    value={form.levelId}
                    onChange={(v) => setF({ levelId: v })}
                    disabled={!!editingRule}
                    placeholder="全部会员"
                    options={levelOptions}
                  />
                </Field>
              </div>
            )}
            <Field label="提前几天发" hint="0=生日当天，7=提前一周" required>
              <OptNumber value={form.daysAheadOfBirthday} onChange={(v) => setF({ daysAheadOfBirthday: v ?? 0 })} min={0} max={30} />
            </Field>
            <Field label="状态" required>
              <SelectInput
                className="w-full"
                value={form.status}
                onChange={(v) => setF({ status: v })}
                options={[
                  { label: '启用', value: 'ACTIVE' },
                  { label: '停用', value: 'INACTIVE' },
                ]}
              />
            </Field>
          </div>

          <div className="flex items-center gap-2 my-1">
            <span className="text-[13px] text-slate-500">送什么（生日礼内容）</span>
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
        title="立即扫描发券？"
        description="将立即扫描所有匹配的会员并按规则发放生日券。同一会员同一年只会发一次。"
        confirmText="确认扫描"
        onConfirm={() => { setScanConfirm(false); handleScanNow() }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="确认删除？"
        danger
        confirmText="删除"
        onConfirm={() => { const t = deleteTarget; setDeleteTarget(null); if (t) handleDeleteRule(t.id) }}
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
      .catch((e) => { if (!isRateLimited(e)) toast.error('加载配置失败') })
      .finally(() => setLoading(false))
  }, [])

  const fetchRules = useCallback(() => {
    setRulesLoading(true)
    pointsRuleApi.list('EARN')
      .then(res => setRules((res.data as any).data ?? []))
      .catch((e) => { if (!isRateLimited(e)) toast.error('加载积分规则失败') })
      .finally(() => setRulesLoading(false))
  }, [])

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
      toast.success('配置已保存')
    } catch (err: any) {
      if (isRateLimited(err)) return
      toast.error(err?.response?.data?.error?.message ?? '保存失败')
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
    if (!ruleForm.name.trim()) { toast.warning('请填写规则名称'); return }
    if (ruleForm.pointsPerDollar == null || ruleForm.pointsPerDollar <= 0) { toast.warning('请填写每 $1 获得积分'); return }
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
        toast.success('规则已更新')
      } else {
        await pointsRuleApi.create(payload)
        toast.success('规则已创建')
      }
      setRuleModalOpen(false)
      fetchRules()
    } catch (err: any) {
      if (isRateLimited(err)) return
      toast.error(err?.response?.data?.error?.message ?? '保存失败')
    } finally {
      setRuleSaving(false)
    }
  }

  const handleDeleteRule = async (id: string) => {
    try {
      await pointsRuleApi.remove(id)
      toast.success('规则已删除')
      fetchRules()
    } catch (e) {
      if (isRateLimited(e)) return
      toast.error('删除失败')
    }
  }

  const toggleDayOfWeek = (day: number) =>
    setR({
      timeLimitDaysOfWeek: ruleForm.timeLimitDaysOfWeek.includes(day)
        ? ruleForm.timeLimitDaysOfWeek.filter(d => d !== day)
        : [...ruleForm.timeLimitDaysOfWeek, day],
    })

  const ruleColumns: Column<PointsRule>[] = [
    { key: 'name', title: '名称', render: (r) => r.name },
    {
      key: 'rate',
      title: '每 $1 得积分',
      render: (r) => {
        const rate = r.earnConversionRate ? parseFloat(r.earnConversionRate) : 0
        return rate > 0 ? (1 / rate).toFixed(2) : '-'
      },
    },
    {
      key: 'min',
      title: '最低消费',
      render: (r) => r.earnMinAmount ? `$${r.earnMinAmount}` : '-',
    },
    {
      key: 'time',
      title: '适用时间',
      render: (r) => {
        const parts: string[] = []
        if (r.timeLimitDaysOfWeek?.length > 0) {
          const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
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
          : <span className="text-slate-400">不限</span>
      },
    },
    {
      key: 'status',
      title: '状态',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={r.status === 'ACTIVE' ? 'green' : 'default'}>{r.status}</Badge>
          {r.isDefault && <Badge variant="blue">默认</Badge>}
        </div>
      ),
    },
    {
      key: 'action',
      title: '操作',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Btn size="sm" variant="secondary" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openRuleModal(r)}>编辑</Btn>
          <Btn size="sm" variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setDeleteTarget(r)}>删除</Btn>
        </div>
      ),
    },
  ]

  const DAYS_OF_WEEK = [
    { label: '周一', value: 1 }, { label: '周二', value: 2 },
    { label: '周三', value: 3 }, { label: '周四', value: 4 },
    { label: '周五', value: 5 }, { label: '周六', value: 6 },
    { label: '周日', value: 0 },
  ]

  return (
    <div className="space-y-4">
      {/* 基本配置 */}
      <div className="max-w-xl">
        <SectionCard title="基本设置">
          {loading ? <Spinner /> : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch checked={config.membershipEnabled} onCheckedChange={(v) => setC({ membershipEnabled: v })} />
                <span className="text-sm text-slate-700">启用会员系统</span>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-sm font-medium text-slate-500 mb-2">兑换上限（每单）</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="每单积分奖励最多可用（次）" hint="空 = 无限制">
                    <OptNumber value={config.maxRewardsPerOrder} onChange={(v) => setC({ maxRewardsPerOrder: v })} min={1} placeholder="留空不限" />
                  </Field>
                  <Field label="每单所有促销最多叠加（次）" hint="空 = 无限制">
                    <OptNumber value={config.maxPromotionsPerOrder} onChange={(v) => setC({ maxPromotionsPerOrder: v })} min={1} placeholder="留空不限" />
                  </Field>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-sm font-medium text-slate-500 mb-2">积分有效期</p>
                <Field label="过期策略" hint="变更后仅对新累积的积分生效，已有积分不受影响">
                  <SelectInput
                    className="w-full"
                    value={config.pointsExpiryMode}
                    onChange={(v) => setC({ pointsExpiryMode: v })}
                    options={[
                      { value: 'NEVER', label: '永不过期' },
                      { value: 'ROLLING', label: '滚动过期（从获得日算起）' },
                      { value: 'CALENDAR_YEAR', label: '固定日期清零（每年）' },
                    ]}
                  />
                </Field>
                {config.pointsExpiryMode === 'ROLLING' && (
                  <div className="mt-3">
                    <Field label="有效天数" hint="积分自获得日起多少天后过期，常见值 365" required>
                      <OptNumber value={config.pointsExpiryDays} onChange={(v) => setC({ pointsExpiryDays: v })} min={1} max={3650} placeholder="例：365" className="w-52" />
                    </Field>
                  </div>
                )}
                {config.pointsExpiryMode === 'CALENDAR_YEAR' && (
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <Field label="每年清零月份" required>
                      <OptNumber value={config.pointsExpiryMonth} onChange={(v) => setC({ pointsExpiryMonth: v ?? 12 })} min={1} max={12} />
                    </Field>
                    <Field label="每年清零日" required>
                      <OptNumber value={config.pointsExpiryDay} onChange={(v) => setC({ pointsExpiryDay: v ?? 31 })} min={1} max={31} />
                    </Field>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3">
                <Btn variant="primary" loading={saving} onClick={handleSaveConfig}>保存配置</Btn>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* 积分规则 */}
      <SectionCard
        title="积分累积规则"
        action={<Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => openRuleModal()}>新增规则</Btn>}
      >
        <Table
          columns={ruleColumns}
          data={rules}
          rowKey={(r) => r.id}
          loading={rulesLoading}
          empty="暂无规则"
        />
      </SectionCard>

      {/* 规则编辑 Modal */}
      <Modal
        title={editingRule ? '编辑积分规则' : '新增积分规则'}
        open={ruleModalOpen}
        onOpenChange={setRuleModalOpen}
        size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setRuleModalOpen(false)}>取消</Btn>
            <Btn variant="primary" loading={ruleSaving} onClick={handleSaveRule}>保存</Btn>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="规则名称" required>
            <TextInput value={ruleForm.name} onChange={(v) => setR({ name: v })} placeholder="例：默认积分规则" />
          </Field>
          <Field label="描述（可选）">
            <TextInput value={ruleForm.description} onChange={(v) => setR({ description: v })} />
          </Field>
          <Field label="每消费 $1 获得积分" hint="例：10 = 每消费 $1 得 10 积分" required>
            <OptNumber value={ruleForm.pointsPerDollar} onChange={(v) => setR({ pointsPerDollar: v })} min={0.01} step={0.5} addonAfter="积分/$1" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="最低消费金额" hint="空 = 无门槛">
              <OptNumber value={ruleForm.earnMinAmount} onChange={(v) => setR({ earnMinAmount: v })} min={0} step={1} placeholder="留空不限" />
            </Field>
            <Field label="单笔积分上限" hint="空 = 无上限">
              <OptNumber value={ruleForm.earnMaxPerTransaction} onChange={(v) => setR({ earnMaxPerTransaction: v })} min={1} placeholder="留空不限" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={ruleForm.isDefault} onCheckedChange={(v) => setR({ isDefault: v })} />
              <span className="text-sm text-slate-700">设为默认规则</span>
            </div>
            <Field label="状态">
              <SelectInput
                className="w-full"
                value={ruleForm.status}
                onChange={(v) => setR({ status: v })}
                options={[
                  { label: '启用', value: 'ACTIVE' },
                  { label: '禁用', value: 'INACTIVE' },
                ]}
              />
            </Field>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-sm font-medium text-slate-500 mb-2">时间限制（可选，全空 = 不限）</p>
            <Field label="适用星期">
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
              <Field label="适用时间段">
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
              <Field label="有效日期范围">
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
        title="确认删除？"
        danger
        confirmText="删除"
        onConfirm={() => { const t = deleteTarget; setDeleteTarget(null); if (t) handleDeleteRule(t.id) }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 主页面
// ─────────────────────────────────────────────────────────────────────────────

const MemberManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('members')

  const tabs = [
    { key: 'members', label: '会员列表', icon: <Users className="w-4 h-4" /> },
    { key: 'levels', label: '会员等级', icon: <Trophy className="w-4 h-4" /> },
    { key: 'rewards', label: '积分奖励', icon: <Gift className="w-4 h-4" /> },
    { key: 'birthday', label: '生日券', icon: <Calendar className="w-4 h-4" /> },
    { key: 'config', label: '系统配置', icon: <Settings className="w-4 h-4" /> },
  ]

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-4 inline-flex items-center gap-2">
        <Users className="w-5 h-5" />
        会员管理
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
