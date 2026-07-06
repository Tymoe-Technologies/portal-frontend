import axios from 'axios'
import { httpService } from '../http'
import type {
  BackendBookingSettings,
  BackendResource,
  BackendBooking,
  BookingSettings,
  BookableResource,
  Booking,
  FloorPlan,
} from '@/types/booking'
import { mapSettings, mapSettingsToBackend, mapResource, mapResourceToBackend, mapBooking } from './mappers'

const BASE = '/api/booking-service/v1'

// Unwrap { success, data } envelope from booking-service responses
function unwrap<T>(response: { data: { success?: boolean; data?: T } }): T {
  const body = response.data as { success?: boolean; data?: T }
  if (body && typeof body === 'object' && 'data' in body) {
    return body.data as T
  }
  return body as unknown as T
}

// ─── Settings API ────────────────────────────────────────────────────

export const settingsApi = {
  async get(orgName?: string): Promise<BookingSettings> {
    const raw = unwrap<BackendBookingSettings>(await httpService.get(`${BASE}/settings`))
    return mapSettings(raw, orgName)
  },

  async update(settings: Partial<BookingSettings>): Promise<BookingSettings> {
    const payload = mapSettingsToBackend(settings)
    const raw = unwrap<BackendBookingSettings>(await httpService.put(`${BASE}/settings`, payload))
    return mapSettings(raw)
  },
}

// ─── Resources API ───────────────────────────────────────────────────

