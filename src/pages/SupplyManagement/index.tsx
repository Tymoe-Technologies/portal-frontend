import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, RotateCcw, Pencil, Trash2 } from 'lucide-react'
import { formatPrice, toMinorUnit, fromMinorUnit } from '@/utils/priceConverter'
import {
  getSupplies, createSupply, updateSupply, deleteSupply,
  type Supply, type CreateSupplyPayload,
} from '@/services/supply'
import { getBrandLocale, LOCALE_LABELS } from '@/services/brand-locale'
import {
  PageHeader, SectionCard, Table, Badge, Btn, Switch, TextInput, Textarea,
  NumberInput, SelectInput, Field, Modal, ConfirmDialog, toast, type Column,
} from '@/components/ui-kit'

const SupplyManagement: React.FC = () => {
  const { t } = useTranslation()
  const [supplies, setSupplies] = useState<Supply[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filterActive, setFilterActive] = useState<boolean | undefined>(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Supply | null>(null)
  const [saving, setSaving] = useState(false)
  const [secondaryLocale, setSecondaryLocale] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Supply | null>(null)

  // 表单（受控）
  const [spName, setSpName] = useState('')
  const [spNameI18n, setSpNameI18n] = useState<string>('')
  const [spBasePrice, setSpBasePrice] = useState<number>(NaN)
  const [spCost, setSpCost] = useState<number>(NaN)
  const [spSku, setSpSku] = useState('')
  const [spDescription, setSpDescription] = useState('')
  const [spDisplayOrder, setSpDisplayOrder] = useState<number>(0)
  const [spIsActive, setSpIsActive] = useState(true)
  const [spErr, setSpErr] = useState('')

  useEffect(() => {
    getBrandLocale().then(cfg => {
      const second = cfg.supported_locales.find(l => l !== 'zh-CN') ?? null
      setSecondaryLocale(second)
    }).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getSupplies({ is_active: filterActive, page, limit: 50 })
      setSupplies(res.data)
      setTotal(res.total)
    } catch (err: any) {
      toast.error(t('pages.supplyManagement.loadFailed', { message: err.message }))
    } finally {
      setLoading(false)
    }
  }, [filterActive, page])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setSpName(''); setSpNameI18n(''); setSpBasePrice(NaN); setSpCost(NaN)
    setSpSku(''); setSpDescription(''); setSpDisplayOrder(0); setSpIsActive(true); setSpErr('')
    setModalOpen(true)
  }

  const openEdit = (record: Supply) => {
    setEditing(record)
    setSpName(record.name)
    setSpNameI18n(secondaryLocale ? ((record as any).name_i18n?.[secondaryLocale] ?? '') : '')
    setSpBasePrice(fromMinorUnit(record.base_price))
    setSpCost(record.cost != null ? fromMinorUnit(record.cost) : NaN)
    setSpSku(record.sku ?? '')
    setSpDescription(record.description ?? '')
    setSpDisplayOrder(record.display_order)
    setSpIsActive(record.is_active)
    setSpErr('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!spName.trim()) { setSpErr(t('pages.supplyManagement.nameRequired')); return }
    const name_i18n = secondaryLocale && spNameI18n ? { [secondaryLocale]: spNameI18n } : undefined
    const payload: CreateSupplyPayload = {
      name: spName,
      sku: spSku || undefined,
      description: spDescription || undefined,
      is_active: spIsActive,
      display_order: spDisplayOrder,
      base_price: toMinorUnit(Number.isNaN(spBasePrice) ? 0 : spBasePrice),
      cost: Number.isNaN(spCost) ? null : toMinorUnit(spCost),
      ...(name_i18n ? { name_i18n } : {}),
    } as any
    setSaving(true)
    try {
      if (editing) {
        await updateSupply(editing.id, payload)
        toast.success(t('pages.supplyManagement.updated'))
      } else {
        await createSupply(payload)
        toast.success(t('pages.supplyManagement.created'))
      }
      setModalOpen(false)
      load()
    } catch (err: any) {
      toast.error(t('pages.supplyManagement.saveFailed', { message: err.message }))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteSupply(id)
      toast.success(t('pages.supplyManagement.deleted'))
      load()
    } catch (err: any) {
      toast.error(t('pages.supplyManagement.deleteFailed', { message: err.message }))
    } finally {
      setDeleteTarget(null)
    }
  }

  const columns: Column<Supply>[] = [
    { key: 'name', title: t('pages.supplyManagement.columns.name'), render: r => <span className="text-slate-800">{r.name}</span> },
    { key: 'base_price', title: t('pages.supplyManagement.columns.basePrice'), width: 100, render: r => formatPrice(r.base_price) },
    { key: 'cost', title: t('pages.supplyManagement.columns.cost'), width: 100, render: r => r.cost != null ? formatPrice(r.cost) : '—' },
    { key: 'sku', title: t('pages.supplyManagement.columns.sku'), width: 130, render: r => <span className="text-slate-500">{r.sku || '—'}</span> },
    { key: 'description', title: t('pages.supplyManagement.columns.description'), render: r => <span className="text-slate-500 line-clamp-1">{r.description || '—'}</span> },
    { key: 'is_active', title: t('pages.supplyManagement.columns.status'), width: 80, render: r => <Badge variant={r.is_active ? 'green' : 'default'}>{r.is_active ? t('pages.supplyManagement.active') : t('pages.supplyManagement.inactive')}</Badge> },
    {
      key: 'actions', title: t('pages.supplyManagement.columns.actions'), width: 100,
      render: r => (
        <div className="flex items-center gap-1">
          <button title={t('pages.supplyManagement.edit')} onClick={() => openEdit(r)} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"><Pencil className="w-4 h-4" /></button>
          <button title={t('pages.supplyManagement.delete')} onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={t('pages.supplyManagement.pageTitle')}
        description={t('pages.supplyManagement.pageDescription')}
        actions={
          <>
            <Btn variant="secondary" icon={<RotateCcw className="w-3.5 h-3.5" />} loading={loading} onClick={load}>{t('pages.supplyManagement.refresh')}</Btn>
            <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>{t('pages.supplyManagement.addSupply')}</Btn>
          </>
        }
      />

      <div className="space-y-4">
        <SectionCard>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{t('pages.supplyManagement.statusLabel')}</span>
            <div className="w-28">
              <SelectInput
                value={filterActive === undefined ? 'all' : String(filterActive)}
                onChange={(v) => { setFilterActive(v === 'all' ? undefined : v === 'true'); setPage(1) }}
                className="w-full"
                options={[
                  { label: t('pages.supplyManagement.active'), value: 'true' },
                  { label: t('pages.supplyManagement.inactive'), value: 'false' },
                  { label: t('pages.supplyManagement.all'), value: 'all' },
                ]}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard bodyClassName="p-0">
          <div className="p-4">
            <Table columns={columns} data={supplies} rowKey={r => r.id} loading={loading} empty={t('pages.supplyManagement.noData')} />
            {total > 50 && (
              <div className="flex items-center justify-between mt-3 text-sm text-slate-500">
                <span>{t('pages.supplyManagement.totalCount', { total })}</span>
                <div className="flex gap-2">
                  <Btn variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('pages.supplyManagement.prevPage')}</Btn>
                  <Btn variant="secondary" size="sm" disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}>{t('pages.supplyManagement.nextPage')}</Btn>
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* 新增/编辑弹窗 */}
      <Modal
        open={modalOpen}
        onOpenChange={(v) => !v && setModalOpen(false)}
        title={editing ? t('pages.supplyManagement.editSupply') : t('pages.supplyManagement.addSupply')}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>{t('pages.supplyManagement.cancel')}</Btn>
            <Btn variant="primary" loading={saving} onClick={handleSave}>{t('pages.supplyManagement.save')}</Btn>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t('pages.supplyManagement.supplyName')} required error={spErr}>
            <TextInput value={spName} onChange={setSpName} placeholder={t('pages.supplyManagement.supplyNamePlaceholder')} maxLength={100} />
          </Field>
          {secondaryLocale && (
            <Field label={t('pages.supplyManagement.secondaryNameLabel', { locale: LOCALE_LABELS[secondaryLocale] ?? secondaryLocale })}>
              <TextInput value={spNameI18n} onChange={setSpNameI18n} placeholder={t('pages.supplyManagement.secondaryNamePlaceholder', { locale: LOCALE_LABELS[secondaryLocale] ?? secondaryLocale })} maxLength={100} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('pages.supplyManagement.columns.basePrice')}><NumberInput value={spBasePrice} onChange={setSpBasePrice} min={0} className="w-full" /></Field>
            <Field label={t('pages.supplyManagement.columns.cost')}><NumberInput value={spCost} onChange={setSpCost} min={0} className="w-full" /></Field>
          </div>
          <Field label={t('pages.supplyManagement.skuLabel')}><TextInput value={spSku} onChange={setSpSku} placeholder={t('pages.supplyManagement.skuPlaceholder')} maxLength={50} /></Field>
          <Field label={t('pages.supplyManagement.columns.description')}><Textarea value={spDescription} onChange={(v) => setSpDescription(v.slice(0, 200))} rows={2} placeholder={t('pages.supplyManagement.optional')} /></Field>
          <div className="grid grid-cols-2 gap-3 items-center">
            <Field label={t('pages.supplyManagement.displayOrder')}><NumberInput value={spDisplayOrder} onChange={setSpDisplayOrder} min={0} className="w-full" /></Field>
            <div>
              <div className="text-sm font-medium text-slate-700 mb-1.5">{t('pages.supplyManagement.columns.status')}</div>
              <div className="flex items-center gap-2">
                <Switch checked={spIsActive} onCheckedChange={setSpIsActive} />
                <span className="text-sm text-slate-500">{spIsActive ? t('pages.supplyManagement.active') : t('pages.supplyManagement.inactive')}</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={t('pages.supplyManagement.confirmDeleteTitle')}
        confirmText={t('pages.supplyManagement.delete')}
        danger
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
      />
    </div>
  )
}

export default SupplyManagement
