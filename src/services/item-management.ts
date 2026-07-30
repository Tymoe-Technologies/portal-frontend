import { httpService } from './http'
import { toMinorUnit, fromMinorUnit } from '@/utils/priceConverter'

// ==================== 类型定义 ====================

export interface Item {
  id: string
  tenantId: string
  categoryId?: string
  name: string
  name_i18n?: Record<string, string>
  description?: string
  description_i18n?: Record<string, string>
  customFields?: any // jsonb
  basePrice: number
  cost?: number
  aiTags?: any // jsonb
  imageUrl?: string // Cloudinary 图片 URL
  isActive: boolean
  scope?: 'BRAND' | 'STORE_EXCLUSIVE'
  visible_stores?: { store_id: string }[]
  createdAt?: string
  updatedAt?: string
}

export interface Category {
  id: string
  tenantId: string
  name: string
  nameI18n?: Record<string, string>
  parentId?: string
  storeId?: string | null  // null=品牌级，有值=门店私有
  isSystem?: boolean       // 系统预设分类，不可删除/停用
  createdAt?: string
  // 后端返回的关联数据
  _count?: { items: number }
  children?: Category[]  // 子分类
  parent?: Category      // 父分类
}

export interface ItemAttributeType {
  id: string
  name: string
  displayName: string
  inputType: 'select' // 所有属性类型都是选择类型
  options: ItemAttributeOption[] // 必须有选项
}

export interface ItemAttributeOption {
  id: string
  value: string
  displayName: string
  priceModifier: number
}

// Add-on 相关接口 (已废弃，请使用 Modifier)
export interface Addon {
  id: string
  name: string
  description: string
  price: number
  cost: number
  trackInventory: boolean
  currentStock: number
  isActive: boolean
}

export interface ItemAddon {
  id: string
  itemId: string
  addonId: string
  maxQuantity: number
  addon?: Addon // 可选的关联Addon对象
}

// ==================== Modifier v2.0 架构 ====================
// 统一的自定义选项系统，替代旧的 Attribute 和 Addon

/**
 * 自定义选项组类型
 * - 'property': 属性类型（如杯型、冰度、糖度）- 商品本身的可选配置
 * - 'addon': 加料类型（如珍珠、椰果、布丁）- 可选的额外配料
 * - 'custom': 自定义类型 - 其他自定义分类
 */
/**
 * 自定义选项组
 * 选择规则（最小/最大选择数、是否必选）在商品关联时定义，见 ItemModifierGroup
 */
export interface ModifierGroup {
  id: string
  tenantId: string
  name: string
  displayName: string
  displayNameI18n?: Record<string, string>
  description?: string
  displayOrder: number
  isActive: boolean
  storeId?: string | null  // null=品牌级，有值=门店私有
  createdAt?: string
  updatedAt?: string
  options?: ModifierOption[]
}

/**
 * 自定义选项选项
 */
export interface ModifierOption {
  id: string
  modifierGroupId: string
  name: string
  displayName: string
  displayNameI18n?: Record<string, string>
  code?: string              // 最终打印代码（base+用量组合，无空格），供标签/配方使用
  printBaseCode?: string     // 打印代码的基础部分（编辑用，如 "LICE"）
  defaultQuantity?: number   // 打印配置：默认用量（整数）
  printInstruction?: string  // 打印配置：用量说明（如 "50%", "30g"），编辑用
  defaultPrice: number | string
  cost?: number | null
  displayOrder?: number
  isActive: boolean
  isDefault?: boolean
  trackInventory?: boolean
  currentStock?: number
  createdAt?: string
  updatedAt?: string
  group?: ModifierGroup
  // 商品关联的选项配置（仅在获取商品自定义选项时返回）
  itemOptions?: Array<{
    isDefault: boolean
    isEnabled: boolean
    displayOrder: number
  }>
  // 商品级价格覆盖（仅在获取商品自定义选项时返回）
  itemPrice?: number | null  // null表示未设置商品级价格
  finalPrice?: number        // 最终价格（已处理优先级）
}

/**
 * 商品自定义选项组关联
 */
export interface ItemModifierGroup {
  id: string
  itemId: string
  modifierGroupId: string
  isRequired: boolean
  minSelections: number
  maxSelections: number
  sortOrder: number
  createdAt?: string
  group?: ModifierGroup
}

/**
 * 商品自定义选项价格
 */
export interface ItemModifierPrice {
  id: string
  itemId: string
  modifierOptionId: string
  price: number
  createdAt?: string
  updatedAt?: string
  option?: ModifierOption
}

/**
 * 创建自定义选项组请求
 */
export interface CreateModifierGroupPayload {
  name?: string  // 可选，如果不提供则后端自动生成
  displayName: string
  description?: string
  isActive?: boolean
  isLocal?: boolean  // true=创建门店私有选项组
}

/**
 * 更新自定义选项组请求
 */
export interface UpdateModifierGroupPayload extends Partial<CreateModifierGroupPayload> {}

/**
 * 创建自定义选项选项请求
 */
export interface CreateModifierOptionPayload {
  name?: string  // 可选，如果不提供则后端自动生成
  displayName: string
  displayNameI18n?: Record<string, string>
  display_name_i18n?: Record<string, string>
  code?: string  // 选项代码，用于打印
  defaultPrice?: number
  cost?: number
  displayOrder?: number
}

/**
 * 更新自定义选项选项请求
 */
export interface UpdateModifierOptionPayload extends Partial<CreateModifierOptionPayload> {}

/**
 * 商品关联自定义选项组请求
 */
export interface AddModifierGroupToItemPayload {
  modifierGroupId: string
  isRequired?: boolean
  minSelections?: number
  maxSelections?: number
  sortOrder?: number
}

/**
 * 设置商品自定义选项价格请求
 */
export interface SetItemModifierPricesPayload {
  prices: Array<{
    modifierOptionId: string
    price: number
  }>
}

/**
 * 配置商品自定义选项选项请求（设置选项在特定商品中的行为）
 */
export interface ConfigureItemModifierOptionsPayload {
  options: Array<{
    modifierOptionId: string
    isDefault?: boolean
    isEnabled?: boolean
    displayOrder?: number
  }>
}

export interface CreateAddonPayload {
  name: string
  description: string
  price: number
  cost: number
  trackInventory: boolean
  currentStock?: number
  isActive: boolean
}

export interface UpdateAddonPayload extends Partial<CreateAddonPayload> {}

export interface CreateItemAddonPayload {
  addonId: string
  maxQuantity: number
}

export interface ItemAttribute {
  id: string
  itemId: string
  attributeTypeId: string
  isRequired: boolean
  optionOverrides?: Record<string, { priceModifier: number }>
  allowedOptions?: string[] // 允许的选项ID列表，用于选项过滤
  defaultOptionId?: string // 商品级默认选项
  optionOrder?: string[] // 选项显示顺序
  attributeType?: ItemAttributeType // API返回时包含完整的属性类型信息
}

// ==================== 税务相关接口 ====================

/**
 * 税率接口
 */
export interface TaxRate {
  id: string
  name: string
  taxType: string
  rate: number
  foodExempt: boolean
  effectiveDate?: string
  expiresDate?: string
  isOverridden: boolean
  overrideReason?: string
  source: 'SYSTEM_DEFAULT' | 'TENANT_OVERRIDE'
  notes?: string
}

/**
 * 税类接口（简化版 - 仅租户自定义）
 */
export interface TaxClass {
  id: string
  name: string
  description?: string
  isCustom?: boolean
  rates: Array<{
    id: string
    taxType: string
    rate: number
    displayOrder: number
  }>
}

/**
 * 简化版税种接口（后端返回的格式）
 */
export interface SimpleTaxRate {
  id: string
  name: string
  rate: number
  regionCode?: string
  createdAt?: string
}

/**
 * 商品税类信息
 */
export interface ItemTaxClass {
  itemId: string
  itemName?: string
  taxClassId?: string
  taxClassName?: string
  taxClassType?: 'DEFAULT' | 'TENANT_CUSTOM'
  source?: 'TENANT_CUSTOM'
  effectiveTaxRates?: Array<{
    taxType: string
    rate: number
    name: string
  }>
  // 支持多个税率
  taxes?: Array<{
    id: string
    name: string
    taxType: string
    rate: number
    displayOrder?: number
    isCompound?: boolean
  }>
}

/**
 * 税费计算结果
 */
export interface TaxCalculationResult {
  itemId: string
  itemName: string
  basePrice: number
  basePriceDisplay: string
  taxes: Array<{
    taxType: string
    taxName: string
    rate: number
    amount: number
    amountDisplay: string
  }>
  totalTax: number
  totalTaxDisplay: string
  finalPrice: number
  finalPriceDisplay: string
  region: string
}

/**
 * 分配单个税类请求
 */
export interface AssignTaxClassPayload {
  taxClassId: string
}

/**
 * 分配多个税类请求（支持商品关联多个税率）
 */
export interface AssignMultipleTaxClassPayload {
  taxClassIds: string[]
}

/**
 * 税率覆盖请求
 */
export interface TaxRateOverridePayload {
  regionCode: string
  taxType: string
  rate: number
  basedOnDefaultId?: string
  overrideReason?: string
}

/**
 * 创建租户自定义税类请求
 */
export interface CreateTenantTaxClassPayload {
  name: string
  description?: string
  regionCode: string
  rates: Array<{
    taxType: string
    rate: number
    applyOrder: number
    compoundPrevious: boolean
  }>
}

const MOCK_TAX_RATES: Record<string, TaxRate[]> = {
  'CA-ON': [
    {
      id: 'mock-hst-ca-on',
      name: 'HST',
      taxType: 'HST',
      rate: 0.13,
      foodExempt: false,
      effectiveDate: '2024-01-01',
      isOverridden: false,
      source: 'SYSTEM_DEFAULT'
    },
    {
      id: 'mock-food-ca-on',
      name: 'Food Essentials Exempt',
      taxType: 'FOOD_EXEMPT',
      rate: 0,
      foodExempt: true,
      effectiveDate: '2024-01-01',
      isOverridden: false,
      source: 'SYSTEM_DEFAULT'
    }
  ],
  'CA-BC': [
    {
      id: 'mock-gst-ca-bc',
      name: 'GST',
      taxType: 'GST',
      rate: 0.05,
      foodExempt: false,
      effectiveDate: '2024-01-01',
      isOverridden: false,
      source: 'SYSTEM_DEFAULT'
    },
    {
      id: 'mock-pst-ca-bc',
      name: 'PST',
      taxType: 'PST',
      rate: 0.07,
      foodExempt: false,
      effectiveDate: '2024-01-01',
      isOverridden: false,
      source: 'SYSTEM_DEFAULT'
    }
  ],
  'US-CA': [
    {
      id: 'mock-ca-sales',
      name: 'California State Tax',
      taxType: 'STATE',
      rate: 0.0725,
      foodExempt: false,
      effectiveDate: '2024-01-01',
      isOverridden: false,
      source: 'SYSTEM_DEFAULT'
    },
    {
      id: 'mock-ca-city',
      name: 'City Tax',
      taxType: 'CITY',
      rate: 0.0125,
      foodExempt: false,
      effectiveDate: '2024-01-01',
      isOverridden: false,
      source: 'SYSTEM_DEFAULT'
    }
  ]
}


