/**
 * 价格转换工具库
 *
 * 系统采用"两级金额单位"设计：
 * - 主单位（基础单位）：用户看到和输入的单位（如 5.99）
 * - 副单位（最小单位）：系统内部存储单位，整数型以避免浮点精度问题（如 599）
 *
 * 转换规则：1 主单位 = 100 副单位
 */

/**
 * 将主单位转换为副单位（最小单位）
 * @param amount 主单位的金额（如 5.99）
 * @returns 副单位的金额（如 599）
 *
 * @example
 * toMinorUnit(5.99)  // 返回 599
 * toMinorUnit(10)    // 返回 1000
 */
export function toMinorUnit(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new Error(`无效的金额: ${amount}`)
  }
  return Math.round(amount * 100)
}

/**
 * 将副单位（最小单位）转换为主单位
 * @param amount 副单位的金额（如 599）
 * @returns 主单位的金额（如 5.99）
 *
 * @example
 * fromMinorUnit(599)   // 返回 5.99
 * fromMinorUnit(1000)  // 返回 10
 */
export function fromMinorUnit(amount: number | bigint): number {
  const num = typeof amount === 'bigint' ? Number(amount) : amount
  // 容忍浮点精度误差，先四舍五入再转换
  const rounded = Math.round(num)
  return rounded / 100
}

/**
 * 将副单位转换为主单位，保留指定小数位
 * @param amount 副单位的金额（可以是number或BigInt）
 * @param decimals 保留的小数位数（默认2）
 * @returns 格式化后的字符串（不包含货币符号）
 *
 * @example
 * formatAmount(599, 2)    // 返回 "5.99"
 * formatAmount(1000, 2)   // 返回 "10.00"
 */
export function formatAmount(amount: number | bigint | null | undefined, decimals: number = 2): string {
  if (amount === null || amount === undefined) {
    return (0).toFixed(decimals)
  }
  const num = typeof amount === 'bigint' ? Number(amount) : amount
  const baseUnit = fromMinorUnit(num)
  return baseUnit.toFixed(decimals)
}

/**
 * 格式化金额显示（带货币符号）
 * @param amount 副单位的金额（可以是number或BigInt）
 * @param currency 货币符号（默认为空，由调用者指定）
 * @returns 格式化后的字符串（如 $5.99 或 €5.99）
 *
 * @example
 * formatPrice(599, '$')   // 返回 "$5.99"
 * formatPrice(599)        // 返回 "5.99"
 */
export function formatPrice(amount: number | bigint | null | undefined, currency: string = ''): string {
  if (amount === null || amount === undefined) {
    const formatted = formatAmount(0)
    return currency ? `${currency}${formatted}` : formatted
  }
  const num = typeof amount === 'bigint' ? Number(amount) : amount
  const formatted = formatAmount(num)
  return currency ? `${currency}${formatted}` : formatted
}

/**
 * 使用系统默认货币符号格式化金额
 * @param amount 副单位的金额（可以是number或BigInt）
 * @returns 格式化后的字符串（如 $5.99）
 *
 * @example
 * formatPriceWithCurrency(599)  // 使用系统配置的货币符号
 */
export function formatPriceWithCurrency(amount: number | bigint | null | undefined): string {
  try {
    const { getCurrencySymbol } = require('../config/currencyConfig')
    const currency = getCurrencySymbol()
    return formatPrice(amount, currency)
  } catch {
    return formatPrice(amount)
  }
}

/**
 * 解析用户输入的金额并转换为副单位
 * @param input 用户输入的字符串或数字（如 "5.99" 或 5.99）
 * @returns 副单位的金额，或 null 如果无效
 *
 * @example
 * parseUserInput("5.99")  // 返回 599
 * parseUserInput(10)      // 返回 1000
 */
export function parseUserInput(input: string | number): number | null {
  const amount = typeof input === 'string' ? parseFloat(input) : input
  if (isNaN(amount) || amount < 0) {
    return null
  }
  return toMinorUnit(amount)
}

/**
 * 计算含税金额（副单位）
 * @param baseAmount 基础金额（副单位）
 * @param taxRate 税率（如 0.13 代表 13%）
 * @returns 含税金额（副单位）
 *
 * @example
 * calculateTaxedAmount(1000, 0.13)  // 返回 1130
 */
export function calculateTaxedAmount(baseAmount: number, taxRate: number): number {
  const num = typeof baseAmount === 'number' ? baseAmount : Number(baseAmount)
  const taxPortion = num * taxRate
  return num + Math.round(taxPortion)
}

