import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Printer, Tag as TagIcon, BarChart3, ArrowLeftRight, RotateCcw, Image as ImageIcon, Trash2 } from 'lucide-react'
import LogoCropModal from '../../components/LogoCropModal'
import type { PrintSetting, TicketType } from '../../services/print-settings'
import {
  getPrintSettings, updatePrintSetting, initializePrintSettings, togglePrintSetting,
  getBrandProfile, uploadBrandLogo, deleteBrandLogo,
} from '../../services/print-settings'
import { LogoPreprocessor, PreprocessOptions, PreprocessResult } from '../../utils/logoPreprocessor'
import CustomerReceiptForm from './components/CustomerReceiptForm'
import KitchenTicketForm from './components/KitchenTicketForm'
import ItemLabelForm from './components/ItemLabelForm'
import DailyReportForm from './components/DailyReportForm'
import ShiftReportForm from './components/ShiftReportForm'
import {
  PageHeader, SectionCard, Btn, Switch, NumberInput, AlertBox, Spinner,
  EmptyState, Modal, Slider, Checkbox, Tabs, toast,
} from '@/components/ui-kit'

// 票据类型 Tab 配置（label/description 需 t()，作为函数在组件内调用）
const getTicketTabs = (t: (key: string) => string): { key: TicketType; label: string; icon: React.ReactNode; description: string }[] => [
  { key: 'CUSTOMER_RECEIPT', label: t('pages.printSettings.tabs.customerReceipt.label'), icon: <FileText className="w-4 h-4" />, description: t('pages.printSettings.tabs.customerReceipt.description') },
  { key: 'KITCHEN_TICKET', label: t('pages.printSettings.tabs.kitchenTicket.label'), icon: <Printer className="w-4 h-4" />, description: t('pages.printSettings.tabs.kitchenTicket.description') },
  { key: 'ITEM_LABEL', label: t('pages.printSettings.tabs.itemLabel.label'), icon: <TagIcon className="w-4 h-4" />, description: t('pages.printSettings.tabs.itemLabel.description') },
  { key: 'DAILY_REPORT', label: t('pages.printSettings.tabs.dailyReport.label'), icon: <BarChart3 className="w-4 h-4" />, description: t('pages.printSettings.tabs.dailyReport.description') },
  { key: 'SHIFT_REPORT', label: t('pages.printSettings.tabs.shiftReport.label'), icon: <ArrowLeftRight className="w-4 h-4" />, description: t('pages.printSettings.tabs.shiftReport.description') },
]