// ==================== Combo 增强功能接口 ====================

/**
 * 套餐商品分组
 */
export interface ComboItemGroup {
  id: string
  name: string
  selectionType: 'single' | 'multiple'
  minSelections: number
  maxSelections: number
  sortOrder: number
}

/**
 * 套餐时段限制规则
 */
export interface ComboAvailabilityRules {
  enabled: boolean
  timeRange?: {
    start: string  // "HH:mm" 格式
    end: string
  }
  daysOfWeek?: number[]  // 0-6, 0=周日
}

// ==================== Combo 组合商品相关接口 ====================
export interface Combo {
  id: string
  tenantId: string
  categoryId?: string
  name: string
  description?: string
  basePrice: number
  discount: number
  discountType: 'fixed' | 'percentage'
  isActive: boolean
  createdAt?: string
  updatedAt?: string
  // 新增字段
  imageUrl?: string
  itemGroups?: ComboItemGroup[]
  availabilityRules?: ComboAvailabilityRules
  // 作用域：BRAND=全品牌门店可见，STORE_EXCLUSIVE=仅 visibleStoreIds 登记的门店可见
  scope?: 'BRAND' | 'STORE_EXCLUSIVE'
  visibleStoreIds?: string[]
  // 关联
  category?: Category
  comboItems?: ComboItem[]
}

export interface ComboItem {
  id: string
  comboId: string
  itemId: string
  quantity: number
  isRequired: boolean
  sortOrder: number
  createdAt?: string
  // 新增字段
  groupId?: string  // 所属分组ID
  additionalPrice?: number  // 额外费用（单位：分）
  attributeSelections?: Record<string, string> // { attributeTypeId: optionId }
  addonSelections?: Array<{ addonId: string; quantity: number }>
  item?: Item & { attributes?: ItemAttribute[]; itemAddons?: ItemAddon[] }
}

export interface CreateComboPayload {
  name: string
  description?: string
  categoryId?: string
  basePrice: number
  discount?: number
  discountType?: 'fixed' | 'percentage'
  isActive?: boolean
  // 新增字段
  imageUrl?: string
  itemGroups?: ComboItemGroup[]
  availabilityRules?: ComboAvailabilityRules
  comboItems?: CreateComboItemPayload[]
  scope?: 'BRAND' | 'STORE_EXCLUSIVE'
  visibleStoreIds?: string[]
}

export interface UpdateComboPayload extends Partial<CreateComboPayload> {}

export interface CreateComboItemPayload {
  itemId: string
  quantity?: number
  isRequired?: boolean
  sortOrder?: number
  // 新增字段
  groupId?: string
  additionalPrice?: number  // 额外费用（单位：分）
  attributeSelections?: Record<string, string>
  addonSelections?: Array<{ addonId: string; quantity: number }>
}

export interface UpdateComboItemPayload extends Partial<CreateComboItemPayload> {}

export interface ComboListParams extends PaginationParams {
  categoryId?: string
  isActive?: boolean
  search?: string
}

// 移除重复的Addon定义，使用上面的API文档版本
// ==================== 请求/响应类型 ====================

export interface CreateItemPayload {
  name: string
  description?: string
  categoryId: string
  basePrice: number
  cost?: number
  isActive?: boolean
  customFields?: any
  name_i18n?: Record<string, string>
  description_i18n?: Record<string, string>
  // 注：属性现在通过 ModifierGroup 系统管理
  // 在创建商品后，通过 POST /items/{itemId}/modifier-groups 来关联
}

export interface UpdateItemPayload extends Partial<CreateItemPayload> {
  // 更新时也不支持直接更新 attributes，使用专门的自定义选项管理 API
}

export interface CreateCategoryPayload {
  name: string
  parentId?: string
  isLocal?: boolean  // true=创建门店私有分类，false/省略=品牌级（仅MAIN默认品牌级）
}

export interface UpdateCategoryPayload extends Partial<CreateCategoryPayload> {}

export interface CreateItemAttributeTypePayload {
  name: string
  displayName: string
  inputType: 'select' // 固定为select类型
}

export interface UpdateItemAttributeTypePayload extends Partial<CreateItemAttributeTypePayload> {}

export interface CreateItemAttributeOptionPayload {
  value: string
  displayName: string
  priceModifier?: number
}

export interface UpdateItemAttributeOptionPayload extends Partial<CreateItemAttributeOptionPayload> {}

// 商品属性关联相关接口
export interface CreateItemAttributePayload {
  attributeTypeId: string
  isRequired: boolean
  optionOverrides?: Record<string, { priceModifier: number }>
  allowedOptions?: string[] // 允许的选项ID列表
  defaultOptionId?: string // 商品级默认选项
  optionOrder?: string[] // 选项显示顺序
}

export interface UpdateItemAttributePayload extends Partial<CreateItemAttributePayload> {}

// 更新为API文档版本
export interface CreateAddonPayload {
  name: string
  description: string
  price: number
  cost: number
  trackInventory: boolean
  currentStock?: number
  isActive: boolean
}

export interface UpdateAddonPayload extends Partial<CreateAddonPayload> {}

export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

export interface ItemListParams extends PaginationParams {
  categoryId?: string
  isActive?: boolean
  includeInactive?: boolean // 管理端专用：true=返回全部（含未激活），否则按 isActive 过滤（默认只激活）
  search?: string
}

// API实际返回的格式
export interface ApiPaginatedResponse<T> {
  items: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// 前端内部使用的格式
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface BatchOperationPayload {
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
  items: Array<CreateItemPayload | (UpdateItemPayload & { id: string }) | { id: string }>
}

export interface BatchOperationResponse {
  success: number
  failed: number
  errors: Array<{
    index: number
    error: string
  }>
  results: Item[]
}

// ==================== API服务类 ====================

const API_BASE = (import.meta.env.VITE_ITEM_MANAGE_BASE as string | undefined) ?? 'http://localhost:3000/api/item-manage/v1'

// 调试：打印环境变量
console.log('🔍 [ITEM-MANAGEMENT] import.meta.env.VITE_ITEM_MANAGE_BASE:', import.meta.env.VITE_ITEM_MANAGE_BASE)
console.log('🔍 [ITEM-MANAGEMENT] API_BASE:', API_BASE)

class ItemManagementService {
  // ==================== 商品管理 ====================

