// 标签的视觉规则（图标映射 + 特色标签角标配色），跟 customer app
// (tymoe-consumer-app/src/lib/tagIcons.ts) 保持一致。
//
// ⚠️ 这份是从 customer app 复制过来的，两个仓库各自一份。之所以复制而不是抽公共包：
// 两个项目没有共享的 npm 包基础设施，为这一个文件搭一套发布流程不划算。
// 代价是**改动必须两边同步**——尤其是 TAG_ICON_MAP 和 FEATURE_BADGE_COLORS，
// 不同步的话商家在后台看到的预览就跟顾客实际看到的对不上，这个页面就失去意义了。
//
// 后端 catalog_tags.icon 存的是语义 key（snowflake / hot-pepper / crown 这种），
// 刻意不绑定任何图标库，由各端自己映射到本地图标。

// 标签底色：把 hex 转成低透明度的浅色调，用作胶囊背景
export function tagTint(hex: string | undefined, alpha = 0.12): string {
  const match = /^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(hex || '')
  if (!match) return `rgba(153, 153, 153, ${alpha})`
  let value = match[1]
  if (value.length === 3) {
    value = value.split('').map((c) => c + c).join('')
  }
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function contrastAgainstWhite(r: number, g: number, b: number): number {
  return 1.05 / (relativeLuminance(r, g, b) + 0.05)
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let seg: [number, number, number] = [0, 0, 0]
  if (h < 60) seg = [c, x, 0]
  else if (h < 120) seg = [x, c, 0]
  else if (h < 180) seg = [0, c, x]
  else if (h < 240) seg = [0, x, c]
  else if (h < 300) seg = [x, 0, c]
  else seg = [c, 0, x]
  return [seg[0] + m, seg[1] + m, seg[2] + m]
}

// WCAG AA 对小号文字的对比度要求；角标字号只有 10-11px，不能按"大字"的 3:1 标准放水
const MIN_CONTRAST = 4.5

// 特色标签角标专用配色。后端 catalog_tags.color 存的是 Ant Design 的默认调色板，
// 那套色是给色块底色用的，直接当白底上的小字要么看不清，要么压暗之后变成橄榄黄/洋红。
// 这六个常驻标签的角标颜色单独设计过：色相彼此拉开，白字对比度统一卡在 5.3。
// 商家自定义的特色标签不在这张表里，走 readableBadgeColor 兜底
const FEATURE_BADGE_COLORS: Record<string, string> = {
  'feature:signature': '#A45800',
  'feature:best_seller': '#CF2617',
  'feature:seasonal': '#0E7C3C',
  'feature:new': '#CB1D74',
  'feature:recommended': '#2861E7',
  'feature:limited': '#8149E1',
}

// 把颜色往黑里压一点，用来做同色相的深浅渐变（ratio 0.22 = 混入 22% 黑）
export function shadeColor(hex: string, ratio: number): string {
  const match = /^#?([a-f\d]{6})$/i.exec(hex)
  if (!match) return hex
  const value = match[1]
  return (
    '#' +
    [0, 2, 4]
      .map((i) => Math.round(parseInt(value.slice(i, i + 2), 16) * (1 - ratio)).toString(16).padStart(2, '0'))
      .join('')
  )
}

// 商品卡片右上角促销角标的颜色。portal 这边 TagItem 上没有 group 字段
// （services/item-management.ts 的 mapTag 把它丢掉了），所以 groupCode 由调用方从
// 外层 TagGroup 传进来
export function featureBadgeColor(tag: { code: string; color?: string }, groupCode: string): string {
  return FEATURE_BADGE_COLORS[`${groupCode}:${tag.code}`] ?? readableBadgeColor(tag.color)
}

// 把偏亮的标签色压到白底上能看清为止：用 WCAG 对比度公式二分搜索出"刚好达标"的亮度，
// 只压 Lightness，色相和饱和度保持不变
export function readableBadgeColor(hex: string | undefined): string {
  const match = /^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(hex || '')
  if (!match) return '#6B7280'
  let value = match[1]
  if (value.length === 3) {
    value = value.split('').map((c) => c + c).join('')
  }
  const r = parseInt(value.slice(0, 2), 16) / 255
  const g = parseInt(value.slice(2, 4), 16) / 255
  const b = parseInt(value.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r: h = ((g - b) / d) % 6; break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h *= 60
    if (h < 0) h += 360
  }

  // 发闷的颜色拉一把饱和度更有活力；纯灰/黑白没有色相（d===0）不处理，否则会凭空长出色相
  const targetS = d !== 0 && s < 0.55 ? Math.min(1, s + (0.75 - s) * 0.8) : s

  let targetL = l
  if (contrastAgainstWhite(...hslToRgb(h, targetS, l)) < MIN_CONTRAST) {
    let lo = 0 // l=0 是纯黑，对比度必然达标，用来兜底
    let hi = l
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (contrastAgainstWhite(...hslToRgb(h, targetS, mid)) >= MIN_CONTRAST) lo = mid
      else hi = mid
    }
    targetL = lo
  }

  return (
    '#' +
    hslToRgb(h, targetS, targetL)
      .map((v) => Math.round(v * 255).toString(16).padStart(2, '0'))
      .join('')
  )
}

