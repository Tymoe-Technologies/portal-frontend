import { httpService, ApiResponse } from './http'

/**
 * 菜单项接口
 */
export interface MenuItem {
  id: string
  title: {
    translations: {
      [locale: string]: string
    }
  }
  description?: {
    translations: {
      [locale: string]: string
    }
  }
  image_url?: string
  price_info: {
    price: number
  }
  tax_info: {
    tax_rate?: number
    vat_rate_percentage?: number
  }
  modifier_group_ids?: {
    ids: string[]
  }
  suspension_info?: {
    suspension?: {
      suspend_until?: number
      reason?: string
    }
  }
}

/**
 * 菜单分类接口
 */
export interface MenuCategory {
  id: string
  title: {
    translations: {
      [locale: string]: string
    }
  }
  subtitle?: {
    translations: {
      [locale: string]: string
    }
  }
  entities: Array<{
    id: string
    type: 'ITEM' | 'MODIFIER_GROUP'
  }>
}

/**
 * 菜单接口
 */
export interface Menu {
  id: string
  title: {
    translations: {
      [locale: string]: string
    }
  }
  subtitle?: {
    translations: {
      [locale: string]: string
    }
  }
  service_availability?: Array<{
    day_of_week: string
    time_periods: Array<{
      start_time: string
      end_time: string
    }>
  }>
  category_ids: string[]
}

/**
 * 菜单配置接口
 */
export interface MenuPayload {
  menus: Menu[]
  categories: MenuCategory[]
  items: MenuItem[]
  modifier_groups?: any[]
  menu_type?: string
}

/**
 * 菜单同步服务
 */
class UberMenuSyncService {
  // Vite 需要使用 VITE_ 前缀的环境变量
  private baseUrl = (import.meta.env as any).REACT_APP_UBER_SERVICE_URL ||
                    'http://localhost:3004'

  /**
   * 获取店铺当前菜单
   */
  async getStoreMenu(
    merchantId: string,
    storeId: string
  ): Promise<MenuPayload> {
    try {
      const response = await httpService.post<ApiResponse<MenuPayload>>(
        `${this.baseUrl}/api/uber/v1/store/menu`,
        { merchantId, storeId }
      )

      const responseData = response.data as any

      if (responseData?.data) {
        return responseData.data
      }

      throw new Error('未获得店铺菜单')
    } catch (error: any) {
      console.error('获取店铺菜单失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '获取菜单失败'
      )
    }
  }

  /**
   * 同步菜单到 Uber
   */
  async syncMenuToUber(
    merchantId: string,
    storeId: string,
    menuPayload: MenuPayload,
    menuType?: string
  ): Promise<{
    success: boolean
    message: string
  }> {
    try {
      const requestBody = {
        merchantId,
        storeId,
        menu: {
          ...menuPayload,
          ...(menuType && { menu_type: menuType })
        }
      }

      const response = await httpService.post(
        `${this.baseUrl}/api/uber/v1/store/menu/sync`,
        requestBody
      )

      const responseData = response.data as any

      if (responseData?.data) {
        return responseData.data
      }

      throw new Error('菜单同步失败')
    } catch (error: any) {
      console.error('菜单同步失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '菜单同步失败'
      )
    }
  }

  /**
   * 快速同步菜单到 Uber
   * 简化版本，自动生成默认菜单结构
   */
  async quickSyncMenu(
    merchantId: string,
    storeId: string,
    items: MenuItem[],
    categories: MenuCategory[],
    menus?: Menu[],
    menuType?: string
  ): Promise<{
    success: boolean
    message: string
  }> {
    try {
      const requestBody = {
        merchantId,
        storeId,
        items,
        categories,
        ...(menus && { menus }),
        ...(menuType && { menu_type: menuType })
      }

      const response = await httpService.post(
        `${this.baseUrl}/api/uber/v1/store/menu/quick-sync`,
        requestBody
      )

      const responseData = response.data as any

      if (responseData?.data) {
        return responseData.data
      }

      throw new Error('菜单同步失败')
    } catch (error: any) {
      console.error('菜单快速同步失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '菜单同步失败'
      )
    }
  }