  async getItems(params: ItemListParams = {}): Promise<PaginatedResponse<Item>> {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value))
      }
    })
    
    const queryString = searchParams.toString()
    const url = `/items${queryString ? '?' + queryString : ''}`
    
    const response = await httpService.get<ApiPaginatedResponse<Item>>(`${API_BASE}${url}`)
    
    // 转换API响应格式为前端期待的格式
    const apiData = response.data
    
    if (!apiData) {
      return { data: [], total: 0, page: 1, limit: 10, totalPages: 0 }
    }
    
    // 处理实际的API响应格式
    const rawItems = Array.isArray(apiData.items) ? apiData.items : []

    // 转换字段名从 snake_case 到 camelCase，并确保数字字段是number类型
    const items = rawItems.map((item: any) => ({
      id: item.id,
      tenantId: item.brand_id || item.tenant_id || item.tenantId,
      categoryId: item.category_id || item.categoryId,
      name: item.name,
      description: item.description,
      customFields: item.custom_fields || item.customFields,
      basePrice: typeof (item.base_price ?? item.basePrice) === 'string'
        ? parseFloat(item.base_price ?? item.basePrice)
        : (item.base_price ?? item.basePrice ?? 0),
      cost: (item.cost !== undefined && item.cost !== null)
        ? (typeof item.cost === 'string' ? parseFloat(item.cost) : item.cost)
        : undefined,
      aiTags: item.ai_tags || item.aiTags,
      imageUrl: item.image_url || item.imageUrl, // 图片 URL
      isActive: item.is_active ?? item.isActive ?? true,
      scope: item.scope,
      visible_stores: item.visible_stores,
      createdAt: item.created_at || item.createdAt,
      updatedAt: item.updated_at || item.updatedAt,
      // 多语言字段
      name_i18n: item.name_i18n ?? undefined,
      description_i18n: item.description_i18n ?? undefined,
      // 保留关联数据
      categories: item.categories,
      item_modifier_groups: item.item_modifier_groups,
      itemModifierGroups: item.item_modifier_groups || item.itemModifierGroups
    }))
    
    const pagination = apiData.pagination || { page: 1, limit: 10, total: 0, pages: 0 }
    
    const result: PaginatedResponse<Item> = {
      data: items,
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: pagination.pages
    }
    
    return result
  }

  async getItem(id: string): Promise<Item> {
    console.log('📦 [ITEM SERVICE DEBUG] Getting item:', id)
    
    const response = await httpService.get<Item>(`${API_BASE}/items/${id}`)
    
    console.log('📦 [ITEM SERVICE DEBUG] Item details:', JSON.stringify(response.data, null, 2))
    return response.data
  }

  async searchItems(query: string, params?: { includeInactive?: boolean; isActive?: boolean }): Promise<Item[]> {
    console.log('🔍 [ITEM SERVICE DEBUG] Searching items:', query)

    // /items/search/:query 已不存在，改为使用 search 查询参数
    const result = await this.getItems({ search: query, limit: 100, ...params })

    console.log('🔍 [ITEM SERVICE DEBUG] Search results:', result.data.length)
    return result.data
  }

  async createItem(payload: CreateItemPayload): Promise<Item> {
    console.log('🚀 [CREATE ITEM] ==========================================')
    console.log('📥 Original payload from UI:', JSON.stringify(payload, null, 2))

    // 验证payload不包含无效字段
    const { tenant_id, status, ...cleanPayload } = payload as any
    if (tenant_id || status) {
      console.warn('⚠️ [ITEM SERVICE] Removed invalid fields:', { tenant_id, status })
    }

    // 后端已修复字段转换，前端只需发送驼峰格式 + 价格转换（元 → 分）
    const backendPayload: any = {
      name: cleanPayload.name,
      basePrice: toMinorUnit(Number(cleanPayload.basePrice)),
      isActive: Boolean(cleanPayload.isActive)
    }
    
    if (cleanPayload.description !== undefined) backendPayload.description = cleanPayload.description
    if (cleanPayload.categoryId !== undefined) backendPayload.categoryId = cleanPayload.categoryId
    if (cleanPayload.cost !== undefined) backendPayload.cost = toMinorUnit(Number(cleanPayload.cost))
    if (cleanPayload.customFields !== undefined) backendPayload.customFields = cleanPayload.customFields
    if (cleanPayload.name_i18n !== undefined) backendPayload.name_i18n = cleanPayload.name_i18n
    if (cleanPayload.description_i18n !== undefined) backendPayload.description_i18n = cleanPayload.description_i18n

    console.log('✅ [ITEM SERVICE] Final payload (will be sent to server):', JSON.stringify(backendPayload, null, 2))
    console.log('🌐 [ITEM SERVICE] Target URL:', `${API_BASE}/items`)
    console.log('📊 [ITEM SERVICE] Field types:', {
      name: typeof backendPayload.name,
      description: typeof backendPayload.description,
      categoryId: typeof backendPayload.categoryId,
      basePrice: `${typeof backendPayload.basePrice} (转换后的分)`,
      cost: `${typeof backendPayload.cost} (转换后的分)`,
      isActive: typeof backendPayload.isActive,
      customFields: typeof backendPayload.customFields
    })

    const response = await httpService.post<Item>(`${API_BASE}/items`, backendPayload)

    console.log('✅ [CREATE ITEM] Server response:', JSON.stringify(response.data, null, 2))
    console.log('🏁 [CREATE ITEM] ==========================================')
    return response.data
  }

  async updateItem(id: string, payload: UpdateItemPayload): Promise<Item> {
    console.log('✏️ [ITEM SERVICE DEBUG] Updating item:', id, JSON.stringify(payload, null, 2))

    // 验证payload不包含无效字段
    const { tenant_id, status, ...cleanPayload } = payload as any
    if (tenant_id || status) {
      console.warn('⚠️ [ITEM SERVICE] Removed invalid fields from update:', { tenant_id, status })
    }

    // 后端已修复字段转换，前端只需发送驼峰格式 + 价格转换（元 → 分）
    const backendPayload: any = {}
    
    if (cleanPayload.name !== undefined) backendPayload.name = cleanPayload.name
    if (cleanPayload.description !== undefined) backendPayload.description = cleanPayload.description
    if (cleanPayload.categoryId !== undefined) backendPayload.categoryId = cleanPayload.categoryId
    if (cleanPayload.basePrice !== undefined) backendPayload.basePrice = toMinorUnit(Number(cleanPayload.basePrice))
    if (cleanPayload.cost !== undefined) backendPayload.cost = toMinorUnit(Number(cleanPayload.cost))
    if (cleanPayload.isActive !== undefined) backendPayload.isActive = Boolean(cleanPayload.isActive)
    if (cleanPayload.customFields !== undefined) backendPayload.customFields = cleanPayload.customFields
    if (cleanPayload.scope !== undefined) backendPayload.scope = cleanPayload.scope
    if (cleanPayload.visibleStoreIds !== undefined) backendPayload.visibleStoreIds = cleanPayload.visibleStoreIds
    if (cleanPayload.name_i18n !== undefined) backendPayload.name_i18n = cleanPayload.name_i18n
    if (cleanPayload.description_i18n !== undefined) backendPayload.description_i18n = cleanPayload.description_i18n

    console.log('✅ [ITEM SERVICE DEBUG] Converted to backend payload:', JSON.stringify(backendPayload, null, 2))

    const response = await httpService.put<Item>(`${API_BASE}/items/${id}`, backendPayload)

    console.log('✏️ [ITEM SERVICE DEBUG] Updated item response:', JSON.stringify(response.data, null, 2))
    return response.data
  }

  async deleteItem(id: string): Promise<void> {
    console.log('🗑️ [ITEM SERVICE DEBUG] Deleting item:', id)
    
    await httpService.delete(`${API_BASE}/items/${id}`)
    
    console.log('🗑️ [ITEM SERVICE DEBUG] Item deleted successfully')
  }

  async batchOperations(payload: BatchOperationPayload): Promise<BatchOperationResponse> {
    console.log('🔄 [ITEM SERVICE DEBUG] Batch operation:', JSON.stringify(payload, null, 2))
    
    const response = await httpService.post<BatchOperationResponse>(`${API_BASE}/items/batch`, payload)
    
    console.log('🔄 [ITEM SERVICE DEBUG] Batch operation result:', JSON.stringify(response.data, null, 2))
    return response.data
  }

  // ==================== 分类管理 ====================

  async getCategories(): Promise<Category[]> {
    console.log('📁 [ITEM SERVICE DEBUG] Getting categories...')

    const response = await httpService.get<any[]>(`${API_BASE}/categories`)

    console.log('📁 [ITEM SERVICE DEBUG] Raw categories response:', JSON.stringify(response.data, null, 2))

    // 添加防护检查，确保返回数组
    let rawCategories: any[] = []

    if (Array.isArray(response.data)) {
      rawCategories = response.data
    } else if (response.data && typeof response.data === 'object') {
      // 新后端返回 { categories: [...] }，兼容旧格式
      const data = response.data as any
      if (Array.isArray(data.categories)) {
        rawCategories = data.categories
      } else if (Array.isArray(data.items)) {
        rawCategories = data.items
      }
    }

    // 转换字段名从 snake_case 到 camelCase
    const categories: Category[] = rawCategories.map((cat: any) => ({
      id: cat.id,
      tenantId: cat.brand_id || cat.tenant_id || cat.tenantId,
      name: cat.name,
      parentId: cat.parent_id || cat.parentId,
      storeId: cat.store_id !== undefined ? cat.store_id : undefined,
      createdAt: cat.created_at || cat.createdAt,
      // 保留子分类和商品数量
      _count: cat._count,
      children: cat.children || cat.other_categories,
      parent: cat.parent || cat.categories
    }))

    console.log('📁 [ITEM SERVICE DEBUG] Processed categories:', categories.length)
    return categories
  }

  async getCategoryTree(): Promise<Category[]> {
    console.log('🌳 [ITEM SERVICE DEBUG] Getting category tree (via getCategories?includeChildren=true)...')

    // /categories/tree 已不存在，改为使用 includeChildren 参数
    const response = await httpService.get<any>(`${API_BASE}/categories?includeChildren=true`)

    const rawCategories = Array.isArray(response.data)
      ? response.data
      : (response.data?.categories || [])

    // 递归转换分类树的字段名
    const transformCategory = (cat: any): Category => ({
      id: cat.id,
      tenantId: cat.brand_id || cat.tenant_id || cat.tenantId,
      name: cat.name,
      parentId: cat.parent_id || cat.parentId,
      createdAt: cat.created_at || cat.createdAt,
      _count: cat._count,
      children: cat.children?.map(transformCategory),
      parent: cat.parent
    })

    return rawCategories.map(transformCategory)
  }

  async createCategory(payload: CreateCategoryPayload): Promise<Category> {
    console.log('🚀 [CREATE CATEGORY] ==========================================')
    console.log('📥 Original payload from UI:', JSON.stringify(payload, null, 2))
    console.log('🌐 [CATEGORY SERVICE] Target URL:', `${API_BASE}/categories`)
    console.log('📊 [CATEGORY SERVICE] Field types:', {
      name: typeof payload.name,
      parentId: typeof payload.parentId
    })
    
    const response = await httpService.post<Category>(`${API_BASE}/categories`, payload)
    
    console.log('✅ [CREATE CATEGORY] Server response:', JSON.stringify(response.data, null, 2))
    console.log('🏁 [CREATE CATEGORY] ==========================================')
    return response.data
  }

  async updateCategory(id: string, payload: UpdateCategoryPayload): Promise<Category> {
    console.log('✏️ [ITEM SERVICE DEBUG] Updating category:', id, JSON.stringify(payload, null, 2))
    
    const response = await httpService.put<Category>(`${API_BASE}/categories/${id}`, payload)
    
    console.log('✏️ [ITEM SERVICE DEBUG] Updated category:', JSON.stringify(response.data, null, 2))
    return response.data
  }

  async deleteCategory(id: string): Promise<void> {
    console.log('🗑️ [ITEM SERVICE DEBUG] Deleting category:', id)
    
    await httpService.delete(`${API_BASE}/categories/${id}`)
    
    console.log('🗑️ [ITEM SERVICE DEBUG] Category deleted successfully')
  }

  // ==================== 属性管理 ====================

  // ==================== Attribute 管理 (已迁移到 Modifier v2.0) ====================
  // Attribute 现在通过 ModifierGroup (groupType='property') 实现
  // 本方法为适配层，自动使用 Modifier API

  async getAttributeTypes(): Promise<ItemAttributeType[]> {
    console.log('🏷️ [ITEM SERVICE DEBUG] Getting attribute types (via Modifier API)...')

    try {
      const groups = await this.getModifierGroups({ isActive: true })

      // 将 ModifierGroup 适配为 ItemAttributeType
      const attributeTypes = groups.map(group => ({
        id: group.id,
        name: group.name,
        displayName: group.displayName,
        inputType: 'select' as const,
        options: group.options?.map(opt => ({
          id: opt.id,
          value: opt.name,
          displayName: opt.displayName,
          priceModifier: 0 // Modifier 中价格在 ItemModifierPrice 中定义
        })) || []
      }))

      console.log('🏷️ [ITEM SERVICE DEBUG] Attribute types (adapted):', JSON.stringify(attributeTypes, null, 2))
      return attributeTypes
    } catch (error) {
      console.error('Failed to get attribute types from Modifier API:', error)
      return []
    }
  }

  async createAttributeType(payload: CreateItemAttributeTypePayload): Promise<ItemAttributeType> {
    console.log('➕ [ITEM SERVICE DEBUG] Creating attribute type (via Modifier API):', JSON.stringify(payload, null, 2))

    try {
      // 将 ItemAttributeType 适配为 ModifierGroup
      const modifierPayload: CreateModifierGroupPayload = {
        name: payload.name,
        displayName: payload.displayName,
        isActive: true
      }

      const group = await this.createModifierGroup(modifierPayload)

      // 适配回 ItemAttributeType
      const result: ItemAttributeType = {
        id: group.id,
        name: group.name,
        displayName: group.displayName,
        inputType: 'select',
        options: []
      }

      console.log('➕ [ITEM SERVICE DEBUG] Created attribute type:', JSON.stringify(result, null, 2))
      return result
    } catch (error) {
      console.error('Failed to create attribute type:', error)
      throw error
    }
  }

  async updateAttributeType(id: string, payload: UpdateItemAttributeTypePayload): Promise<ItemAttributeType> {
    console.log('✏️ [ITEM SERVICE DEBUG] Updating attribute type (via Modifier API):', id, JSON.stringify(payload, null, 2))

    try {
      const groups = await this.getModifierGroups()
      const group = groups.find(g => g.id === id)

      if (!group) {
        throw new Error(`Attribute type not found: ${id}`)
      }

      // 由于 Modifier API 还没有 updateModifierGroup，这里暂时无法实现
      console.warn('⚠️ [ITEM SERVICE] updateModifierGroup not yet implemented in Modifier API')

      const result: ItemAttributeType = {
        id: group.id,
        name: payload.name || group.name,
        displayName: payload.displayName || group.displayName,
        inputType: 'select',
        options: group.options?.map(opt => ({
          id: opt.id,
          value: opt.name,
          displayName: opt.displayName,
          priceModifier: 0
        })) || []
      }

      console.log('✏️ [ITEM SERVICE DEBUG] Updated attribute type:', JSON.stringify(result, null, 2))
      return result
    } catch (error) {
      console.error('Failed to update attribute type:', error)
      throw error
    }
  }

  async deleteAttributeType(id: string): Promise<void> {
    console.log('🗑️ [ITEM SERVICE DEBUG] Deleting attribute type (via Modifier API):', id)

    try {
      // 由于 Modifier API 还没有 deleteModifierGroup，这里暂时无法实现
      console.warn('⚠️ [ITEM SERVICE] deleteModifierGroup not yet implemented in Modifier API')
    } catch (error) {
      console.error('Failed to delete attribute type:', error)
      throw error
    }
  }

  async getAttributeOptions(typeId: string): Promise<ItemAttributeOption[]> {
    console.log('🏷️ [ITEM SERVICE DEBUG] Getting attribute options for type (via Modifier API):', typeId)

    try {
      const groups = await this.getModifierGroups()
      const group = groups.find(g => g.id === typeId)

      if (!group || !group.options) {
        return []
      }

      // 将 ModifierOption 适配为 ItemAttributeOption
      const options = group.options.map(opt => ({
        id: opt.id,
        value: opt.name,
        displayName: opt.displayName,
        priceModifier: 0
      }))

      console.log('🏷️ [ITEM SERVICE DEBUG] Attribute options:', JSON.stringify(options, null, 2))
      return options
    } catch (error) {
      console.error('Failed to get attribute options:', error)
      return []
    }
  }

  async createAttributeOption(typeId: string, payload: CreateItemAttributeOptionPayload): Promise<ItemAttributeOption> {
    console.log('➕ [ITEM SERVICE DEBUG] Creating attribute option (via Modifier API):', typeId, JSON.stringify(payload, null, 2))

    try {
      // 将 ItemAttributeOption 适配为 ModifierOption
      const modifierPayload: CreateModifierOptionPayload = {
        name: payload.value,
        displayName: payload.displayName,
        defaultPrice: 0,
        cost: 0
      }

      const option = await this.createModifierOption(typeId, modifierPayload)

      // 适配回 ItemAttributeOption
      const result: ItemAttributeOption = {
        id: option.id,
        value: option.name,
        displayName: option.displayName,
        priceModifier: 0
      }

      console.log('➕ [ITEM SERVICE DEBUG] Created attribute option:', JSON.stringify(result, null, 2))
      return result
    } catch (error) {
      console.error('Failed to create attribute option:', error)
      throw error
    }
  }

  async updateAttributeOption(optionId: string, payload: UpdateItemAttributeOptionPayload): Promise<ItemAttributeOption> {
    console.log('✏️ [ITEM SERVICE DEBUG] Updating attribute option (via Modifier API):', optionId, JSON.stringify(payload, null, 2))

    try {
      // 由于 Modifier API 还没有 updateModifierOption，这里暂时无法实现
      console.warn('⚠️ [ITEM SERVICE] updateModifierOption not yet implemented in Modifier API')

      // 返回一个占位符对象
      const result: ItemAttributeOption = {
        id: optionId,
        value: payload.value || '',
        displayName: payload.displayName || '',
        priceModifier: 0
      }

      console.log('✏️ [ITEM SERVICE DEBUG] Updated attribute option:', JSON.stringify(result, null, 2))
      return result
    } catch (error) {
      console.error('Failed to update attribute option:', error)
      throw error
    }
  }

  async deleteAttributeOption(optionId: string): Promise<void> {
    console.log('🗑️ [ITEM SERVICE DEBUG] Deleting attribute option (via Modifier API):', optionId)

    try {
      // 由于 Modifier API 还没有 deleteModifierOption，这里暂时无法实现
      console.warn('⚠️ [ITEM SERVICE] deleteModifierOption not yet implemented in Modifier API')
    } catch (error) {
      console.error('Failed to delete attribute option:', error)
      throw error
    }
  }

  // ==================== 商品属性关联管理 (已迁移到 Modifier v2.0) ====================
  async getItemAttributes(itemId: string): Promise<ItemAttribute[]> {
    console.log('🏷️ [ITEM SERVICE DEBUG] Getting item attributes for item (via Modifier API):', itemId)

    try {
      const itemModifiers = await this.getItemModifiers(itemId)
      const attributeModifiers = itemModifiers

      // 将 ItemModifierGroup 适配为 ItemAttribute
      const attributes = attributeModifiers.map(im => ({
        id: im.id,
        itemId: im.itemId,
        attributeTypeId: im.modifierGroupId,
        isRequired: im.isRequired,
        optionOverrides: undefined,
        allowedOptions: undefined,
        defaultOptionId: undefined,
        optionOrder: undefined,
        attributeType: im.group ? {
          id: im.group.id,
          name: im.group.name,
          displayName: im.group.displayName,
          inputType: 'select' as const,
          options: im.group.options?.map(opt => ({
            id: opt.id,
            value: opt.name,
            displayName: opt.displayName,
            priceModifier: 0
          })) || []
        } : undefined
      })) as ItemAttribute[]

      console.log('🏷️ [ITEM SERVICE DEBUG] Item attributes (adapted):', JSON.stringify(attributes, null, 2))
      return attributes
    } catch (error) {
      console.error('Failed to get item attributes:', error)
      return []
    }
  }

  async addItemAttribute(itemId: string, payload: CreateItemAttributePayload): Promise<ItemAttribute> {
    console.log('➕ [ITEM SERVICE DEBUG] Adding item attribute (via Modifier API):', itemId, JSON.stringify(payload, null, 2))

    try {
      // 将 CreateItemAttributePayload 适配为 AddModifierGroupToItemPayload
      const modifierPayload: AddModifierGroupToItemPayload = {
        modifierGroupId: payload.attributeTypeId,
        isRequired: payload.isRequired,
        minSelections: 0,
        maxSelections: 1
      }

      const itemModifier = await this.addModifierGroupToItem(itemId, modifierPayload)

      // 适配回 ItemAttribute
      const result: ItemAttribute = {
        id: itemModifier.id,
        itemId: itemModifier.itemId,
        attributeTypeId: itemModifier.modifierGroupId,
        isRequired: itemModifier.isRequired,
        optionOverrides: payload.optionOverrides,
        allowedOptions: payload.allowedOptions,
        defaultOptionId: payload.defaultOptionId,
        optionOrder: payload.optionOrder,
        attributeType: itemModifier.group ? {
          id: itemModifier.group.id,
          name: itemModifier.group.name,
          displayName: itemModifier.group.displayName,
          inputType: 'select',
          options: itemModifier.group.options?.map(opt => ({
            id: opt.id,
            value: opt.name,
            displayName: opt.displayName,
            priceModifier: 0
          })) || []
        } : undefined
      }

      console.log('➕ [ITEM SERVICE DEBUG] Added item attribute:', JSON.stringify(result, null, 2))
      return result
    } catch (error) {
      console.error('Failed to add item attribute:', error)
      throw error
    }
  }

  async updateItemAttribute(itemId: string, attributeId: string, payload: UpdateItemAttributePayload): Promise<ItemAttribute> {
    console.log('✏️ [ITEM SERVICE DEBUG] Updating item attribute (via Modifier API):', itemId, attributeId, JSON.stringify(payload, null, 2))

    try {
      // 由于 Modifier API 还没有更新方法，这里暂时无法实现
      console.warn('⚠️ [ITEM SERVICE] updateItemModifier not yet implemented in Modifier API')

      // 返回一个占位符对象
      const result: ItemAttribute = {
        id: attributeId,
        itemId,
        attributeTypeId: payload.attributeTypeId || '',
        isRequired: payload.isRequired !== undefined ? payload.isRequired : false,
        optionOverrides: payload.optionOverrides,
        allowedOptions: payload.allowedOptions,
        defaultOptionId: payload.defaultOptionId,
        optionOrder: payload.optionOrder
      }

      console.log('✏️ [ITEM SERVICE DEBUG] Updated item attribute:', JSON.stringify(result, null, 2))
      return result
    } catch (error) {
      console.error('Failed to update item attribute:', error)
      throw error
    }
  }

  async removeItemAttribute(itemId: string, attributeId: string): Promise<void> {
    console.log('🗑️ [ITEM SERVICE DEBUG] Removing item attribute (via Modifier API):', itemId, attributeId)

    try {
      // attributeId 实际上是 ItemModifierGroup 的 modifierGroupId
      // 我们需要先获取 ItemModifierGroup 找到 modifierGroupId
      const itemModifiers = await this.getItemModifiers(itemId)
      const itemModifier = itemModifiers.find(im => im.id === attributeId)

      if (!itemModifier) {
        throw new Error(`Item attribute not found: ${attributeId}`)
      }

      await this.removeModifierGroupFromItem(itemId, itemModifier.modifierGroupId)

      console.log('🗑️ [ITEM SERVICE DEBUG] Item attribute removed successfully')
    } catch (error) {
      console.error('Failed to remove item attribute:', error)
      throw error
    }
  }

  // ==================== Add-on管理 ====================

  async getAddons(params?: { page?: number; limit?: number; isActive?: boolean }): Promise<Addon[]> {
    console.log('🧩 [ITEM SERVICE DEBUG] Getting addons...')
    
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString())
    
    const url = `${API_BASE}/addons${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    const response = await httpService.get<{ addons: Addon[] } | Addon[]>(url)
    
    console.log('🧩 [ITEM SERVICE DEBUG] Addons response:', JSON.stringify(response.data, null, 2))
    
    // 处理不同的响应格式
    if (Array.isArray(response.data)) {
      return response.data
    } else if (response.data && typeof response.data === 'object' && 'addons' in response.data) {
      return (response.data as { addons: Addon[] }).addons || []
    } else {
      console.warn('🧩 [ITEM SERVICE DEBUG] Unexpected response format, returning empty array')
      return []
    }
  }

  async getAddon(id: string): Promise<Addon> {
    console.log('🧩 [ITEM SERVICE DEBUG] Getting addon:', id)
    
    const response = await httpService.get<Addon>(`${API_BASE}/addons/${id}`)
    
    console.log('🧩 [ITEM SERVICE DEBUG] Addon details:', JSON.stringify(response.data, null, 2))
    return response.data
  }

  async createAddon(payload: CreateAddonPayload): Promise<Addon> {
    console.log('➕ [ITEM SERVICE DEBUG] Creating addon:', JSON.stringify(payload, null, 2))
    
    const response = await httpService.post<Addon>(`${API_BASE}/addons`, payload)
    
    console.log('➕ [ITEM SERVICE DEBUG] Created addon:', JSON.stringify(response.data, null, 2))
    return response.data
  }

  async updateAddon(id: string, payload: UpdateAddonPayload): Promise<Addon> {
    console.log('✏️ [ITEM SERVICE DEBUG] Updating addon:', id, JSON.stringify(payload, null, 2))
    
    const response = await httpService.put<Addon>(`${API_BASE}/addons/${id}`, payload)
    
    console.log('✏️ [ITEM SERVICE DEBUG] Updated addon:', JSON.stringify(response.data, null, 2))
    return response.data
  }

  async deleteAddon(id: string): Promise<void> {
    console.log('🗑️ [ITEM SERVICE DEBUG] Deleting addon:', id)
    
    await httpService.delete(`${API_BASE}/addons/${id}`)
    
    console.log('🗑️ [ITEM SERVICE DEBUG] Addon deleted successfully')
  }

  async getItemAddons(itemId: string): Promise<ItemAddon[]> {
    console.log('🧩 [ITEM SERVICE DEBUG] Getting item addons for:', itemId)
    
    const response = await httpService.get<ItemAddon[]>(`${API_BASE}/addons/item/${itemId}`)
    
    console.log('🧩 [ITEM SERVICE DEBUG] Item addons:', JSON.stringify(response.data, null, 2))
    return response.data
  }

  async addItemAddon(itemId: string, payload: CreateItemAddonPayload): Promise<ItemAddon> {
    console.log('➕ [ITEM SERVICE DEBUG] Adding addon to item:', itemId, JSON.stringify(payload, null, 2))
    
    const response = await httpService.post<ItemAddon>(`${API_BASE}/addons/item/${itemId}`, payload)
    
    console.log('➕ [ITEM SERVICE DEBUG] Added item addon:', JSON.stringify(response.data, null, 2))
    return response.data
  }

  async removeItemAddon(itemId: string, addonId: string): Promise<void> {
    console.log('🗑️ [ITEM SERVICE DEBUG] Removing addon from item:', itemId, addonId)
    
    await httpService.delete(`${API_BASE}/addons/item/${itemId}/${addonId}`)
    
    console.log('🗑️ [ITEM SERVICE DEBUG] Item addon removed successfully')
  }

  // ==================== Combo管理 ====================

  async getCombos(params: ComboListParams = {}): Promise<PaginatedResponse<Combo>> {
    console.log('🎁 [ITEM SERVICE DEBUG] Getting combos...')
    
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value))
      }
    })
    
    const queryString = searchParams.toString()
    const url = `/combos${queryString ? '?' + queryString : ''}`
    
    const response = await httpService.get<ApiPaginatedResponse<Combo>>(`${API_BASE}${url}`)
    
    console.log('🎁 [ITEM SERVICE DEBUG] Combos response:', JSON.stringify(response.data, null, 2))
    
    const apiData = response.data
    
    if (!apiData) {
      return { data: [], total: 0, page: 1, limit: 10, totalPages: 0 }
    }
    
    // 处理API响应格式
    const rawCombos = Array.isArray(apiData.items) ? apiData.items : (apiData as any).combos || []
    
    // 转换数据类型
    const combos = rawCombos.map((combo: any) => ({
      ...combo,
      basePrice: typeof combo.basePrice === 'string' ? parseFloat(combo.basePrice) : combo.basePrice,
      discount: typeof combo.discount === 'string' ? parseFloat(combo.discount) : combo.discount
    }))
    
    const pagination = apiData.pagination || { page: 1, limit: 10, total: 0, pages: 0 }
    
    return {
      data: combos,
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: pagination.pages
    }
  }

  async getCombo(id: string): Promise<Combo> {
    console.log('🎁 [ITEM SERVICE DEBUG] Getting combo:', id)
    
    const response = await httpService.get<Combo>(`${API_BASE}/combos/${id}`)
    
    console.log('🎁 [ITEM SERVICE DEBUG] Combo details:', JSON.stringify(response.data, null, 2))
    return response.data
  }

  async createCombo(payload: CreateComboPayload): Promise<Combo> {
    console.log('🚀 [CREATE COMBO] ==========================================')
    console.log('📥 Original payload from UI:', JSON.stringify(payload, null, 2))

    const discountType = payload.discountType || 'fixed'
    const validatedPayload = {
      ...payload,
      basePrice: toMinorUnit(Number(payload.basePrice)), // 元 → 分
      // 百分比折扣直接使用数值，固定金额折扣需要转换为分
      discount: payload.discount
        ? (discountType === 'percentage' ? Number(payload.discount) : toMinorUnit(Number(payload.discount)))
        : 0,
      discountType: discountType,
      isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true
    }

    console.log('✅ [COMBO SERVICE] Final payload:', JSON.stringify(validatedPayload, null, 2))
    console.log('🌐 [COMBO SERVICE] Target URL:', `${API_BASE}/combos`)

    const response = await httpService.post<Combo>(`${API_BASE}/combos`, validatedPayload)

    console.log('✅ [CREATE COMBO] Server response:', JSON.stringify(response.data, null, 2))
    console.log('🏁 [CREATE COMBO] ==========================================')
    return response.data
  }

  async updateCombo(id: string, payload: UpdateComboPayload): Promise<Combo> {
    console.log('✏️ [COMBO SERVICE DEBUG] Updating combo:', id, JSON.stringify(payload, null, 2))

    const validatedPayload: any = {
      ...payload
    }

    // 转换价格: 元 → 分
    if (payload.basePrice !== undefined) {
      validatedPayload.basePrice = toMinorUnit(Number(payload.basePrice))
    }
    if (payload.discount !== undefined) {
      // 百分比折扣直接使用数值，固定金额折扣需要转换为分
      const discountType = payload.discountType || validatedPayload.discountType || 'fixed'
      validatedPayload.discount = discountType === 'percentage'
        ? Number(payload.discount)
        : toMinorUnit(Number(payload.discount))
    }
    if (payload.isActive !== undefined) {
      validatedPayload.isActive = Boolean(payload.isActive)
    }

    console.log('✅ [COMBO SERVICE DEBUG] Validated update payload:', JSON.stringify(validatedPayload, null, 2))

    const response = await httpService.put<Combo>(`${API_BASE}/combos/${id}`, validatedPayload)

    console.log('✏️ [COMBO SERVICE DEBUG] Updated combo response:', JSON.stringify(response.data, null, 2))
    return response.data
  }

  async deleteCombo(id: string): Promise<void> {
    console.log('🗑️ [COMBO SERVICE DEBUG] Deleting combo:', id)
    
    await httpService.delete(`${API_BASE}/combos/${id}`)
    
    console.log('🗑️ [COMBO SERVICE DEBUG] Combo deleted successfully')
  }

  // ==================== ComboItem管理 ====================

  async getComboItems(comboId: string): Promise<ComboItem[]> {
    // 套餐商品已整合到套餐详情中（combo.comboItems），此端点已废弃
    console.warn('[COMBO SERVICE] getComboItems 已废弃，请使用 getCombo 获取包含 comboItems 的完整套餐')
    const combo = await this.getCombo(comboId)
    return combo.comboItems || []
  }

  async addComboItem(comboId: string, payload: CreateComboItemPayload): Promise<ComboItem> {
    // 套餐商品管理已整合到套餐更新中（updateCombo），此端点已废弃
    console.warn('[COMBO SERVICE] addComboItem 已废弃，请使用 updateCombo 更新 comboItems')
    throw new Error('addComboItem 已废弃，请通过 updateCombo 管理套餐商品')
  }

  async updateComboItem(comboId: string, itemId: string, payload: UpdateComboItemPayload): Promise<ComboItem> {
    console.warn('[COMBO SERVICE] updateComboItem 已废弃，请使用 updateCombo 更新 comboItems')
    throw new Error('updateComboItem 已废弃，请通过 updateCombo 管理套餐商品')
  }

  async removeComboItem(comboId: string, itemId: string): Promise<void> {
    console.warn('[COMBO SERVICE] removeComboItem 已废弃，请使用 updateCombo 更新 comboItems')
    throw new Error('removeComboItem 已废弃，请通过 updateCombo 管理套餐商品')
  }

  /**
   * 上传套餐图片
   */
  async uploadComboImage(comboId: string, file: File): Promise<{ combo: Combo; image: { url: string; publicId: string } }> {
    console.log('📸 [COMBO SERVICE] Uploading image for combo:', comboId)

    const formData = new FormData()
    formData.append('image', file)

    const response = await httpService.post<{ combo: any; image: { url: string; publicId: string } }>(
      `${API_BASE}/combos/${comboId}/image`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' }
      }
    )

    console.log('📸 [COMBO SERVICE] Image uploaded successfully:', response.data.image.url)
    return response.data
  }

  /**
   * 删除套餐图片
   */
  async deleteComboImage(comboId: string): Promise<{ combo: Combo }> {
    console.log('🗑️ [COMBO SERVICE] Deleting image for combo:', comboId)

    const response = await httpService.delete<{ combo: any }>(
      `${API_BASE}/combos/${comboId}/image`
    )

    console.log('🗑️ [COMBO SERVICE] Image deleted successfully')
    return response.data
  }

  /**
   * 检查套餐是否当前可用
   */
  isComboCurrentlyAvailable(combo: Combo): boolean {
    const rules = combo.availabilityRules
    if (!rules || !rules.enabled) return true

    const now = new Date()
    const currentDay = now.getDay()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    // 检查星期限制
    if (rules.daysOfWeek?.length && !rules.daysOfWeek.includes(currentDay)) {
      return false
    }

    // 检查时间范围
    if (rules.timeRange) {
      if (currentTime < rules.timeRange.start || currentTime > rules.timeRange.end) {
        return false
      }
    }

    return true
  }

  // ==================== Modifier v2.0 管理 ====================

  /**
   * 获取自定义选项组列表
   */
  async getModifierGroups(params?: { isActive?: boolean; nocache?: number }): Promise<ModifierGroup[]> {
    const queryParams = new URLSearchParams()
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString())
    if (params?.nocache !== undefined) queryParams.append('nocache', params.nocache.toString())

    const url = `${API_BASE}/modifier-groups${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    const response = await httpService.get<{ groups: any[] }>(url)

    // 转换后端的下划线字段为前端的驼峰字段
    const groups = (response.data.groups || []).map((group: any) => ({
      id: group.id,
      tenantId: group.brand_id || group.tenant_id,
      name: group.name,
      displayName: group.display_name,
      displayNameI18n: group.display_name_i18n ?? undefined,

      description: group.description,
      displayOrder: group.display_order,
      isActive: group.is_active,
      storeId: group.store_id !== undefined ? group.store_id : undefined,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      // 新后端关联字段为 options（旧字段为 modifier_options）
      options: (group.options || group.modifier_options || []).map((option: any) => ({
        id: option.id,
        modifierGroupId: option.modifier_group_id,
        name: option.name,
        displayName: option.display_name,
        displayNameI18n: option.display_name_i18n ?? undefined,
        code: option.code,
        defaultPrice: option.default_price !== null && option.default_price !== undefined
          ? fromMinorUnit(Number(option.default_price))
          : 0,
        cost: option.cost !== null && option.cost !== undefined
          ? fromMinorUnit(Number(option.cost))
          : undefined,
        displayOrder: option.display_order,
        isActive: option.is_active,
        isDefault: option.is_default,
        trackInventory: option.track_inventory,
        currentStock: option.current_stock,
        createdAt: option.created_at,
        updatedAt: option.updated_at
      }))
    }))

    return groups
  }

  /**
   * 创建自定义选项组
   */
  async createModifierGroup(payload: CreateModifierGroupPayload): Promise<ModifierGroup> {
    // 新后端直接返回 group 对象，不再包装在 { group: {...} }
    const response = await httpService.post<any>(`${API_BASE}/modifier-groups`, payload)
    const group = response.data.group ?? response.data

    // 转换后端的下划线字段为前端的驼峰字段
    return {
      id: group.id,
      tenantId: group.brand_id || group.tenant_id,
      name: group.name,
      displayName: group.display_name,

      description: group.description,
      displayOrder: group.display_order,
      isActive: group.is_active,
      storeId: group.store_id !== undefined ? group.store_id : undefined,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      options: []
    }
  }

  /**
   * 创建自定义选项选项
   */
  async createModifierOption(groupId: string, payload: CreateModifierOptionPayload): Promise<ModifierOption> {
    console.log('[MODIFIER] ➕ Create option request:', JSON.stringify({ groupId, payload }, null, 2))

    // 价格转换（元 → 分）
    const convertedPayload = {
      ...payload,
      defaultPrice: payload.defaultPrice ? toMinorUnit(Number(payload.defaultPrice)) : 0, // 元 → 分
      cost: payload.cost ? toMinorUnit(Number(payload.cost)) : undefined // 元 → 分
    }

    // 新后端直接返回 option 对象，不再包装在 { option: {...} }
    const response = await httpService.post<any>(`${API_BASE}/modifier-groups/${groupId}/options`, convertedPayload)
    const option = response.data.option ?? response.data

    console.log('[MODIFIER] ➕ Create option response:', JSON.stringify(option, null, 2))

    // 转换后端的下划线字段为前端的驼峰字段，价格从分转换为元
    return {
      id: option.id,
      modifierGroupId: option.modifier_group_id,
      name: option.name,
      displayName: option.display_name,
      code: option.code,
      defaultPrice: option.default_price !== null && option.default_price !== undefined
        ? fromMinorUnit(Number(option.default_price))
        : 0,
      cost: option.cost !== null && option.cost !== undefined
        ? fromMinorUnit(Number(option.cost))
        : undefined,
      displayOrder: option.display_order,
      isActive: option.is_active,
      isDefault: option.is_default,
      trackInventory: option.track_inventory,
      currentStock: option.current_stock,
      createdAt: option.created_at,
      updatedAt: option.updated_at
    }
  }

  /**
   * 更新自定义选项选项
   */
  async updateModifierOption(groupId: string, optionId: string, payload: Partial<CreateModifierOptionPayload>): Promise<ModifierOption> {
    // 价格转换（元 → 分）
    const convertedPayload: any = { ...payload }
    if (payload.defaultPrice !== undefined) {
      convertedPayload.defaultPrice = toMinorUnit(Number(payload.defaultPrice)) // 元 → 分
    }
    if (payload.cost !== undefined) {
      convertedPayload.cost = toMinorUnit(Number(payload.cost)) // 元 → 分
    }

    // 新后端直接返回 option 对象，不再包装在 { option: {...} }
    const response = await httpService.put<any>(`${API_BASE}/modifier-groups/${groupId}/options/${optionId}`, convertedPayload)
    const option = response.data.option ?? response.data

    // 转换后端的下划线字段为前端的驼峰字段，价格从分转换为元
    return {
      id: option.id,
      modifierGroupId: option.modifier_group_id,
      name: option.name,
      displayName: option.display_name,
      code: option.code,
      defaultPrice: option.default_price !== null && option.default_price !== undefined
        ? fromMinorUnit(Number(option.default_price))
        : 0,
      cost: option.cost !== null && option.cost !== undefined
        ? fromMinorUnit(Number(option.cost))
        : undefined,
      displayOrder: option.display_order,
      isActive: option.is_active,
      isDefault: option.is_default,
      trackInventory: option.track_inventory,
      currentStock: option.current_stock,
      createdAt: option.created_at,
      updatedAt: option.updated_at
    }
  }

  /**
   * 获取所有自定义选项的打印配置（平坦数组）
   * GET /print-configs
   */
  async getAllPrintConfigs(): Promise<Array<{
    id: string;
    modifierOptionId: string;
    printCode: string;
    defaultQuantity: number;
    instruction: string | null;
    isActive: boolean;
  }>> {
    const response = await httpService.get<any>(`${API_BASE}/print-configs`)
    const raw: any[] = response.data.configs ?? response.data ?? []
    // 将后端下划线字段转换为驼峰
    return raw.map((c: any) => ({
      id: c.id,
      modifierOptionId: c.modifier_option_id,
      printCode: c.print_code,
      defaultQuantity: c.default_quantity ?? 1,
      instruction: c.instruction ?? null,
      isActive: c.is_active ?? true
    }))
  }

  /**
   * 保存选项打印配置（打印代码 + 用量 + 说明）
   * PUT /modifier-groups/:groupId/options/:optionId/print-config
   */
  async updatePrintConfig(groupId: string, optionId: string, payload: {
    printCode?: string;  // 空字符串表示清除
    defaultQuantity?: number;
    instruction?: string;
  }): Promise<any> {
    // 打印配置现在通过 /print-configs/:modifierOptionId 管理
    const response = await httpService.put<any>(
      `${API_BASE}/print-configs/${optionId}`,
      payload
    )
    return response.data.config ?? response.data
  }

  /**
   * 删除自定义选项选项
   * 注意：根据 API 文档，后端可能还未实现此端点
   * 如果返回 404，说明后端还未支持此功能
   */
  async deleteModifierOption(groupId: string, optionId: string): Promise<void> {
    try {
      await httpService.delete(`${API_BASE}/modifier-groups/${groupId}/options/${optionId}`)
    } catch (error: any) {
      // 如果返回 404，说明后端还未实现此端点
      if (error?.response?.status === 404) {
        throw new Error('后端 API 还未实现删除自定义选项选项功能，请稍后再试')
      }
      throw error
    }
  }

  /**
   * 更新自定义选项组
   */
  async updateModifierGroup(groupId: string, payload: UpdateModifierGroupPayload): Promise<ModifierGroup> {
    // 新后端直接返回 group 对象，不再包装在 { group: {...} }
    const response = await httpService.put<any>(`${API_BASE}/modifier-groups/${groupId}`, payload)
    const group = response.data.group ?? response.data

    // 转换后端的下划线字段为前端的驼峰字段
    return {
      id: group.id,
      tenantId: group.brand_id || group.tenant_id,
      name: group.name,
      displayName: group.display_name,
      displayNameI18n: group.display_name_i18n ?? undefined,
      description: group.description,
      displayOrder: group.display_order,
      isActive: group.is_active,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      // 新后端关联字段为 options（旧字段为 modifier_options）
      options: (group.options || group.modifier_options || []).map((option: any) => ({
        id: option.id,
        modifierGroupId: option.modifier_group_id,
        name: option.name,
        displayName: option.display_name,
        displayNameI18n: option.display_name_i18n ?? undefined,
        code: option.code,
        defaultPrice: option.default_price !== null && option.default_price !== undefined
          ? fromMinorUnit(Number(option.default_price))
          : 0,
        cost: option.cost !== null && option.cost !== undefined
          ? fromMinorUnit(Number(option.cost))
          : undefined,
        displayOrder: option.display_order,
        isActive: option.is_active,
        isDefault: option.is_default,
        trackInventory: option.track_inventory,
        currentStock: option.current_stock,
        createdAt: option.created_at,
        updatedAt: option.updated_at
      }))
    }
  }

  /**
   * 删除自定义选项组
   * 注意：根据 API 文档，后端可能还未实现此端点
   * 如果返回 404，说明后端还未支持此功能
   */
  async deleteModifierGroup(groupId: string): Promise<void> {
    try {
      await httpService.delete(`${API_BASE}/modifier-groups/${groupId}`)
    } catch (error: any) {
      // 如果返回 404，说明后端还未实现此端点
      if (error?.response?.status === 404) {
        throw new Error('后端 API 还未实现删除自定义选项组功能，请稍后再试')
      }
      throw error
    }
  }

  /**
   * 获取商品的自定义选项配置
   */
  async getItemModifiers(itemId: string): Promise<ItemModifierGroup[]> {
    const response = await httpService.get<{ groups: any[] }>(`${API_BASE}/items/${itemId}/modifiers`)

    // 转换后端的下划线字段为前端的驼峰字段
    // 新后端返回 { groups: [...] }，每个 relation 包含 modifier_group（不是 group）
    const groups = (response.data.groups || []).map((relation: any) => {
      const rawGroup = relation.modifier_group || relation.group || relation.modifier_groups
      return {
        id: relation.id,
        itemId: relation.item_id,
        modifierGroupId: relation.modifier_group_id,
        isRequired: relation.is_required,
        minSelections: relation.min_selections,
        maxSelections: relation.max_selections,
        sortOrder: relation.display_order || relation.sort_order,
        createdAt: relation.created_at,
        group: rawGroup ? {
          id: rawGroup.id,
          tenantId: rawGroup.brand_id || rawGroup.tenant_id,
          name: rawGroup.name,
          displayName: rawGroup.display_name,

          description: rawGroup.description,
          displayOrder: rawGroup.display_order,
          isActive: rawGroup.is_active,
          createdAt: rawGroup.created_at,
          updatedAt: rawGroup.updated_at,
          // 新后端关联字段为 options（旧字段为 modifier_options）
          options: (rawGroup.options || rawGroup.modifier_options || []).map((option: any) => {
            const defaultPriceCents = option.default_price
            const itemPriceCents = option.item_modifier_prices?.[0]?.price
            return {
              id: option.id,
              modifierGroupId: option.modifier_group_id,
              name: option.name,
              displayName: option.display_name,
              defaultPrice: defaultPriceCents !== null && defaultPriceCents !== undefined
                ? fromMinorUnit(Number(defaultPriceCents))
                : 0,
              cost: option.cost !== null && option.cost !== undefined
                ? fromMinorUnit(Number(option.cost))
                : undefined,
              displayOrder: option.display_order,
              isActive: option.is_active,
              isDefault: option.is_default,
              trackInventory: option.track_inventory,
              currentStock: option.current_stock,
              createdAt: option.created_at,
              updatedAt: option.updated_at,
              itemOptions: (option.item_modifier_options || []).map((itemOpt: any) => ({
                isDefault: itemOpt.is_default,
                isEnabled: itemOpt.is_enabled,
                displayOrder: itemOpt.display_order
              })),
              itemPrice: itemPriceCents !== null && itemPriceCents !== undefined
                ? fromMinorUnit(Number(itemPriceCents))
                : null,
              finalPrice: itemPriceCents !== null && itemPriceCents !== undefined
                ? fromMinorUnit(Number(itemPriceCents))
                : (defaultPriceCents !== null && defaultPriceCents !== undefined ? fromMinorUnit(Number(defaultPriceCents)) : 0)
            }
          })
        } : undefined
      }
    })

    return groups
  }

  /**
   * 为商品关联自定义选项组
   */
  async addModifierGroupToItem(itemId: string, payload: AddModifierGroupToItemPayload): Promise<ItemModifierGroup> {
    // 新后端直接返回 relation 对象，不再包装在 { relation: {...} }
    const response = await httpService.post<any>(`${API_BASE}/items/${itemId}/modifier-groups`, payload)
    const relation = response.data.relation ?? response.data

    // 新后端关联字段为 modifier_group（旧字段为 group 或 modifier_groups）
    const rawGroup = relation.modifier_group || relation.group || relation.modifier_groups

    return {
      id: relation.id,
      itemId: relation.item_id,
      modifierGroupId: relation.modifier_group_id,
      isRequired: relation.is_required,
      minSelections: relation.min_selections,
      maxSelections: relation.max_selections,
      sortOrder: relation.display_order || relation.sort_order,
      createdAt: relation.created_at,
      group: rawGroup ? {
        id: rawGroup.id,
        tenantId: rawGroup.brand_id || rawGroup.tenant_id,
        name: rawGroup.name,
        displayName: rawGroup.display_name,
        description: rawGroup.description,
        displayOrder: rawGroup.display_order,
        isActive: rawGroup.is_active,
        createdAt: rawGroup.created_at,
        updatedAt: rawGroup.updated_at,
        // 新后端关联字段为 options（旧字段为 modifier_options）
        options: (rawGroup.options || rawGroup.modifier_options || []).map((option: any) => {
          const defaultPriceCents = option.default_price
          const itemPriceCents = option.item_modifier_prices?.[0]?.price
          return {
            id: option.id,
            modifierGroupId: option.modifier_group_id,
            name: option.name,
            displayName: option.display_name,
            defaultPrice: defaultPriceCents !== null && defaultPriceCents !== undefined
              ? fromMinorUnit(Number(defaultPriceCents))
              : 0,
            cost: option.cost !== null && option.cost !== undefined
              ? fromMinorUnit(Number(option.cost))
              : undefined,
            displayOrder: option.display_order,
            isActive: option.is_active,
            isDefault: option.is_default,
            trackInventory: option.track_inventory,
            currentStock: option.current_stock,
            createdAt: option.created_at,
            updatedAt: option.updated_at,
            itemOptions: (option.item_modifier_options || []).map((itemOpt: any) => ({
              isDefault: itemOpt.is_default,
              isEnabled: itemOpt.is_enabled,
              displayOrder: itemOpt.display_order
            })),
            itemPrice: itemPriceCents !== null && itemPriceCents !== undefined
              ? fromMinorUnit(Number(itemPriceCents))
              : null,
            finalPrice: itemPriceCents !== null && itemPriceCents !== undefined
              ? fromMinorUnit(Number(itemPriceCents))
              : (defaultPriceCents !== null && defaultPriceCents !== undefined ? fromMinorUnit(Number(defaultPriceCents)) : 0)
          }
        })
      } : undefined
    }
  }

  /**
   * 移除商品的自定义选项组
   */
  async removeModifierGroupFromItem(itemId: string, groupId: string): Promise<void> {
    await httpService.delete(`${API_BASE}/items/${itemId}/modifier-groups/${groupId}`)
  }

  /**
   * 设置商品的自定义选项价格
   */
  async setItemModifierPrices(itemId: string, payload: SetItemModifierPricesPayload): Promise<void> {
    // 转换价格: 元 → 分
    const convertedPayload = {
      prices: payload.prices.map(p => ({
        modifierOptionId: p.modifierOptionId,
        price: toMinorUnit(Number(p.price))
      }))
    }
    await httpService.post(`${API_BASE}/items/${itemId}/modifier-prices`, convertedPayload)
  }

  /**
   * 删除商品的自定义选项价格（已废弃，使用 setItemModifierPrices 批量更新）
   */
  async removeItemModifierPrice(itemId: string, optionId: string): Promise<void> {
    // 此端点已不存在，使用 setItemModifierPrices 覆盖即可
    console.warn('[MODIFIER] removeItemModifierPrice 已废弃，请使用 setItemModifierPrices 重新设置价格')
  }

  /**
   * 配置商品自定义选项选项（已废弃）
   */
  async configureItemModifierOptions(itemId: string, payload: ConfigureItemModifierOptionsPayload): Promise<void> {
    await httpService.post(`${API_BASE}/items/${itemId}/modifier-options`, payload)
  }

  /**
   * 删除商品的自定义选项选项配置（已废弃）
   */
  async removeItemModifierOption(itemId: string, optionId: string): Promise<void> {
    // 此端点已不存在
    console.warn('[MODIFIER] removeItemModifierOption 已废弃')
  }

  // ==================== 商品图片管理 ====================

  /**
   * 上传或更新商品图片
   * 使用覆盖策略：同一商品上传新图片会自动替换旧图片
   * @param itemId 商品 ID
   * @param file 图片文件 (支持 JPG, PNG, WebP，最大 5MB)
   */
  async uploadItemImage(itemId: string, file: File): Promise<{ item: Item; image: { url: string; publicId: string } }> {
    console.log('📸 [ITEM SERVICE] Uploading image for item:', itemId, {
      fileName: file.name,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      fileType: file.type
    })

    const formData = new FormData()
    formData.append('image', file)

    const response = await httpService.post<{ item: any; image: { url: string; publicId: string } }>(
      `${API_BASE}/items/${itemId}/image`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    )

    console.log('📸 [ITEM SERVICE] Image upload response:', response.data)

    // 转换返回的 item 字段名
    const item = response.data.item
    return {
      item: {
        id: item.id,
        tenantId: item.brand_id || item.tenant_id || item.tenantId,
        categoryId: item.category_id || item.categoryId,
        name: item.name,
        description: item.description,
        customFields: item.custom_fields || item.customFields,
        basePrice: typeof (item.base_price ?? item.basePrice) === 'string'
          ? parseFloat(item.base_price ?? item.basePrice)
          : (item.base_price ?? item.basePrice ?? 0),
        cost: item.cost !== undefined && item.cost !== null
          ? (typeof item.cost === 'string' ? parseFloat(item.cost) : item.cost)
          : undefined,
        aiTags: item.ai_tags || item.aiTags,
        imageUrl: item.image_url || item.imageUrl,
        isActive: item.is_active ?? item.isActive ?? true,
        createdAt: item.created_at || item.createdAt,
        updatedAt: item.updated_at || item.updatedAt
      },
      image: response.data.image
    }
  }

  /**
   * 删除商品图片
   * @param itemId 商品 ID
   */
  async deleteItemImage(itemId: string): Promise<{ item: Item }> {
    console.log('🗑️ [ITEM SERVICE] Deleting image for item:', itemId)

    const response = await httpService.delete<{ item: any }>(
      `${API_BASE}/items/${itemId}/image`
    )

    console.log('🗑️ [ITEM SERVICE] Image delete response:', response.data)

    // 转换返回的 item 字段名
    const item = response.data.item
    return {
      item: {
        id: item.id,
        tenantId: item.brand_id || item.tenant_id || item.tenantId,
        categoryId: item.category_id || item.categoryId,
        name: item.name,
        description: item.description,
        customFields: item.custom_fields || item.customFields,
        basePrice: typeof (item.base_price ?? item.basePrice) === 'string'
          ? parseFloat(item.base_price ?? item.basePrice)
          : (item.base_price ?? item.basePrice ?? 0),
        cost: item.cost !== undefined && item.cost !== null
          ? (typeof item.cost === 'string' ? parseFloat(item.cost) : item.cost)
          : undefined,
        aiTags: item.ai_tags || item.aiTags,
        imageUrl: item.image_url || item.imageUrl,
        isActive: item.is_active ?? item.isActive ?? true,
        createdAt: item.created_at || item.createdAt,
        updatedAt: item.updated_at || item.updatedAt
      }
    }
  }

  // ==================== 税务相关方法（已更新为新架构）====================
  // 新架构：
  //   GET  /taxes/catalog         - 获取品牌税率列表
  //   POST /taxes/catalog         - 创建品牌税率
  //   PUT  /taxes/catalog/:id     - 更新品牌税率
  //   DELETE /taxes/catalog/:id   - 删除品牌税率
  //   GET  /taxes/items/:itemId   - 获取商品关联的税率
  //   POST /taxes/items/:itemId/assign - 批量绑定税率到商品
  //   DELETE /taxes/items/:itemId/:taxRateId - 移除商品税率关联

  /**
   * 获取品牌税率列表（新架构）
   */
  async getTaxRates(regionCode?: string): Promise<TaxRate[]> {
    try {
      const url = regionCode
        ? `${API_BASE}/taxes/catalog?regionCode=${regionCode}`
        : `${API_BASE}/taxes/catalog`
      const response = await httpService.get<{ rates: any[] }>(url)
      return (response.data?.rates || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        taxType: r.type || r.taxType,
        rate: r.rate,
        foodExempt: false,
        effectiveDate: r.created_at,
        isOverridden: false,
        source: 'SYSTEM_DEFAULT' as const
      }))
    } catch (error: any) {
      if (error?.response?.status === 404) {
        console.warn('[ITEM SERVICE] 税率 API 未实现，返回本地 mock 数据')
        return MOCK_TAX_RATES[regionCode || ''] || []
      }
      throw error
    }
  }

  /**
   * 获取品牌税率列表（简化格式）
   */
  async getTaxClasses(regionCode?: string): Promise<SimpleTaxRate[]> {
    try {
      const url = regionCode
        ? `${API_BASE}/taxes/catalog?regionCode=${regionCode}`
        : `${API_BASE}/taxes/catalog`
      const response = await httpService.get<{ rates: any[] }>(url)
      return (response.data?.rates || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        rate: r.rate,
        regionCode: r.region_code || regionCode || '',
        createdAt: r.created_at
      }))
    } catch (error: any) {
      if (error?.response?.status === 404) {
        console.warn('[ITEM SERVICE] 税类 API 未实现，返回空数组')
        return []
      }
      throw error
    }
  }

  /**
   * 获取商品关联的税率
   */
  async getItemTaxClass(itemId: string): Promise<ItemTaxClass> {
    const response = await httpService.get<{ itemId: string; taxRates: any[] }>(
      `${API_BASE}/taxes/items/${itemId}`
    )
    const data = response.data
    return {
      itemId: data.itemId || itemId,
      taxes: (data.taxRates || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        taxType: r.type || r.taxType,
        rate: r.rate
      }))
    } as ItemTaxClass
  }

  /**
   * 为商品绑定税率（新接口，支持多个）
   */
  async assignItemTaxClass(itemId: string, payload: AssignTaxClassPayload): Promise<void> {
    // 新接口为批量绑定：POST /taxes/items/:itemId/assign { taxRateIds: [...] }
    await httpService.post(`${API_BASE}/taxes/items/${itemId}/assign`, {
      taxRateIds: [payload.taxClassId]
    })
  }

  /**
   * 为商品分配租户自定义税类（已合并到 assignItemTaxClass）
   */
  async assignItemTenantTaxClass(itemId: string, payload: AssignTaxClassPayload): Promise<void> {
    await this.assignItemTaxClass(itemId, payload)
  }

  /**
   * 为商品添加单个税类
   */
  async addItemTaxClass(itemId: string, payload: AssignTaxClassPayload): Promise<void> {
    await this.assignItemTaxClass(itemId, payload)
  }

  /**
   * 为商品批量添加多个税类
   */
  async addMultipleItemTaxClasses(itemId: string, payload: AssignMultipleTaxClassPayload): Promise<void> {
    await httpService.post(`${API_BASE}/taxes/items/${itemId}/assign`, {
      taxRateIds: payload.taxClassIds
    })
  }

  /**
   * 计算单个商品的税后价格（已简化，前端自行计算）
   */
  async calculateItemTax(itemId: string, region: string): Promise<TaxCalculationResult> {
    console.warn('[TAX] calculateItemTax 已废弃，请在前端基于税率自行计算')
    return { itemId, itemName: '', basePrice: 0, basePriceDisplay: '0', taxes: [], totalTax: 0, totalTaxDisplay: '0', finalPrice: 0, finalPriceDisplay: '0', region }
  }

  /**
   * 批量计算商品的税后价格（已废弃）
   */
  async calculateBatchItemTax(itemIds: string[], region: string): Promise<TaxCalculationResult[]> {
    console.warn('[TAX] calculateBatchItemTax 已废弃，请在前端基于税率自行计算')
    return []
  }

  /**
   * 创建或更新税率覆盖（已废弃）
   */
  async createTaxRateOverride(payload: TaxRateOverridePayload): Promise<void> {
    console.warn('[TAX] createTaxRateOverride 已废弃')
  }

  /**
   * 创建品牌税率（替代原 createTenantTaxClass）
   */
  async createTenantTaxClass(payload: CreateTenantTaxClassPayload): Promise<SimpleTaxRate> {
    const response = await httpService.post<any>(
      `${API_BASE}/taxes/catalog`,
      {
        name: payload.name,
        rate: payload.rates?.[0]?.rate ?? 0,
        type: payload.rates?.[0]?.taxType,
        regionCode: payload.regionCode
      }
    )
    const r = response.data
    return {
      id: r.id,
      name: r.name,
      rate: r.rate,
      regionCode: r.region_code || payload.regionCode,
      createdAt: r.created_at
    } as SimpleTaxRate
  }

  /**
   * 删除品牌税率
   */
  async deleteTaxRate(taxRateId: string): Promise<void> {
    await httpService.delete(`${API_BASE}/taxes/catalog/${taxRateId}`)
  }

  /**
   * 更新品牌税率
   */
  async updateTaxRate(taxRateId: string, payload: { name?: string; rate?: number }): Promise<SimpleTaxRate> {
    const response = await httpService.put<any>(
      `${API_BASE}/taxes/catalog/${taxRateId}`,
      payload
    )
    const r = response.data
    return {
      id: r.id,
      name: r.name,
      rate: r.rate,
      regionCode: r.region_code,
      createdAt: r.created_at
    } as SimpleTaxRate
  }

  // ==================== 门店税率（每个门店独立管理）====================

  /**
   * 获取门店可用商品列表（含门店价格覆盖和本地商品）
   */
  async getStoreAvailableItems(): Promise<Array<{ id: string; name: string; basePrice: number; isActive: boolean; isLocal: boolean }>> {
    const response = await httpService.get<Array<{ id: string; name: string; basePrice: number; isActive: boolean; isLocal: boolean }>>(
      `${API_BASE}/taxes/store/items`
    )
    return Array.isArray(response.data) ? response.data : []
  }

  /**
   * 获取门店税率列表
   */
  async getStoreTaxRates(regionCode?: string): Promise<SimpleTaxRate[]> {
    const url = regionCode
      ? `${API_BASE}/taxes/store?regionCode=${regionCode}`
      : `${API_BASE}/taxes/store`
    const response = await httpService.get<{ rates: any[] }>(url)
    return (response.data?.rates || []).map((r: any) => ({
      id: r.id, name: r.name, rate: parseFloat(r.rate), regionCode: r.region_code, createdAt: r.created_at
    })) as SimpleTaxRate[]
  }

  /**
   * 创建门店税率
   */
  async createStoreTaxRate(payload: { name: string; rate: number; regionCode?: string }): Promise<SimpleTaxRate> {
    const response = await httpService.post<any>(`${API_BASE}/taxes/store`, {
      name: payload.name,
      rate: payload.rate,
      regionCode: payload.regionCode
    })
    const r = response.data
    return { id: r.id, name: r.name, rate: parseFloat(r.rate), regionCode: r.region_code, createdAt: r.created_at } as SimpleTaxRate
  }

  /**
   * 更新门店税率
   */
  async updateStoreTaxRate(taxRateId: string, payload: { name?: string; rate?: number }): Promise<SimpleTaxRate> {
    const response = await httpService.put<any>(`${API_BASE}/taxes/store/${taxRateId}`, payload)
    const r = response.data
    return { id: r.id, name: r.name, rate: parseFloat(r.rate), regionCode: r.region_code, createdAt: r.created_at } as SimpleTaxRate
  }

  /**
   * 删除门店税率
   */
  async deleteStoreTaxRate(taxRateId: string): Promise<void> {
    await httpService.delete(`${API_BASE}/taxes/store/${taxRateId}`)
  }

  /**
   * 获取门店税率关联的商品列表
   */
  async getStoreTaxRateItems(taxRateId: string): Promise<Array<{ id: string; name: string; basePrice: number; isActive: boolean }>> {
    const response = await httpService.get<Array<{ id: string; name: string; basePrice: number; isActive: boolean }>>(
      `${API_BASE}/taxes/store/tax-rates/${taxRateId}/items`
    )
    return Array.isArray(response.data) ? response.data : []
  }

  /**
   * 批量分配门店商品税率
   */
  async batchAssignStoreItemTaxRate(itemIds: string[], taxRateId: string): Promise<{ total: number; succeeded: number; failed: number }> {
    const response = await httpService.post<{ total: number; succeeded: number; failed: number }>(
      `${API_BASE}/taxes/store/items/batch-assign`,
      { itemIds, taxRateId }
    )
    return response.data
  }

  /**
   * 批量移除门店商品税率
   */
  async batchRemoveStoreItemTaxRate(itemIds: string[]): Promise<{ total: number; removed: number }> {
    const response = await httpService.post<{ total: number; removed: number }>(
      `${API_BASE}/taxes/store/items/batch-remove`,
      { itemIds }
    )
    return response.data
  }

  /**
   * 批量为商品绑定税率
   */
  async batchAssignItemTaxClass(itemIds: string[], taxClassId: string): Promise<{ total: number; succeeded: number; failed: number; failedItems: Array<{ itemId: string; error: string }> }> {
    // 新接口逐个分配
    let succeeded = 0
    const failedItems: Array<{ itemId: string; error: string }> = []
    for (const itemId of itemIds) {
      try {
        await httpService.post(`${API_BASE}/taxes/items/${itemId}/assign`, { taxRateIds: [taxClassId] })
        succeeded++
      } catch (e: any) {
        failedItems.push({ itemId, error: e.message })
      }
    }
    return { total: itemIds.length, succeeded, failed: failedItems.length, failedItems }
  }

  /**
   * 批量为商品分配租户自定义税类（已合并到 batchAssignItemTaxClass）
   */
  async batchAssignItemTenantTaxClass(itemIds: string[], tenantTaxClassId: string): Promise<{ total: number; succeeded: number; failed: number; failedItems: Array<{ itemId: string; error: string }> }> {
    // 直接内联，避免解构时 this 丢失的问题
    let succeeded = 0
    const failedItems: Array<{ itemId: string; error: string }> = []
    for (const itemId of itemIds) {
      try {
        await httpService.post(`${API_BASE}/taxes/items/${itemId}/assign`, { taxRateIds: [tenantTaxClassId] })
        succeeded++
      } catch (e: any) {
        failedItems.push({ itemId, error: e.message })
      }
    }
    return { total: itemIds.length, succeeded, failed: failedItems.length, failedItems }
  }

  /**
   * 获取税率关联的商品列表
   */
  async getTaxRateItems(taxRateId: string): Promise<Array<{ id: string; name: string; basePrice: number; isActive: boolean }>> {
    const response = await httpService.get<Array<{ id: string; name: string; basePrice: number; isActive: boolean }>>(
      `${API_BASE}/taxes/tax-rates/${taxRateId}/items`
    )
    return Array.isArray(response.data) ? response.data : []
  }

  /**
   * 移除商品的税率关联
   */
  async removeItemTaxClass(itemId: string, taxRateId?: string): Promise<void> {
    if (taxRateId) {
      await httpService.delete(`${API_BASE}/taxes/items/${itemId}/${taxRateId}`)
    } else {
      console.warn('[TAX] removeItemTaxClass: 需要提供 taxRateId')
    }
  }

  /**
   * 批量移除商品的税率关联
   */
  async batchRemoveItemTaxClass(itemIds: string[]): Promise<{ total: number; removed: number }> {
    const response = await httpService.post<{ total: number; removed: number }>(
      `${API_BASE}/taxes/items/batch-remove`,
      { itemIds }
    )
    return response.data
  }

  // ==================== 自定义选项税种 ====================

  /**
   * 获取税种关联的自定义选项列表
   */
  async getTaxRateModifierOptions(taxRateId: string): Promise<Array<{
    id: string; name: string; displayName: string; defaultPrice: number;
    isActive: boolean; groupId: string; groupDisplayName: string
  }>> {
    const response = await httpService.get<any[]>(`${API_BASE}/taxes/tax-rates/${taxRateId}/modifier-options`)
    return Array.isArray(response.data) ? response.data : []
  }

  /**
   * 批量为自定义选项分配税种
   */
  async batchAssignModifierOptionTaxRate(optionIds: string[], taxRateId: string): Promise<{ total: number; succeeded: number; failed: number }> {
    const response = await httpService.post<{ total: number; succeeded: number; failed: number }>(
      `${API_BASE}/taxes/modifier-options/batch-assign`,
      { optionIds, taxRateId }
    )
    return response.data
  }

  /**
   * 批量移除自定义选项的税种关联
   */
  async batchRemoveModifierOptionTaxRate(optionIds: string[]): Promise<{ total: number; removed: number }> {
    const response = await httpService.post<{ total: number; removed: number }>(
      `${API_BASE}/taxes/modifier-options/batch-remove`,
      { optionIds }
    )
    return response.data
  }
}

