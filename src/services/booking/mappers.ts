import type {
  BackendBookingSettings,
  BackendResource,
  BackendBooking,
  BookingSettings,
  BookableResource,
  Booking,
} from '@/types/booking'

/** Add minutes to a HH:MM time string */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// ─── Settings ────────────────────────────────────────────────────────

export function mapSettings(
  backend: BackendBookingSettings | null | undefined,
  orgName?: string
): BookingSettings {
  if (!backend) {
    return {
      businessName: orgName ?? '',
      openTime: '09:00',
      closeTime: '21:00',
      advanceBookingDays: 30,
      minAdvanceHours: 1,
      requireCustomerPhone: true,
      requireCustomerEmail: false,
      depositEnabled: false,
    }
  }
  return {
    orgId: backend.orgId,
    businessName: orgName ?? '',
    openTime: backend.openingTime,
    closeTime: backend.closingTime,
    advanceBookingDays: backend.advanceBookingDays,
    minAdvanceHours: backend.minAdvanceHours,
    requireCustomerPhone: backend.requireCustomerPhone,
    requireCustomerEmail: backend.requireCustomerEmail,
    depositEnabled: backend.depositEnabled,
    depositAmount: backend.depositAmount,
    slotDurationMinutes: backend.slotDurationMinutes ?? 60,
    tableConfig: backend.tableConfig,
  }
}

export function mapSettingsToBackend(
  frontend: Partial<BookingSettings>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (frontend.openTime !== undefined) out.openingTime = frontend.openTime
  if (frontend.closeTime !== undefined) out.closingTime = frontend.closeTime
  if (frontend.advanceBookingDays !== undefined) out.advanceBookingDays = frontend.advanceBookingDays
  if (frontend.minAdvanceHours !== undefined) out.minAdvanceHours = frontend.minAdvanceHours
  if (frontend.slotDurationMinutes !== undefined) out.slotDurationMinutes = frontend.slotDurationMinutes
  if (frontend.requireCustomerPhone !== undefined) out.requireCustomerPhone = frontend.requireCustomerPhone
  if (frontend.requireCustomerEmail !== undefined) out.requireCustomerEmail = frontend.requireCustomerEmail
  if (frontend.depositEnabled !== undefined) out.depositEnabled = frontend.depositEnabled
  if (frontend.depositAmount !== undefined) out.depositAmount = frontend.depositAmount
  if (frontend.tableConfig !== undefined) out.tableConfig = frontend.tableConfig
  return out
}

// ─── Resources ───────────────────────────────────────────────────────

export function mapResource(backend: BackendResource): BookableResource {
  return {
    id: backend.id,
    orgId: backend.orgId,
    name: backend.name,
    resourceType: backend.resourceType,
    description: backend.description,
    imageUrl: backend.imageUrl,
    config: backend.config as BookableResource['config'],
    floorPlanId: backend.floorPlanId,
    posX: backend.posX,
    posY: backend.posY,
    status: backend.status,
    isActive: backend.isActive,
    sortOrder: backend.sortOrder,
    createdAt: backend.createdAt,
    updatedAt: backend.updatedAt,
  }
}

export function mapResourceToBackend(
  frontend: Partial<BookableResource>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (frontend.name !== undefined) out.name = frontend.name
  if (frontend.resourceType !== undefined) out.resourceType = frontend.resourceType
  if (frontend.description !== undefined) out.description = frontend.description
  if (frontend.imageUrl !== undefined) out.imageUrl = frontend.imageUrl
  if (frontend.config !== undefined) out.config = frontend.config
  if (frontend.isActive !== undefined) out.isActive = frontend.isActive
  if (frontend.status !== undefined) out.status = frontend.status
  if (frontend.staffId !== undefined) out.staffId = frontend.staffId
  return out
}

// ─── Bookings ────────────────────────────────────────────────────────

export function mapBooking(backend: BackendBooking): Booking {
  return {
    id: backend.id,
    orgId: backend.orgId,
    primaryResourceId: backend.primaryResourceId,
    primaryResource: backend.primaryResource ? mapResource(backend.primaryResource) : undefined,
    personId: backend.personId,
    person: backend.person ? mapResource(backend.person) : undefined,
    spaceId: backend.spaceId,
    space: backend.space ? mapResource(backend.space) : undefined,
    customerName: backend.customerName,
    customerPhone: backend.customerPhone,
    customerEmail: backend.customerEmail,
    date: backend.bookingDate,
    startTime: backend.bookingTime,
    endTime: addMinutes(backend.bookingTime, backend.duration),
    partySize: backend.partySize,
    status: backend.status,
    notes: backend.notes,
    internalNotes: backend.internalNotes,
    depositRequired: backend.depositRequired,
    depositAmount: backend.depositAmount,
    depositStatus: backend.depositStatus,
    cancelReason: backend.cancelReason,
    createdAt: backend.createdAt,
  }
}
