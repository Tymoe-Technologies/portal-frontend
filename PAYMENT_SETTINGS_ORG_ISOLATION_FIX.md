# 支付方式设置 - 组织隔离修复

## 问题描述

支付方式设置页面（`PaymentSettings/index.tsx`）没有正确处理组织切换：

1. **组织ID获取方式不当**：使用 `useState` 存储 `tenantId`，只在首次加载时获取一次
2. **切换组织不生效**：用户在其他页面切换组织后，回到支付设置页面，数据不会更新
3. **缺少组织未选择提示**：当用户未选择组织时，页面仍然显示空数据，没有友好提示

## 解决方案

### 1. 改用直接读取方式获取 tenantId

**修改前**：
```typescript
const [tenantId, setTenantId] = useState<string>('')

useEffect(() => {
  const orgId = localStorage.getItem('organization_id') || ''
  setTenantId(orgId)
  if (orgId) {
    loadDevices(orgId)
    // ...
  }
}, [])  // 空依赖，只执行一次
```

**修改后**：
```typescript
// 直接读取，每次渲染时都获取最新值
const tenantId = localStorage.getItem('organization_id') || ''

useEffect(() => {
  if (tenantId) {
    loadDevices(tenantId)
    loadProviders(tenantId)
    loadTenantPaymentConfig(tenantId)
    loadStripeConnectStatus(tenantId)
  }
  loadCurrencies()
}, [tenantId])  // 监听 tenantId 变化
```

### 2. 添加组织未选择提示

```typescript
{!tenantId ? (
  <Card style={{ marginBottom: 24 }}>
    <Empty
      description="请先在顶部选择一个组织"
      image={Empty.PRESENTED_IMAGE_SIMPLE}
    />
  </Card>
) : (
  <>
    {/* 统计卡片 */}
    {/* 设备支付配置 */}
    {/* 支付提供商配置 */}
    {/* Stripe Connect */}
  </>
)}
```

## 技术细节

### 为什么使用直接读取而不是 useState？

1. **实时性**：每次组件重新渲染时都能获取最新的 `organization_id`
2. **简单性**：不需要管理状态更新逻辑
3. **一致性**：与其他页面（如 `PricingManagement.tsx`）保持一致

### useEffect 依赖项

```typescript
useEffect(() => {
  if (tenantId) {
    // 加载数据
  }
}, [tenantId])  // 当 tenantId 变化时重新加载
```

当用户切换组织时：
1. `localStorage` 中的 `organization_id` 被更新
2. 组件重新渲染
3. `tenantId` 获取到新值
4. `useEffect` 检测到 `tenantId` 变化
5. 自动重新加载所有数据

## 参考实现

其他已正确实现组织隔离的页面：
- `src/pages/OrderConfig/PricingManagement.tsx`（第 69 行）
- `src/pages/TaxManagement/index.tsx`
- `src/pages/DeviceManagement/index.tsx`

## 测试要点

1. **首次进入页面**：
   - 如果未选择组织，显示提示
   - 如果已选择组织，正常加载数据

2. **切换组织**：
   - 在顶部切换组织
   - 回到支付设置页面
   - 数据应自动更新为新组织的数据

3. **数据隔离**：
   - 组织A的支付配置不应出现在组织B中
   - 设备列表、支付提供商、Stripe 状态都应按组织隔离

## 日期

2026-03-10
