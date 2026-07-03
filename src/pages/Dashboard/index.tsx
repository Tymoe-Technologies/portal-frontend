import React from 'react'
import { useTranslation } from 'react-i18next'
import { SectionCard } from '@/components/ui-kit'

const Dashboard: React.FC = () => {
  const { t } = useTranslation()
  return (
    <SectionCard title={t('pages.dashboard.title')}>
      <p className="text-sm text-slate-500">{t('pages.dashboard.desc')}</p>
    </SectionCard>
  )
}

export default Dashboard
