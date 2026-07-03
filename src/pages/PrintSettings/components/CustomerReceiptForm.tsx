import React, { useState, useEffect, useRef } from 'react'
import { Save, Image as ImageIcon, Trash2, Loader2 } from 'lucide-react'
import LogoCropModal from '../../../components/LogoCropModal'
import { uploadPrintLogo, deletePrintLogo } from '../../../services/print-settings'
import { LogoPreprocessor, PreprocessOptions, PreprocessResult } from '../../../utils/logoPreprocessor'
import {
  SectionCard, FormRow, SelectInput, Switch, TextInput, Btn, Modal, Slider, Checkbox, toast,
} from '@/components/ui-kit'

interface Props {
  config: Record<string, any>
  onSave: (config: Record<string, any>) => void
  saving: boolean
  // 品牌 Logo URL（从父级传入，模板未设置专属 Logo 时显示此图）
  brandLogoUrl?: string | null
}

const PAPER_OPTIONS = [
  { label: '58mm（小票）', value: '58' },
  { label: '80mm（标准）', value: '80' },
]
const LANG_OPTIONS = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en' },
  { label: '繁體中文', value: 'zh-TW' },
]

const CustomerReceiptForm: React.FC<Props> = ({ config, onSave, saving, brandLogoUrl }) => {
  // 表单字段以「展平」形式保存在 state 中（key 形如 storeInfo.showName）
  const [values, setValues] = useState<Record<string, any>>({})
  const [logoUrl, setLogoUrl] = useState<string | undefined>(config?.sections?.storeInfo?.logoUrl)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // 裁剪弹窗状态
  const [cropModalVisible, setCropModalVisible] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState<string>('')

  // Logo 预处理相关状态
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

  // 将嵌套的 config 展平为表单字段
  const flattenConfig = (cfg: Record<string, any>) => {
    const flat: Record<string, any> = {
      paperWidth: cfg.paperWidth || 80,
      language: cfg.language || 'zh-CN',
    }
    const sections = cfg.sections || {}
    for (const [sectionKey, sectionVal] of Object.entries(sections)) {
      if (typeof sectionVal === 'object' && sectionVal !== null) {
        for (const [key, val] of Object.entries(sectionVal as Record<string, any>)) {
          flat[`${sectionKey}.${key}`] = val
        }
      }
    }
    return flat
  }

  useEffect(() => {
    setValues(flattenConfig(config))
    setLogoUrl(config?.sections?.storeInfo?.logoUrl)
  }, [config])

  const setField = (key: string, val: any) => setValues(prev => ({ ...prev, [key]: val }))
  const sw = (key: string) => (v: boolean) => setField(key, v)

  // 将表单字段还原为嵌套 config
  const unflattenToConfig = (vals: Record<string, any>) => {
    const cfg: Record<string, any> = {
      paperWidth: vals.paperWidth || 80,
      language: vals.language || 'zh-CN',
      sections: {
        storeInfo: {}, orderInfo: {}, items: {}, amounts: {}, payment: {}, footer: {},
      },
    }
    for (const [key, val] of Object.entries(vals)) {
      if (key.includes('.')) {
        const [section, field] = key.split('.')
        if (cfg.sections[section]) {
          cfg.sections[section][field] = val
        }
      }
    }
    // customMessage 直接使用字符串
    if (cfg.sections.footer.customMessage === undefined) {
      cfg.sections.footer.customMessage = config.sections?.footer?.customMessage || '感谢惠顾'
    }
    return cfg
  }

  const buildLayoutAndStyles = (cfg: Record<string, any>) => {
    const paperWidth = cfg.paperWidth || 80
    const charsPerLine = paperWidth === 58 ? 32 : 48
    cfg.layout = [
      { type: 'section', key: 'storeInfo' },
      { type: 'divider', style: '***', repeat: charsPerLine },
      { type: 'section', key: 'orderInfo' },
      { type: 'section', key: 'items' },
      { type: 'section', key: 'amounts' },
      { type: 'divider', style: '**', repeat: charsPerLine },
      { type: 'section', key: 'payment' },
      { type: 'section', key: 'footer' },
    ]
    cfg.styles = {
      global: { fontFamily: 'monospace', charsPerLine },
      storeInfo: {
        storeName: { fontSize: 'double', bold: true, align: 'center' },
        address: { fontSize: 'normal', bold: false, align: 'center' },
        phone: { fontSize: 'normal', bold: false, align: 'center' },
        logo: { align: 'center', maxWidth: paperWidth === 58 ? 200 : 300 },
      },
      orderInfo: {
        label: { fontSize: 'normal', bold: false, align: 'left' },
        value: { fontSize: 'normal', bold: false, align: 'right' },
      },
      items: {
        header: { fontSize: 'normal', bold: true, align: 'left' },
        itemName: { fontSize: 'normal', bold: false, align: 'left' },
        itemPrice: { fontSize: 'normal', bold: false, align: 'right' },
        attributes: { fontSize: 'small', bold: false, align: 'left', indent: 2 },
        modifiers: { fontSize: 'small', bold: false, align: 'left', indent: 2 },
      },
      amounts: {
        label: { fontSize: 'normal', bold: false, align: 'left' },
        value: { fontSize: 'normal', bold: false, align: 'right' },
        total: { fontSize: 'double', bold: true, align: 'right' },
      },
      payment: {
        label: { fontSize: 'normal', bold: false, align: 'left' },
        value: { fontSize: 'normal', bold: false, align: 'right' },
      },
      footer: {
        qrCode: { align: 'center', moduleSize: paperWidth === 58 ? 4 : 6 },
        qrCodeText: { fontSize: 'normal', bold: false, align: 'center' },
        customMessage: { fontSize: 'normal', bold: false, align: 'center' },
      },
    }
    return cfg
  }

  // 选择文件 → 校验 → 读取 dataURL → 打开裁剪弹窗
  const handleLogoFilePicked = (file: File) => {
    const isValidType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    if (!isValidType) { toast.error('只支持 JPG、PNG、WebP 格式的图片'); return }
    const isLt2M = file.size / 1024 / 1024 < 2
    if (!isLt2M) { toast.error('Logo 图片大小不能超过 2MB'); return }
    const reader = new FileReader()
    reader.onload = (e) => {
      setCropImageSrc(e.target?.result as string)
      setCropModalVisible(true)
    }
    reader.readAsDataURL(file)
  }

  // 裁剪确认后进入预处理弹窗
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
      toast.error('图片处理失败: ' + error.message)
    }
  }

  // 上传处理后的图片
  const handleConfirmUpload = async () => {
    if (!processedResult) return
    setLogoUploading(true)
    try {
      const processedFile = new File([processedResult.blob], 'logo.png', { type: 'image/png' })
      const result = await uploadPrintLogo(processedFile as any)
      setLogoUrl(result.url)
      toast.success('Logo 上传成功')
      setPreprocessModalVisible(false)
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Logo 上传失败')
    } finally {
      setLogoUploading(false)
    }
  }

  // 参数改变时重新处理
  const handlePreprocessOptionsChange = async (newOptions: Partial<PreprocessOptions>) => {
    if (!originalFile) return
    const options = { ...preprocessOptions, ...newOptions }
    setPreprocessOptions(options)
    try {
      const result = await LogoPreprocessor.preprocessImage(originalFile as any, options)
      setProcessedResult(result)
    } catch (error: any) {
      toast.error('图片处理失败: ' + error.message)
    }
  }

  const handleLogoDelete = async () => {
    setLogoUploading(true)
    try {
      await deletePrintLogo()
      setLogoUrl(undefined)
      const cfg = unflattenToConfig(values)
      if (cfg.sections.storeInfo) cfg.sections.storeInfo.logoUrl = ''
      buildLayoutAndStyles(cfg)
      onSave(cfg)
      toast.success('Logo 已删除并保存')
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Logo 删除失败')
    } finally {
      setLogoUploading(false)
    }
  }

  const handleSave = () => {
    const cfg = unflattenToConfig(values)
    if (cfg.sections.storeInfo) cfg.sections.storeInfo.logoUrl = logoUrl || ''
    buildLayoutAndStyles(cfg)
    onSave(cfg)
  }

  const showLogo = !!values['storeInfo.showLogo']
  const showQrCode = !!values['footer.showQrCode']

  return (
    <>
      <div className="space-y-4 max-w-3xl">
        {/* 基础设置 */}
        <SectionCard title="基础设置">
          <FormRow label="纸张宽度">
            <div className="w-48"><SelectInput className="w-full" value={String(values.paperWidth ?? 80)}
              onChange={(v) => setField('paperWidth', Number(v))} options={PAPER_OPTIONS} /></div>
          </FormRow>
          <FormRow label="语言">
            <div className="w-48"><SelectInput className="w-full" value={values.language || 'zh-CN'}
              onChange={(v) => setField('language', String(v))} options={LANG_OPTIONS} /></div>
          </FormRow>
        </SectionCard>

        {/* 店铺信息 */}
        <SectionCard title="店铺信息">
          <FormRow label="显示店铺名称"><Switch checked={!!values['storeInfo.showName']} onCheckedChange={sw('storeInfo.showName')} /></FormRow>
          <FormRow label="显示地址"><Switch checked={!!values['storeInfo.showAddress']} onCheckedChange={sw('storeInfo.showAddress')} /></FormRow>
          <FormRow label="显示电话"><Switch checked={!!values['storeInfo.showPhone']} onCheckedChange={sw('storeInfo.showPhone')} /></FormRow>
          <FormRow label="显示 Logo"><Switch checked={!!values['storeInfo.showLogo']} onCheckedChange={sw('storeInfo.showLogo')} /></FormRow>
          {showLogo && (
            <FormRow label="收据 Logo">
              <div>
                {logoUrl ? (
                  // 模板专属 Logo
                  <div className="flex items-start gap-3">
                    <div className="relative w-[100px] h-[100px]">
                      <img src={logoUrl} className="w-[100px] h-[100px] object-contain rounded border border-slate-100 bg-slate-50" />
                      <button
                        onClick={handleLogoDelete}
                        disabled={logoUploading}
                        className="absolute top-0.5 right-0.5 flex h-6 w-6 items-center justify-center rounded-md bg-white/85 text-red-500 hover:bg-white transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {logoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      模板专属 Logo<br />
                      <span className="text-slate-400">删除后将自动使用品牌 Logo</span>
                    </div>
                  </div>
                ) : brandLogoUrl ? (
                  // 没有模板专属 Logo，显示品牌 Logo 预览
                  <div className="flex items-start gap-3">
                    <div className="relative w-[100px] h-[100px] opacity-80">
                      <img src={brandLogoUrl} className="w-[100px] h-[100px] object-contain rounded border border-dashed border-blue-400 bg-blue-50/50" />
                    </div>
                    <div className="text-xs">
                      <div className="text-blue-600 mb-1">当前使用品牌 Logo</div>
                      <div className="text-slate-400 mb-2">上传专属 Logo 可覆盖品牌设置</div>
                      <Btn variant="secondary" size="sm" icon={<ImageIcon className="w-3.5 h-3.5" />} loading={logoUploading}
                        onClick={() => logoInputRef.current?.click()}>上传专属 Logo</Btn>
                    </div>
                  </div>
                ) : (
                  // 品牌和模板都没有 Logo
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                    className="flex flex-col items-center justify-center w-[100px] h-[100px] rounded border border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-slate-400 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {logoUploading
                      ? <Loader2 className="w-6 h-6 animate-spin" />
                      : <><ImageIcon className="w-6 h-6 mb-1" /><span className="text-xs text-slate-500">上传 Logo</span></>}
                  </button>
                )}
                <p className="text-xs text-slate-400 mt-1">支持 JPG、PNG、WebP，最大 2MB</p>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFilePicked(f); e.target.value = '' }}
                />
              </div>
            </FormRow>
          )}
        </SectionCard>

        {/* 订单信息 */}
        <SectionCard title="订单信息">
          <FormRow label="订单号"><Switch checked={!!values['orderInfo.showOrderNumber']} onCheckedChange={sw('orderInfo.showOrderNumber')} /></FormRow>
          <FormRow label="订单类型"><Switch checked={!!values['orderInfo.showOrderType']} onCheckedChange={sw('orderInfo.showOrderType')} /></FormRow>
          <FormRow label="桌号"><Switch checked={!!values['orderInfo.showTableNumber']} onCheckedChange={sw('orderInfo.showTableNumber')} /></FormRow>
          <FormRow label="时间"><Switch checked={!!values['orderInfo.showTime']} onCheckedChange={sw('orderInfo.showTime')} /></FormRow>
          <FormRow label="顾客姓名"><Switch checked={!!values['orderInfo.showCustomerName']} onCheckedChange={sw('orderInfo.showCustomerName')} /></FormRow>
          <FormRow label="顾客电话"><Switch checked={!!values['orderInfo.showCustomerPhone']} onCheckedChange={sw('orderInfo.showCustomerPhone')} /></FormRow>
          <FormRow label="收银员"><Switch checked={!!values['orderInfo.showCashier']} onCheckedChange={sw('orderInfo.showCashier')} /></FormRow>
        </SectionCard>

        {/* 商品明细 */}
        <SectionCard title="商品明细">
          <FormRow label="商品属性（规格）"><Switch checked={!!values['items.showAttributes']} onCheckedChange={sw('items.showAttributes')} /></FormRow>
          <FormRow label="加料/自定义选项"><Switch checked={!!values['items.showModifiers']} onCheckedChange={sw('items.showModifiers')} /></FormRow>
          <FormRow label="单品备注"><Switch checked={!!values['items.showItemNotes']} onCheckedChange={sw('items.showItemNotes')} /></FormRow>
          <FormRow label="单价"><Switch checked={!!values['items.showUnitPrice']} onCheckedChange={sw('items.showUnitPrice')} /></FormRow>
        </SectionCard>

        {/* 金额汇总 */}
        <SectionCard title="金额汇总">
          <FormRow label="小计"><Switch checked={!!values['amounts.showSubtotal']} onCheckedChange={sw('amounts.showSubtotal')} /></FormRow>
          <FormRow label="折扣"><Switch checked={!!values['amounts.showDiscount']} onCheckedChange={sw('amounts.showDiscount')} /></FormRow>
          <FormRow label="税费"><Switch checked={!!values['amounts.showTax']} onCheckedChange={sw('amounts.showTax')} /></FormRow>
          <FormRow label="服务费"><Switch checked={!!values['amounts.showServiceFee']} onCheckedChange={sw('amounts.showServiceFee')} /></FormRow>
          <FormRow label="配送费"><Switch checked={!!values['amounts.showDeliveryFee']} onCheckedChange={sw('amounts.showDeliveryFee')} /></FormRow>
          <FormRow label="小费"><Switch checked={!!values['amounts.showTip']} onCheckedChange={sw('amounts.showTip')} /></FormRow>
        </SectionCard>

        {/* 支付信息 */}
        <SectionCard title="支付信息">
          <FormRow label="支付方式"><Switch checked={!!values['payment.showPaymentMethod']} onCheckedChange={sw('payment.showPaymentMethod')} /></FormRow>
          <FormRow label="支付时间"><Switch checked={!!values['payment.showPaymentTime']} onCheckedChange={sw('payment.showPaymentTime')} /></FormRow>
          <FormRow label="交易号"><Switch checked={!!values['payment.showTransactionId']} onCheckedChange={sw('payment.showTransactionId')} /></FormRow>
          <FormRow label="现金收付详情"><Switch checked={!!values['payment.showCashDetail']} onCheckedChange={sw('payment.showCashDetail')} /></FormRow>
        </SectionCard>

        {/* 底部信息 */}
        <SectionCard title="底部信息">
          <FormRow label="二维码"><Switch checked={!!values['footer.showQrCode']} onCheckedChange={sw('footer.showQrCode')} /></FormRow>
          {showQrCode && (
            <>
              <FormRow label="二维码链接">
                <TextInput className="w-full" value={values['footer.qrCodeUrl'] || ''} onChange={(v) => setField('footer.qrCodeUrl', v)}
                  placeholder="https://example.com/order/{orderId}" />
              </FormRow>
              <FormRow label="二维码文字">
                <TextInput className="w-full" value={values['footer.qrCodeText'] || ''} onChange={(v) => setField('footer.qrCodeText', v)}
                  placeholder="扫码关注（可选）" />
              </FormRow>
            </>
          )}
          <FormRow label="订单备注"><Switch checked={!!values['footer.showOrderNotes']} onCheckedChange={sw('footer.showOrderNotes')} /></FormRow>
          <FormRow label="自定义底部文字">
            <TextInput className="w-full" value={values['footer.customMessage'] ?? ''} onChange={(v) => setField('footer.customMessage', v)}
              placeholder="感谢惠顾" />
          </FormRow>
        </SectionCard>

        <div className="text-center pt-2">
          <Btn variant="primary" icon={<Save className="w-3.5 h-3.5" />} onClick={handleSave} loading={saving}>保存配置</Btn>
        </div>
      </div>

      {/* 裁剪弹窗 */}
      <LogoCropModal
        open={cropModalVisible}
        imageSrc={cropImageSrc}
        onConfirm={handleCropConfirm}
        onCancel={() => setCropModalVisible(false)}
      />

      {/* Logo 预处理弹窗 */}
      <Modal
        title="Logo 图片处理"
        open={preprocessModalVisible}
        onOpenChange={(o) => !o && setPreprocessModalVisible(false)}
        size="xl"
        footer={
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setPreprocessModalVisible(false)}>取消</Btn>
            <Btn variant="primary" loading={logoUploading} onClick={handleConfirmUpload}>上传处理后的图片</Btn>
          </div>
        }
      >
        <div className="flex gap-10 mb-8">
          {/* 原图预览 */}
          <div className="flex-1 text-center">
            <h4 className="font-semibold text-slate-700 mb-2">原图</h4>
            {originalPreview && (
              <>
                <img src={originalPreview} alt="原图" className="max-w-full border border-slate-200 rounded mx-auto" />
                <p className="mt-2.5 text-slate-500 text-sm">
                  大小: {originalFile ? (originalFile.size / 1024).toFixed(2) : 0} KB
                </p>
              </>
            )}
          </div>

          {/* 处理后预览 */}
          <div className="flex-1 text-center">
            <h4 className="font-semibold text-slate-700 mb-2">处理后（纯黑白）</h4>
            {processedResult && (
              <>
                <img
                  src={processedResult.dataUrl}
                  alt="处理后"
                  className="max-w-full border border-slate-200 rounded mx-auto"
                  style={{
                    background: `
                      linear-gradient(45deg, #eee 25%, transparent 25%),
                      linear-gradient(-45deg, #eee 25%, transparent 25%),
                      linear-gradient(45deg, transparent 75%, #eee 75%),
                      linear-gradient(-45deg, transparent 75%, #eee 75%)
                    `,
                    backgroundSize: '20px 20px',
                    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                  }}
                />
                <p className="mt-2.5 text-slate-500 text-sm">
                  大小: {(processedResult.stats.processedSize / 1024).toFixed(2)} KB<br />
                  尺寸: {processedResult.width} × {processedResult.height}<br />
                  去除背景: {processedResult.stats.removedPixels} 像素<br />
                  黑色: {processedResult.stats.blackPixels} / 白色: {processedResult.stats.whitePixels}
                </p>
              </>
            )}
          </div>
        </div>

        {/* 参数调整 */}
        <div className="bg-slate-50 p-5 rounded">
          <h4 className="font-semibold text-slate-700 mb-4">调整参数</h4>

          <div className="mb-5">
            <label className="block mb-2 text-sm text-slate-700">
              背景去除阈值 ({preprocessOptions.backgroundThreshold})
              <span className="text-xs text-slate-500 ml-2.5">越高越激进地移除浅色背景</span>
            </label>
            <Slider min={200} max={255} value={preprocessOptions.backgroundThreshold ?? 240}
              onChange={(value) => handlePreprocessOptionsChange({ backgroundThreshold: value })} />
          </div>

          <div className="mb-5">
            <label className="block mb-2 text-sm text-slate-700">
              黑白阈值 ({preprocessOptions.binarizeThreshold})
              <span className="text-xs text-slate-500 ml-2.5">低于此值的像素视为黑色</span>
            </label>
            <Slider min={0} max={255} value={preprocessOptions.binarizeThreshold ?? 128}
              onChange={(value) => handlePreprocessOptionsChange({ binarizeThreshold: value })} />
          </div>

          <div className="mb-5">
            <label className="block mb-2 text-sm text-slate-700">
              对比度 ({preprocessOptions.contrastFactor?.toFixed(1)})
              <span className="text-xs text-slate-500 ml-2.5">增强图片对比度</span>
            </label>
            <Slider min={1.0} max={3.0} step={0.1} value={preprocessOptions.contrastFactor ?? 1.5}
              onChange={(value) => handlePreprocessOptionsChange({ contrastFactor: value })} />
          </div>

          <Checkbox
            checked={!!preprocessOptions.invert}
            onCheckedChange={(checked) => handlePreprocessOptionsChange({ invert: checked })}
            label="反色（黑底白字 → 白底黑字）"
          />
        </div>
      </Modal>
    </>
  )
}

export default CustomerReceiptForm