const PrintSettings: React.FC = () => {
  const { t } = useTranslation()
  const TICKET_TABS = getTicketTabs(t)
  const [settings, setSettings] = useState<PrintSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<TicketType>('CUSTOMER_RECEIPT')

  // 品牌 Logo
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // 裁剪弹窗
  const [cropModalVisible, setCropModalVisible] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState<string>('')

  // 预处理弹窗
  const [preprocessModalVisible, setPreprocessModalVisible] = useState(false)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [originalPreview, setOriginalPreview] = useState<string>('')
  const [processedResult, setProcessedResult] = useState<PreprocessResult | null>(null)
  const [preprocessOptions, setPreprocessOptions] = useState<PreprocessOptions>({
    backgroundThreshold: 240,
    binarizeThreshold: 128,
    contrastFactor: 1.5,
    invert: false,
    maxSize: 800,
  })

  const loadBrandProfile = useCallback(async () => {
    try {
      const profile = await getBrandProfile()
      setBrandLogoUrl(profile?.logoUrl ?? null)
    } catch {
      // 品牌配置未初始化时静默处理
    }
  }, [])

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      let data = await getPrintSettings()
      if (data.length === 0) {
        data = await initializePrintSettings()
        toast.success(t('pages.printSettings.initDefaultSuccess'))
      }
      setSettings(data)
    } catch (error: any) {
      toast.error(t('pages.printSettings.loadFailed', { message: error.message || t('pages.printSettings.unknownError') }))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
    loadBrandProfile()
  }, [loadSettings, loadBrandProfile])

  // 选择 Logo 文件：校验后读取为 dataURL 打开裁剪弹窗
  const handleLogoFile = (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.error(t('pages.printSettings.logoFormatError')); return }
    if (file.size / 1024 / 1024 >= 5) { toast.error(t('pages.printSettings.logoSizeError')); return }
    const reader = new FileReader()
    reader.onload = (e) => { setCropImageSrc(e.target?.result as string); setCropModalVisible(true) }
    reader.readAsDataURL(file)
  }

  const handleCropConfirm = async (blob: Blob) => {
    setCropModalVisible(false)
    const file = new File([blob], 'logo-cropped.png', { type: 'image/png' })
    setOriginalFile(file)
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.readAsDataURL(blob)
    })
    setOriginalPreview(dataUrl)
    try {
      const result = await LogoPreprocessor.preprocessImage(file as any, preprocessOptions)
      setProcessedResult(result)
      setPreprocessModalVisible(true)
    } catch (error: any) {
      toast.error(t('pages.printSettings.imageProcessFailed', { message: error.message }))
    }
  }

  const handleBrandLogoConfirmUpload = async () => {
    if (!processedResult) return
    setLogoUploading(true)
    try {
      const processedFile = new File([processedResult.blob], 'logo.png', { type: 'image/png' })
      const { url } = await uploadBrandLogo(processedFile as unknown as File)
      setBrandLogoUrl(url)
      toast.success(t('pages.printSettings.logoUploadSuccess'))
      setPreprocessModalVisible(false)
    } catch (error: any) {
      toast.error(error?.response?.data?.error || t('pages.printSettings.logoUploadFailed'))
    } finally {
      setLogoUploading(false)
    }
  }

  const handleBrandLogoPreprocessOptionsChange = async (newOptions: Partial<PreprocessOptions>) => {
    if (!originalFile) return
    const options = { ...preprocessOptions, ...newOptions }
    setPreprocessOptions(options)
    try {
      const result = await LogoPreprocessor.preprocessImage(originalFile as any, options)
      setProcessedResult(result)
    } catch (error: any) {
      toast.error(t('pages.printSettings.imageProcessFailed', { message: error.message }))
    }
  }

  const handleBrandLogoDelete = async () => {
    setLogoUploading(true)
    try {
      await deleteBrandLogo()
      setBrandLogoUrl(null)
      toast.success(t('pages.printSettings.logoDeleteSuccess'))
    } catch {
      toast.error(t('pages.printSettings.logoDeleteFailed'))
    } finally {
      setLogoUploading(false)
    }
  }

  const handleSaveConfig = async (ticketType: TicketType, config: Record<string, any>) => {
    setSaving(true)
    try {
      const updated = await updatePrintSetting(ticketType, { config })
      setSettings(prev => prev.map(s => s.ticketType === ticketType ? updated : s))
      toast.success(t('pages.printSettings.saveSuccess'))
    } catch (error: any) {
      toast.error(t('pages.printSettings.saveFailed', { message: error.message || t('pages.printSettings.unknownError') }))
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (ticketType: TicketType) => {
    try {
      const updated = await togglePrintSetting(ticketType)
      setSettings(prev => prev.map(s => s.ticketType === ticketType ? updated : s))
      toast.success(updated.isEnabled ? t('pages.printSettings.enabledMsg') : t('pages.printSettings.disabledMsg'))
    } catch (error: any) {
      toast.error(t('pages.printSettings.operationFailed', { message: error.message || t('pages.printSettings.unknownError') }))
    }
  }

  const handleCopiesChange = async (ticketType: TicketType, copies: number) => {
    try {
      const updated = await updatePrintSetting(ticketType, { copies })
      setSettings(prev => prev.map(s => s.ticketType === ticketType ? updated : s))
    } catch {
      toast.error(t('pages.printSettings.updateCopiesFailed'))
    }
  }

  const renderConfigForm = (setting: PrintSetting) => {
    const props = {
      config: setting.config,
      onSave: (config: Record<string, any>) => handleSaveConfig(setting.ticketType, config),
      saving,
    }
    switch (setting.ticketType) {
      case 'CUSTOMER_RECEIPT': return <CustomerReceiptForm {...props} brandLogoUrl={brandLogoUrl} />
      case 'KITCHEN_TICKET': return <KitchenTicketForm {...props} />
      case 'ITEM_LABEL': return <ItemLabelForm {...props} />
      case 'DAILY_REPORT': return <DailyReportForm {...props} />
      case 'SHIFT_REPORT': return <ShiftReportForm {...props} />
      default: return null
    }
  }

  if (loading) return <Spinner className="py-24" />

  const activeSetting = settings.find(s => s.ticketType === activeTab)

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <PageHeader
        title={t('pages.printSettings.pageTitle')}
        description={t('pages.printSettings.pageDescription')}
        actions={<Btn variant="secondary" icon={<RotateCcw className="w-3.5 h-3.5" />} onClick={loadSettings}>{t('pages.printSettings.refreshBtn')}</Btn>}
      />

      {/* 品牌 Logo */}
      <div className="mb-5">
        <SectionCard title={t('pages.printSettings.brandLogoTitle')} description={t('pages.printSettings.brandLogoDescription')}>
          <div className="flex items-center gap-4">
            {brandLogoUrl ? (
              <>
                <img src={brandLogoUrl} alt="Logo" className="w-20 h-20 object-contain rounded border border-slate-100 bg-slate-50" />
                <div className="flex flex-col gap-2">
                  <Btn variant="secondary" size="sm" icon={<ImageIcon className="w-3.5 h-3.5" />} loading={logoUploading} onClick={() => logoInputRef.current?.click()}>{t('pages.printSettings.changeLogoBtn')}</Btn>
                  <Btn variant="danger" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} loading={logoUploading} onClick={handleBrandLogoDelete}>{t('pages.printSettings.deleteLogoBtn')}</Btn>
                </div>
              </>
            ) : (
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
                className="flex flex-col items-center justify-center w-20 h-20 rounded border border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-slate-400 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                {logoUploading ? <Spinner className="py-0" /> : <><ImageIcon className="w-5 h-5" /><span className="text-[11px] mt-1">{t('pages.printSettings.uploadLogoBtn')}</span></>}
              </button>
            )}
            <div className="text-xs text-slate-400">
              {t('pages.printSettings.logoUploadHint1')}
              <br />{t('pages.printSettings.logoUploadHint2')}
            </div>
            <input ref={logoInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); e.target.value = '' }} />
          </div>
        </SectionCard>
      </div>

      <Tabs
        value={activeTab}
        onChange={(k) => setActiveTab(k as TicketType)}
        items={TICKET_TABS.map(tab => {
          const setting = settings.find(s => s.ticketType === tab.key)
          return { key: tab.key, label: <>{tab.label}{setting && !setting.isEnabled && <span className="text-slate-400 text-xs ml-1">{t('pages.printSettings.disabledTag')}</span>}</>, icon: tab.icon }
        })}
      />

      <div className="mt-4">
        {activeSetting ? (
          <div>
            <div className="flex items-center gap-6 rounded-lg bg-slate-50 px-5 py-4 mb-5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">{t('pages.printSettings.enablePrintLabel')}</span>
                <Switch checked={activeSetting.isEnabled} onCheckedChange={() => handleToggle(activeTab)} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">{t('pages.printSettings.printCopiesLabel')}</span>
                <NumberInput value={activeSetting.copies} onChange={(val) => val && handleCopiesChange(activeTab, val)} min={1} max={10} />
              </div>
              <span className="text-xs text-slate-400">{t('pages.printSettings.versionLabel', { version: activeSetting.version })}</span>
            </div>

            {!activeSetting.isEnabled && (
              <div className="mb-4">
                <AlertBox type="warning" title={t('pages.printSettings.disabledWarning')} />
              </div>
            )}

            {renderConfigForm(activeSetting)}
          </div>
        ) : (
          <EmptyState title={t('pages.printSettings.emptyStateTitle')} />
        )}
      </div>

      {/* 裁剪弹窗 */}
      <LogoCropModal
        open={cropModalVisible}
        imageSrc={cropImageSrc}
        onConfirm={handleCropConfirm}
        onCancel={() => setCropModalVisible(false)}
      />

      {/* 预处理弹窗 */}
      <Modal
        open={preprocessModalVisible}
        onOpenChange={(v) => !v && setPreprocessModalVisible(false)}
        title={t('pages.printSettings.preprocessModalTitle')}
        size="xl"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setPreprocessModalVisible(false)}>{t('pages.printSettings.cancelBtn')}</Btn>
            <Btn variant="primary" loading={logoUploading} onClick={handleBrandLogoConfirmUpload}>{t('pages.printSettings.uploadProcessedBtn')}</Btn>
          </>
        }
      >
        <div className="flex gap-10 mb-8">
          <div className="flex-1 text-center">
            <p className="font-medium text-slate-700 mb-2">{t('pages.printSettings.originalImageLabel')}</p>
            {originalPreview && (
              <>
                <img src={originalPreview} alt={t('pages.printSettings.originalImageLabel')} className="max-w-full border border-slate-200 rounded mx-auto" />
                <p className="mt-2 text-sm text-slate-500">{t('pages.printSettings.sizeLabel', { size: originalFile ? (originalFile.size / 1024).toFixed(2) : 0 })}</p>
              </>
            )}
          </div>
          <div className="flex-1 text-center">
            <p className="font-medium text-slate-700 mb-2">{t('pages.printSettings.processedImageLabel')}</p>
            {processedResult && (
              <>
                <img
                  src={processedResult.dataUrl}
                  alt={t('pages.printSettings.processedAltLabel')}
                  className="max-w-full border border-slate-200 rounded mx-auto"
                  style={{
                    background: 'linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)',
                    backgroundSize: '20px 20px',
                    backgroundPosition: '0 0,0 10px,10px -10px,-10px 0px',
                  }}
                />
                <p className="mt-2 text-sm text-slate-500">
                  {t('pages.printSettings.sizeLabel', { size: (processedResult.stats.processedSize / 1024).toFixed(2) })}<br />
                  {t('pages.printSettings.dimensionLabel', { width: processedResult.width, height: processedResult.height })}<br />
                  {t('pages.printSettings.removedBgLabel', { count: processedResult.stats.removedPixels })}<br />
                  {t('pages.printSettings.blackWhiteLabel', { black: processedResult.stats.blackPixels, white: processedResult.stats.whitePixels })}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-5">
          <p className="font-medium text-slate-700 mb-4">{t('pages.printSettings.adjustParamsTitle')}</p>

          <div className="mb-5">
            <label className="block mb-2 text-sm text-slate-700">
              {t('pages.printSettings.bgThresholdLabel', { value: preprocessOptions.backgroundThreshold })}
              <span className="text-xs text-slate-400 ml-2">{t('pages.printSettings.bgThresholdHint')}</span>
            </label>
            <Slider min={200} max={255} value={preprocessOptions.backgroundThreshold!} onChange={(v) => handleBrandLogoPreprocessOptionsChange({ backgroundThreshold: v })} />
          </div>

          <div className="mb-5">
            <label className="block mb-2 text-sm text-slate-700">
              {t('pages.printSettings.bwThresholdLabel', { value: preprocessOptions.binarizeThreshold })}
              <span className="text-xs text-slate-400 ml-2">{t('pages.printSettings.bwThresholdHint')}</span>
            </label>
            <Slider min={0} max={255} value={preprocessOptions.binarizeThreshold!} onChange={(v) => handleBrandLogoPreprocessOptionsChange({ binarizeThreshold: v })} />
          </div>

          <div className="mb-5">
            <label className="block mb-2 text-sm text-slate-700">
              {t('pages.printSettings.contrastLabel', { value: preprocessOptions.contrastFactor?.toFixed(1) })}
              <span className="text-xs text-slate-400 ml-2">{t('pages.printSettings.contrastHint')}</span>
            </label>
            <Slider min={1} max={3} step={0.1} value={preprocessOptions.contrastFactor!} onChange={(v) => handleBrandLogoPreprocessOptionsChange({ contrastFactor: v })} />
          </div>

          <Checkbox
            checked={!!preprocessOptions.invert}
            onCheckedChange={(c) => handleBrandLogoPreprocessOptionsChange({ invert: c })}
            label={t('pages.printSettings.invertLabel')}
          />
        </div>
      </Modal>
    </div>
  )
}

export default PrintSettings
