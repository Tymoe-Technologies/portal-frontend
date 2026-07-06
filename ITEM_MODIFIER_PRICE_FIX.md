# 商品自定义选项价格显示修复

## 问题描述

商品自定义选项配置页面没有正确显示和处理商品级价格覆盖（Item Modifier Price）。

## 修复内容

### 1. 更新类型定义 (`src/services/item-management.ts`)

为 `ModifierOption` 接口添加了价格相关字段：

```typescript
export interface ModifierOption {
  // ... 其他字段
  
  // 商品级价格覆盖（仅在获取商品自定义选项时返回）
  itemPrice?: number | null  // null表示未设置商品级价格
  finalPrice?: number        // 最终价格（已处理优先级）
}
```

根据API文档，`GET /items/{itemId}/modifiers` 响应中包含：
- `defaultPrice`: 选项的默认价格
- `itemPrice`: 商品对该选项的定价覆盖 (null = 未设置)
- `finalPrice`: 最终价格

### 2. 编辑功能：加载商品价格 (`handleEditItem`)

更新了编辑商品时加载自定义选项配置的逻辑：

```typescript
// 检查是否有商品级价格覆盖
if (option.itemPrice !== null && option.itemPrice !== undefined) {
  optionPrices[option.id] = typeof option.itemPrice === 'string' 
    ? parseFloat(option.itemPrice) 
    : option.itemPrice
}
```

现在编辑商品时：
- ✅ 正确从API响应中提取 `itemPrice`
- ✅ 将商品级价格填充到表单的 `optionPrices` 字段
- ✅ 在UI中显示已设置的商品价格

### 3. UI改进：价格显示和编辑

优化了选项配置卡片的布局和功能：

**显示改进：**
- 默认价格显示更简洁：`默认: ¥8.00`
- 商品价格输入框使用 placeholder 提示默认价格
- 已设置商品价格时，显示"清除"按钮

**新增功能：**
- ✅ 清除按钮：点击可清除商品级价格，恢复使用默认价格
- ✅ 禁用状态：选项未启用时，价格输入和清除按钮都会禁用
- ✅ 视觉反馈：已设置商品价格时显示清除按钮

**列布局调整：**
```
| 启用 (1) | 选项名称 (6) | 默认价格 (5) | 商品价格+清除 (7) | 默认选项 (5) |
```

### 4. 价格优先级说明

系统使用三级价格优先级：

```
1. 渠道覆盖价格 (SourceModifierPrice)    [最高]
   ↓
2. 商品级定价 (ItemModifierPrice)        [中]
   ↓
3. 自定义选项默认价格 (ModifierOption.defaultPrice) [最低]
```

- **默认价格**：在自定义选项组管理中设置，所有商品共享
- **商品价格**：在商品配置中设置，仅对该商品生效，覆盖默认价格
- **渠道价格**：在渠道配置中设置，对特定渠道的该商品该选项生效，优先级最高

## 使用示例

### 场景1：设置商品级价格

1. 创建/编辑商品
2. 进入"自定义选项配置"标签页
3. 选择自定义选项组（如"杯型"）
4. 在选项配置中：
   - 默认价格：¥2.00（来自自定义选项组）
   - 商品价格：输入 ¥2.50（该商品的特殊价格）
5. 保存后，该商品的这个选项将使用 ¥2.50

### 场景2：清除商品级价格

1. 编辑已有商品级价格的商品
2. 进入"自定义选项配置"标签页
3. 看到已设置的商品价格（如 ¥2.50）
4. 点击"清除"按钮
5. 保存后，该商品的这个选项将恢复使用默认价格 ¥2.00

### 场景3：编辑显示现有价格

1. 编辑已配置自定义选项价格的商品
2. 系统自动加载并显示：
   - 默认价格：自定义选项组设置的价格
   - 商品价格：如果之前设置了商品级价格，输入框中会显示该值
   - 清除按钮：已设置商品价格时自动显示

## API调用流程

### 编辑商品时加载价格

```javascript
// 1. 获取商品自定义选项配置
const itemModifiers = await itemManagementService.getItemModifiers(itemId)

// 2. API响应包含价格信息
{
  groups: [{
    group: {
      options: [{
        id: "opt-001",
        defaultPrice: 2.00,    // 默认价格
        itemPrice: 2.50,       // 商品价格（如果设置了）
        finalPrice: 2.50       // 最终价格
      }]
    }
  }]
}

// 3. 提取价格到表单
if (option.itemPrice !== null && option.itemPrice !== undefined) {
  optionPrices[option.id] = option.itemPrice
}
```

### 保存商品价格

```javascript
// 如果有价格覆盖，调用价格设置API
if (Object.keys(modifierConfig.optionPrices).length > 0) {
  await itemManagementService.setItemModifierPrices(itemId, {
    prices: [
      { modifierOptionId: "opt-001", price: 2.50 }
    ]
  })
}
```

## 测试检查清单

- [ ] 创建新商品，设置商品级价格
- [ ] 编辑现有商品，显示已设置的商品价格
- [ ] 修改商品价格，保存后再次编辑验证
- [ ] 使用"清除"按钮清除商品价格
- [ ] 禁用选项时，价格输入框和清除按钮应该禁用
- [ ] 启用选项后，价格输入框和清除按钮应该可用
- [ ] 验证价格优先级：商品价格 > 默认价格

## 相关文件

- `src/services/item-management.ts` - 类型定义更新
- `src/pages/MenuCenter/index.tsx` - UI和逻辑更新
- `src/pages/MenuCenter/ModifierGroupApi/api.md` - API文档参考

## 注意事项

1. **价格为null vs undefined**：
   - `null`：明确表示未设置商品价格，使用默认价格
   - `undefined`：表单中未填写，也会被视为未设置

2. **清除价格**：
   - 前端：将 `optionPrices[optionId]` 设置为 `null` 或删除
   - 保存时：如果价格数组为空，不调用设置价格API
   - 或调用 `DELETE /items/{itemId}/modifier-prices/{optionId}`

3. **显示逻辑**：
   - 只有在 `optionPrices` 对象中存在该选项ID时才显示清除按钮
   - placeholder 始终显示默认价格，提供参考

---

**更新日期**: 2025-10-30
**问题追踪**: 商品自定义选项价格显示问题
**状态**: ✅ 已修复

