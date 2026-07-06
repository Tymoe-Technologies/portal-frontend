import { httpService } from '../http'
import type {
  Recipe,
  CreateRecipeRequest,
  UpdateRecipeRequest,
  UpdateRecipeStepsRequest,
  GenerateCombinationsRequest,
  GenerateCombinationsResponse,
  CopyRecipeRequest,
  CopyRecipeResponse,
  MatchRecipeRequest,
  MatchRecipeResponse,
  StepType,
  CreateStepTypeRequest,
  ApiResponse
} from './types'

// 从环境变量中获取 API 基础 URL，用于直接 CORS 请求
// 支持本地开发环境，默认为本地 localhost:3000
const API_BASE = (import.meta.env.VITE_ITEM_MANAGE_BASE as string | undefined) ?? 'http://localhost:3000/api/item-manage/v1'

// API Base URLs (v2.2)
const RECIPE_API_BASE = `${API_BASE}/recipes`
const STEP_TYPE_API_BASE = `${API_BASE}/step-types`

// ==================== 配方管理 (v2.2) ====================

/**
 * 生成自定义选项组合列表 (v2.2 新增)
 */
export const generateCombinations = async (itemId: string, data: GenerateCombinationsRequest): Promise<GenerateCombinationsResponse> => {
  const response = await httpService.post<ApiResponse<GenerateCombinationsResponse>>(
    `${API_BASE}/items/${itemId}/recipes/generate-combinations`,
    data
  )
  
  // 打印详细的响应数据用于调试
  console.log('generateCombinations 响应:', response.data)
  
  // 处理包装格式的响应 (success/data wrapper)
  if (response.data && typeof response.data === 'object' && 'success' in response.data) {
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || '生成组合列表失败')
    }
    return response.data.data
  }
  
  // 处理直接返回数据的响应格式
  if (response.data && typeof response.data === 'object' && 'combinations' in response.data) {
    return response.data as GenerateCombinationsResponse
  }
  
  // 如果响应格式不符合预期
  console.error('意外的响应格式:', response.data)
  throw new Error('生成组合列表失败：响应格式不正确')
}

/**
 * 创建配方 (v2.2)
 */
export const createRecipe = async (data: CreateRecipeRequest): Promise<Recipe> => {
  console.log('📤 创建配方请求:', data)
  
  try {
    const response = await httpService.post<ApiResponse<Recipe>>(RECIPE_API_BASE, data)
    console.log('📥 创建配方响应:', response)
    
    // 处理包装格式的响应 (success/data wrapper)
    if (response.data && typeof response.data === 'object') {
      // 如果有 success 字段
      if ('success' in response.data) {
        if (!response.data.success) {
          console.error('❌ 创建配方失败 (success=false):', response.data.error)
          throw new Error(response.data.error?.message || '创建配方失败')
        }
        if (response.data.data) {
          console.log('✅ 创建配方成功 (包装格式):', response.data.data)
          return response.data.data
        }
      }
      
      // 直接返回 Recipe 对象（无包装）
      if ('id' in response.data) {
        console.log('✅ 创建配方成功 (直接格式):', response.data)
        return response.data as Recipe
      }
    }
    
    console.error('❌ 创建配方响应格式不正确:', response.data)
    throw new Error('创建配方失败：响应格式不正确')
  } catch (error: any) {
    console.error('❌ 创建配方异常:', error)
    throw error
  }
}

/**
 * 获取商品的所有配方 (v2.2)
 */
export const getRecipes = async (itemId: string): Promise<{ itemId: string; recipes: Recipe[]; totalRecipes: number }> => {
  const response = await httpService.get<ApiResponse<{ itemId: string; recipes: Recipe[]; totalRecipes: number }>>(
    `${API_BASE}/items/${itemId}/recipes`
  )
  
  // 打印详细的响应数据用于调试
  console.log('getRecipes 响应:', response.data)
  
  // 处理包装格式的响应 (success/data wrapper)
  if (response.data && typeof response.data === 'object' && 'success' in response.data) {
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || '获取配方列表失败')
    }
    return response.data.data
  }
  
  // 处理直接返回数据的响应格式
  if (response.data && typeof response.data === 'object' && 'itemId' in response.data) {
    return response.data as { itemId: string; recipes: Recipe[]; totalRecipes: number }
  }
  
  // 如果响应格式不符合预期
  console.error('意外的响应格式:', response.data)
  throw new Error('获取配方列表失败：响应格式不正确')
}

/**
 * 获取配方详情 (v2.2)
 */
export const getRecipeById = async (id: string): Promise<Recipe> => {
  console.log('📡 获取配方详情 - ID:', id)
  
  try {
    const response = await httpService.get<ApiResponse<Recipe>>(`${RECIPE_API_BASE}/${id}`)
    console.log('📥 配方详情响应:', response)
    
    // 处理包装格式的响应
    if (response.data && typeof response.data === 'object') {
      // 如果有 success 字段
      if ('success' in response.data) {
        if (!response.data.success) {
          console.error('❌ 获取配方详情失败 (success=false):', response.data.error)
          throw new Error(response.data.error?.message || '获取配方详情失败')
        }
        if (response.data.data) {
          console.log('✅ 获取配方详情成功 (包装格式):', response.data.data)
          return response.data.data
        }
      }
      
      // 直接返回 Recipe 对象（无包装）
      if ('id' in response.data) {
        console.log('✅ 获取配方详情成功 (直接格式):', response.data)
        return response.data as Recipe
      }
    }
    
    console.error('❌ 配方详情响应格式不正确:', response.data)
    throw new Error('获取配方详情失败：响应格式不正确')
  } catch (error: any) {
    console.error('❌ 获取配方详情异常:', error)
    throw error
  }
}

