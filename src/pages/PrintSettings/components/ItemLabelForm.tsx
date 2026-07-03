import React, { useEffect, useRef, useCallback, useState } from 'react'
import { Save } from 'lucide-react'
import { SectionCard, FormRow, SelectInput, Switch, NumberInput, Btn } from '@/components/ui-kit'

interface Props {
  config: Record<string, any>
  onSave: (config: Record<string, any>) => void
  saving: boolean
}

/** 可选字体列表（与 POS 前端 types.ts 中的 LABEL_FONT_OPTIONS 对应） */
const FONT_OPTIONS = [
  {
    value: 'noto-sans-sc',
    label: 'Noto Sans SC',
    cssName: '"Noto Sans SC", sans-serif',
    // Google Fonts CDN 加载
    url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap',
  },
  {
    value: 'alibaba-puhuiti',
    label: '阿里巴巴普惠体',
    cssName: '"Alibaba PuHuiTi 2.0", "Alibaba PuHuiTi", sans-serif',
    url: 'https://fonts.googleapis.com/css2?family=Alibaba+PuHuiTi+2.0:wght@400;700&display=swap',
  },
  {
    value: 'system-default',
    label: '系统默认',
    cssName: '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif',
    url: '',
  },
]

const FONT_SIZE_MAP: Record<string, number> = { small: 24, medium: 48, large: 72 }
const LINE_HEIGHT_MAP: Record<string, number> = { small: 28, medium: 52, large: 76 }

/** 预览中的多语言示例文案 */
const PREVIEW_TEXT: Record<string, {
  itemName: string; attributes: string; modifiers: string;
  notes: string; customerName: string; tableNumber: string;
}> = {
  'zh-CN': {
    itemName: '冰拿铁 Iced Latte',
    attributes: '大杯 / 冰',
    modifiers: '少糖 · 燕麦奶 · Extra Shot',
    notes: '* 不要泡沫',
    customerName: '张先生',
    tableNumber: '桌号: A3',
  },
  'en': {
    itemName: 'Iced Latte',
    attributes: 'Large / Iced',
    modifiers: 'Less Sugar · Oat Milk · Extra Shot',
    notes: '* No foam',
    customerName: 'John',
    tableNumber: 'Table: A3',
  },
  'zh-TW': {
    itemName: '冰拿鐵 Iced Latte',
    attributes: '大杯 / 冰',
    modifiers: '少糖 · 燕麥奶 · Extra Shot',
    notes: '* 不要泡沫',
    customerName: '張先生',
    tableNumber: '桌號: A3',
  },
}

/** 动态加载字体样式表 */
const loadedFonts = new Set<string>()
function loadFontCSS(url: string) {
  if (!url || loadedFonts.has(url)) return
  loadedFonts.add(url)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url
  document.head.appendChild(link)
}

/** 表单状态类型 */
interface LabelState {
  labelWidth: number; labelHeight: number; labelGap: number; language: string
  showItemName: boolean; showAttributes: boolean; showModifiers: boolean; showSpecialNotes: boolean
  showCupIndex: boolean; showOrderNumber: boolean; showCustomerName: boolean
  showTableNumber: boolean; showTimestamp: boolean; showQrCode: boolean
  fontFamily: string; itemNameFontSize: string; modifierFontSize: string
  bold: boolean; printDensity: string
}

const DEFAULT_STATE: LabelState = {
  labelWidth: 40, labelHeight: 30, labelGap: 2, language: 'zh-CN',
  showItemName: true, showAttributes: true, showModifiers: true, showSpecialNotes: true,
  showCupIndex: true, showOrderNumber: true, showCustomerName: false,
  showTableNumber: false, showTimestamp: false, showQrCode: false,
  fontFamily: 'noto-sans-sc', itemNameFontSize: 'large', modifierFontSize: 'small',
  bold: true, printDensity: 'normal',
}

const LANG_OPTIONS = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en' },
  { label: '繁體中文', value: 'zh-TW' },
]
const SIZE_OPTIONS = [
  { label: '小', value: 'small' },
  { label: '中', value: 'medium' },
  { label: '大', value: 'large' },
]

