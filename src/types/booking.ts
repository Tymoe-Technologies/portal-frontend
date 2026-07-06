// ─── Resource Types ──────────────────────────────────────────────────
export type ResourceType = 'TABLE' | 'SPACE' | 'PRODUCT' | 'PERSON'

// ─── Booking Status ──────────────────────────────────────────────────
export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'FAILED'

// ─── Deposit Status ──────────────────────────────────────────────────
export type DepositStatus = 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'REFUNDED' | 'FAILED'

// ─── Table Config ────────────────────────────────────────────────────
export interface TableConfig {
  minCapacity: number
  maxCapacity: number
  shape: 'round' | 'square' | 'long'
  location?: 'indoor' | 'outdoor' | 'window' | 'bar'
  combinable?: boolean
  rotation?: number  // 旋转角度（度），步进 90
}

// ─── Space Config ────────────────────────────────────────────────────
export interface SpaceConfig {
  capacity: number
  minDurationMinutes: number
  maxDurationMinutes?: number
  hourlyRate?: number
  amenities?: string[]
}

// ─── Product Config ──────────────────────────────────────────────────
// 注意：关联人员/空间通过 ResourceAssignment 表维护，不再存于 config
export interface ProductConfig {
  durationMinutes: number
  price: number
  maxGroupSize: number
  requiresPerson: boolean
  requiresSpace: boolean
  depositEnabled?: boolean
  depositAmount?: number
}

// ─── Person Config ───────────────────────────────────────────────────
// 注意：可提供的服务通过 ResourceAssignment 表维护，不再存于 config
export interface PersonConfig {
  weeklySchedule?: {
    mon?: Array<{ start: string; end: string }>
    tue?: Array<{ start: string; end: string }>
    wed?: Array<{ start: string; end: string }>
    thu?: Array<{ start: string; end: string }>
    fri?: Array<{ start: string; end: string }>
    sat?: Array<{ start: string; end: string }>
    sun?: Array<{ start: string; end: string }>
  }
  maxConcurrent?: number
  breakMinutes?: number
  skills?: string[]  // 技能列表（如：["烫", "染", "剪"]）
  gender?: 'male' | 'female' | 'non-binary' | 'not-specified'  // 性别
  title?: string  // 职称
}

// ─── Frontend Models ─────────────────────────────────────────────────
export interface BookableResource {
  id: string
  orgId: string
  name: string
  resourceType: ResourceType
  description?: string
  imageUrl?: string
  config?: TableConfig | SpaceConfig | ProductConfig | PersonConfig | null
  // TABLE 专用位置字段
  floorPlanId?: string | null
  posX?: number | null
  posY?: number | null
  // PERSON 专用：关联员工账号
  staffId?: string | null
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE'
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

// ─── Floor Plan ──────────────────────────────────────────────────────
export interface FloorPlan {
  id: string
  orgId: string
  name: string
  isDefault: boolean
  width: number
  height: number
  isActive: boolean
  sortOrder: number
  tables: BookableResource[]
  createdAt: string
  updatedAt: string
}

// ─── Booking ─────────────────────────────────────────────────────────
export interface Booking {
  id: string
  orgId: string
  primaryResourceId: string
  primaryResource?: BookableResource
  personId?: string
  person?: BookableResource
  spaceId?: string
  space?: BookableResource
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
  cancelReason?: string
  createdAt: string
}

// ─── TABLE 营业时段配置 ────────────────────────────────────────────────
export interface OperatingPeriod {
  name?: string
  start: string    // "HH:mm"
  end: string      // "HH:mm"
  days?: number[]  // 0=周日, 1=周一…6=周六；空/undefined 表示每天
}

export interface TableSettingsConfig {
  operatingPeriods?: OperatingPeriod[]
  autoAccept?: boolean
  autoAcceptCutoffMinutes?: number
  autoAssignSeat?: boolean
}

// ─── Booking Settings ────────────────────────────────────────────────
export interface BookingSettings {
  orgId?: string
  businessName?: string
  openTime: string
  closeTime: string
  advanceBookingDays: number
  minAdvanceHours?: number
  requireCustomerPhone?: boolean
  requireCustomerEmail?: boolean
  depositEnabled?: boolean
  depositAmount?: number
  slotDurationMinutes?: number
  allowWalkIn?: boolean
  autoConfirm?: boolean
  requireStaffSelection?: boolean
  allowAutoAssignment?: boolean
  maxPartySize?: number
  tableConfig?: TableSettingsConfig
}

// ─── Backend DTOs ────────────────────────────────────────────────────
export interface BackendBookingSettings {
  id: string
  orgId: string
  openingTime: string
  closingTime: string
  advanceBookingDays: number
  minAdvanceHours: number
  slotDurationMinutes: number
  requireCustomerPhone: boolean
  requireCustomerEmail: boolean
  depositEnabled: boolean
  depositAmount?: number
  tableConfig?: TableSettingsConfig
  cancellationPolicy?: unknown
  createdAt: string
  updatedAt: string
}

export interface BackendResource {
  id: string
  orgId: string
  name: string
  resourceType: ResourceType
  description?: string
  imageUrl?: string
  config?: unknown
  floorPlanId?: string | null
  posX?: number | null
  posY?: number | null
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE'
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface BackendBooking {
  id: string
  orgId: string
  primaryResourceId: string
  primaryResource?: BackendResource
  personId?: string
  person?: BackendResource
  spaceId?: string
  space?: BackendResource
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
  cancelReason?: string
  createdAt: string
  updatedAt: string
}

// ─── Constants ───────────────────────────────────────────────────────
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
  AUTHORIZED: 'blue',
  CAPTURED: 'green',
  REFUNDED: 'cyan',
  FAILED: 'red',
}
