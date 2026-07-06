// 制作指引相关类型定义

// ==================== 配方核心类型 ====================

// 配方自定义选项条件
export interface RecipeCondition {
  modifierGroupId: string
  modifierOptionId: string
}

// 步骤内的单个步骤类型项
export interface RecipeSubStep {
  stepTypeId: string
  instruction?: string  // 该类型的用量/说明，如 200、350
}

// 配方步骤（从后端读取）
export interface RecipeStep {
  id?: string
  stepTypeId: string              // 主步骤类型（第一个 subStep）
  displayOrder: number
  instruction?: string            // 整步说明（包裹后的值）
  subSteps?: RecipeSubStep[]      // 步骤内的多个类型（从 metadata 重建）
  wrapSymbol?: string             // 包裹符号，如 '[]'、'()'
  stepType?: StepType
  metadata?: any
  createdAt?: string
  updatedAt?: string
}

// 编辑器内的步骤格式（前端使用）
export interface StepEditorItem {
  subSteps: RecipeSubStep[]       // 至少一个
  wrapSymbol: string              // 包裹整个步骤的符号，'' = 不包裹
  stepInstruction: string         // 步骤说明，追加到末尾
}

// 配方
export interface Recipe {
  id: string
  itemId: string
  name: string
  printCode: string
  recipePrintCode?: string
  displayCodeString?: string
  description?: string
  isActive?: boolean
  priority?: number
  modifierConditions?: RecipeCondition[]
  steps?: RecipeStep[]
  createdAt?: string
  updatedAt?: string
}

// 创建配方请求
export interface CreateRecipeRequest {
  itemId: string
  printCode: string
  displayCodeString?: string
  description?: string
  conditions?: RecipeCondition[]
  steps?: Array<{
    subSteps: RecipeSubStep[]
    wrapSymbol?: string
    stepInstruction?: string
    displayOrder: number
  }>
}

// 更新配方请求
export interface UpdateRecipeRequest {
  printCode?: string
  displayCodeString?: string
  description?: string
  isActive?: boolean
  priority?: number
}

// 更新配方步骤请求
export interface UpdateRecipeStepsRequest {
  steps: Array<{
    subSteps: RecipeSubStep[]
    wrapSymbol?: string
    stepInstruction?: string
    displayOrder: number
  }>
}

// ==================== 其他 API 类型 ====================

export interface GenerateCombinationsRequest {
  modifierGroupIds: string[]
}

export interface CombinationOption {
  modifierGroupId: string
  modifierOptionId: string
  displayName: string
}

export interface ModifierCombination {
  id: string
  options: CombinationOption[]
  hasRecipe: boolean
}

export interface GenerateCombinationsResponse {
  combinations: ModifierCombination[]
}

export interface CopyRecipeTarget {
  conditions: RecipeCondition[]
  printCode: string
  displayCodeString?: string
}

export interface CopyRecipeRequest {
  targetCombinations: CopyRecipeTarget[]
}

export interface CopyRecipeResponse {
  sourceRecipeId: string
  createdCount: number
  failedCount: number
  recipes: Recipe[]
}

export interface MatchRecipeRequest {
  itemId: string
  selectedOptions: string[]
}

export interface MatchRecipeResponse {
  matched: boolean
  recipe?: {
    id: string
    name: string
    printCode: string
    displayCodeString?: string
    description?: string
    steps: RecipeStep[]
  }
  printCode?: string
  message?: string
  selectedOptions?: string[]
}

// ==================== 步骤类型管理 ====================

export interface StepType {
  id: string
  code: string
  name: string
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface CreateStepTypeRequest {
  name: string
  code: string
}

// ==================== API 响应包装 ====================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}
