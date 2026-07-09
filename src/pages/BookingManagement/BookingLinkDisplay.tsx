import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Pencil, Globe, Table, LayoutGrid, Users } from 'lucide-react'
import { orgProfileApi, OrganizationProfile } from '@/services/booking'
import { SectionCard, Btn, toast } from '@/components/ui-kit'
import type { TFunction } from 'i18next'

// 模块级函数：接收 t 以获取翻译（无法在模块作用域直接调用 t）
const getBookingTypes = (t: TFunction) => [
  {
    key: 'table',
    label: t('pages.booking.bookingLinkDisplay.typeTable.label'),
    icon: <Table className="w-3.5 h-3.5" />,
    cls: 'bg-blue-50 text-blue-600 ring-blue-200',
    param: '',           // 默认，无 type 参数
    desc: t('pages.booking.bookingLinkDisplay.typeTable.desc'),
  },
  {
    key: 'services',
    label: t('pages.booking.bookingLinkDisplay.typeServices.label'),
    icon: <LayoutGrid className="w-3.5 h-3.5" />,
    cls: 'bg-slate-100 text-slate-600 ring-slate-200',   // 原紫色，改 slate（严禁紫色）
    param: '?type=services',
    desc: t('pages.booking.bookingLinkDisplay.typeServices.desc'),
  },
  {
    key: 'staff',
    label: t('pages.booking.bookingLinkDisplay.typeStaff.label'),
    icon: <Users className="w-3.5 h-3.5" />,
    cls: 'bg-green-50 text-green-600 ring-green-200',
    param: '?type=staff',
    desc: t('pages.booking.bookingLinkDisplay.typeStaff.desc'),
  },
]

export default function BookingLinkDisplay() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<OrganizationProfile | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const data = await orgProfileApi.get()
      setProfile(data)
    } catch (error: any) {
      console.error('加载组织配置失败:', error)
      toast.error(t('pages.booking.bookingLinkDisplay.loadLinkFailed'))
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(t('pages.booking.bookingLinkDisplay.copiedSuffix', { label }))
  }

  const frontendBaseUrl = 'http://localhost:8173'

  if (loading) {
    return (
      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-slate-200 rounded w-1/3" />
          <div className="h-3 bg-slate-200 rounded w-full" />
          <div className="h-3 bg-slate-200 rounded w-2/3" />
        </div>
      </div>
    )
  }

  if (!profile) return null

  const baseUrl = `${frontendBaseUrl}/book/${profile.slug}`
  const bookingTypes = getBookingTypes(t)

  return (
    <div className="mb-4">
      <SectionCard
        title={<span className="inline-flex items-center gap-2"><Globe className="w-4 h-4" />{t('pages.booking.bookingLinkDisplay.title')}</span>}
        action={<Btn variant="link" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => toast.info(t('pages.booking.bookingLinkDisplay.editComingSoon'))}>{t('pages.booking.bookingLinkDisplay.edit')}</Btn>}
      >
        <div className="flex flex-col gap-3">
          {bookingTypes.map(type => {
            const url = `${baseUrl}${type.param}`
            return (
              <div key={type.key}>
                <div className="mb-1 flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ring-1 ${type.cls}`}>
                    {type.icon}{type.label}
                  </span>
                  <span className="text-xs text-slate-400">{type.desc}</span>
                </div>
                <div className="flex">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-l-md bg-white text-[13px] text-blue-600 truncate hover:underline"
                  >
                    {url}
                  </a>
                  <button
                    onClick={() => copyToClipboard(url, type.label)}
                    title={t('pages.booking.bookingLinkDisplay.copyLinkTitle')}
                    className="px-3 border border-l-0 border-slate-300 rounded-r-md bg-white text-slate-500 hover:bg-slate-50 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}

          <p className="text-xs text-slate-400">{t('pages.booking.bookingLinkDisplay.shareHint')}</p>
        </div>
      </SectionCard>
    </div>
  )
}