/**
 * 计算税费部分（副单位）
 * @param baseAmount 基础金额（副单位）
 * @param taxRate 税率（如 0.13 代表 13%）
 * @returns 税费金额（副单位）
 *
 * @example
 * calculateTaxAmount(1000, 0.13)  // 返回 130
 */
export function calculateTaxAmount(baseAmount: number, taxRate: number): number {
  const num = typeof baseAmount === 'number' ? baseAmount : Number(baseAmount)
  const taxPortion = num * taxRate
  return Math.round(taxPortion)
}

/**
 * 计算折扣后的金额（副单位）
 * @param baseAmount 基础金额（副单位）
 * @param discountPercent 折扣百分比（如 0.1 代表 10% 折扣）
 * @returns 折扣后的金额（副单位）
 *
 * @example
 * applyDiscount(1000, 0.1)  // 返回 900
 */
export function applyDiscount(baseAmount: number, discountPercent: number): number {
  const num = typeof baseAmount === 'number' ? baseAmount : Number(baseAmount)
  const discountPortion = num * discountPercent
  return num - Math.round(discountPortion)
}

/**
 * 套餐折扣：算出折后价（主单位）
 * @param basePrice 套餐原价（主单位）
 * @param discount 折扣值：discountType='fixed' 时是要减掉的金额，'percentage' 时是百分比数值（如 10 代表 10%）
 * @param discountType 折扣类型
 *
 * @example
 * applyComboDiscount(15, 2, 'fixed')        // 返回 13（立减2元）
 * applyComboDiscount(15, 10, 'percentage')  // 返回 13.5（打9折）
 */
export function applyComboDiscount(basePrice: number, discount: number, discountType: 'fixed' | 'percentage'): number {
  const discountAmount = discountType === 'percentage' ? basePrice * (discount / 100) : discount
  return Math.max(0, basePrice - discountAmount)
}

/**
 * 套餐折扣：从折后价反推原价（主单位）
 *
 * 用途：后端存的 basePrice 是已经应用过折扣的最终售价（前端算好折后价再提交，
 * 后端只存储不重复计算），重新打开套餐编辑表单时，"原价"输入框需要从
 * 折后价 + 折扣设置反推出原价，否则会显示成折后价、再套一次折扣算出折上折。
 *
 * @example
 * reverseComboDiscount(13, 2, 'fixed')        // 返回 15
 * reverseComboDiscount(13.5, 10, 'percentage') // 返回 15
 */
export function reverseComboDiscount(finalPrice: number, discount: number, discountType: 'fixed' | 'percentage'): number {
  if (discountType === 'percentage') {
    if (discount >= 100) return finalPrice // 100%折扣时原价无法从0反推，退化返回折后价，避免除0
    return finalPrice / (1 - discount / 100)
  }
  return finalPrice + discount
}

/**
 * 验证金额的有效性（副单位）
 * @param amount 金额（副单位）
 * @returns 如果有效返回 true，否则 false
 *
 * @example
 * isValidAmount(599)   // 返回 true
 * isValidAmount(-100)  // 返回 false
 */
export function isValidAmount(amount: number | bigint): boolean {
  const num = typeof amount === 'bigint' ? Number(amount) : amount
  return (
    Number.isInteger(num) &&
    Number.isFinite(num) &&
    num >= 0
  )
}

/**
 * 比较两个金额（考虑整数精度）
 * @param amount1 第一个金额（副单位）
 * @param amount2 第二个金额（副单位）
 * @param tolerance 容差范围（副单位）。默认为 1，即允许误差不超过 1 个副单位
 * @returns true 如果两个金额在容差范围内相等
 *
 * @example
 * amountsEqual(599, 599)       // 返回 true
 * amountsEqual(599, 600, 2)    // 返回 true
 */
export function amountsEqual(amount1: number | bigint, amount2: number | bigint, tolerance: number = 1): boolean {
  const a1 = typeof amount1 === 'bigint' ? Number(amount1) : amount1
  const a2 = typeof amount2 === 'bigint' ? Number(amount2) : amount2
  return Math.abs(a1 - a2) <= tolerance
}

/**
 * 求和多个金额（副单位）
 * @param amounts 多个金额（都是副单位）
 * @returns 总和（副单位）
 *
 * @example
 * sumAmounts([100, 200, 300])  // 返回 600
 */
export function sumAmounts(amounts: (number | bigint)[]): number {
  return amounts.reduce((sum, amount) => {
    const num = typeof amount === 'bigint' ? Number(amount) : amount
    return sum + num
  }, 0)
}