  /**
   * 从 POS 系统同步菜单到 Uber
   * 一键同步：自动从 item-management 获取商品数据，转换格式后推送到 Uber
   */
  async syncFromPOS(
    merchantId: string,
    storeId: string,
    tenantId: string,
    options?: {
      menuType?: string
      locale?: string
      menuTitle?: string
    }
  ): Promise<{
    success: boolean
    message: string
    stats: {
      itemCount: number
      categoryCount: number
      modifierGroupCount: number
    }
  }> {
    try {
      const requestBody = {
        merchantId,
        storeId,
        tenantId,
        options
      }

      const response = await httpService.post(
        `${this.baseUrl}/api/uber/v1/store/menu/sync-from-pos`,
        requestBody
      )

      const responseData = response.data as any

      if (responseData?.data) {
        return responseData.data
      }

      throw new Error('POS 菜单同步失败')
    } catch (error: any) {
      console.error('POS 菜单同步失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        'POS 菜单同步失败'
      )
    }
  }

  /**
   * 预览 POS 菜单数据
   * 获取转换后的 Uber 格式数据，用于调试和确认
   */
  async previewPOSMenu(
    tenantId: string,
    options?: {
      locale?: string
      menuTitle?: string
    }
  ): Promise<{
    data: MenuPayload
    stats: {
      itemCount: number
      categoryCount: number
      modifierGroupCount: number
      menuCount: number
    }
  }> {
    try {
      const requestBody = {
        tenantId,
        options
      }

      const response = await httpService.post(
        `${this.baseUrl}/api/uber/v1/store/menu/preview-pos`,
        requestBody
      )

      const responseData = response.data as any

      if (responseData?.data) {
        return {
          data: responseData.data,
          stats: responseData.stats
        }
      }

      throw new Error('预览生成失败')
    } catch (error: any) {
      console.error('预览生成失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '预览生成失败'
      )
    }
  }

  /**
   * 获取菜单配置
   * 返回 POS 商品列表和 Uber 同步配置
   */
  async getMenuConfig(
    integrationId: string,
    tenantId: string,
    menuGroupId?: string
  ): Promise<{
    items: MenuConfigItem[]
    summary: {
      totalItems: number
      enabledItems: number
      customPriceItems: number
    }
  }> {
    try {
      const response = await httpService.post(
        `${this.baseUrl}/api/uber/v1/store/menu/config`,
        { integrationId, tenantId, menuGroupId }
      )

      const responseData = response.data as any
      if (responseData?.data) {
        return responseData.data
      }

      throw new Error('获取菜单配置失败')
    } catch (error: any) {
      console.error('获取菜单配置失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '获取菜单配置失败'
      )
    }
  }

  /**
   * 保存菜单配置
   */
  async saveMenuConfig(
    integrationId: string,
    tenantId: string,
    items: Array<{
      posItemId: string
      enabled: boolean
      uberPrice?: number | null
    }>,
    menuGroupId?: string
  ): Promise<{
    success: boolean
    updatedCount: number
    createdCount: number
  }> {
    try {
      const response = await httpService.post(
        `${this.baseUrl}/api/uber/v1/store/menu/config/save`,
        { integrationId, tenantId, items, menuGroupId }
      )

      const responseData = response.data as any
      if (responseData?.data) {
        return responseData.data
      }

      throw new Error('保存菜单配置失败')
    } catch (error: any) {
      console.error('保存菜单配置失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '保存菜单配置失败'
      )
    }
  }

