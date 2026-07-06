import { httpService } from './http'

const API_BASE = (import.meta.env.VITE_ITEM_MANAGE_BASE as string | undefined) ?? 'http://localhost:3000/api/item-manage/v1'

// ==================== 类型定义 ====================

/** 时间调度（哪些天的哪个时段激活该菜单） */
export interface MenuSchedule {
  id: string
  menuId: string
  /** 星期几：0=周日, 1=周一, ..., 6=周六 */
  days: number[]
  /** 开始时间 HH:mm */
  startTime: string
  /** 结束时间 HH:mm（可小于 startTime，表示跨午夜） */
  endTime: string
}

/** 菜单分区内的商品 */
export interface MenuSectionItem {
  id: string
  sectionId: string
  catalogItemId: string
  /** 菜单内价格覆盖（分），null 则使用品牌目录 base_price */
  priceOverride: number | null
  isAvailable: boolean
  displayOrder: number
  /** 品牌目录商品信息（从后端 join 来） */
  catalogItem?: {
    id: string
    name: string
    basePrice: number
    imageUrl?: string
    category?: { id: string; name: string }
  }
}

/** 菜单分区 */
export interface MenuSection {
  id: string
  menuId: string
  name: string
  description?: string
  displayOrder: number
  isActive: boolean
  items: MenuSectionItem[]
}

/** 多菜单主体 */
export interface StoreMenu {
  id: string
  storeId: string
  name: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  schedules: MenuSchedule[]
  sections: MenuSection[]
}

// ==================== API 调用 ====================

/** 菜单列表 */
export async function getMenus(isActive?: boolean): Promise<StoreMenu[]> {
  const params: Record<string, string> = {}
  if (isActive !== undefined) params.isActive = String(isActive)
  const res = await httpService.get(`${API_BASE}/menus`, { params })
  return (res.data.menus || []).map(normalizeMenu)
}

/** 菜单详情（含商品信息） */
export async function getMenuById(id: string): Promise<StoreMenu> {
  const res = await httpService.get(`${API_BASE}/menus/${id}`)
  return normalizeMenu(res.data)
}

/** 当前时段所有激活菜单（可同时有多个） */
export async function getActiveMenus(): Promise<StoreMenu[]> {
  const res = await httpService.get(`${API_BASE}/menus/active-menus`)
  return (res.data.menus || []).map(normalizeMenu)
}

/** 创建菜单 */
export async function createMenu(data: {
  name: string
  description?: string
  schedules?: Array<{ days: number[]; startTime: string; endTime: string }>
}): Promise<StoreMenu> {
  const res = await httpService.post(`${API_BASE}/menus`, data)
  return normalizeMenu(res.data)
}

/** 更新菜单 */
export async function updateMenu(id: string, data: {
  name?: string
  description?: string
  isActive?: boolean
}): Promise<StoreMenu> {
  const res = await httpService.put(`${API_BASE}/menus/${id}`, data)
  return normalizeMenu(res.data)
}

/** 删除菜单 */
export async function deleteMenu(id: string): Promise<void> {
  await httpService.delete(`${API_BASE}/menus/${id}`)
}

/** 替换调度配置 */
export async function replaceSchedules(
  menuId: string,
  schedules: Array<{ days: number[]; startTime: string; endTime: string }>
): Promise<MenuSchedule[]> {
  const res = await httpService.put(`${API_BASE}/menus/${menuId}/schedules`, { schedules })
  return (res.data.schedules || []).map(normalizeSchedule)
}

/** 创建分区 */
export async function createSection(
  menuId: string,
  data: { name: string; description?: string; displayOrder?: number }
): Promise<MenuSection> {
  const res = await httpService.post(`${API_BASE}/menus/${menuId}/sections`, data)
  return normalizeSection(res.data)
}

/** 更新分区 */
export async function updateSection(
  menuId: string,
  sectionId: string,
  data: { name?: string; description?: string; displayOrder?: number; isActive?: boolean }
): Promise<MenuSection> {
  const res = await httpService.put(`${API_BASE}/menus/${menuId}/sections/${sectionId}`, data)
  return normalizeSection(res.data)
}

/** 删除分区 */
export async function deleteSection(menuId: string, sectionId: string): Promise<void> {
  await httpService.delete(`${API_BASE}/menus/${menuId}/sections/${sectionId}`)
}

/** 批量添加商品到分区 */
export async function addItemsToSection(
  menuId: string,
  sectionId: string,
  items: Array<{ catalogItemId: string; priceOverride?: number | null; displayOrder?: number }>
): Promise<MenuSectionItem[]> {
  const res = await httpService.post(`${API_BASE}/menus/${menuId}/sections/${sectionId}/items`, { items })
  return (res.data.items || []).map(normalizeSectionItem)
}

/** 更新分区商品 */
export async function updateSectionItem(
  menuId: string,
  sectionId: string,
  itemId: string,
  data: { priceOverride?: number | null; isAvailable?: boolean; displayOrder?: number }
): Promise<MenuSectionItem> {
  const res = await httpService.put(
    `${API_BASE}/menus/${menuId}/sections/${sectionId}/items/${itemId}`,
    data
  )
  return normalizeSectionItem(res.data)
}

/** 移除分区商品 */
export async function removeSectionItem(
  menuId: string,
  sectionId: string,
  itemId: string
): Promise<void> {
  await httpService.delete(`${API_BASE}/menus/${menuId}/sections/${sectionId}/items/${itemId}`)
}

// ==================== 数据规范化（snake_case → camelCase）====================

function normalizeSchedule(s: any): MenuSchedule {
  return {
    id: s.id,
    menuId: s.menu_id,
    days: s.days,
    startTime: s.start_time,
    endTime: s.end_time,
  }
}

function normalizeSectionItem(i: any): MenuSectionItem {
  return {
    id: i.id,
    sectionId: i.section_id,
    catalogItemId: i.catalog_item_id,
    priceOverride: i.price_override !== undefined ? Number(i.price_override) || null : null,
    isAvailable: i.is_available,
    displayOrder: i.display_order,
    catalogItem: i.catalogItem
      ? {
          id: i.catalogItem.id,
          name: i.catalogItem.name,
          basePrice: Number(i.catalogItem.base_price ?? i.catalogItem.basePrice ?? 0),
          imageUrl: i.catalogItem.image_url ?? i.catalogItem.imageUrl,
          category: i.catalogItem.category,
        }
      : undefined,
  }
}

function normalizeSection(s: any): MenuSection {
  return {
    id: s.id,
    menuId: s.menu_id,
    name: s.name,
    description: s.description ?? undefined,
    displayOrder: s.display_order,
    isActive: s.is_active,
    items: (s.items || []).map(normalizeSectionItem),
  }
}

function normalizeMenu(m: any): StoreMenu {
  return {
    id: m.id,
    storeId: m.store_id,
    name: m.name,
    description: m.description ?? undefined,
    isActive: m.is_active,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
    schedules: (m.schedules || []).map(normalizeSchedule),
    sections: (m.sections || []).map(normalizeSection),
  }
}