// 导出服务实例
export const itemManagementService = new ItemManagementService()

// 导出便捷的函数接口
export const {
  getItems,
  getItem,
  searchItems,
  createItem,
  updateItem,
  deleteItem,
  batchOperations,
  // 图片管理
  uploadItemImage,
  deleteItemImage,
  getCategories,
  getCategoryTree,
  createCategory,
  updateCategory,
  deleteCategory,
  getAttributeTypes,
  createAttributeType,
  updateAttributeType,
  deleteAttributeType,
  getAttributeOptions,
  createAttributeOption,
  updateAttributeOption,
  deleteAttributeOption,
  getItemAttributes,
  addItemAttribute,
  updateItemAttribute,
  removeItemAttribute,
  getAddons,
  getAddon,
  createAddon,
  updateAddon,
  deleteAddon,
  getItemAddons,
  addItemAddon,
  removeItemAddon,
  getCombos,
  getCombo,
  createCombo,
  updateCombo,
  deleteCombo,
  getComboItems,
  addComboItem,
  updateComboItem,
  removeComboItem,
  // Modifier v2.0 方法
  getModifierGroups,
  createModifierGroup,
  updateModifierGroup,
  deleteModifierGroup,
  createModifierOption,
  updateModifierOption,
  deleteModifierOption,
  getItemModifiers,
  addModifierGroupToItem,
  removeModifierGroupFromItem,
  setItemModifierPrices,
  removeItemModifierPrice,
  configureItemModifierOptions,
  removeItemModifierOption,
  // 税务相关方法
  getTaxRates,
  getTaxClasses,
  getItemTaxClass,
  assignItemTaxClass,
  assignItemTenantTaxClass,
  addItemTaxClass,
  addMultipleItemTaxClasses,
  batchAssignItemTaxClass,
  batchAssignItemTenantTaxClass,
  calculateItemTax,
  calculateBatchItemTax,
  createTaxRateOverride,
  createTenantTaxClass,
  deleteTaxRate,
  updateTaxRate,
  getTaxRateItems,
  removeItemTaxClass,
  batchRemoveItemTaxClass,
  getTaxRateModifierOptions,
  batchAssignModifierOptionTaxRate,
  batchRemoveModifierOptionTaxRate,
  // 门店税率（每店独立管理）
  getStoreAvailableItems,
  getStoreTaxRates,
  createStoreTaxRate,
  updateStoreTaxRate,
  deleteStoreTaxRate,
  getStoreTaxRateItems,
  batchAssignStoreItemTaxRate,
  batchRemoveStoreItemTaxRate
} = itemManagementService
