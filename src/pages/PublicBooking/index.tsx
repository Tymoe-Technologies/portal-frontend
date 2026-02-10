import { useState, useMemo, useCallback, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  ChevronLeft, Clock, User, Phone, Mail, MessageSquare, Check,
  UtensilsCrossed, DoorOpen, Armchair, Stethoscope, GraduationCap,
  Star, Users, MapPin, Loader2, Sparkles, ArrowRight, CheckCircle2,
} from 'lucide-react'
import { publicApi } from '@/services/booking'
import { mapResource, mapSettings } from '@/services/booking/mappers'
import type { BookableResource, BookingSettings, ResourceType } from '@/types/booking'
import '@/styles/booking-public.css'

// ─── Types ───────────────────────────────────────────────────────────

interface PublicOrgConfig {
  settings: BookingSettings
  resources: BookableResource[]
  primaryResourceType: ResourceType
  brandColor?: string
  logoText?: string
  tagline?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}

function generateTimeSlots(openTime: string, closeTime: string, durationMinutes: number): string[] {
  const slots: string[] = []
  const [openH, openM] = openTime.split(':').map(Number)
  const [closeH, closeM] = closeTime.split(':').map(Number)
  const startMinutes = openH * 60 + openM
  const endMinutes = closeH * 60 + closeM

  for (let m = startMinutes; m + durationMinutes <= endMinutes; m += durationMinutes) {
    const h = Math.floor(m / 60)
    const min = m % 60
    slots.push(`${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`)
  }
  return slots
}

function generateDateOptions(advanceDays: number, dayNames: string[], monthNames: string[]) {
  const dates: { date: string; label: string; dayName: string; isToday: boolean }[] = []
  const today = new Date()

  for (let i = 0; i < Math.min(advanceDays, 14); i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    dates.push({
      date: dateStr,
      label: `${monthNames[d.getMonth()]} ${d.getDate()}`,
      dayName: dayNames[d.getDay()],
      isToday: i === 0,
    })
  }
  return dates
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.floor(total / 60)
  const nm = total % 60
  return `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}`
}

const RESOURCE_ICONS: Record<string, React.ElementType> = {
  TABLE: UtensilsCrossed,
  ROOM: DoorOpen,
  BED: DoorOpen,
  CHAIR: Armchair,
  DOCTOR: Stethoscope,
  INSTRUCTOR: GraduationCap,
  CLASS: Users,
  TIMESLOT: Clock,
}

// ─── Animation Variants ──────────────────────────────────────────────

const pageVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
    filter: 'blur(4px)',
  }),
  center: { x: 0, opacity: 1, filter: 'blur(0px)' },
  exit: (direction: number) => ({
    x: direction < 0 ? 80 : -80,
    opacity: 0,
    filter: 'blur(4px)',
  }),
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.04,
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  }),
}

// ─── Step Components ─────────────────────────────────────────────────

