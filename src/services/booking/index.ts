import axios from 'axios'
import { httpService } from '../http'
import type {
  BackendBookingSettings,
  BackendResource,
  BackendBooking,
  BookingSettings,
  BookableResource,
  Booking,
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
}

// ─── Bookings API ────────────────────────────────────────────────────

export const bookingsApi = {
  async list(query?: { status?: string; date?: string; search?: string }): Promise<Booking[]> {
    const params = new URLSearchParams()
    if (query?.status) params.set('status', query.status)
    if (query?.date) params.set('date', query.date)
    if (query?.search) params.set('search', query.search)
    const qs = params.toString() ? `?${params}` : ''
    const raw = unwrap<BackendBooking[]>(await httpService.get(`${BASE}/bookings${qs}`))
    return (raw ?? []).map(mapBooking)
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
