# 套餐增强功能实现总结

## 功能概览

本实现为套餐（Combo）系统添加了三个可选增强功能：

1. **商品分组** - 支持单选(N选1)和多选(任选N)模式
2. **时段限制** - 支持按时间和星期的可用性限制
3. **套餐图片** - 通过Cloudinary存储套餐图片

所有功能都是可选的，不会影响现有的套餐正常工作。

---

## 实现细节

### 数据库模式

#### 修改的表

**combos 表新增字段：**
```sql
ALTER TABLE combos ADD COLUMN image_url VARCHAR(500);
ALTER TABLE combos ADD COLUMN item_groups JSONB;
ALTER TABLE combos ADD COLUMN availability_rules JSONB;
```

**combo_items 表新增字段：**
```sql
ALTER TABLE combo_items ADD COLUMN group_id VARCHAR(50);
```

#### JSON数据结构

**item_groups** (存储商品分组配置)：
```typescript
interface ComboItemGroup {
  id: string                              // "group-1", "group-2"等
  name: string                            // "主食选择", "小食任选2款"
  selection_type: 'single' | 'multiple'   // 选择模式
  min_selections: number                  // 最小选择数
  max_selections: number                  // 最大选择数
  sort_order: number                      // 显示顺序
}
```

**availability_rules** (存储时段限制配置)：
```typescript
interface ComboAvailabilityRules {
  enabled: boolean
  time_range?: { start: string; end: string }  // "09:00", "21:30"
  days_of_week?: number[]                      // [1,2,3,4,5] 周一到周五
}
```

---

### 后端实现

#### 修改的文件

| 文件 | 修改内容 |
|------|--------|
| `schema.prisma` | 添加新字段到combos和combo_items模型 |
| `ComboController.ts` | 修改createCombo/updateCombo，新增uploadImage/deleteImage方法 |
| `CloudinaryService.ts` | 添加uploadComboImage/deleteComboImage方法 |
| `combos.ts` | 添加图片上传/删除路由 |
| `comboValidators.ts` | 新建验证函数 |

#### 关键API端点

**创建套餐** - `POST /api/item-manage/v1/combos`
```json
请求体示例：
{
  "name": "午餐套餐",
  "categoryId": "cat-123",
  "basePrice": 1999,        // 分（cents）
  "comboItems": [...],
  "itemGroups": [           // 可选
    { "id": "g1", "name": "主食", "selectionType": "single", ... }
  ],
  "availabilityRules": {    // 可选
    "enabled": true,
    "timeRange": { "start": "11:30", "end": "14:00" },
    "daysOfWeek": [1,2,3,4,5]
  }
}
```

**更新套餐** - `PUT /api/item-manage/v1/combos/{id}`
- 同上，所有字段都是可选的
- 新字段如果不提供则不更新

**上传套餐图片** - `POST /api/item-manage/v1/combos/{id}/image`
```
Content-Type: multipart/form-data
- image: File (JPG/PNG/WebP, max 5MB)

返回：
{
  "combo": { ... },
  "image": { "url": "https://res.cloudinary.com/...", "publicId": "..." }
}
```

**删除套餐图片** - `DELETE /api/item-manage/v1/combos/{id}/image`
```
返回：
{ "combo": { ... } }
```

#### 验证规则

**comboValidators.ts** 中实现的验证函数：

1. `validateItemGroups()` - 验证分组配置
   - 检查groupId的唯一性
   - 验证selectionType和min/max数值
   - 确保单选时min=max=1

2. `validateAvailabilityRules()` - 验证时段限制
   - 时间格式验证（HH:mm）
   - 开始时间 <= 结束时间
   - 星期数值在0-6范围内

3. `isComboAvailable()` - 检查当前是否可用
   - 根据当前时间和星期判断
   - 配合前端显示"缺货"或"不可用"提示

#### 数据转换

后端使用下划线命名（snake_case），前端使用驼峰（camelCase）：

| 后端字段 | 前端字段 | 数据类型 |
|---------|--------|--------|
| image_url | imageUrl | string |
| item_groups | itemGroups | ComboItemGroup[] |
| availability_rules | availabilityRules | ComboAvailabilityRules |
| group_id | groupId | string |

数据转换在 ComboController 的 `formatResponse()` 方法中实现。

---

### 前端实现

#### 类型定义

**src/services/item-management.ts** 中定义的接口：

```typescript
// 商品分组配置
export interface ComboItemGroup {
  id: string
  name: string
  selectionType: 'single' | 'multiple'
  minSelections: number
  maxSelections: number
  sortOrder: number
}

// 时段限制配置
export interface ComboAvailabilityRules {
  enabled: boolean
  timeRange?: { start: string; end: string }
  daysOfWeek?: number[]
}

// 更新后的Combo接口（新增字段）
export interface Combo {
  id: string
  name: string
  // ... 其他现有字段
  imageUrl?: string                        // 新增
  itemGroups?: ComboItemGroup[]           // 新增
  availabilityRules?: ComboAvailabilityRules // 新增
  comboItems?: ComboItem[]
}

// 更新后的CreateComboPayload（新增字段）
export interface CreateComboPayload {
  name: string
  // ... 其他现有字段
  imageUrl?: string                        // 新增
  itemGroups?: ComboItemGroup[]           // 新增
  availabilityRules?: ComboAvailabilityRules // 新增
  comboItems?: CreateComboItemPayload[]
}

// 更新后的ComboItem（新增字段）
export interface ComboItem {
  itemId: string
  // ... 其他现有字段
  groupId?: string                         // 新增
}

// 更新后的CreateComboItemPayload（新增字段）
export interface CreateComboItemPayload {
  itemId: string
  // ... 其他现有字段
  groupId?: string                         // 新增
}
```

