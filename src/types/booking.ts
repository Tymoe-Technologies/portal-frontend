// ─── Resource Types ──────────────────────────────────────────────────
export type ResourceType =
  | 'TABLE'
  | 'ROOM'
  | 'BED'
  | 'CHAIR'
  | 'DOCTOR'
  | 'INSTRUCTOR'
  | 'CLASS'
  | 'TIMESLOT'

// ─── Booking Status ──────────────────────────────────────────────────
export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'FAILED'

// ─── Deposit Status ──────────────────────────────────────────────────
export type DepositStatus = 'PENDING' | 'CAPTURED' | 'REFUNDED' | 'FAILED'

// ─── Frontend Models ─────────────────────────────────────────────────
export interface BookableResource {
  id: string
  orgId: string
  name: string
  type: ResourceType
  description?: string
  capacity?: number
  isActive: boolean
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface Booking {
  id: string
  orgId: string
  resourceId: string
  resourceName: string
  resourceType: ResourceType
  customerName: string
  customerPhone: string
  customerEmail?: string
  date: string
  startTime: string
  endTime: string
  partySize?: number
  status: BookingStatus
  notes?: string
  internalNotes?: string
  depositRequired?: boolean
  depositAmount?: number
  depositStatus?: DepositStatus
  stripeSessionUrl?: string
  cancelReason?: string
  createdAt: string
}

export interface BookingSettings {
  orgId: string
  businessName: string
  openTime: string
  closeTime: string
  advanceBookingDays: number
  slotDurationMinutes: number
  requireStaffSelection: boolean
  allowWalkIn: boolean
  autoConfirm: boolean
  maxPartySize: number
  allowAutoAssignment: boolean
  resourceType?: ResourceType
  depositRequired?: boolean
  depositAmount?: number
}

export interface PublicOrgConfig {
  settings: BookingSettings
  resources: BookableResource[]
  primaryResourceType: ResourceType
  brandColor?: string
  logoText?: string
  tagline?: string
}

export interface DashboardStats {
  todayBookings: number
  confirmedBookings: number
  pendingBookings: number
  cancelledBookings: number
  totalResources: number
  activeResources: number
  utilizationRate: number
}

// ─── Backend DTOs ────────────────────────────────────────────────────
export interface BackendBookingSettings {
  id: string
  organizationId: string
  resourceType: ResourceType
  openingTime: string
  closingTime: string
  slotDuration: number
  advanceBookingDays: number
  maxPartySize: number
  requireStaffSelection: boolean
  allowWalkIn: boolean
  autoConfirm: boolean
  allowAutoAssignment: boolean
  depositRequired: boolean
  depositAmount: number
  createdAt: string
  updatedAt: string
}

export interface BackendResource {
  id: string
  organizationId: string
  name: string
  resourceType: ResourceType
  description?: string
  capacity: number
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'MAINTENANCE'
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface BackendBooking {
  id: string
  organizationId: string
  resourceId: string
  resource?: BackendResource
  customerName: string
  customerPhone: string
  customerEmail?: string
  bookingDate: string
  bookingTime: string
  duration: number
  partySize?: number
  status: BookingStatus
  notes?: string
  internalNotes?: string
  depositRequired: boolean
  depositAmount?: number
  depositStatus?: DepositStatus
  stripeSessionUrl?: string
  cancelReason?: string
  createdAt: string
  updatedAt: string
}

// ─── Constants ───────────────────────────────────────────────────────
export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  TABLE: 'Table',
  ROOM: 'Room',
  BED: 'Bed',
  CHAIR: 'Chair',
  DOCTOR: 'Doctor',
  INSTRUCTOR: 'Instructor',
  CLASS: 'Class',
  TIMESLOT: 'Time Slot',
}

export const RESOURCE_TYPE_ICONS: Record<ResourceType, string> = {
  TABLE: 'UtensilsCrossed',
  ROOM: 'DoorOpen',
  BED: 'BedDouble',
  CHAIR: 'Armchair',
  DOCTOR: 'Stethoscope',
  INSTRUCTOR: 'GraduationCap',
  CLASS: 'Users',
  TIMESLOT: 'Clock',
}

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  PENDING: 'orange',
  CONFIRMED: 'green',
  CANCELLED: 'red',
  COMPLETED: 'default',
  NO_SHOW: 'purple',
  FAILED: 'error',
}

export const DEPOSIT_STATUS_COLORS: Record<DepositStatus, string> = {
  PENDING: 'orange',
  CAPTURED: 'green',
  REFUNDED: 'blue',
  FAILED: 'red',
}