  /**
   * 基于配置同步菜单到 Uber
   * 只同步已启用的商品，并应用价格覆盖
   */
  async syncWithConfig(
    merchantId: string,
    storeId: string,
    integrationId: string,
    tenantId: string,
    options?: {
      menuType?: string
      locale?: string
      menuTitle?: string
      serviceAvailability?: Array<{
        day_of_week: string
        time_periods: Array<{
          start_time: string
          end_time: string
        }>
      }>
    }
  ): Promise<{
    success: boolean
    message: string
    stats: {
      itemCount: number
      categoryCount: number
      modifierGroupCount: number
      skippedCount: number
      customPriceCount: number
    }
  }> {
    try {
      const response = await httpService.post(
        `${this.baseUrl}/api/uber/v1/store/menu/sync-with-config`,
        { merchantId, storeId, integrationId, tenantId, options }
      )

      const responseData = response.data as any
      if (responseData?.data) {
        return responseData.data
      }

      throw new Error('基于配置的菜单同步失败')
    } catch (error: any) {
      console.error('基于配置的菜单同步失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '基于配置的菜单同步失败'
      )
    }
  }

  /**
   * 获取同步历史
   */
  async getSyncHistory(
    integrationId: string,
    options?: {
      limit?: number
      offset?: number
    }
  ): Promise<{
    histories: SyncHistoryItem[]
    total: number
  }> {
    try {
      const response = await httpService.post(
        `${this.baseUrl}/api/uber/v1/store/menu/history`,
        { integrationId, ...options }
      )

      const responseData = response.data as any
      if (responseData?.data) {
        return responseData.data
      }

      throw new Error('获取同步历史失败')
    } catch (error: any) {
      console.error('获取同步历史失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '获取同步历史失败'
      )
    }
  }

  /**
   * 获取商品的自定义选项配置
   */
  async getModifierConfig(
    integrationId: string,
    tenantId: string,
    posItemId: string,
    menuGroupId?: string
  ): Promise<{
    modifiers: ModifierConfigItem[]
    summary: {
      totalOptions: number
      enabledOptions: number
      customPriceOptions: number
    }
  }> {
    try {
      const response = await httpService.post(
        `${this.baseUrl}/api/uber/v1/store/menu/modifier-config`,
        { integrationId, tenantId, posItemId, menuGroupId }
      )

      const responseData = response.data as any
      if (responseData?.data) {
        return responseData.data
      }

      throw new Error('获取自定义选项配置失败')
    } catch (error: any) {
      console.error('获取自定义选项配置失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '获取自定义选项配置失败'
      )
    }
  }

  /**
   * 保存自定义选项配置
   */
  async saveModifierConfig(
    integrationId: string,
    modifiers: Array<{
      posItemId: string
      modifierGroupId: string
      modifierOptionId: string
      modifierOptionName?: string
      enabled: boolean
      uberPrice?: number | null
    }>,
    menuGroupId?: string
  ): Promise<{
    success: boolean
    updatedCount: number
    createdCount: number
  }> {
    try {
      const response = await httpService.post(
        `${this.baseUrl}/api/uber/v1/store/menu/modifier-config/save`,
        { integrationId, modifiers, menuGroupId }
      )

      const responseData = response.data as any
      if (responseData?.data) {
        return responseData.data
      }

      throw new Error('保存自定义选项配置失败')
    } catch (error: any) {
      console.error('保存自定义选项配置失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '保存自定义选项配置失败'
      )
    }
  }

