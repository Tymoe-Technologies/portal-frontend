import React, { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, RotateCw, Gift, ArrowUp, Ban } from 'lucide-react'
import {
  memberRewardService,
  type RedeemItem,
  type RewardType,
  type StackingMode,
} from '@/services/memberReward'
import { isRateLimited } from '@/services/http'
import { SectionCard, Btn, IconButton, Table, type Column, Tabs, ConfirmDialog, toast } from '@/components/ui-kit'
import RewardEditorModal from './RewardEditorModal'
import { useAuthContext } from '@/auth/AuthProvider'
import { canEditModule } from '@/auth/permissions'

// 徽章配色（严禁紫色：DISCOUNT_PERCENTAGE / 可发放 原为紫/洋红，改 slate）
const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  TEXT_ONLY: '文字说明',
  FREE_ITEM: '免费商品',
  DISCOUNT_AMOUNT: '固定金额折扣',
  DISCOUNT_PERCENTAGE: '百分比折扣',
}
const REWARD_TYPE_BADGE: Record<RewardType, string> = {
  TEXT_ONLY: 'bg-slate-100 text-slate-600 ring-slate-200',
  FREE_ITEM: 'bg-green-50 text-green-600 ring-green-200',
  DISCOUNT_AMOUNT: 'bg-blue-50 text-blue-600 ring-blue-200',
  DISCOUNT_PERCENTAGE: 'bg-slate-100 text-slate-600 ring-slate-200',
}
const STATUS_LABELS: Record<string, string> = { ACTIVE: '上架', INACTIVE: '下架', COMING_SOON: '即将上线', SOLD_OUT: '已兑完' }
const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-600 ring-green-200',
  INACTIVE: 'bg-slate-100 text-slate-600 ring-slate-200',
  COMING_SOON: 'bg-amber-50 text-amber-600 ring-amber-200',
  SOLD_OUT: 'bg-red-50 text-red-600 ring-red-200',
}