/**
 * 更新配方 (v2.2)
 */
export const updateRecipe = async (id: string, data: UpdateRecipeRequest): Promise<Recipe> => {
  console.log('📡 更新配方 - ID:', id, '数据:', data)
  
  try {
    const response = await httpService.put<ApiResponse<Recipe>>(`${RECIPE_API_BASE}/${id}`, data)
    console.log('📥 更新配方响应:', response)
    
    // 处理包装格式的响应
    if (response.data && typeof response.data === 'object') {
      // 如果有 success 字段
      if ('success' in response.data) {
        if (!response.data.success) {
          console.error('❌ 更新配方失败 (success=false):', response.data.error)
          throw new Error(response.data.error?.message || '更新配方失败')
        }
        if (response.data.data) {
          console.log('✅ 更新配方成功 (包装格式):', response.data.data)
          return response.data.data
        }
      }
      
      // 直接返回 Recipe 对象（无包装）
      if ('id' in response.data) {
        console.log('✅ 更新配方成功 (直接格式):', response.data)
        return response.data as Recipe
      }
    }
    
    console.error('❌ 更新配方响应格式不正确:', response.data)
    throw new Error('更新配方失败：响应格式不正确')
  } catch (error: any) {
    console.error('❌ 更新配方异常:', error)
    throw error
  }
}

/**
 * 更新配方步骤 (v2.2)
 */
export const updateRecipeSteps = async (recipeId: string, data: UpdateRecipeStepsRequest): Promise<void> => {
  console.log('📡 更新配方步骤 - Recipe ID:', recipeId, '步骤数据:', data)
  
  try {
    const response = await httpService.put<ApiResponse<void>>(`${RECIPE_API_BASE}/${recipeId}/steps`, data)
    console.log('📥 更新步骤响应:', response)
    
    // 处理包装格式的响应
    if (response.data && typeof response.data === 'object') {
      // 如果有 success 字段
      if ('success' in response.data) {
        if (!response.data.success) {
          console.error('❌ 更新步骤失败 (success=false):', response.data.error)
          throw new Error(response.data.error?.message || '更新配方步骤失败')
        }
        console.log('✅ 更新步骤成功')
        return
      }
      
      // 如果响应状态是 200 且没有 success 字段，视为成功
      if (response.status === 200) {
        console.log('✅ 更新步骤成功 (无包装格式)')
        return
      }
    }
    
    console.error('❌ 更新步骤响应格式不正确:', response.data)
    throw new Error('更新配方步骤失败：响应格式不正确')
  } catch (error: any) {
    console.error('❌ 更新步骤异常:', error)
    throw error
  }
}

/**
 * 复制配方到其他组合 (v2.2 新增)
 */
export const copyRecipe = async (recipeId: string, data: CopyRecipeRequest): Promise<CopyRecipeResponse> => {
  const response = await httpService.post<ApiResponse<CopyRecipeResponse>>(`${RECIPE_API_BASE}/${recipeId}/copy`, data)
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || '复制配方失败')
  }
  return response.data.data
}

/**
 * 删除配方 (v2.2)
 */
export const deleteRecipe = async (id: string): Promise<void> => {
  const response = await httpService.delete<ApiResponse<void>>(`${RECIPE_API_BASE}/${id}`)
  if (!response.data.success) {
    throw new Error(response.data.error?.message || '删除配方失败')
  }
}

/**
 * 匹配配方 (v2.2 新增)
 */
export const matchRecipe = async (data: MatchRecipeRequest): Promise<MatchRecipeResponse> => {
  const response = await httpService.post<ApiResponse<MatchRecipeResponse>>(`${RECIPE_API_BASE}/match`, data)
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || '匹配配方失败')
  }
  return response.data.data
}


// ==================== 步骤类型管理 (v2.2) ====================

/**
 * 获取步骤类型列表 (v2.2)
 */
export const getStepTypes = async (): Promise<StepType[]> => {
  const response = await httpService.get<ApiResponse<StepType[]>>(STEP_TYPE_API_BASE)
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || '获取步骤类型列表失败')
  }
  return response.data.data
}

/**
 * 获取步骤类型详情 (v2.2)
 */
export const getStepTypeById = async (id: string): Promise<StepType> => {
  const response = await httpService.get<ApiResponse<StepType>>(`${STEP_TYPE_API_BASE}/${id}`)
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || '获取步骤类型详情失败')
  }
  return response.data.data
}

/**
 * 创建步骤类型 (v2.2)
 */
export const createStepType = async (data: CreateStepTypeRequest): Promise<StepType> => {
  const response = await httpService.post<ApiResponse<StepType>>(STEP_TYPE_API_BASE, data)
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || '创建步骤类型失败')
  }
  return response.data.data
}

/**
 * 更新步骤类型 (v2.2)
 */
export const updateStepType = async (id: string, data: Partial<CreateStepTypeRequest>): Promise<StepType> => {
  const response = await httpService.put<ApiResponse<StepType>>(`${STEP_TYPE_API_BASE}/${id}`, data)
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || '更新步骤类型失败')
  }
  return response.data.data
}

/**
 * 删除步骤类型 (v2.2)
 */
export const deleteStepType = async (id: string): Promise<void> => {
  const response = await httpService.delete<ApiResponse<void>>(`${STEP_TYPE_API_BASE}/${id}`)
  if (!response.data.success) {
    throw new Error(response.data.error?.message || '删除步骤类型失败')
  }
}



