import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs } from '@/components/ui-kit'
import BookingPageLayout from './BookingPageLayout'
import FloorPlanEditor from './FloorPlanEditor'
import PersonManagement from './PersonManagement'
import ProductManagement from './ProductManagement'
import BookingLinkDisplay from './BookingLinkDisplay'

// SPACE 类型的管理页面（后续实现）
function ComingSoon({ label, t }: { label: string; t: (key: string, opts?: Record<string, unknown>) => string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-300 gap-2">
      <div className="text-4xl">🚧</div>
      <div className="text-base font-medium">{t('pages.booking.resources.comingSoonTitle', { label })}</div>
      <div className="text-[13px]">{t('pages.booking.resources.comingSoonHint')}</div>
    </div>
  )
}

export default function BookingResources() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('TABLE')

  const tabs = [
    { key: 'TABLE', label: t('pages.booking.resources.tabTable') },
    { key: 'SPACE', label: t('pages.booking.resources.tabSpace') },
    { key: 'PRODUCT', label: t('pages.booking.resources.tabProduct') },
    { key: 'PERSON', label: t('pages.booking.resources.tabPerson') },
  ]

  return (
    <BookingPageLayout>
      <div>
        <h2 className="mb-4 text-xl font-semibold text-slate-800">{t('pages.booking.resources.title')}</h2>

        {/* 显示预约链接 */}
        <BookingLinkDisplay />

        <div className="mb-4">
          <Tabs value={activeTab} onChange={setActiveTab} items={tabs} />
        </div>

        {activeTab === 'TABLE' && <FloorPlanEditor />}
        {activeTab === 'SPACE' && <ComingSoon label={t('pages.booking.resources.spaceLabel')} t={t} />}
        {activeTab === 'PRODUCT' && <ProductManagement />}
        {activeTab === 'PERSON' && <PersonManagement />}
      </div>
    </BookingPageLayout>
  )
}
