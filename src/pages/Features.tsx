import React from 'react'
import { BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface FeatureCard {
  key: string
  icon: React.ReactNode
  title: string
  description: string
  path: string
}

const Features: React.FC = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const features: FeatureCard[] = [
    {
      key: 'recipe-guide',
      icon: <BookOpen className="w-12 h-12 text-blue-500" />,
      title: t('nav.recipeGuide'),
      description: t('pages.features.recipeGuideDesc'),
      path: '/recipe-guide',
    },
    // 未来可以在这里添加更多特色功能
  ]

  return (
    <div>
      <h2 className="text-2xl font-semibold text-slate-900 mb-2">{t('pages.features.title')}</h2>
      <p className="text-slate-500 mb-6">{t('pages.features.description')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {features.map((feature) => (
          <div
            key={feature.key}
            onClick={() => navigate(feature.path)}
            className="h-full text-center bg-white border border-slate-200 rounded-xl p-6 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all"
          >
            <div className="mb-4 flex justify-center">{feature.icon}</div>
            <h4 className="text-base font-semibold text-slate-800 mb-1">{feature.title}</h4>
            <p className="text-sm text-slate-500">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Features