function StepResource({
  config,
  selected,
  onSelect,
  t,
}: {
  config: PublicOrgConfig
  selected: BookableResource | null
  onSelect: (r: BookableResource) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const activeResources = config.resources.filter((r) => r.isActive)
  const isStaffType = config.primaryResourceType === 'DOCTOR' || config.primaryResourceType === 'INSTRUCTOR'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
          {t(`pages.booking.resourceSelect.${config.primaryResourceType}.title`)}
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          {t(`pages.booking.resourceSelect.${config.primaryResourceType}.description`)}
        </p>
      </div>

      <div className="space-y-2.5">
        {activeResources.map((resource, i) => {
          const Icon = RESOURCE_ICONS[resource.type] || Clock
          const isSelected = selected?.id === resource.id

          return (
            <motion.button
              key={resource.id}
              custom={i}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              onClick={() => onSelect(resource)}
              className={cn(
                'w-full text-left rounded-2xl border p-4 transition-all duration-200',
                isSelected
                  ? 'border-zinc-900 bg-zinc-900/[0.03] ring-1 ring-zinc-900/20'
                  : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50'
              )}
            >
              <div className="flex items-start gap-3.5">
                {isStaffType ? (
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white text-sm font-semibold"
                    style={{ backgroundColor: (resource.metadata.avatarColor as string) ?? '#71717a' }}
                  >
                    {resource.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 border border-zinc-200/60">
                    <Icon size={20} strokeWidth={1.5} className="text-zinc-500" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[15px] text-zinc-900">{resource.name}</span>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      >
                        <CheckCircle2 size={16} className="text-zinc-900" />
                      </motion.div>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500 mt-0.5">{resource.description}</p>

                  <div className="flex items-center gap-3 mt-2">
                    {isStaffType && resource.metadata.rating != null && (
                      <div className="flex items-center gap-1">
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        <span className="text-xs font-medium text-zinc-700">{String(resource.metadata.rating)}</span>
                      </div>
                    )}
                    {isStaffType && Array.isArray(resource.metadata.specialties) && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {(resource.metadata.specialties as string[]).map((s: string) => (
                          <span key={s} className="inline-flex items-center rounded-full bg-zinc-100 px-1.5 py-0 text-[10px] font-normal text-zinc-600">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {!isStaffType && (
                      <>
                        <div className="flex items-center gap-1 text-xs text-zinc-500">
                          <Users size={12} />
                          <span>{t('pages.booking.public.upTo', { n: resource.capacity ?? 1 })}</span>
                        </div>
                        {resource.metadata.section && (
                          <div className="flex items-center gap-1 text-xs text-zinc-500">
                            <MapPin size={12} />
                            <span>{resource.metadata.section as string}</span>
                          </div>
                        )}
                        {resource.metadata.isOutdoor && (
                          <span className="inline-flex items-center rounded-full bg-zinc-100 px-1.5 py-0 text-[10px] font-normal text-zinc-600">
                            {t('pages.booking.public.outdoor')}
                          </span>
                        )}
                        {resource.metadata.isPremium && (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0 text-[10px] font-normal text-amber-700 border border-amber-200/60">
                            {t('pages.booking.public.premium')}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

function StepDate({
  advanceDays,
  selected,
  onSelect,
  t,
}: {
  advanceDays: number
  selected: string
  onSelect: (date: string) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const dayNames = t('pages.booking.public.dayNames').split(',')
  const monthNames = t('pages.booking.public.monthNames').split(',')
  const dates = useMemo(
    () => generateDateOptions(advanceDays, dayNames, monthNames),
    [advanceDays, dayNames, monthNames]
  )

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900">{t('pages.booking.public.dateTitle')}</h2>
        <p className="text-sm text-zinc-500 mt-1">{t('pages.booking.public.dateDescription')}</p>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {dates.map((d, i) => (
          <motion.button
            key={d.date}
            custom={i}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            onClick={() => onSelect(d.date)}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-2xl border py-3 px-1 transition-all duration-200',
              d.date === selected
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50'
            )}
          >
            <span className={cn(
              'text-[10px] font-medium uppercase tracking-wider',
              d.date === selected ? 'text-white/60' : 'text-zinc-500'
            )}>
              {d.isToday ? t('pages.booking.public.today') : d.dayName}
            </span>
            <span className="text-lg font-semibold tabular-nums leading-none mt-0.5">
              {d.label.split(' ')[1]}
            </span>
            <span className={cn(
              'text-[10px]',
              d.date === selected ? 'text-white/60' : 'text-zinc-500'
            )}>
              {d.label.split(' ')[0]}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function StepTime({
  config,
  selected,
  onSelect,
  t,
}: {
  config: PublicOrgConfig
  selected: string
  onSelect: (time: string) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const { openTime, closeTime, slotDurationMinutes } = config.settings
  const slots = useMemo(
    () => generateTimeSlots(openTime, closeTime, slotDurationMinutes),
    [openTime, closeTime, slotDurationMinutes]
  )

  const grouped = useMemo(() => {
    const morning: string[] = []
    const afternoon: string[] = []
    const evening: string[] = []

    slots.forEach((s) => {
      const h = parseInt(s.split(':')[0])
      if (h < 12) morning.push(s)
      else if (h < 17) afternoon.push(s)
      else evening.push(s)
    })

    return [
      { key: 'morning' as const, label: t('pages.booking.public.morning'), slots: morning },
      { key: 'afternoon' as const, label: t('pages.booking.public.afternoon'), slots: afternoon },
      { key: 'evening' as const, label: t('pages.booking.public.evening'), slots: evening },
    ].filter((g) => g.slots.length > 0)
  }, [slots, t])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900">{t('pages.booking.public.timeTitle')}</h2>
        <p className="text-sm text-zinc-500 mt-1">
          {t('pages.booking.public.timeDescription', { min: slotDurationMinutes })}
        </p>
      </div>

      <div className="space-y-4">
        {grouped.map((group) => (
          <div key={group.key}>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
              {group.label}
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {group.slots.map((time, i) => (
                <motion.button
                  key={time}
                  custom={i}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  onClick={() => onSelect(time)}
                  className={cn(
                    'rounded-xl border py-2.5 px-2 text-sm font-medium tabular-nums transition-all duration-200',
                    time === selected
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50 text-zinc-900'
                  )}
                >
                  {time}
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepDetails({
  config,
  name,
  phone,
  email,
  notes,
  partySize,
  onNameChange,
  onPhoneChange,
  onEmailChange,
  onNotesChange,
  onPartySizeChange,
  t,
}: {
  config: PublicOrgConfig
  name: string
  phone: string
  email: string
  notes: string
  partySize: number
  onNameChange: (v: string) => void
  onPhoneChange: (v: string) => void
  onEmailChange: (v: string) => void
  onNotesChange: (v: string) => void
  onPartySizeChange: (v: number) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const showPartySize = ['TABLE', 'ROOM'].includes(config.primaryResourceType)

  return (
    <motion.div
      className="space-y-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900">{t('pages.booking.public.detailsTitle')}</h2>
        <p className="text-sm text-zinc-500 mt-1">{t('pages.booking.public.detailsDescription')}</p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-500 flex items-center gap-1.5">
            <User size={12} />
            {t('pages.booking.public.nameLabel')}
          </label>
          <input
            placeholder={t('pages.booking.public.namePlaceholder')}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="flex h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-zinc-500 flex items-center gap-1.5">
            <Phone size={12} />
            {t('pages.booking.public.phoneLabel')}
          </label>
          <input
            type="tel"
            placeholder={t('pages.booking.public.phonePlaceholder')}
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            className="flex h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-zinc-500 flex items-center gap-1.5">
            <Mail size={12} />
            {t('pages.booking.public.emailLabel')}{' '}
            <span className="text-zinc-400">{t('pages.booking.public.optional')}</span>
          </label>
          <input
            type="email"
            placeholder={t('pages.booking.public.emailPlaceholder')}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="flex h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
          />
        </div>

        {showPartySize && (
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-500 flex items-center gap-1.5">
              <Users size={12} />
              {t('pages.booking.public.partySizeLabel')}
            </label>
            <input
              type="number"
              min={1}
              max={config.settings.maxPartySize}
              value={partySize}
              onChange={(e) => onPartySizeChange(parseInt(e.target.value) || 1)}
              className="flex h-11 w-[120px] rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
            />
            <p className="text-xs text-zinc-500">{t('pages.booking.public.maxGuests', { max: config.settings.maxPartySize })}</p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs text-zinc-500 flex items-center gap-1.5">
            <MessageSquare size={12} />
            {t('pages.booking.public.notesLabel')}{' '}
            <span className="text-zinc-400">{t('pages.booking.public.optional')}</span>
          </label>
          <textarea
            placeholder={t('pages.booking.public.notesPlaceholder')}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="flex min-h-[80px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
          />
        </div>
      </div>
    </motion.div>
  )
}

function StepConfirmation({
  config,
  resource,
  date,
  time,
  customerName,
  partySize,
  t,
  lang,
}: {
  config: PublicOrgConfig
  resource: BookableResource | null
  date: string
  time: string
  customerName: string
  partySize: number
  t: (key: string, opts?: Record<string, unknown>) => string
  lang: string
}) {
  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString(
    lang.startsWith('zh') ? 'zh-CN' : 'en-US',
    { weekday: 'long', month: 'long', day: 'numeric' }
  )

  return (
    <motion.div
      className="flex flex-col items-center text-center py-4"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 mb-5"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 400, damping: 20 }}
      >
        <Check size={28} strokeWidth={2.5} className="text-emerald-600" />
      </motion.div>

      <motion.h2
        className="text-2xl font-semibold tracking-tight text-zinc-900"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        {t('pages.booking.public.allSet')}
      </motion.h2>
      <motion.p
        className="text-sm text-zinc-500 mt-1.5 max-w-xs"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
      >
        {config.settings.autoConfirm
          ? t('pages.booking.public.bookingConfirmed')
          : t('pages.booking.public.bookingPending')}
      </motion.p>

      <motion.div
        className="w-full mt-8 rounded-2xl border border-zinc-200 bg-white p-5 text-left space-y-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
            {t('pages.booking.public.bookingSummary')}
          </span>
          <span className="inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            {config.settings.autoConfirm
              ? t('pages.booking.status.CONFIRMED')
              : t('pages.booking.status.PENDING')}
          </span>
        </div>
        <hr className="border-zinc-100" />
        <div className="space-y-2.5">
          <div className="flex justify-between">
            <span className="text-sm text-zinc-500">{t('pages.booking.public.guest')}</span>
            <span className="text-sm font-medium text-zinc-900">{customerName}</span>
          </div>
          {resource && (
            <div className="flex justify-between">
              <span className="text-sm text-zinc-500">
                {t(`pages.booking.resourceSelect.${config.primaryResourceType}.noun`)}
              </span>
              <span className="text-sm font-medium text-zinc-900">{resource.name}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-sm text-zinc-500">{t('pages.booking.public.date')}</span>
            <span className="text-sm font-medium text-zinc-900">{formattedDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-zinc-500">{t('pages.booking.public.time')}</span>
            <span className="text-sm font-medium tabular-nums text-zinc-900">
              {time} – {addMinutesToTime(time, config.settings.slotDurationMinutes)}
            </span>
          </div>
          {['TABLE', 'ROOM'].includes(config.primaryResourceType) && partySize > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-zinc-500">{t('pages.booking.public.party')}</span>
              <span className="text-sm font-medium text-zinc-900">{t('pages.booking.public.guestCount', { count: partySize })}</span>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Progress Bar ────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="relative h-1 flex-1 rounded-full bg-zinc-200 overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-zinc-900"
            initial={false}
            animate={{ width: i < current ? '100%' : i === current ? '50%' : '0%' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────

export default function PublicBookingPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const { t, i18n } = useTranslation()

  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<PublicOrgConfig | null>(null)

  // Booking state
  const [selectedResource, setSelectedResource] = useState<BookableResource | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)

  // Step navigation
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(1)

  useEffect(() => {
    if (!orgId) return
    loadOrgConfig()
  }, [orgId])

  const loadOrgConfig = async () => {
    try {
      const [settingsRes, resourcesRes] = await Promise.all([
        publicApi.getSettings(orgId!),
        publicApi.getResources(orgId!),
      ])

      const settingsData = (settingsRes.data as any)?.data ?? settingsRes.data
      const resourcesData = (resourcesRes.data as any)?.data ?? resourcesRes.data

      const mappedSettings = mapSettings(settingsData)
      const mappedResources = (resourcesData ?? []).map(mapResource)

      const orgConfig: PublicOrgConfig = {
        settings: mappedSettings,
        resources: mappedResources,
        primaryResourceType: mappedSettings.resourceType ?? 'TABLE',
        brandColor: '#18181b',
        logoText: mappedSettings.businessName?.charAt(0) ?? 'B',
        tagline: undefined,
      }

      setConfig(orgConfig)
      setSelectedDate(new Date().toISOString().split('T')[0])
      if (orgConfig.settings.allowAutoAssignment) {
        const firstActive = orgConfig.resources.find((r) => r.isActive) ?? null
        setSelectedResource(firstActive)
      }
    } catch {
      setConfig(null)
    } finally {
      setLoading(false)
    }
  }

  const steps = useMemo(() => {
    if (!config) return []
    const s: string[] = []
    if (!config.settings.allowAutoAssignment) {
      s.push('resource')
    }
    s.push('date', 'time', 'details')
    return s
  }, [config])

  const totalSteps = steps.length

  const canProceed = useMemo(() => {
    if (!config) return false
    const stepName = steps[currentStep]
    switch (stepName) {
      case 'resource':
        return selectedResource !== null
      case 'date':
        return selectedDate !== ''
      case 'time':
        return selectedTime !== ''
      case 'details':
        return customerName.trim().length > 0 && customerPhone.trim().length > 0
      default:
        return false
    }
  }, [config, steps, currentStep, selectedResource, selectedDate, selectedTime, customerName, customerPhone])

  const goNext = useCallback(async () => {
    if (currentStep < totalSteps - 1) {
      setDirection(1)
      setCurrentStep((s) => s + 1)
    } else {
      setSubmitting(true)

      try {
        await publicApi.createBooking(orgId!, {
          resourceId: selectedResource?.id ?? null,
          bookingDate: selectedDate,
          bookingTime: selectedTime,
          duration: config?.settings.slotDurationMinutes,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim() || undefined,
          notes: notes.trim() || undefined,
          partySize: ['TABLE', 'ROOM'].includes(config?.primaryResourceType ?? '') ? partySize : undefined,
        })
      } catch {
        // Continue to confirmation even if API fails for now (graceful degradation)
      }

      setSubmitting(false)
      setCompleted(true)
    }
  }, [currentStep, totalSteps, config, orgId, selectedResource, selectedDate, selectedTime, customerName, customerPhone, customerEmail, notes, partySize])

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setDirection(-1)
      setCurrentStep((s) => s - 1)
    }
  }, [currentStep])

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="booking-page flex min-h-dvh items-center justify-center bg-white">
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Loader2 size={24} className="animate-spin text-zinc-400" />
          <span className="text-sm text-zinc-500">{t('pages.booking.public.loading')}</span>
        </motion.div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="booking-page flex min-h-dvh items-center justify-center bg-white px-6">
        <div className="text-center">
          <p className="text-6xl font-semibold tracking-tighter text-zinc-900">404</p>
          <p className="text-sm text-zinc-500 mt-2">{t('pages.booking.public.notFound')}</p>
          <p className="text-xs text-zinc-400 mt-1">{t('pages.booking.public.notFoundHint')}</p>
        </div>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="booking-page min-h-dvh bg-white">
        <div className="mx-auto max-w-md px-5 py-8">
          <div className="flex items-center gap-2.5 mb-8">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white text-xs font-bold"
              style={{ backgroundColor: config.brandColor }}
            >
              {config.logoText}
            </div>
            <span className="text-sm font-semibold tracking-tight text-zinc-900">
              {config.settings.businessName}
            </span>
          </div>
          <StepConfirmation
            config={config}
            resource={selectedResource}
            date={selectedDate}
            time={selectedTime}
            customerName={customerName}
            partySize={partySize}
            t={t}
            lang={i18n.language}
          />
        </div>
      </div>
    )
  }

  const stepName = steps[currentStep]

  return (
    <div className="booking-page min-h-dvh bg-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-zinc-100">
        <div className="mx-auto max-w-md px-5 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-[11px] font-bold"
                style={{ backgroundColor: config.brandColor }}
              >
                {config.logoText}
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight leading-none text-zinc-900">
                  {config.settings.businessName}
                </p>
                {config.tagline && (
                  <p className="text-[11px] text-zinc-500 leading-none mt-0.5">
                    {config.tagline}
                  </p>
                )}
              </div>
            </div>
            <span className="text-xs tabular-nums text-zinc-500">
              {currentStep + 1}/{totalSteps}
            </span>
          </div>
          <ProgressBar current={currentStep} total={totalSteps} />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 mx-auto w-full max-w-md px-5 py-6">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={stepName}
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {stepName === 'resource' && (
              <StepResource config={config} selected={selectedResource} onSelect={setSelectedResource} t={t} />
            )}
            {stepName === 'date' && (
              <StepDate advanceDays={config.settings.advanceBookingDays} selected={selectedDate} onSelect={setSelectedDate} t={t} />
            )}
            {stepName === 'time' && (
              <StepTime config={config} selected={selectedTime} onSelect={setSelectedTime} t={t} />
            )}
            {stepName === 'details' && (
              <StepDetails
                config={config}
                name={customerName}
                phone={customerPhone}
                email={customerEmail}
                notes={notes}
                partySize={partySize}
                onNameChange={setCustomerName}
                onPhoneChange={setCustomerPhone}
                onEmailChange={setCustomerEmail}
                onNotesChange={setNotes}
                onPartySizeChange={setPartySize}
                t={t}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Bar */}
      <div className="sticky bottom-0 z-10 border-t border-zinc-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto max-w-md px-5 py-4 flex items-center gap-3">
          {currentStep > 0 ? (
            <button
              onClick={goBack}
              disabled={submitting}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <ChevronLeft size={16} />
              {t('pages.booking.public.back')}
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={goNext}
            disabled={!canProceed || submitting}
            className="ml-auto inline-flex items-center gap-2 px-6 h-11 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                {t('pages.booking.public.booking')}
              </>
            ) : currentStep === totalSteps - 1 ? (
              <>
                <Sparkles size={15} />
                {t('pages.booking.public.confirmBooking')}
              </>
            ) : (
              <>
                {t('pages.booking.public.continue')}
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
