import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Calendar, LayoutGrid, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface BookingPageLayoutProps {
  children: React.ReactNode
}

export default function BookingPageLayout({ children }: BookingPageLayoutProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // 根据当前路径确定激活的菜单项
  const getActiveKey = () => {
    if (pathname.startsWith('/booking/bookings')) return '/booking/bookings'
    if (pathname.startsWith('/booking/resources')) return '/booking/resources'
    if (pathname.startsWith('/booking/settings')) return '/booking/settings'
    return '/booking'
  }

  const active = getActiveKey()

  const menuItems = [
    { key: '/booking', icon: <LayoutDashboard className="w-4 h-4" />, label: t('pages.booking.dashboard.title') },
    { key: '/booking/bookings', icon: <Calendar className="w-4 h-4" />, label: t('pages.booking.bookings.title') },
    { key: '/booking/resources', icon: <LayoutGrid className="w-4 h-4" />, label: t('pages.booking.resources.title') },
    { key: '/booking/settings', icon: <Settings className="w-4 h-4" />, label: t('pages.booking.settings.title') },
  ]

  return (
    <div>
      {/* 页面内横向子菜单 */}
      <nav className="flex items-center gap-1 mb-6 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
        {menuItems.map(item => {
          const isActive = active === item.key
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.icon}{item.label}
            </button>
          )
        })}
      </nav>
      {children}
    </div>
  )
}
