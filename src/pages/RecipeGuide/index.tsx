import React, { useState, useEffect } from 'react'
import { BookOpen, Settings, HelpCircle, Code } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import RecipeManagementByModifiers from './RecipeManagementByModifiers'
import StepTypeManagement from './StepTypeManagement'
import ModifierPrintCodeManagement from './ModifierPrintCodeManagement'
import { getItems, type Item } from '@/services/item-management'
import { SectionCard, Tabs, SelectInput, Spinner, toast } from '@/components/ui-kit'

const RecipeGuide: React.FC = () => {
  const { t } = useTranslation()
  const [items, setItems] = useState<Item[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('recipesByModifier')

  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    setLoading(true)
    try {
      const orgId = localStorage.getItem('organization_id')
      if (!orgId) {
        toast.warning(t('organization.selectOrg'))
        return
      }
      const response = await getItems({ limit: 1000 })
      setItems(response.data)
    } catch (error: any) {
      toast.error(error.message || t('pages.recipeGuide.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const tabItems = [
    { key: 'recipesByModifier', label: t('pages.recipeGuide.recipeManagement'), icon: <BookOpen className="w-4 h-4" /> },
    { key: 'modifierPrintCodes', label: t('pages.recipeGuide.modifierPrintCodeManagement'), icon: <Code className="w-4 h-4" /> },
    { key: 'stepTypes', label: t('pages.recipeGuide.stepTypeManagement'), icon: <Settings className="w-4 h-4" /> },
  ]

  return (
    <div>
      <SectionCard
        title={
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-slate-900">{t('pages.recipeGuide.title')}</span>
            <span className="text-sm text-slate-500 font-normal">{t('pages.recipeGuide.description')}</span>
          </div>
        }
      >
        {/* 使用指引（可折叠） */}
        <details className="mb-4">
          <summary className="inline-flex items-center gap-2 cursor-pointer">
            <HelpCircle className="w-4 h-4 text-blue-500" />
            <span className="font-semibold text-slate-700">{t('pages.recipeGuide.guideTitle')}</span>
          </summary>
          <div className="pl-6 mt-3">
            <div className="mb-3"><span className="text-sm text-slate-500">{t('pages.recipeGuide.guideIntro')}</span></div>
            <div className="mb-2">
              <span className="font-semibold text-slate-700">📋 {t('pages.recipeGuide.guideStep1Title')}</span>
              <div className="ml-4 mt-1">
                <div className="text-[13px] text-slate-500">{t('pages.recipeGuide.guideStep1Desc')}</div>
                <ul className="my-1 pl-5 text-[13px] list-disc text-slate-500">
                  <li>{t('pages.recipeGuide.guideStep1Example1')}</li>
                  <li>{t('pages.recipeGuide.guideStep1Example2')}</li>
                  <li>{t('pages.recipeGuide.guideStep1Example3')}</li>
                </ul>
              </div>
            </div>
            <div className="mb-2">
              <span className="font-semibold text-slate-700">📝 {t('pages.recipeGuide.guideStep2Title')}</span>
              <div className="ml-4 mt-1">
                <div className="text-[13px] text-slate-500">{t('pages.recipeGuide.guideStep2Desc')}</div>
                <div className="mt-1 px-2.5 py-1.5 bg-slate-100 rounded text-[13px]">
                  <code className="text-xs text-slate-700">{t('pages.recipeGuide.guideStep2Example')}</code>
                </div>
              </div>
            </div>
            <div className="mt-2 px-3 py-2 bg-amber-50 rounded border border-amber-200">
              <span className="text-[13px] text-amber-700">💡 {t('pages.recipeGuide.guideTip')}</span>
            </div>
          </div>
        </details>

        {loading && items.length === 0 ? (
          <div className="py-12 text-center"><Spinner className="w-8 h-8 mx-auto text-slate-400" /></div>
        ) : (
          <>
            <Tabs value={activeTab} onChange={setActiveTab} items={tabItems} />
            <div className="mt-4">
              {activeTab === 'recipesByModifier' && (
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <span className="text-sm text-slate-700">{t('pages.recipeGuide.selectItem')}:</span>
                    <div className="w-72">
                      <SelectInput className="w-full" placeholder={t('pages.recipeGuide.selectItemPlaceholder')}
                        value={selectedItemId} onChange={(v) => setSelectedItemId(String(v))}
                        options={items.map(item => ({ label: item.name, value: item.id }))} />
                    </div>
                  </div>
                  <RecipeManagementByModifiers itemId={selectedItemId || undefined} />
                </div>
              )}
              {activeTab === 'modifierPrintCodes' && <ModifierPrintCodeManagement />}
              {activeTab === 'stepTypes' && <StepTypeManagement />}
            </div>
          </>
        )}
      </SectionCard>
    </div>
  )
}

export default RecipeGuide
