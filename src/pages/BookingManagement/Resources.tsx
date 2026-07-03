import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs } from '@/components/ui-kit'
import BookingPageLayout from './BookingPageLayout'
import FloorPlanEditor from './FloorPlanEditor'
import PersonManagement from './PersonManagement'
import ProductManagement from './ProductManagement'
import BookingLinkDisplay from './BookingLinkDisplay'

// SPACE 类型的管理页面（后续实现）
function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-300 gap-2">
      <div className="text-4xl">🚧</div>
      <div className="text-base font-medium">{label} 管理</div>
      <div className="text-[13px]">即将推出</div>
    </div>
  )
}

export default function BookingResources() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('TABLE')

  const tabs = [
    { key: 'TABLE', label: '餐桌 / 座位' },
    { key: 'SPACE', label: '空间 / 场地' },
    { key: 'PRODUCT', label: '服务 / 产品' },
    { key: 'PERSON', label: '人员' },
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
        {activeTab === 'SPACE' && <ComingSoon label="空间" />}
        {activeTab === 'PRODUCT' && <ProductManagement />}
        {activeTab === 'PERSON' && <PersonManagement />}
      </div>
    </BookingPageLayout>
  )
}