export const resourcesApi = {
  async list(query?: { type?: string; status?: string }): Promise<BookableResource[]> {
    const params = new URLSearchParams()
    if (query?.type) params.set('type', query.type)
    if (query?.status) params.set('status', query.status)
    const qs = params.toString() ? `?${params}` : ''
    const raw = unwrap<BackendResource[]>(await httpService.get(`${BASE}/resources${qs}`))
    return (raw ?? []).map(mapResource)
  },

  async create(resource: Partial<BookableResource>): Promise<BookableResource> {
    const payload = mapResourceToBackend(resource)
    const raw = unwrap<BackendResource>(await httpService.post(`${BASE}/resources`, payload))
    return mapResource(raw)
  },

  async update(id: string, resource: Partial<BookableResource>): Promise<BookableResource> {
    const payload = mapResourceToBackend(resource)
    const raw = unwrap<BackendResource>(await httpService.put(`${BASE}/resources/${id}`, payload))
    return mapResource(raw)
  },

  async delete(id: string): Promise<void> {
    await httpService.delete(`${BASE}/resources/${id}`)
  },

  async uploadImage(id: string, file: File): Promise<{ resource: BookableResource; image: { url: string; publicId: string } }> {
    const formData = new FormData()
    formData.append('image', file)
    const response = await httpService.post<{ success?: boolean; data?: { resource: BackendResource; image: { url: string; publicId: string } } }>(
      `${BASE}/resources/${id}/image`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    const data = unwrap<{ resource: BackendResource; image: { url: string; publicId: string } }>(response)
    return {
      resource: mapResource(data.resource),
      image: data.image,
    }
  },
}

// ─── ResourceAssignment API ──────────────────────────────────────────

export interface ResourceAssignment {
  id: string
  orgId: string
  productId: string
  resourceId: string
  priceOverride: number | null
  resource: { id: string; name: string; resourceType: string }
  createdAt: string
  updatedAt: string
}

export const assignmentsApi = {
  // 获取某 PRODUCT 的所有关联（人员/空间）
  async list(productId: string): Promise<ResourceAssignment[]> {
    return unwrap<ResourceAssignment[]>(
      await httpService.get(`${BASE}/resources/${productId}/assignments`)
    ) ?? []
  },

  // 全量同步（PUT 替换）
  async sync(
    productId: string,
    assignments: { resourceId: string; priceOverride?: number | null }[],
  ): Promise<ResourceAssignment[]> {
    return unwrap<ResourceAssignment[]>(
      await httpService.put(`${BASE}/resources/${productId}/assignments`, { assignments })
    ) ?? []
  },

  // 新增单条
  async add(productId: string, resourceId: string, priceOverride?: number | null): Promise<ResourceAssignment> {
    return unwrap<ResourceAssignment>(
      await httpService.post(`${BASE}/resources/${productId}/assignments`, { resourceId, priceOverride })
    )
  },

  // 删除单条
  async remove(productId: string, resourceId: string): Promise<void> {
    await httpService.delete(`${BASE}/resources/${productId}/assignments/${resourceId}`)
  },
}

// ─── Bookings API ────────────────────────────────────────────────────

export const bookingsApi = {
  async list(query?: { status?: string; date?: string; search?: string }): Promise<Booking[]> {
    const params = new URLSearchParams()
    if (query?.status) params.set('status', query.status)
    if (query?.date) params.set('date', query.date)
    if (query?.search) params.set('search', query.search)
    const qs = params.toString() ? `?${params}` : ''
    const raw = unwrap<{ bookings: BackendBooking[]; pagination: unknown } | BackendBooking[]>(
      await httpService.get(`${BASE}/bookings${qs}`)
    )
    // 后端返回 { bookings: [], pagination: {} } 或直接数组
    const list = Array.isArray(raw) ? raw : (raw as { bookings: BackendBooking[] })?.bookings ?? []
    return list.map(mapBooking)
  },

  async create(data: Record<string, unknown>): Promise<Booking> {
    const raw = unwrap<BackendBooking>(await httpService.post(`${BASE}/bookings`, data))
    return mapBooking(raw)
  },

  async updateStatus(id: string, status: string, notes?: string): Promise<Booking> {
    const raw = unwrap<BackendBooking>(
      await httpService.put(`${BASE}/bookings/${id}/status`, { status, internalNotes: notes })
    )
    return mapBooking(raw)
  },

  async cancel(id: string, reason: string, refundPercent?: number): Promise<Booking> {
    const raw = unwrap<BackendBooking>(
      await httpService.put(`${BASE}/bookings/${id}/cancel`, { cancelReason: reason, refundPercent })
    )
    return mapBooking(raw)
  },
}

// ─── Availability API ────────────────────────────────────────────────

export const availabilityApi = {
  async check(date: string, partySize?: number) {
    const params = new URLSearchParams({ date })
    if (partySize) params.set('partySize', String(partySize))
    return unwrap(await httpService.get(`${BASE}/availability?${params}`))
  },

  // 查询 TABLE 模式的最大可接待人数
  async getCapacity(): Promise<{ maxPartySize: number; tableCount: number }> {
    return unwrap(await httpService.get(`${BASE}/availability/capacity`))
  },
}

// ─── Floor Plan API ──────────────────────────────────────────────────

export const floorPlanApi = {
  async list(): Promise<FloorPlan[]> {
    return unwrap<FloorPlan[]>(await httpService.get(`${BASE}/floor-plans`)) ?? []
  },

  async get(id: string): Promise<FloorPlan> {
    return unwrap<FloorPlan>(await httpService.get(`${BASE}/floor-plans/${id}`))
  },

  async create(data: { name: string; width?: number; height?: number }): Promise<FloorPlan> {
    return unwrap<FloorPlan>(await httpService.post(`${BASE}/floor-plans`, data))
  },

  async update(id: string, data: { name?: string; width?: number; height?: number }): Promise<FloorPlan> {
    return unwrap<FloorPlan>(await httpService.put(`${BASE}/floor-plans/${id}`, data))
  },

  async setDefault(id: string): Promise<FloorPlan> {
    return unwrap<FloorPlan>(await httpService.put(`${BASE}/floor-plans/${id}/set-default`, {}))
  },

  async delete(id: string): Promise<void> {
    await httpService.delete(`${BASE}/floor-plans/${id}`)
  },

  // 桌位操作
  async addTable(
    floorPlanId: string,
    data: { name?: string; shape?: string; minCapacity?: number; maxCapacity?: number; posX?: number; posY?: number }
  ): Promise<BookableResource> {
    const raw = unwrap<BackendResource>(await httpService.post(`${BASE}/floor-plans/${floorPlanId}/tables`, data))
    return mapResource(raw)
  },

  async savePositions(
    floorPlanId: string,
    updates: Array<{ id: string; posX: number; posY: number }>
  ): Promise<void> {
    await httpService.put(`${BASE}/floor-plans/${floorPlanId}/tables/positions`, { updates })
  },

  async updateTable(
    floorPlanId: string,
    tableId: string,
    data: { name?: string; config?: unknown; status?: string; isActive?: boolean }
  ): Promise<BookableResource> {
    const raw = unwrap<BackendResource>(
      await httpService.put(`${BASE}/floor-plans/${floorPlanId}/tables/${tableId}`, data)
    )
    return mapResource(raw)
  },

  async removeTable(floorPlanId: string, tableId: string): Promise<void> {
    await httpService.delete(`${BASE}/floor-plans/${floorPlanId}/tables/${tableId}`)
  },
}

// ─── Organization Profile API ───────────────────────────────────────

export interface OrganizationProfile {
  id: string
  orgId: string
  slug: string
  displayName?: string
  logoUrl?: string
  description?: string
  createdAt: string
  updatedAt: string
}

export const orgProfileApi = {
  async get(): Promise<OrganizationProfile> {
    return unwrap<OrganizationProfile>(await httpService.get(`${BASE}/org-profile`))
  },

  async update(data: {
    slug?: string
    displayName?: string
    logoUrl?: string
    description?: string
  }): Promise<OrganizationProfile> {
    return unwrap<OrganizationProfile>(await httpService.put(`${BASE}/org-profile`, data))
  },

  async checkSlug(slug: string): Promise<{ slug: string; available: boolean }> {
    return unwrap<{ slug: string; available: boolean }>(
      await httpService.get(`${BASE}/org-profile/check-slug?slug=${slug}`)
    )
  },
}

// ─── Public API (C-end, sends X-Org-Id manually via raw axios) ───────

const publicClient = axios.create({ timeout: 10000 })

export const publicApi = {
  async createBooking(orgId: string, data: Record<string, unknown>) {
    return publicClient.post(`${BASE}/public/bookings`, data, {
      headers: { 'X-Org-Id': orgId },
    })
  },

  async getBooking(id: string, token: string) {
    return publicClient.get(`${BASE}/public/bookings/${id}?token=${token}`)
  },

  async getAvailability(orgId: string, date: string, partySize?: number) {
    const params = new URLSearchParams({ date })
    if (partySize) params.set('partySize', String(partySize))
    return publicClient.get(`${BASE}/public/availability?${params}`, {
      headers: { 'X-Org-Id': orgId },
    })
  },

  async getSettings(orgId: string) {
    return publicClient.get(`${BASE}/public/settings`, {
      headers: { 'X-Org-Id': orgId },
    })
  },

  async getResources(orgId: string) {
    return publicClient.get(`${BASE}/public/resources`, {
      headers: { 'X-Org-Id': orgId },
    })
  },
}
