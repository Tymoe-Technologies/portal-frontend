import React, { useState } from 'react'
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
        <AlertBox type="warning" title="需要登录" description="请先登录以测试商品管理服务API" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <SectionCard>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">商品管理服务 API 测试</h2>
        <p className="text-slate-600 mb-4">这个页面用于测试商品管理服务的各种API功能。点击下面的按钮来执行不同的测试。</p>

        <div className="space-y-6">
          {/* 测试按钮 */}
          <SectionCard title="API 测试">
            <div className="flex flex-wrap gap-2">
              <Btn variant="primary" icon={<PlayCircle className="w-3.5 h-3.5" />} loading={loading === 'items'} onClick={() => runTest('items', itemManagementExamples)}>测试商品管理</Btn>
              <Btn variant="secondary" icon={<PlayCircle className="w-3.5 h-3.5" />} loading={loading === 'categories'} onClick={() => runTest('categories', categoryManagementExamples)}>测试分类管理</Btn>
              <Btn variant="secondary" icon={<PlayCircle className="w-3.5 h-3.5" />} loading={loading === 'addons'} onClick={() => runTest('addons', addonManagementExamples)}>测试Add-on管理</Btn>
              <Btn variant="secondary" icon={<PlayCircle className="w-3.5 h-3.5" />} loading={loading === 'attributes'} onClick={() => runTest('attributes', attributeManagementExamples)}>测试属性管理</Btn>
              <Btn variant="primary" icon={<PlayCircle className="w-3.5 h-3.5" />} loading={loading === 'all'} onClick={() => runTest('all', runAllExamples)}>运行所有测试</Btn>
              <Btn variant="danger" icon={<Eraser className="w-3.5 h-3.5" />} loading={loading === 'cleanup'} onClick={() => runTest('cleanup', cleanupTestData)}>清理测试数据</Btn>
            </div>
          </SectionCard>

          {/* 测试结果 */}
          {results && (
            <SectionCard title="测试结果">
              {results.success
                ? <div className="mb-4"><AlertBox type="success" title="测试成功" description="API调用成功完成" /></div>
                : <div className="mb-4"><AlertBox type="error" title="测试失败" description={results.error} /></div>}

              <details className="rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">详细结果</summary>
                <pre className={`${preCls} max-h-96 mt-2`}>{JSON.stringify(results.data, null, 2)}</pre>
              </details>
            </SectionCard>
          )}

          {/* API 信息 */}
          <SectionCard title="API 服务信息">
            <div className="space-y-2 text-sm">
              <div><span className="font-semibold text-slate-700">服务端点: </span>{tag(import.meta.env.VITE_ITEM_MANAGE_BASE || 'https://tymoe.com/api/item-manage/v1', 'bg-blue-50 text-blue-600 ring-blue-200')}</div>
              <div><span className="font-semibold text-slate-700">认证状态: </span>{tag('已认证', 'bg-green-50 text-green-600 ring-green-200')}</div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-slate-700">支持的功能: </span>
                {tag('商品CRUD')}{tag('分类管理')}{tag('属性管理')}{tag('Add-on管理')}{tag('批量操作')}{tag('搜索')}
              </div>
            </div>
          </SectionCard>

          {/* 使用说明 */}
          <SectionCard title="使用说明">
            <div className="space-y-2">
              <details className="rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">API 使用示例</summary>
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
                <summary className="cursor-pointer text-sm font-medium text-slate-700">错误处理</summary>
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
