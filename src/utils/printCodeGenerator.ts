import type { StepType, StepEditorItem } from '@/services/recipe/types'

// 步骤包裹符号选项（用于区分大步骤与其他步骤）
// value 格式：前缀+后缀，如 '[]' → 前缀'[' 后缀']'
export const WRAP_SYMBOLS = [
  { value: '', label: '无' },
  // 半角括号
  { value: '[]', label: '[ ]' },
  { value: '()', label: '( )' },
  { value: '{}', label: '{ }' },
  { value: '<>', label: '< >' },
  // 全角括号
  { value: '【】', label: '【 】' },
  { value: '（）', label: '（ ）' },
  { value: '｛｝', label: '｛ ｝' },
  { value: '〔〕', label: '〔 〕' },
  { value: '〈〉', label: '〈 〉' },
  { value: '《》', label: '《 》' },
  { value: '「」', label: '「 」' },
  { value: '『』', label: '『 』' },
  { value: '〖〗', label: '〖 〗' },
  { value: '⟨⟩', label: '⟨ ⟩' },
  // 对称符号（前后相同）
  { value: '//', label: '/ /' },
  { value: '||', label: '| |' },
  { value: '**', label: '* *' },
  { value: '--', label: '- -' },
  { value: '~~', label: '~ ~' },
  { value: '""', label: '" "' },
  { value: "''", label: "' '" },
]

/**
 * 生成单个步骤的打印代码
 * - 步骤内多个类型之间固定用逗号分隔
 * - wrapSymbol 包裹整个步骤，步骤说明追加到末尾
 * 示例：
 *   [{mk,200}], wrap='', instruction='' → mk200
 *   [{mk,200},{bt,350}], wrap='[]', instruction='2' → [mk200,bt350]2
 *   [{mk,200},{bt,350}], wrap='()', instruction='' → (mk200,bt350)
 */
export function generateStepCode(
  step: StepEditorItem,
  stepTypeMap: Map<string, StepType>
): string {
  // 类型间固定逗号分隔
  const subCodes = step.subSteps
    .map(s => {
      const type = stepTypeMap.get(s.stepTypeId)
      if (!type) return ''
      return `${type.code}${s.instruction || ''}`
    })
    .filter(Boolean)
    .join(',')

  if (!subCodes) return ''

  const sym = step.wrapSymbol || ''
  if (sym.length >= 2) {
    // 多字符符号（全角括号）：前半为前缀，后半为后缀
    const mid = Math.floor(sym.length / 2)
    const prefix = sym.slice(0, mid)
    const suffix = sym.slice(mid)
    return `${prefix}${subCodes}${suffix}${step.stepInstruction || ''}`
  }

  return `${subCodes}${step.stepInstruction || ''}`
}

/**
 * 生成整个配方的打印代码（各步骤用空格连接）
 */
export function generateRecipePrintCode(
  steps: StepEditorItem[],
  stepTypeMap: Map<string, StepType>
): string {
  return steps
    .map(s => generateStepCode(s, stepTypeMap))
    .filter(Boolean)
    .join(' ')
}

/**
 * 验证打印代码格式
 */
export function validatePrintCode(code: string): boolean {
  return !!(code && code.trim().length > 0)
}