/**
 * 计算平均金额（副单位）
 * @param amounts 多个金额（都是副单位）
 * @returns 平均金额（副单位，四舍五入）
 *
 * @example
 * averageAmount([100, 200, 300])  // 返回 200
 */
export function averageAmount(amounts: (number | bigint)[]): number {
  if (amounts.length === 0) return 0
  const sum = sumAmounts(amounts)
  return Math.round(sum / amounts.length)
}

/**
 * 批量转换主单位到副单位
 * @param amounts 主单位的金额数组
 * @returns 副单位的金额数组
 *
 * @example
 * convertToMinorUnits([5.99, 10, 2.5])  // 返回 [599, 1000, 250]
 */
export function convertToMinorUnits(amounts: number[]): number[] {
  return amounts.map(amount => toMinorUnit(amount))
}

/**
 * 批量转换副单位到主单位
 * @param amounts 副单位的金额数组
 * @returns 主单位的金额数组
 *
 * @example
 * convertFromMinorUnits([599, 1000, 250])  // 返回 [5.99, 10, 2.5]
 */
export function convertFromMinorUnits(amounts: (number | bigint)[]): number[] {
  return amounts.map(amount => fromMinorUnit(amount))
}

// ==================== 工具类 ====================

/**
 * 金额格式化工具类
 * 用于在前端渲染时格式化金额显示
 */
export class PriceFormatter {
  private currency: string
  private decimalPlaces: number

  /**
   * 创建金额格式化器
   * @param currency 货币符号（默认为空，由系统配置提供）
   * @param decimalPlaces 小数位数（默认2）
   */
  constructor(currency: string = '', decimalPlaces: number = 2) {
    this.currency = currency
    this.decimalPlaces = decimalPlaces
  }

  /**
   * 格式化副单位的金额为显示字符串
   */
  format(amount: number | bigint): string {
    return formatPrice(amount, this.currency)
  }

  /**
   * 仅返回数值部分（带小数点）
   */
  formatNumber(amount: number | bigint): string {
    return formatAmount(amount, this.decimalPlaces)
  }

  /**
   * 获取货币符号
   */
  getCurrency(): string {
    return this.currency
  }
}

/**
 * API请求/响应转换工具
 */
export class PriceAPIAdapter {
  /**
   * 将API响应中的金额字段转换为显示友好的格式
   */
  static toDisplay(data: any): any {
    if (!data) return data

    const convert = (value: any): any => {
      if (value === null || value === undefined) return value
      if (typeof value === 'bigint' || typeof value === 'number') {
        return {
          minor: typeof value === 'bigint' ? Number(value) : value,
          display: formatAmount(value)
        }
      }
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          return value.map(convert)
        }
        return Object.keys(value).reduce((acc, key) => {
          acc[key] = convert(value[key])
          return acc
        }, {} as any)
      }
      return value
    }

    return convert(data)
  }

  /**
   * 将用户输入的金额转换为API请求格式
   */
  static toRequest(amount: number | string): number {
    const parsed = parseUserInput(amount)
    if (parsed === null) {
      throw new Error(`无效的金额输入: ${amount}`)
    }
    return parsed
  }

  /**
   * 批量转换API响应中的金额对象数组
   */
  static convertAmountArray<T extends Record<string, any>>(
    items: T[],
    amountFields: (keyof T)[] = ['price', 'basePrice', 'cost', 'defaultPrice']
  ): T[] {
    return items.map(item => {
      const converted = { ...item }
      for (const field of amountFields) {
        if (field in converted && converted[field] !== null && converted[field] !== undefined) {
          const value = converted[field]
          const numValue = typeof value === 'bigint' ? Number(value) : value
          // 添加 *Display 字段
          converted[`${String(field)}Display`] = formatAmount(numValue) as any
          // 如果原值是bigint，转换为number
          if (typeof value === 'bigint') {
            converted[field] = numValue as any
          }
        }
      }
      return converted
    })
  }
}

// ==================== 默认导出 ====================

export default {
  // 基础转换
  toMinorUnit,
  fromMinorUnit,
  formatAmount,
  formatPrice,
  formatPriceWithCurrency,
  parseUserInput,

  // 计算函数
  calculateTaxedAmount,
  calculateTaxAmount,
  applyDiscount,
  applyComboDiscount,
  reverseComboDiscount,

  // 验证和比较
  isValidAmount,
  amountsEqual,

  // 批量操作
  sumAmounts,
  averageAmount,
  convertToMinorUnits,
  convertFromMinorUnits,

  // 工具类
  PriceFormatter,
  PriceAPIAdapter
}
