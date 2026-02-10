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
  backend: BackendBookingSettings,
  orgName?: string
): BookingSettings {
  return {
    orgId: backend.organizationId,
    businessName: orgName ?? '',
    openTime: backend.openingTime,
    closeTime: backend.closingTime,
    advanceBookingDays: backend.advanceBookingDays,
    slotDurationMinutes: backend.slotDuration,
    requireStaffSelection: backend.requireStaffSelection,
    allowWalkIn: backend.allowWalkIn,
    autoConfirm: backend.autoConfirm,
    maxPartySize: backend.maxPartySize,
    allowAutoAssignment: backend.allowAutoAssignment,
    resourceType: backend.resourceType,
    depositRequired: backend.depositRequired,
    depositAmount: backend.depositAmount,
  }
}

export function mapSettingsToBackend(
  frontend: Partial<BookingSettings>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (frontend.openTime !== undefined) out.openingTime = frontend.openTime
  if (frontend.closeTime !== undefined) out.closingTime = frontend.closeTime
  if (frontend.slotDurationMinutes !== undefined) out.slotDuration = frontend.slotDurationMinutes
  if (frontend.advanceBookingDays !== undefined) out.advanceBookingDays = frontend.advanceBookingDays
  if (frontend.maxPartySize !== undefined) out.maxPartySize = frontend.maxPartySize
  if (frontend.requireStaffSelection !== undefined) out.requireStaffSelection = frontend.requireStaffSelection
  if (frontend.allowWalkIn !== undefined) out.allowWalkIn = frontend.allowWalkIn
  if (frontend.autoConfirm !== undefined) out.autoConfirm = frontend.autoConfirm
  if (frontend.allowAutoAssignment !== undefined) out.allowAutoAssignment = frontend.allowAutoAssignment
  if (frontend.resourceType !== undefined) out.resourceType = frontend.resourceType
  if (frontend.depositRequired !== undefined) out.depositRequired = frontend.depositRequired
  if (frontend.depositAmount !== undefined) out.depositAmount = frontend.depositAmount
  return out
}

// ─── Resources ───────────────────────────────────────────────────────

export function mapResource(backend: BackendResource): BookableResource {
  return {
    id: backend.id,
    orgId: backend.organizationId,
    name: backend.name,
    type: backend.resourceType,
    description: backend.description,
    capacity: backend.capacity,
    isActive: backend.status === 'AVAILABLE',
    metadata: backend.metadata ?? {},
    createdAt: backend.createdAt,
    updatedAt: backend.updatedAt,
  }
}

export function mapResourceToBackend(
  frontend: Partial<BookableResource>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (frontend.name !== undefined) out.name = frontend.name
  if (frontend.type !== undefined) out.resourceType = frontend.type
  if (frontend.description !== undefined) out.description = frontend.description
  if (frontend.capacity !== undefined) out.capacity = frontend.capacity
  if (frontend.isActive !== undefined) out.status = frontend.isActive ? 'AVAILABLE' : 'UNAVAILABLE'
  if (frontend.metadata !== undefined) out.metadata = frontend.metadata
  return out
}

// ─── Bookings ────────────────────────────────────────────────────────

export function mapBooking(backend: BackendBooking): Booking {
  return {
    id: backend.id,
    orgId: backend.organizationId,
    resourceId: backend.resourceId,
    resourceName: backend.resource?.name ?? '',
    resourceType: backend.resource?.resourceType ?? 'TABLE',
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
    stripeSessionUrl: backend.stripeSessionUrl,
    cancelReason: backend.cancelReason,
    createdAt: backend.createdAt,
  }
}