  /**
   * 基于菜单分类配置同步菜单到 Uber
   * 使用用户在菜单分类管理中配置的分类和商品映射
   */
  async syncWithMenuCategories(
    merchantId: string,
    storeId: string,
    integrationId: string,
    tenantId: string,
    options?: MultiCategorySyncOptions
  ): Promise<SyncResponse> {
    try {
      const payload = {
        merchantId,
        storeId,
        integrationId,
        tenantId,
        options
      };

      console.log('📤 发送菜单分类同步请求', {
        url: `${this.baseUrl}/api/uber/v1/store/menu/sync-with-menu-categories`,
        menuType: options?.menuType || 'MENU_TYPE_FULFILLMENT_DELIVERY',
        includePickup: options?.includePickup || false,
        payload,
      });

      const response = await httpService.post(
        `${this.baseUrl}/api/uber/v1/store/menu/sync-with-menu-categories`,
        payload
      )

      const responseData = response.data as any

      // 后端返回 { success: true, data: { message, stats } }
      const result = {
        success: responseData?.success || false,
        message: responseData?.data?.message || '菜单分类同步成功',
        stats: responseData?.data?.stats || {},
      };

      console.log('✅ 菜单分类同步响应', {
        menuType: options?.menuType || 'MENU_TYPE_FULFILLMENT_DELIVERY',
        success: result.success,
        stats: result.stats,
      });

      if (result.success && responseData?.data) {
        return result as any
      }

      throw new Error(responseData?.error || '菜单分类同步失败')
    } catch (error: any) {
      console.error('❌ 菜单分类同步失败:', {
        menuType: options?.menuType || 'MENU_TYPE_FULFILLMENT_DELIVERY',
        error: error?.message,
        status: error?.response?.status,
        responseData: error?.response?.data,
      })
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '菜单分类同步失败'
      )
    }
  }

  /**
   * 基于多分类配置同步菜单到 Uber
   * 支持商品属于多个分类
   */
  async syncWithMultiCategories(
    merchantId: string,
    storeId: string,
    integrationId: string,
    tenantId: string,
    options?: MultiCategorySyncOptions
  ): Promise<SyncResponse> {
    try {
      const response = await httpService.post(
        `${this.baseUrl}/api/uber/v1/store/menu/sync-with-multi-categories`,
        {
          merchantId,
          storeId,
          integrationId,
          tenantId,
          options
        }
      )

      const responseData = response.data as any

      // 后端返回 { success: true, data: { message, stats } }
      const result = {
        success: responseData?.success || false,
        message: responseData?.data?.message || '多分类菜单同步成功',
        stats: responseData?.data?.stats || {},
      };

      if (result.success && responseData?.data) {
        return result as any
      }

      throw new Error(responseData?.error || '多分类菜单同步失败')
    } catch (error: any) {
      console.error('多分类菜单同步失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '多分类菜单同步失败'
      )
    }
  }

  /**
   * 从 Uber 获取菜单列表（诊断工具）
   * 用于检查菜单是否正确同步到 Uber
   */
  async getMenusFromUber(merchantId: string, storeId: string): Promise<any> {
    try {
      console.log('📋 正在从 Uber 获取菜单列表...', { merchantId, storeId });

      const response = await httpService.post(
        `${this.baseUrl}/api/uber/v1/store/menu/list-from-uber`,
        {
          merchantId,
          storeId,
        }
      );

      const responseData = response.data as any;

      console.log('✅ 获取 Uber 菜单列表成功:', {
        success: responseData?.success,
        menuCount: responseData?.data?.menus?.length || 0,
        menus: responseData?.data?.menus || [],
      });

      return responseData?.data || {};
    } catch (error: any) {
      console.error('❌ 获取 Uber 菜单列表失败:', {
        error: error?.message,
        status: error?.response?.status,
        responseData: error?.response?.data,
      });
      throw new Error(
        error?.response?.data?.message ||
          error?.message ||
          '获取 Uber 菜单列表失败'
      );
    }
  }

  /**
   * 获取菜单组列表
   */
  async getMenuGroups(storeId: string, integrationId: string): Promise<MenuGroup[]> {
    try {
      const response = await httpService.get<ApiResponse<MenuGroup[]>>(
        `${this.baseUrl}/api/uber/v1/stores/${storeId}/menu-groups?integrationId=${integrationId}`
      )

      const responseData = response.data as any

      if (responseData?.data) {
        return responseData.data
      }

      return []
    } catch (error: any) {
      console.error('获取菜单组列表失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '获取菜单组列表失败'
      )
    }
  }

  /**
   * 获取单个菜单组
   */
  async getMenuGroup(storeId: string, groupId: string): Promise<MenuGroup> {
    try {
      const response = await httpService.get<ApiResponse<MenuGroup>>(
        `${this.baseUrl}/api/uber/v1/stores/${storeId}/menu-groups/${groupId}`
      )

      const responseData = response.data as any

      if (responseData?.data) {
        return responseData.data
      }

      throw new Error('获取菜单组失败')
    } catch (error: any) {
      console.error('获取菜单组失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '获取菜单组失败'
      )
    }
  }

  /**
   * 创建菜单组
   */
  async createMenuGroup(
    storeId: string,
    integrationId: string,
    dto: CreateMenuGroupDto
  ): Promise<MenuGroup> {
    try {
      const response = await httpService.post<ApiResponse<MenuGroup>>(
        `${this.baseUrl}/api/uber/v1/stores/${storeId}/menu-groups`,
        { integrationId, ...dto }
      )

      const responseData = response.data as any

      if (responseData?.data) {
        return responseData.data
      }

      throw new Error('创建菜单组失败')
    } catch (error: any) {
      console.error('创建菜单组失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '创建菜单组失败'
      )
    }
  }

  /**
   * 更新菜单组
   */
  async updateMenuGroup(
    storeId: string,
    groupId: string,
    dto: CreateMenuGroupDto
  ): Promise<MenuGroup> {
    try {
      const response = await httpService.put<ApiResponse<MenuGroup>>(
        `${this.baseUrl}/api/uber/v1/stores/${storeId}/menu-groups/${groupId}`,
        dto
      )

      const responseData = response.data as any

      if (responseData?.data) {
        return responseData.data
      }

      throw new Error('更新菜单组失败')
    } catch (error: any) {
      console.error('更新菜单组失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '更新菜单组失败'
      )
    }
  }

  /**
   * 删除菜单组
   */
  async deleteMenuGroup(storeId: string, groupId: string): Promise<void> {
    try {
      await httpService.delete(
        `${this.baseUrl}/api/uber/v1/stores/${storeId}/menu-groups/${groupId}`
      )
    } catch (error: any) {
      console.error('删除菜单组失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '删除菜单组失败'
      )
    }
  }

  /**
   * 获取菜单的分类列表
   */
  async getMenuGroupCategories(storeId: string, menuGroupId: string): Promise<any[]> {
    try {
      const response = await httpService.get<ApiResponse<any[]>>(
        `${this.baseUrl}/api/uber/v1/stores/${storeId}/menu-groups/${menuGroupId}/categories`
      )

      const responseData = response.data as any

      if (responseData?.data) {
        return responseData.data
      }

      return []
    } catch (error: any) {
      console.error('获取菜单分类失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '获取菜单分类失败'
      )
    }
  }

  /**
   * 添加分类到菜单组
   */
  async addCategoryToMenuGroup(
    storeId: string,
    menuGroupId: string,
    categoryId: string,
    integrationId: string
  ): Promise<any> {
    try {
      const response = await httpService.post<ApiResponse<any>>(
        `${this.baseUrl}/api/uber/v1/stores/${storeId}/menu-groups/${menuGroupId}/categories`,
        { categoryId, integrationId }
      )

      const responseData = response.data as any

      if (responseData?.data) {
        return responseData.data
      }

      throw new Error('添加分类失败')
    } catch (error: any) {
      console.error('添加分类失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '添加分类失败'
      )
    }
  }

  /**
   * 从菜单组中删除分类
   */
  async removeCategoryFromMenuGroup(
    storeId: string,
    menuGroupId: string,
    categoryId: string
  ): Promise<void> {
    try {
      await httpService.delete(
        `${this.baseUrl}/api/uber/v1/stores/${storeId}/menu-groups/${menuGroupId}/categories/${categoryId}`
      )
    } catch (error: any) {
      console.error('删除分类失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '删除分类失败'
      )
    }
  }

  /**
   * 重新排序菜单中的分类
   */
  async reorderMenuGroupCategories(
    storeId: string,
    menuGroupId: string,
    categoryIds: string[]
  ): Promise<any[]> {
    try {
      const response = await httpService.put<ApiResponse<any[]>>(
        `${this.baseUrl}/api/uber/v1/stores/${storeId}/menu-groups/${menuGroupId}/categories/reorder`,
        { categoryIds }
      )

      const responseData = response.data as any

      if (responseData?.data) {
        return responseData.data
      }

      return []
    } catch (error: any) {
      console.error('重新排序分类失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '重新排序分类失败'
      )
    }
  }

  /**
   * 同步菜单组到 Uber（配送和自取双菜单）
   */
  async syncMenuGroupsToUber(
    storeId: string,
    merchantId: string,
    integrationId: string,
    includePickup: boolean = false
  ): Promise<SyncMenuGroupsResponse> {
    try {
      const response = await httpService.post<ApiResponse<SyncMenuGroupsResponse>>(
        `${this.baseUrl}/api/uber/v1/stores/${storeId}/menu-groups/sync`,
        { merchantId, storeId, integrationId, includePickup }
      )

      const responseData = response.data as any

      if (responseData?.data) {
        return responseData.data
      }

      throw new Error('同步菜单组失败')
    } catch (error: any) {
      console.error('同步菜单组失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '同步菜单组失败'
      )
    }
  }

  /**
   * 清理菜单
   * 根据 Uber 官方文档，使用空菜单对象清理菜单中的所有商品、分类和自定义选项
   */
  async clearMenuItems(
    merchantId: string,
    storeId: string,
    integrationId: string,
    menuType: string = 'MENU_TYPE_FULFILLMENT_DELIVERY'
  ): Promise<{
    success: boolean
    message: string
  }> {
    try {
      const response = await httpService.post<ApiResponse>(
        `${this.baseUrl}/api/uber/v1/store/menu/clear`,
        {
          merchantId,
          storeId,
          integrationId,
          menuType
        }
      )

      const responseData = response.data as any

      return {
        success: responseData?.success || false,
        message: responseData?.message || '菜单清理完成'
      }
    } catch (error: any) {
      console.error('清理菜单失败:', error)
      throw new Error(
        error?.response?.data?.message ||
        error?.message ||
        '清理菜单失败'
      )
    }
  }
}

