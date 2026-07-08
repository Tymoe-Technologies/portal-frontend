import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PlayCircle, Eraser } from 'lucide-react'
import { useAuthContext } from '../../auth/AuthProvider'
import {
  runAllExamples,
  cleanupTestData,
  itemManagementExamples,
  categoryManagementExamples,
  addonManagementExamples,
  attributeManagementExamples,
} from '../../examples/item-management-examples'
import { SectionCard, Btn, AlertBox } from '@/components/ui-kit'

const preCls = 'bg-slate-100 p-4 rounded overflow-auto text-xs text-slate-700'
const tag = (text: string, cls = 'bg-slate-100 text-slate-600 ring-slate-200') =>
  <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded ring-1 ${cls}`}>{text}</span>

const ItemApiTest: React.FC = () => {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuthContext()
  const [loading, setLoading] = useState<string | null>(null)
  const [results, setResults] = useState<any>(null)

  const runTest = async (testName: string, testFunction: () => Promise<any>) => {
    setLoading(testName)
    setResults(null)
    try {
      const result = await testFunction()
      setResults({ success: true, data: result })
    } catch (error) {
      setResults({ success: false, error: error instanceof Error ? error.message : String(error) })
    } finally {
      setLoading(null)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <AlertBox type="warning" title={t('pages.itemApiTest.loginRequiredTitle')} description={t('pages.itemApiTest.loginRequiredDesc')} />
      </div>
    )
  }

  return (
    <div className="p-6">
      <SectionCard>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">{t('pages.itemApiTest.pageTitle')}</h2>
        <p className="text-slate-600 mb-4">{t('pages.itemApiTest.pageDesc')}</p>

        <div className="space-y-6">
          {/* 测试按钮 */}
          <SectionCard title={t('pages.itemApiTest.apiTestsTitle')}>
            <div className="flex flex-wrap gap-2">
              <Btn variant="primary" icon={<PlayCircle className="w-3.5 h-3.5" />} loading={loading === 'items'} onClick={() => runTest('items', itemManagementExamples)}>{t('pages.itemApiTest.testItemsBtn')}</Btn>
              <Btn variant="secondary" icon={<PlayCircle className="w-3.5 h-3.5" />} loading={loading === 'categories'} onClick={() => runTest('categories', categoryManagementExamples)}>{t('pages.itemApiTest.testCategoriesBtn')}</Btn>
              <Btn variant="secondary" icon={<PlayCircle className="w-3.5 h-3.5" />} loading={loading === 'addons'} onClick={() => runTest('addons', addonManagementExamples)}>{t('pages.itemApiTest.testAddonsBtn')}</Btn>
              <Btn variant="secondary" icon={<PlayCircle className="w-3.5 h-3.5" />} loading={loading === 'attributes'} onClick={() => runTest('attributes', attributeManagementExamples)}>{t('pages.itemApiTest.testAttributesBtn')}</Btn>
              <Btn variant="primary" icon={<PlayCircle className="w-3.5 h-3.5" />} loading={loading === 'all'} onClick={() => runTest('all', runAllExamples)}>{t('pages.itemApiTest.runAllBtn')}</Btn>
              <Btn variant="danger" icon={<Eraser className="w-3.5 h-3.5" />} loading={loading === 'cleanup'} onClick={() => runTest('cleanup', cleanupTestData)}>{t('pages.itemApiTest.cleanupBtn')}</Btn>
            </div>
          </SectionCard>

          {/* 测试结果 */}
          {results && (
            <SectionCard title={t('pages.itemApiTest.resultsTitle')}>
              {results.success
                ? <div className="mb-4"><AlertBox type="success" title={t('pages.itemApiTest.testSuccessTitle')} description={t('pages.itemApiTest.testSuccessDesc')} /></div>
                : <div className="mb-4"><AlertBox type="error" title={t('pages.itemApiTest.testFailedTitle')} description={results.error} /></div>}

              <details className="rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">{t('pages.itemApiTest.detailedResults')}</summary>
                <pre className={`${preCls} max-h-96 mt-2`}>{JSON.stringify(results.data, null, 2)}</pre>
              </details>
            </SectionCard>
          )}

          {/* API 信息 */}
          <SectionCard title={t('pages.itemApiTest.serviceInfoTitle')}>
            <div className="space-y-2 text-sm">
              <div><span className="font-semibold text-slate-700">{t('pages.itemApiTest.endpointLabel')} </span>{tag(import.meta.env.VITE_ITEM_MANAGE_BASE || 'https://tymoe.com/api/item-manage/v1', 'bg-blue-50 text-blue-600 ring-blue-200')}</div>
              <div><span className="font-semibold text-slate-700">{t('pages.itemApiTest.authStatusLabel')} </span>{tag(t('pages.itemApiTest.authenticatedTag'), 'bg-green-50 text-green-600 ring-green-200')}</div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-slate-700">{t('pages.itemApiTest.supportedFeaturesLabel')} </span>
                {tag(t('pages.itemApiTest.featureItemCrud'))}{tag(t('pages.itemApiTest.featureCategoryMgmt'))}{tag(t('pages.itemApiTest.featureAttributeMgmt'))}{tag(t('pages.itemApiTest.featureAddonMgmt'))}{tag(t('pages.itemApiTest.featureBatchOps'))}{tag(t('pages.itemApiTest.featureSearch'))}
              </div>
            </div>
          </SectionCard>

          {/* 使用说明 */}
          <SectionCard title={t('pages.itemApiTest.usageGuideTitle')}>
            <div className="space-y-2">
              <details className="rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">{t('pages.itemApiTest.apiExampleSummary')}</summary>
                <pre className={`${preCls} mt-2`}>{`// 导入服务
import { itemManagementService } from '@/services/item-management'

// 获取商品列表
const items = await itemManagementService.getItems({
  page: 1,
  limit: 10,
  status: 'ACTIVE'
})

// 创建商品
const newItem = await itemManagementService.createItem({
  name: '商品名称',
  price: 99.99,
  status: 'ACTIVE'
})

// 搜索商品
const searchResults = await itemManagementService.searchItems('关键词')

// 获取分类树
const categoryTree = await itemManagementService.getCategoryTree()`}</pre>
              </details>

              <details className="rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">{t('pages.itemApiTest.errorHandlingSummary')}</summary>
                <pre className={`${preCls} mt-2`}>{`try {
  const items = await itemManagementService.getItems()
  console.log('获取商品成功:', items)
} catch (error) {
  console.error('获取商品失败:', error)
  // 处理错误...
}`}</pre>
              </details>
            </div>
          </SectionCard>
        </div>
      </SectionCard>
    </div>
  )
}

export default ItemApiTest
