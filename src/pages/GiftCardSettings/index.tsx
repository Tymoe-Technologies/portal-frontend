import React, { useState, useEffect, useCallback } from 'react'
import {
  Gift, Plus, Trash2, Upload as UploadIcon, Copy, Info, Eye, EyeOff, X,
} from 'lucide-react'
import { useAuthContext } from '@/auth/AuthProvider'
import { useTranslation } from 'react-i18next'
import {
  SectionCard, Switch, Btn, AlertBox, Spinner, Modal, TextInput, Textarea,
  SelectInput, FormRow, toast,
} from '@/components/ui-kit'
import {
  getGiftCardConfig,
  upsertGiftCardConfig,
  issueGiftCard,
  uploadGiftCardImageToList,
  deleteGiftCardImageFromList,
  type GiftCardConfig,
} from '@/services/gift-card'

// 预设面额选项（分），供快速选择
const SUGGESTED_DENOMINATIONS = [1000, 2500, 5000, 10000, 15000, 20000, 25000, 50000]

// 分 → 美元显示
const centsToDisplay = (cents: number) => `$${(cents / 100).toFixed(2)}`

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function GiftCardSettings() {
  const { t } = useTranslation()
  const { organizations } = useAuthContext()
  const organizationId = localStorage.getItem('organization_id') || ''

  const currentOrg = organizations.find(o => o.id === organizationId)
  const isMainStore = currentOrg?.orgType === 'MAIN'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<GiftCardConfig | null>(null)

  // 面额编辑状态
  const [denominations, setDenominations] = useState<number[]>([])
  const [customDenomInput, setCustomDenomInput] = useState<string>('')

  // 发行弹窗
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [issueBalance, setIssueBalance] = useState<string>('')   // 美元字符串
  const [issueEmail, setIssueEmail] = useState('')
  const [issueNote, setIssueNote] = useState('')
  const [issueError, setIssueError] = useState<string>('')

  // 图片上传
  const [uploadingImage, setUploadingImage] = useState(false)
  const imageInputRef = React.useRef<HTMLInputElement>(null)

  // 发行结果展示
  const [issuedCard, setIssuedCard] = useState<{ cardNumber: string; pin: string; balance: number } | null>(null)
  const [pinVisible, setPinVisible] = useState(false)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getGiftCardConfig()
      setConfig(data)
      setDenominations(data?.presetDenominations ?? [])
    } catch {
      toast.error(t('giftCard.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (isMainStore) loadConfig()
    else setLoading(false)
  }, [isMainStore, loadConfig])

  const handleToggleEnabled = async (enabled: boolean) => {
    setSaving(true)
    try {
      const updated = await upsertGiftCardConfig({ enabled })
      setConfig(updated)
      toast.success(enabled ? t('giftCard.enabled') : t('giftCard.disabled'))
    } catch {
      toast.error(t('giftCard.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDenominations = async () => {
    setSaving(true)
    try {
      const updated = await upsertGiftCardConfig({ presetDenominations: denominations })
      setConfig(updated)
      toast.success(t('giftCard.denominationsSaved'))
    } catch {
      toast.error(t('giftCard.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const addDenomination = (cents: number) => {
    if (!cents || cents <= 0) return
    if (denominations.includes(cents)) return
    setDenominations(prev => [...prev, cents].sort((a, b) => a - b))
    setCustomDenomInput('')
  }

  const removeDenomination = (cents: number) => {
    setDenominations(prev => prev.filter(d => d !== cents))
  }

  const handleUploadImage = async (file: File) => {
    setUploadingImage(true)
    try {
      const { config: updated } = await uploadGiftCardImageToList(file)
      setConfig(updated)
      toast.success(t('giftCard.imageUploaded'))
    } catch {
      toast.error(t('giftCard.saveError'))
    } finally {
      setUploadingImage(false)
    }
  }

  const handleDeleteImage = async (url: string) => {
    setUploadingImage(true)
    try {
      const updated = await deleteGiftCardImageFromList(url)
      setConfig(updated)
      toast.success(t('giftCard.imageDeleted'))
    } catch {
      toast.error(t('giftCard.saveError'))
    } finally {
      setUploadingImage(false)
    }
  }

  const handleIssue = async () => {
    const balance = parseFloat(issueBalance)
    if (!issueBalance || Number.isNaN(balance) || balance <= 0) {
      setIssueError(t('giftCard.balanceRequired'))
      return
    }
    if (issueEmail && !EMAIL_RE.test(issueEmail)) {
      setIssueError(t('common.invalidEmail'))
      return
    }
    setIssueError('')
    setIssuing(true)
    try {
      const card = await issueGiftCard({
        initialBalance: Math.round(balance * 100),  // 美元 → 分
        recipientEmail: issueEmail || undefined,
        note: issueNote || undefined,
      })
      setIssuedCard({ cardNumber: card.cardNumber, pin: card.pin, balance: card.initialBalance })
      closeIssueModal()
    } catch {
      toast.error(t('giftCard.issueError'))
    } finally {
      setIssuing(false)
    }
  }

  const closeIssueModal = () => {
    setIssueModalOpen(false)
    setIssueBalance('')
    setIssueEmail('')
    setIssueNote('')
    setIssueError('')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success(t('common.copied'))
  }

  // 非主店禁止访问
  if (!isMainStore) {
    return (
      <div className="p-6 max-w-3xl">
        <AlertBox type="warning" title={t('giftCard.mainStoreOnly')} description={t('giftCard.mainStoreOnlyDesc')} />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        <Spinner className="w-8 h-8 mx-auto text-slate-400" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      {/* ── 功能开关 ── */}
      <SectionCard>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gift className="w-5 h-5 text-amber-500" />
            <div>
              <div className="font-semibold text-slate-800">{t('giftCard.title')}</div>
              <div className="text-sm text-slate-500">{t('giftCard.subtitle')}</div>
            </div>
          </div>
          <Switch checked={config?.enabled ?? false} onCheckedChange={handleToggleEnabled} disabled={saving} />
        </div>
      </SectionCard>

      {config?.enabled && (
        <>
          {/* ── 预设面额 ── */}
          <SectionCard
            title={t('giftCard.denominations')}
            action={<Btn variant="primary" size="sm" onClick={handleSaveDenominations} loading={saving}>{t('common.save')}</Btn>}
          >
            <div className="space-y-4">
              <p className="text-sm text-slate-500">{t('giftCard.denominationsHint')}</p>

              {/* 已配置面额 */}
              <div>
                {denominations.length === 0 ? (
                  <p className="text-sm text-slate-400">{t('giftCard.noDenominations')}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {denominations.map(d => (
                      <span key={d} className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 text-amber-700 ring-1 ring-amber-200 px-2.5 py-1 text-sm">
                        {centsToDisplay(d)}
                        <button onClick={() => removeDenomination(d)} className="text-amber-500 hover:text-amber-700 cursor-pointer">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100" />

              {/* 快速选择建议面额 */}
              <div>
                <p className="text-sm text-slate-500 mb-2">{t('giftCard.suggestedDenominations')}</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_DENOMINATIONS.map(d => {
                    const active = denominations.includes(d)
                    return (
                      <button
                        key={d}
                        onClick={() => addDenomination(d)}
                        disabled={active}
                        className={active
                          ? 'inline-flex items-center rounded-md bg-slate-100 text-slate-400 px-2.5 py-1 text-sm cursor-default'
                          : 'inline-flex items-center gap-1 rounded-md bg-blue-50 text-blue-600 ring-1 ring-blue-200 px-2.5 py-1 text-sm hover:bg-blue-100 cursor-pointer'}
                      >
                        {centsToDisplay(d)}
                        {!active && <Plus className="w-3 h-3" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 自定义面额输入 */}
              <div className="flex items-center gap-2">
                <div className="relative w-40">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    step={0.01}
                    placeholder={t('giftCard.customDenomination')}
                    value={customDenomInput}
                    onChange={e => setCustomDenomInput(e.target.value)}
                    className="w-full text-sm bg-white border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
                  />
                </div>
                <Btn
                  variant="secondary"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  disabled={!customDenomInput || parseFloat(customDenomInput) <= 0}
                  onClick={() => {
                    const cents = Math.round(parseFloat(customDenomInput) * 100)
                    if (cents > 0) addDenomination(cents)
                  }}
                >
                  {t('giftCard.addDenomination')}
                </Btn>
              </div>
            </div>
          </SectionCard>

          {/* ── 卡面图片（多款） ── */}
          <SectionCard title={t('giftCard.cardImage')}>
            <div className="space-y-4">
              <p className="text-sm text-slate-500">{t('giftCard.cardImageHint')}</p>

              {/* 多卡面网格 */}
              {(config?.cardImageUrls?.length ?? 0) > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {config!.cardImageUrls.map((url, idx) => (
                    <div key={url} className="relative rounded-xl overflow-hidden border border-slate-100">
                      <img src={url} alt={`Design ${idx + 1}`} className="w-full aspect-video object-cover block" />
                      <button
                        onClick={() => handleDeleteImage(url)}
                        disabled={uploadingImage}
                        className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-red-500 hover:bg-white transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 上传新卡面 */}
              <div>
                <Btn variant="secondary" icon={<UploadIcon className="w-3.5 h-3.5" />} loading={uploadingImage}
                  onClick={() => imageInputRef.current?.click()}>
                  {t('giftCard.uploadImage')}
                </Btn>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadImage(f); e.target.value = '' }}
                />
              </div>

              <AlertBox type="info" description="单张卡面：消费者购买时自动使用该设计。多张卡面：消费者可在购买时选择喜欢的设计。" />
            </div>
          </SectionCard>

          {/* ── 发行礼品卡 ── */}
          <SectionCard
            title={t('giftCard.issue')}
            action={<Btn variant="primary" icon={<Gift className="w-3.5 h-3.5" />} onClick={() => setIssueModalOpen(true)}>{t('giftCard.issueNew')}</Btn>}
          >
            <p className="text-sm text-slate-500">{t('giftCard.issueHint')}</p>
          </SectionCard>
        </>
      )}

      {/* ── 发行成功结果展示 ── */}
      {issuedCard && (
        <div className="rounded-xl border border-green-300 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <Gift className="w-5 h-5 text-green-500" />{t('giftCard.issueSuccess')}
            </div>
            <button onClick={() => setIssuedCard(null)} className="text-red-500 hover:text-red-600 cursor-pointer">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <AlertBox type="warning" description={t('giftCard.pinWarning')} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            <div className="col-span-2">
              <div className="text-sm text-slate-500">{t('giftCard.cardNumber')}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-semibold text-base tracking-widest text-slate-800">
                  {issuedCard.cardNumber.replace(/(.{4})/g, '$1 ').trim()}
                </span>
                <Copy className="w-4 h-4 text-blue-500 cursor-pointer" onClick={() => copyToClipboard(issuedCard.cardNumber)} />
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500">PIN</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-semibold text-base text-slate-800">{pinVisible ? issuedCard.pin : '••••••'}</span>
                {pinVisible
                  ? <EyeOff className="w-4 h-4 cursor-pointer text-slate-500" onClick={() => setPinVisible(false)} />
                  : <Eye className="w-4 h-4 cursor-pointer text-slate-500" onClick={() => setPinVisible(true)} />}
                <Copy className="w-4 h-4 text-blue-500 cursor-pointer" onClick={() => copyToClipboard(issuedCard.pin)} />
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500">{t('giftCard.balance')}</div>
              <div className="font-semibold text-base text-green-600 mt-1">{centsToDisplay(issuedCard.balance)}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── 发行弹窗 ── */}
      <Modal
        open={issueModalOpen}
        onOpenChange={(o) => !o && closeIssueModal()}
        title={<span className="inline-flex items-center gap-2"><Gift className="w-4 h-4" />{t('giftCard.issueNew')}</span>}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={closeIssueModal}>{t('common.cancel')}</Btn>
            <Btn variant="primary" loading={issuing} icon={<Gift className="w-3.5 h-3.5" />} onClick={handleIssue}>{t('giftCard.issue')}</Btn>
          </div>
        }
      >
        <div className="space-y-4">
          <FormRow label={t('giftCard.initialBalance')}>
            {denominations.length > 0 ? (
              <div className="w-full">
                <SelectInput
                  className="w-full"
                  placeholder={t('giftCard.selectBalance')}
                  value={issueBalance}
                  onChange={(v) => setIssueBalance(String(v))}
                  options={denominations.map(d => ({ label: centsToDisplay(d), value: String(d / 100) }))}
                />
              </div>
            ) : (
              <div className="relative w-full">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  step={0.01}
                  placeholder="50.00"
                  value={issueBalance}
                  onChange={e => setIssueBalance(e.target.value)}
                  className="w-full text-sm bg-white border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0"
                />
              </div>
            )}
          </FormRow>

          <FormRow label={t('giftCard.recipientEmail')}>
            <TextInput className="w-full" type="email" value={issueEmail} onChange={setIssueEmail} placeholder="customer@example.com" />
          </FormRow>

          <FormRow label={t('giftCard.note')}>
            <Textarea className="w-full" rows={2} value={issueNote} onChange={setIssueNote} placeholder={t('giftCard.notePlaceholder')} />
          </FormRow>

          {issueError && <p className="text-sm text-red-500">{issueError}</p>}

          <AlertBox type="info" description={t('giftCard.pinOnceHint')} />
        </div>
      </Modal>
    </div>
  )
}
