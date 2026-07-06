import { httpService } from './http'

const API_BASE = (import.meta.env.VITE_ITEM_MANAGE_BASE as string | undefined) ?? 'http://localhost:3000/api/item-manage/v1'

export interface Supply {
  id: string
  brand_id: string
  name: string
  base_price: number   // 分，同 catalog_items.base_price
  cost?: number | null // 分
  image_url?: string | null
  sku?: string | null
  description?: string | null
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface SupplyListResponse {
  data: Supply[]
  total: number
  page: number
  limit: number
}

export interface CreateSupplyPayload {
  name: string
  base_price?: number   // 分
  cost?: number | null  // 分
  image_url?: string | null
  sku?: string | null
  description?: string | null
  is_active?: boolean
  display_order?: number
}

export type UpdateSupplyPayload = Partial<CreateSupplyPayload>

export async function getSupplies(params?: {
  is_active?: boolean
  page?: number
  limit?: number
}): Promise<SupplyListResponse> {
  const query = new URLSearchParams()
  if (params?.is_active !== undefined) query.set('is_active', String(params.is_active))
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  const url = `${API_BASE}/supplies${query.toString() ? `?${query}` : ''}`
  const res = await httpService.get<SupplyListResponse>(url)
  return res.data
}

export async function createSupply(payload: CreateSupplyPayload): Promise<Supply> {
  const res = await httpService.post<Supply>(`${API_BASE}/supplies`, payload)
  return res.data
}

export async function updateSupply(id: string, payload: UpdateSupplyPayload): Promise<Supply> {
  const res = await httpService.put<Supply>(`${API_BASE}/supplies/${id}`, payload)
  return res.data
}

export async function deleteSupply(id: string): Promise<void> {
  await httpService.delete(`${API_BASE}/supplies/${id}`)
}