// customer app 在卡片上显示的是精简过的标签名（后端配的名字为了准确经常带前后缀，
// 卡片空间寸土寸金，图标已经表达了类别，文字只留核心词）。预览要让商家看到真实效果，
// 这份精简规则也得跟过来，否则后台显示"畅销/爆款"、顾客端实际显示"畅销"，预览就不准了。
// key 是 "分组code:标签code"——'hot' 在温度分组(热饮)和辣度分组(重辣)都存在，只按 code 查会串
const TAG_LABEL_OVERRIDES: Record<string, { 'zh-CN'?: string; 'zh-TW'?: string; en?: string; fr?: string }> = {
  'allergen:seafood': { 'zh-CN': '海鲜', 'zh-TW': '海鮮' },
  'allergen:nuts': { 'zh-CN': '坚果', 'zh-TW': '堅果' },
  'allergen:peanuts': { 'zh-CN': '花生', 'zh-TW': '花生' },
  'allergen:gluten': { 'zh-CN': '麸质', 'zh-TW': '麩質' },
  'allergen:dairy': { 'zh-CN': '乳制品', 'zh-TW': '乳製品' },
  'allergen:egg': { 'zh-CN': '蛋', 'zh-TW': '蛋' },
  'allergen:soy': { 'zh-CN': '大豆', 'zh-TW': '大豆' },
  'dietary:kosher': { 'zh-CN': '洁食', 'zh-TW': '潔食' },
  'dietary:keto': { 'zh-CN': '生酮', 'zh-TW': '生酮', en: 'Keto', fr: 'Kéto' },
  'dietary:sugar_free': { 'zh-CN': '无糖', 'zh-TW': '無糖' },
  'dietary:low_calorie': { 'zh-CN': '低卡', 'zh-TW': '低卡' },
  'spice_level:mild': { fr: 'Léger' },
  'spice_level:medium': { en: 'Medium', fr: 'Moyen' },
  'spice_level:hot': { en: 'Hot', fr: 'Fort' },
  'feature:limited': { fr: 'Limitée' },
  'feature:best_seller': { 'zh-CN': '畅销', 'zh-TW': '暢銷' },
  'feature:healthy_choice': { 'zh-CN': '健康', 'zh-TW': '健康', en: 'Healthy', fr: 'Santé' },
  'feature:kid_friendly': { 'zh-CN': '儿童', 'zh-TW': '兒童', en: 'Kids', fr: 'Enfants' },
  'feature:family_share': { 'zh-CN': '分享装', 'zh-TW': '分享裝', en: 'Family', fr: 'Familial' },
  'feature:seasonal': { 'zh-CN': '季节', 'zh-TW': '季節' },
}

// 顾客端实际会看到的标签文案。注意 portal 的 TagItem 是 nameI18n（camelCase），
// customer app 那边是 name_i18n，字段名不同但含义一样
export function getTagLabel(
  tag: { code: string; name: string; nameI18n?: Record<string, string> },
  groupCode: string,
  locale: string
): string {
  const override = TAG_LABEL_OVERRIDES[`${groupCode}:${tag.code}`]?.[locale as 'zh-CN' | 'zh-TW' | 'en' | 'fr']
  if (override) return override
  return tag.nameI18n?.[locale] || tag.name
}

// 标签 icon 语义 key -> Iconify 图标名
// 信息类标签（温度/辣度/过敏原/饮食限制）用 tabler 线条版，
// 特色标签（招牌/新品/推荐等）用 mingcute 实心版
export const TAG_ICON_MAP: Record<string, string> = {
  snowflake: 'tabler:snowflake',
  coffee: 'tabler:coffee',
  thermometer: 'tabler:thermometer',
  'hot-pepper': 'tabler:pepper',
  fish: 'tabler:fish',
  // 花生和树坚果没有合适的图标库图形，交给手绘的 PeanutIcon / TreeNutIcon（见 TagIcon.tsx）
  wheat: 'tabler:wheat',
  'wheat-off': 'tabler:wheat-off',
  milk: 'tabler:milk',
  egg: 'tabler:egg',
  salad: 'tabler:salad',
  seedling: 'tabler:seedling',
  mosque: 'tabler:mosque',
  'jewish-star': 'tabler:jewish-star',
  avocado: 'tabler:avocado',
  'droplet-half': 'tabler:droplet-half',
  'candy-off': 'tabler:candy-off',
  salt: 'tabler:salt',
  barbell: 'tabler:barbell',
  // tabler:recycle 是"回收/环保"标志，不是"有机食品"，换成更贴切的叶子图标
  recycle: 'tabler:leaf',
  apple: 'tabler:apple',
  crown: 'mingcute:vip-1-fill',
  sparkles: 'mingcute:sparkles-fill',
  'thumb-up': 'mingcute:thumb-up-fill',
  hourglass: 'mingcute:time-fill',
  trophy: 'mingcute:fire-fill',
  star: 'mingcute:star-fill',
  heart: 'mingcute:heart-fill',
  'mood-kid': 'mingcute:baby-fill',
  'users-group': 'mingcute:group-3-fill',
  'leaf-maple': 'mingcute:leaf-fill',
}