const ItemLabelForm: React.FC<Props> = ({ config, onSave, saving }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fontsReady, setFontsReady] = useState(false)
  const [v, setV] = useState<LabelState>(DEFAULT_STATE)

  // 加载所有字体
  useEffect(() => {
    FONT_OPTIONS.forEach(f => f.url && loadFontCSS(f.url))
    // 等待字体加载完成后重新渲染预览
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => setFontsReady(true))
    } else {
      // fallback: 延迟后标记字体就绪
      setTimeout(() => setFontsReady(true), 1500)
    }
  }, [])

  useEffect(() => {
    const sections = config.sections || {}
    const style = config.style || {}
    setV({
      labelWidth: config.labelWidth ?? 40,
      labelHeight: config.labelHeight ?? 30,
      labelGap: config.labelGap ?? 2,
      language: config.language || 'zh-CN',
      showItemName: sections.showItemName ?? true,
      showAttributes: sections.showAttributes ?? true,
      showModifiers: sections.showModifiers ?? true,
      showSpecialNotes: sections.showSpecialNotes ?? true,
      showCupIndex: sections.showCupIndex ?? true,
      showOrderNumber: sections.showOrderNumber ?? true,
      showCustomerName: sections.showCustomerName ?? false,
      showTableNumber: sections.showTableNumber ?? false,
      showTimestamp: sections.showTimestamp ?? false,
      showQrCode: sections.showQrCode ?? false,
      fontFamily: style.fontFamily || 'noto-sans-sc',
      itemNameFontSize: style.itemNameFontSize || 'large',
      modifierFontSize: style.modifierFontSize || 'small',
      bold: style.bold ?? true,
      printDensity: style.printDensity || 'normal',
    })
  }, [config])

  const set = <K extends keyof LabelState>(k: K, val: LabelState[K]) => setV(prev => ({ ...prev, [k]: val }))
  const toggle = (k: keyof LabelState) => (val: boolean) => set(k, val as any)

  /** 用 Canvas 渲染标签预览 */
  const renderPreview = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const values = v
    const dpi = 203
    const dotPerMm = dpi / 25.4
    const widthDots = Math.round((values.labelWidth || 40) * dotPerMm)
    const heightDots = Math.round((values.labelHeight || 30) * dotPerMm)

    // Canvas 内部用实际打印分辨率，显示时缩放到合理大小
    canvas.width = widthDots
    canvas.height = heightDots
    const maxDisplayWidth = 380
    const displayWidth = Math.min(maxDisplayWidth, widthDots)
    const displayScale = displayWidth / widthDots
    canvas.style.width = `${displayWidth}px`
    canvas.style.height = `${Math.round(heightDots * displayScale)}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 白底
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, widthDots, heightDots)

    // 打印浓度影响文字颜色
    const density = values.printDensity || 'normal'
    const textColor = density === 'light' ? '#666666' : density === 'dark' ? '#000000' : '#333333'
    ctx.fillStyle = textColor

    const margin = 16
    let y = 16

    const fontFamilyKey = values.fontFamily || 'noto-sans-sc'
    const fontOption = FONT_OPTIONS.find(f => f.value === fontFamilyKey)
    const fontCssName = fontOption?.cssName || '"Noto Sans SC", sans-serif'
    const itemNameSize = values.itemNameFontSize || 'large'
    const modifierSize = values.modifierFontSize || 'small'
    const isBold = values.bold ?? true
    const lang = values.language || 'zh-CN'
    const texts = PREVIEW_TEXT[lang] || PREVIEW_TEXT['zh-CN']

    const setFont = (size: string, bold: boolean = false) => {
      const px = FONT_SIZE_MAP[size] || 24
      ctx.font = `${bold ? 'bold ' : ''}${px}px ${fontCssName}`
    }

    // 自动换行绘制
    const drawWrapped = (text: string, size: string, startY: number, bold: boolean = false): number => {
      setFont(size, bold)
      const maxWidth = widthDots - margin * 2
      const lh = LINE_HEIGHT_MAP[size] || 28
      const fs = FONT_SIZE_MAP[size] || 24
      let curY = startY
      let line = ''
      for (const char of text) {
        const testLine = line + char
        if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
          ctx.fillText(line, margin, curY + fs * 0.85)
          curY += lh
          line = char
        } else {
          line = testLine
        }
      }
      if (line) {
        ctx.fillText(line, margin, curY + fs * 0.85)
        curY += lh
      }
      return curY
    }

    // === 头部：店名 + 取餐号 ===
    setFont('small')
    ctx.fillText('Tymoe Coffee', margin, y + 20)
    const pickupText = '# A-012'
    const tw = ctx.measureText(pickupText).width
    ctx.fillText(pickupText, Math.max(margin, widthDots - margin - tw), y + 20)
    y += LINE_HEIGHT_MAP.small + 4

    // 杯数
    if (values.showCupIndex) {
      setFont('small')
      const cupText = '1/2'
      const cupW = ctx.measureText(cupText).width
      ctx.fillText(cupText, Math.max(margin, widthDots - margin - cupW), y + 20)
      y += LINE_HEIGHT_MAP.small + 4
    }

    // 顾客姓名
    if (values.showCustomerName) {
      setFont('small')
      ctx.fillText(texts.customerName, margin, y + 20)
      y += LINE_HEIGHT_MAP.small + 4
    }

    // 桌号
    if (values.showTableNumber) {
      setFont('small')
      ctx.fillText(texts.tableNumber, margin, y + 20)
      y += LINE_HEIGHT_MAP.small + 4
    }

    // 分隔线
    ctx.strokeStyle = '#cccccc'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(margin, y)
    ctx.lineTo(widthDots - margin, y)
    ctx.stroke()
    ctx.fillStyle = textColor
    y += 8

    // === 商品名称 ===
    if (values.showItemName) {
      y = drawWrapped(texts.itemName, itemNameSize, y, isBold)
    }

    // 属性
    if (values.showAttributes) {
      y += 4
      y = drawWrapped(texts.attributes, modifierSize, y, isBold)
    }

    // 修饰项
    if (values.showModifiers) {
      y += 4
      y = drawWrapped(texts.modifiers, modifierSize, y)
    }

    // 备注
    if (values.showSpecialNotes) {
      y += 4
      y = drawWrapped(texts.notes, modifierSize, y)
    }

    // === 底部：订单号 + 时间 ===
    const bottomY = heightDots - 8 - LINE_HEIGHT_MAP.small
    if (values.showOrderNumber) {
      setFont('small')
      ctx.fillText('#ORD-20260319-001', margin, bottomY + 20)
    }
    if (values.showTimestamp) {
      setFont('small')
      const timeText = '14:30:25'
      const timeW = ctx.measureText(timeText).width
      ctx.fillText(timeText, Math.max(margin, widthDots - margin - timeW), bottomY + 20)
    }
  }, [v])

  // 状态或字体变化后重新渲染预览
  useEffect(() => {
    const timer = setTimeout(() => renderPreview(), 60)
    return () => clearTimeout(timer)
  }, [renderPreview, fontsReady])

  const handleSave = () => {
    onSave({
      labelWidth: v.labelWidth,
      labelHeight: v.labelHeight,
      labelGap: v.labelGap,
      language: v.language,
      sections: {
        showItemName: v.showItemName,
        showAttributes: v.showAttributes,
        showModifiers: v.showModifiers,
        showSpecialNotes: v.showSpecialNotes,
        showCupIndex: v.showCupIndex,
        showOrderNumber: v.showOrderNumber,
        showCustomerName: v.showCustomerName,
        showTableNumber: v.showTableNumber,
        showTimestamp: v.showTimestamp,
        showQrCode: v.showQrCode,
      },
      style: {
        fontFamily: v.fontFamily,
        itemNameFontSize: v.itemNameFontSize,
        modifierFontSize: v.modifierFontSize,
        bold: v.bold,
        printDensity: v.printDensity,
      },
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 左侧：配置表单 */}
      <div className="lg:col-span-2 space-y-4">
        {/* 打印样式 */}
        <SectionCard title="🎨 打印样式">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <FormRow label="打印字体">
              <div className="w-44"><SelectInput className="w-full" value={v.fontFamily} onChange={(val) => set('fontFamily', String(val))}
                options={FONT_OPTIONS.map(f => ({ label: f.label, value: f.value }))} /></div>
            </FormRow>
            <FormRow label="打印浓度">
              <div className="w-44"><SelectInput className="w-full" value={v.printDensity} onChange={(val) => set('printDensity', String(val))}
                options={[{ label: '淡色', value: 'light' }, { label: '正常', value: 'normal' }, { label: '深色', value: 'dark' }]} /></div>
            </FormRow>
            <FormRow label="商品名字号">
              <div className="w-44"><SelectInput className="w-full" value={v.itemNameFontSize} onChange={(val) => set('itemNameFontSize', String(val))} options={SIZE_OPTIONS} /></div>
            </FormRow>
            <FormRow label="修饰项字号">
              <div className="w-44"><SelectInput className="w-full" value={v.modifierFontSize} onChange={(val) => set('modifierFontSize', String(val))} options={SIZE_OPTIONS} /></div>
            </FormRow>
            <FormRow label="加粗显示"><Switch checked={v.bold} onCheckedChange={toggle('bold')} /></FormRow>
          </div>
        </SectionCard>

        {/* 纸张规格 + 标签内容 并排 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SectionCard title="📋 纸张规格">
            <FormRow label="宽度(mm)" hint="常见值: 40, 50, 60mm"><NumberInput value={v.labelWidth} onChange={(val) => set('labelWidth', val)} min={20} max={100} /></FormRow>
            <FormRow label="高度(mm)" hint="常见值: 30, 40mm"><NumberInput value={v.labelHeight} onChange={(val) => set('labelHeight', val)} min={15} max={100} /></FormRow>
            <FormRow label="间距(mm)" hint="多张标签之间的间距"><NumberInput value={v.labelGap} onChange={(val) => set('labelGap', val)} min={0} max={10} /></FormRow>
            <FormRow label="语言">
              <div className="w-40"><SelectInput className="w-full" value={v.language} onChange={(val) => set('language', String(val))} options={LANG_OPTIONS} /></div>
            </FormRow>
          </SectionCard>

          <SectionCard title="📄 标签内容显示">
            <FormRow label="商品名称"><Switch checked={v.showItemName} onCheckedChange={toggle('showItemName')} /></FormRow>
            <FormRow label="商品属性"><Switch checked={v.showAttributes} onCheckedChange={toggle('showAttributes')} /></FormRow>
            <FormRow label="修饰项"><Switch checked={v.showModifiers} onCheckedChange={toggle('showModifiers')} /></FormRow>
            <FormRow label="特殊备注"><Switch checked={v.showSpecialNotes} onCheckedChange={toggle('showSpecialNotes')} /></FormRow>
            <FormRow label="杯数显示"><Switch checked={v.showCupIndex} onCheckedChange={toggle('showCupIndex')} /></FormRow>
            <FormRow label="订单号"><Switch checked={v.showOrderNumber} onCheckedChange={toggle('showOrderNumber')} /></FormRow>
            <FormRow label="顾客姓名"><Switch checked={v.showCustomerName} onCheckedChange={toggle('showCustomerName')} /></FormRow>
            <FormRow label="桌号"><Switch checked={v.showTableNumber} onCheckedChange={toggle('showTableNumber')} /></FormRow>
            <FormRow label="订单时间"><Switch checked={v.showTimestamp} onCheckedChange={toggle('showTimestamp')} /></FormRow>
            <FormRow label="二维码"><Switch checked={v.showQrCode} onCheckedChange={toggle('showQrCode')} disabled /></FormRow>
          </SectionCard>
        </div>

        {/* 保存按钮 */}
        <div className="text-center pt-2">
          <Btn variant="primary" icon={<Save className="w-3.5 h-3.5" />} onClick={handleSave} loading={saving}>保存配置</Btn>
        </div>
      </div>

      {/* 右侧：实时预览 */}
      <div>
        <div className="sticky top-4">
          <SectionCard title="标签打印预览" bodyClassName="text-center px-3 py-4">
            <div className="inline-block bg-white border border-slate-200 rounded p-1 shadow-sm">
              <canvas
                ref={canvasRef}
                style={{ display: 'block', imageRendering: 'pixelated', maxWidth: '100%', height: 'auto' }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">模拟实际打印效果（切换选项实时更新）</p>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

export default ItemLabelForm