#### API方法

**ItemManagementService** 中新增的方法：

```typescript
// 上传套餐图片
async uploadComboImage(comboId: string, file: File): Promise<{
  combo: Combo
  image: { url: string; publicId: string }
}> { ... }

// 删除套餐图片
async deleteComboImage(comboId: string): Promise<{ combo: Combo }> { ... }

// 检查套餐当前是否可用
isComboCurrentlyAvailable(combo: Combo): boolean { ... }
```

#### 新增组件

##### 1. ComboImageUpload.tsx
位置：`src/pages/MenuCenter/components/ComboImageUpload.tsx`

功能：
- 图片拖拽和点击上传
- 图片预览
- 图片删除功能
- 文件验证（格式、大小）
- 创建套餐时禁用（必须先保存套餐）

Props：
```typescript
interface ComboImageUploadProps {
  comboId?: string              // 套餐ID（用于上传）
  imageUrl?: string             // 当前图片URL
  onImageChange: (url: string | undefined) => void  // 图片变更回调
  disabled?: boolean            // 是否禁用
}
```

##### 2. ComboItemGroupsConfig.tsx
位置：`src/pages/MenuCenter/components/ComboItemGroupsConfig.tsx`

功能：
- 启用/禁用商品分组
- 添加/编辑/删除分组
- 配置选择模式（单选/多选）
- 配置选择数量范围
- 拖拽分配商品到分组
- 显示未分组商品
- 快捷分组分配

Props：
```typescript
interface ComboItemGroupsConfigProps {
  groups: ComboItemGroup[]
  onGroupsChange: (groups: ComboItemGroup[]) => void
  comboItems: CreateComboItemPayload[]
  onComboItemsChange: (items: CreateComboItemPayload[]) => void
  allItems: Item[]
}
```

##### 3. ComboAvailabilityConfig.tsx
位置：`src/pages/MenuCenter/components/ComboAvailabilityConfig.tsx`

功能：
- 启用/禁用时段限制
- 时间段选择（TimePicker）
- 星期选择（Checkbox）
- 快捷选择（工作日/周末/全选）
- 可用时段预览
- 实时验证提示

Props：
```typescript
interface ComboAvailabilityConfigProps {
  value?: ComboAvailabilityRules
  onChange?: (rules: ComboAvailabilityRules) => void
}
```

#### 表单集成

**src/pages/MenuCenter/index.tsx** 修改：

1. **导入新组件和类型：**
```typescript
import { ComboItemGroupsConfig } from './components/ComboItemGroupsConfig'
import { ComboAvailabilityConfig } from './components/ComboAvailabilityConfig'
import { ComboImageUpload } from './components/ComboImageUpload'
import type { ComboItemGroup, ComboAvailabilityRules } from '@/services/item-management'
```

2. **添加状态变量：**
```typescript
const [comboImageUrl, setComboImageUrl] = useState<string | undefined>()
const [comboItemGroups, setComboItemGroups] = useState<ComboItemGroup[]>([])
const [comboAvailabilityRules, setComboAvailabilityRules] = useState<ComboAvailabilityRules | undefined>()
```

3. **修改处理函数：**
- `handleCreateCombo()` - 初始化新状态
- `handleEditCombo()` - 加载新字段
- `handleSaveCombo()` - 包含新字段在payload中

4. **表单JSX结构：**
```jsx
<Form>
  {/* 基本信息 */}
  <Form.Item name="name" ... />
  <Form.Item name="description" ... />

  {/* 套餐图片 */}
  <ComboImageUpload />

  {/* 活跃状态 */}
  <Form.Item name="isActive" ... />

  {/* 商品配置 */}
  <ComboItemGroupsConfig />      {/* 分组配置 */}
  <Form.Item name="comboItems">
    <ComboItemsInput />           {/* 商品列表 */}
  </Form.Item>

  {/* 价格与折扣 */}
  <Form.Item name="discountType" ... />
  <Form.Item name="discount" ... />

  {/* 时段限制 */}
  <ComboAvailabilityConfig />     {/* 时段配置 */}

  {/* 提交按钮 */}
  <Form.Item>Submit</Form.Item>
</Form>
```

---

## 工作流程

### 创建套餐流程

1. **用户点击"创建套餐"**
   - 清空所有状态（包括新增字段）
   - 显示创建模态框
   - 图片上传功能禁用（需要先保存套餐）

