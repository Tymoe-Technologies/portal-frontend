# 套餐增强功能集成指南

## 集成步骤

### 1. 导入新组件和类型

在 `MenuCenter/index.tsx` 文件顶部的导入部分添加：

```typescript
import { ComboItemGroupsConfig } from './components/ComboItemGroupsConfig';
import { ComboAvailabilityConfig } from './components/ComboAvailabilityConfig';
import { ComboImageUpload } from './components/ComboImageUpload';
import type { ComboItemGroup, ComboAvailabilityRules } from '@/services/item-management';
```

### 2. 修改组件状态（与 editingCombo 相同的位置）

在现有的 comboForm 初始化中添加新字段：

```typescript
const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
// 添加以下状态来保存新组件的值
const [comboImageUrl, setComboImageUrl] = useState<string | undefined>();
const [comboItemGroups, setComboItemGroups] = useState<ComboItemGroup[]>([]);
const [comboAvailabilityRules, setComboAvailabilityRules] = useState<ComboAvailabilityRules | undefined>();
```

### 3. 修改 handleCreateCombo 函数

在 `handleCreateCombo` 中初始化新状态：

```typescript
const handleCreateCombo = () => {
  setEditingCombo(null);
  comboForm.resetFields();
  // 初始化新字段
  setComboImageUrl(undefined);
  setComboItemGroups([]);
  setComboAvailabilityRules(undefined);
  setComboModalVisible(true);
};
```

### 4. 修改 handleEditCombo 函数

在现有代码之后添加：

```typescript
// 在 setComboModalVisible(true) 之前添加
setComboImageUrl(combo.imageUrl);
setComboItemGroups(combo.itemGroups || []);
setComboAvailabilityRules(combo.availabilityRules || { enabled: false });
```

### 5. 修改 handleSaveCombo 函数

修改函数来处理新字段：

```typescript
const handleSaveCombo = async (values: CreateComboPayload) => {
  setLoading(prev => ({ ...prev, creating: true }));
  try {
    const payload: CreateComboPayload = {
      ...values,
      imageUrl: comboImageUrl,
      itemGroups: comboItemGroups.length > 0 ? comboItemGroups : undefined,
      availabilityRules: comboAvailabilityRules?.enabled ? comboAvailabilityRules : undefined,
    };

    if (editingCombo) {
      await itemManagementService.updateCombo(editingCombo.id, payload);
      message.success(t('pages.menuCenter.updateComboSuccess'));
    } else {
      await itemManagementService.createCombo(payload);
      message.success(t('pages.menuCenter.createComboSuccess'));
    }
    setComboModalVisible(false);
    loadCombos();
  } catch (error) {
    console.error('Failed to save combo:', error);
    message.error(editingCombo ? t('pages.menuCenter.updateComboFailed') : t('pages.menuCenter.createComboFailed'));
  } finally {
    setLoading(prev => ({ ...prev, creating: false }));
  }
};
```

### 6. 在套餐模态框中添加新组件

在套餐 Modal 的 Form 内部，按照以下顺序添加组件：

#### 6.1 在基本信息部分之后添加图片上传：

```jsx
{/* 套餐图片 */}
<Form.Item label="套餐图片">
  <ComboImageUpload
    comboId={editingCombo?.id}
    imageUrl={comboImageUrl}
    onImageChange={setComboImageUrl}
    disabled={!editingCombo && !comboForm.getFieldValue('name')}
  />
</Form.Item>

<Divider>商品配置</Divider>
```

#### 6.2 在 ComboItemsInput 组件之前添加分组配置：

```jsx
{/* 商品分组配置 */}
<Form.Item noStyle>
  <ComboItemGroupsConfig
    groups={comboItemGroups}
    onGroupsChange={setComboItemGroups}
    comboItems={comboForm.getFieldValue('comboItems') || []}
    onComboItemsChange={(items) => {
      comboForm.setFieldsValue({ comboItems: items });
    }}
    allItems={allItems}
  />
</Form.Item>

<Divider>商品选择</Divider>

{/* 现有的 ComboItemsInput 组件 */}
```

#### 6.3 在价格与折扣部分之后添加时段限制：

```jsx
{/* 在 "价格与折扣" Divider 之后，现有的价格设置代码之前添加 */}

<Divider>可用性设置</Divider>

{/* 时段限制 */}
<Form.Item noStyle>
  <ComboAvailabilityConfig
    value={comboAvailabilityRules}
    onChange={setComboAvailabilityRules}
  />
</Form.Item>
```

## 关键修改位置汇总

| 位置 | 修改内容 |
|------|---------|
| 文件顶部导入 | 导入 3 个新组件和 2 个新类型接口 |
| State 声明 | 添加 3 个新状态变量 |
| `handleCreateCombo` | 初始化新状态 |
| `handleEditCombo` | 读取并设置新字段 |
| `handleSaveCombo` | 将新字段包含在 payload 中发送 |
| Modal Form 内部 | 按照指定位置添加 3 个组件 |

## 数据流向

```
用户输入 (组件状态)
    ↓
ComboItemGroupsConfig 更新 comboItemGroups
ComboAvailabilityConfig 更新 comboAvailabilityRules
ComboImageUpload 更新 comboImageUrl
    ↓
handleSaveCombo 收集所有状态
    ↓
创建 payload 对象并发送给后端 API
    ↓
后端验证并保存到数据库
```

## 注意事项

1. **图片上传时机**：图片只能在套餐创建后上传，所以 ComboImageUpload 的 disabled 属性会在新建时禁用

2. **分组验证**：后端会验证分组配置的有效性，确保没有无效数据

3. **可选功能**：所有新功能都是可选的，不启用时表单不会发送对应的字段

4. **向后兼容**：修改现有套餐时，如果没有这些字段，会保持原样

## 测试检查清单

- [ ] 创建没有分组和时段的套餐（验证向后兼容）
- [ ] 创建带有商品分组的套餐
- [ ] 创建带有时段限制的套餐（测试时段 + 星期的组合）
- [ ] 上传套餐图片
- [ ] 编辑现有套餐并更新新字段
- [ ] 验证表单提交的数据结构正确
- [ ] 验证后端 API 返回正确格式的数据