const badge = (text: string, cls: string) => <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 ${cls}`}>{text}</span>

const RewardManagement: React.FC = () => {
  const { role, permissions } = useAuthContext()
  const canEdit = canEditModule('loyaltyRewards', role, permissions)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<RedeemItem[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RedeemItem | null>(null)
  const [activeTab, setActiveTab] = useState('active')
  const [confirm, setConfirm] = useState<{ title: string; description?: string; confirmText: string; onConfirm: () => void } | null>(null)

  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await memberRewardService.list({ page: 1, limit: 100, redeemableOnly: true })
      const body = res.data as any
      setItems(body.data ?? [])
    } catch (e) {
      if (isRateLimited(e)) return
      toast.error('加载奖励列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchItems() }, [])

  const openCreate = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (record: RedeemItem) => { setEditing(record); setModalOpen(true) }

  const handleDelete = async (id: string) => {
    try {
      await memberRewardService.remove(id)
      toast.success('奖励已停用')
      fetchItems()
    } catch (e) {
      if (isRateLimited(e)) return
      toast.error('操作失败')
    }
  }

  const handleReactivate = async (id: string) => {
    try {
      await memberRewardService.reactivate(id)
      toast.success('奖励已重新上架')
      fetchItems()
    } catch (e) {
      if (isRateLimited(e)) return
      toast.error('操作失败')
    }
  }

  const handleHardDelete = async (id: string) => {
    try {
      await memberRewardService.hardRemove(id)
      toast.success('奖励已彻底删除')
      fetchItems()
    } catch (e: any) {
      if (isRateLimited(e)) return
      const detail: string = e?.message ?? ''
      if (e?.status === 409) {
        toast.warning(`${detail || '该奖励无法彻底删除'} — 下架后顾客无法再兑换，但已领取的券仍可正常使用。`)
        return
      }
      toast.error(detail || '删除失败')
    }
  }

  const columns: Column<RedeemItem>[] = [
    {
      key: 'name', title: '名称',
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          <Gift className="w-4 h-4 text-slate-700" />
          <span className="font-semibold text-slate-800">{r.name}</span>
          {r.description && <span className="text-xs text-slate-400">— {r.description}</span>}
        </span>
      ),
    },
    { key: 'rewardType', title: '类型', render: (r) => badge(REWARD_TYPE_LABELS[r.rewardType], REWARD_TYPE_BADGE[r.rewardType]) },
    {
      key: 'usage', title: '用途',
      render: (r) => (
        <span className="inline-flex items-center gap-1">
          {r.pointsCost != null && badge('积分兑换', 'bg-amber-50 text-amber-600 ring-amber-200')}
          {r.isGrantable && badge('可发放', 'bg-slate-100 text-slate-600 ring-slate-200')}
          {r.pointsCost == null && !r.isGrantable && <span className="text-slate-400">—</span>}
        </span>
      ),
    },
    {
      key: 'pointsCost', title: '所需积分',
      render: (r) => (r.pointsCost != null ? <span className="font-semibold text-slate-800">{r.pointsCost.toLocaleString()} pts</span> : <span className="text-slate-400">—</span>),
    },
    {
      key: 'discount', title: '奖励内容',
      render: (r) => {
        if (r.rewardType === 'DISCOUNT_AMOUNT' && r.discountAmount) return badge(`$${(r.discountAmount / 100).toFixed(2)} off`, 'bg-blue-50 text-blue-600 ring-blue-200')
        if (r.rewardType === 'DISCOUNT_PERCENTAGE' && r.discountPercentage) return badge(`${r.discountPercentage}% off`, 'bg-slate-100 text-slate-600 ring-slate-200')
        if (r.rewardType === 'FREE_ITEM') return badge(`${r.linkedItems?.length ?? 0} 件商品可选`, 'bg-green-50 text-green-600 ring-green-200')
        return <span className="text-slate-400">—</span>
      },
    },
    { key: 'stock', title: '库存', render: (r) => (r.stock == null ? <span className="text-slate-400">无限</span> : <span className="text-slate-700">{r.stock}</span>) },
    {
      key: 'stackingMode', title: '叠加规则',
      render: (r) => {
        const map: Record<StackingMode, [string, string]> = {
          EXCLUSIVE: ['独占', 'bg-red-50 text-red-600 ring-red-200'],
          STACKABLE: ['可叠加', 'bg-green-50 text-green-600 ring-green-200'],
          GROUP_EXCLUSIVE: ['组内互斥', 'bg-amber-50 text-amber-600 ring-amber-200'],
        }
        const [label, cls] = map[r.stackingMode]
        return badge(label, cls)
      },
    },
    { key: 'status', title: '状态', render: (r) => badge(STATUS_LABELS[r.status], STATUS_BADGE[r.status] || 'bg-slate-100 text-slate-600 ring-slate-200') },
    {
      key: 'actions', title: '操作',
      render: (r) => !canEdit ? null : (
        <div className="flex items-center gap-0.5">
          <IconButton icon={<Pencil className="w-4 h-4" />} label="编辑" onClick={() => openEdit(r)} />
          {r.status !== 'INACTIVE' ? (
            <IconButton icon={<Ban className="w-4 h-4" />} label="停用" variant="danger"
              onClick={() => setConfirm({ title: '确认停用此奖励？', confirmText: '停用', onConfirm: () => { setConfirm(null); handleDelete(r.id) } })} />
          ) : (
            <>
              <IconButton icon={<ArrowUp className="w-4 h-4" />} label="上架" onClick={() => handleReactivate(r.id)} />
              <IconButton icon={<Trash2 className="w-4 h-4" />} label="删除" variant="danger"
                onClick={() => setConfirm({ title: '确认彻底删除此奖励？删除后不可恢复', description: '仅从未发放过的奖励可删除', confirmText: '删除', onConfirm: () => { setConfirm(null); handleHardDelete(r.id) } })} />
            </>
          )}
        </div>
      ),
    },
  ]

  const activeItems = items.filter(i => i.status !== 'INACTIVE')
  const inactiveItems = items.filter(i => i.status === 'INACTIVE')
  const data = activeTab === 'active' ? activeItems : inactiveItems

  return (
    <div>
      <SectionCard
        title={<span className="inline-flex items-center gap-2"><Gift className="w-4 h-4" />积分奖励管理</span>}
        action={
          <div className="flex gap-2">
            <Btn variant="secondary" icon={<RotateCw className="w-3.5 h-3.5" />} onClick={() => fetchItems()}>刷新</Btn>
            {canEdit && <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>新建奖励</Btn>}
          </div>
        }
      >
        <div className="mb-4">
          <Tabs value={activeTab} onChange={setActiveTab} items={[
            { key: 'active', label: `上架中 (${activeItems.length})` },
            { key: 'inactive', label: `已下架 (${inactiveItems.length})` },
          ]} />
        </div>
        <Table columns={columns} data={data} rowKey={(r) => r.id} loading={loading} />
      </SectionCard>

      <RewardEditorModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => fetchItems()}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title ?? ''}
        description={confirm?.description}
        danger
        confirmText={confirm?.confirmText}
        onConfirm={() => confirm?.onConfirm()}
      />
    </div>
  )
}

export default RewardManagement