2. **用户填写表单**
   - 填写基本信息
   - 添加商品
   - **可选：** 配置商品分组
   - **可选：** 配置时段限制
   - **不可用：** 上传图片（需要先保存）

3. **用户提交表单**
   - 收集所有字段值
   - 调用 `createCombo()` API
   - 后端验证所有新字段
   - 返回创建的套餐信息

4. **套餐创建成功**
   - 刷新套餐列表
   - 用户可以编辑套餐来上传图片

### 编辑套餐流程

1. **用户点击"编辑套餐"**
   - 加载套餐详情
   - 初始化所有状态（包括新增字段）
   - 所有功能都可用（包括图片上传）

2. **用户修改表单**
   - 修改任何字段
   - 上传/删除图片
   - 修改分组或时段限制

3. **用户提交表单**
   - 收集所有修改的字段值
   - 调用 `updateCombo()` API
   - 仅更新提供的字段（其他字段保持不变）

### 删除套餐流程

1. **用户点击"删除套餐"**
   - 确认删除
   - 调用 `deleteCombo()` API

2. **后端处理**
   - 删除套餐记录
   - 删除所有关联的商品（combo_items）
   - 删除Cloudinary上的图片（如果有）

---

## 向后兼容性

所有新功能都是完全可选的：

- 现有的套餐（没有新字段）继续正常工作
- 新字段在数据库中为NULL/undefined时不显示
- 禁用新功能不会删除已保存的配置（只是UI隐藏）
- 可以在任何时候启用或禁用新功能，而不会丢失其他数据

---

## 性能考虑

1. **图片存储**
   - 使用Cloudinary存储，不占用服务器存储
   - 图片URL存在数据库，无须额外查询
   - 删除时自动清理Cloudinary资源

2. **JSON字段**
   - item_groups 和 availability_rules 使用JSON存储
   - PostgreSQL JSONB类型，支持查询和索引
   - 大多数套餐不会有复杂的分组配置，存储高效

3. **查询性能**
   - 分组和时段限制信息随套餐一起返回
   - 无需额外查询来获取配置
   - `isComboAvailable()` 是前端内存计算，不涉及数据库

---

## 安全考虑

1. **文件上传**
   - 文件类型验证（仅JPG/PNG/WebP）
   - 文件大小限制（5MB）
   - Multer配置限制

2. **数据验证**
   - 后端验证所有JSON字段结构
   - 防止malformed JSON导入数据库
   - 验证groupId存在

3. **权限控制**
   - 所有API端点使用 `optionalAuth` 中间件
   - 租户隔离（通过JWT中的tenantId）
   - Cloudinary资源按租户分隔

---

## 错误处理

### 前端错误处理

```typescript
// 图片上传失败
try {
  await uploadComboImage(comboId, file)
} catch (error) {
  message.error(error?.response?.data?.error || '图片上传失败')
}

// 表单提交失败
try {
  await createCombo(payload)
} catch (error) {
  message.error('创建套餐失败')
}
```

### 后端错误处理

```typescript
// 验证失败
if (!validateItemGroups(itemGroups)) {
  return res.status(400).json({ error: '分组配置无效' })
}

// 文件验证失败
if (!file) {
  return res.status(400).json({ error: '未提供图片文件' })
}

// Cloudinary上传失败
catch (error) {
  return res.status(500).json({ error: '图片上传失败' })
}
```

---

## 测试覆盖

详见 [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md)

测试场景包括：
- 创建不使用新功能的套餐（兼容性）
- 创建使用所有新功能的套餐（完整功能）
- 编辑套餐和加载新字段
- 删除套餐和级联删除
- 各功能的启用/禁用
- 边界条件和错误场景

---

## 迁移指南

### 对现有代码的影响

**最小影响 - 所有新字段都是可选的：**

1. 创建套餐时无需提供新字段
2. 获取套餐时新字段可能为 undefined
3. 更新套餐时不提供新字段则不更新

### 升级步骤

1. 运行数据库迁移：`npx prisma db push`
2. 重新编译后端：`npm run build`
3. 重新编译前端：`npm run build`
4. 部署应用
5. 现有套餐自动使用新功能（无需修改）

---

## 常见问题

**Q: 图片上传为什么只在编辑时可用？**
A: 为了避免孤立的图片资源。上传前需要套餐ID，而创建时ID还不存在。用户可以先创建套餐再编辑添加图片。

**Q: 可以禁用某个功能吗？**
A: 可以。在表单中不勾选相应的复选框即可禁用任何功能，而不会影响其他数据。

**Q: 是否可以同时使用分组和时段限制？**
A: 完全可以。它们是独立的功能，可以任意组合。

**Q: 旧的套餐会影响吗？**
A: 完全不影响。旧套餐会继续使用现有的字段，新字段为空。

**Q: 分组对价格有影响吗？**
A: 没有。分组是为了UI展示和选择约束，不影响价格计算。价格仍然是基于商品的总和和折扣。

---

## 相关文档

- [COMBO_INTEGRATION_GUIDE.md](./COMBO_INTEGRATION_GUIDE.md) - 前端集成指南
- [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md) - 端到端测试指南
- API.md - (项目顶级) 完整API文档