/**
 * 菜单配置项接口
 */
export interface MenuConfigItem {
  posItemId: string
  posItemName: string
  posDescription?: string
  posPrice: number
  posCategoryId?: string
  posCategoryName?: string
  isActive: boolean
  enabled: boolean
  uberPrice?: number
  effectivePrice: number
  lastSyncedAt?: string
  syncStatus?: string
  syncError?: string
}

/**
 * 同步历史项接口
 */
export interface SyncHistoryItem {
  id: string
  syncType: string
  itemCount: number
  categoryCount: number
  modifierGroupCount: number
  success: boolean
  errorMessage?: string
  syncedAt: string
}

/**
 * 自定义选项配置项接口
 */
export interface ModifierConfigItem {
  posItemId: string
  modifierGroupId: string
  modifierGroupName: string
  modifierOptionId: string
  modifierOptionName: string
  posPrice: number
  enabled: boolean
  uberPrice?: number
  effectivePrice: number
}

/**
 * 多分类同步选项接口
 */
export interface MultiCategorySyncOptions {
  menuType?: string
  locale?: string
  menuTitle?: string
  includePickup?: boolean
}

/**
 * 菜单组接口
 */
export interface MenuGroup {
  id: string
  integrationId: string
  name: string
  displayOrder: number
  serviceAvailability?: {
    [dayOfWeek: string]: Array<{
      startTime: string
      endTime: string
    }>
  }
  categories: Array<{
    id: string
    categoryId: string
    category: {
      id: string
      name: string
      displayOrder: number
    }
    displayOrder: number
  }>
  lastSyncedAt?: string
  syncStatus?: string
  syncError?: string
  createdAt: string
  updatedAt: string
}

/**
 * 创建/更新菜单组请求体
 */
export interface CreateMenuGroupDto {
  name?: string
  displayOrder?: number
  serviceAvailability?: {
    [dayOfWeek: string]: Array<{
      startTime: string
      endTime: string
    }>
  }
  categoryIds?: string[]
}

/**
 * 同步菜单组响应
 */
export interface SyncMenuGroupsResponse {
  success: boolean
  message: string
  results: {
    delivery: {
      success: boolean
      message: string
      menuType: string
    }
    pickup?: {
      success: boolean
      message: string
      menuType: string
    }
  }
}

export const uberMenuSyncService = new UberMenuSyncService()
