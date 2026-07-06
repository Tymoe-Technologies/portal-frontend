# 菜单中心 - 价格单位适配指南

## 概述

后端服务已完成从**元（Decimal）**到**分（BigInt）**的价格单位迁移。前端菜单中心需要进行相应的适配以正确处理新的价格格式。

## 价格转换规则

- **1 元 = 100 分**
- **存储**：分（BigInt）
- **传输**：元（用户输入）或分（API响应）
- **显示**：元（格式化为小数点后2位）

## 前端适配步骤

### 1. 导入价格转换工具

```typescript
import {
  toMinorUnit,          // 主单位 → 副单位
  fromMinorUnit,        // 副单位 → 主单位（数字）
  formatAmount,         // 副单位 → 主单位（字符串）
  formatPrice,          // 副单位 → 主单位（带符号）
  parseUserInput,       // 用户输入 → 副单位
  PriceFormatter,       // 格式化工具类
  PriceAPIAdapter       // API适配工具
} from '@/utils/priceConverter'
```

### 2. 菜单中心数据交互改动

#### 2.1 创建/编辑商品

**原来的做法**：
```typescript
const item = {
  basePrice: 5.99,    // 元
  cost: 3.00         // 元
}
```

**新的做法**：
```typescript
// 用户在表单中输入元
const userInput = {
  basePrice: 5.99,
  cost: 3.00
}

// 发送API请求时转换为副单位
const payload = {
  basePrice: toMinorUnit(userInput.basePrice),  // 599
  cost: toMinorUnit(userInput.cost)            // 300
}
```

#### 2.2 显示商品信息

**原来的做法**：
```typescript
function displayItem(item: Item) {
  return `¥${item.basePrice.toFixed(2)}`
}
```

**新的做法**：
```typescript
function displayItem(item: Item) {
  // API返回的是分，需要转换为元显示
  return formatPrice(item.basePrice)  // 返回 "¥5.99"
}

// 或者
function displayItem(item: Item) {
  const mainUnit = fromMinorUnit(item.basePrice)
  return `${mainUnit.toFixed(2)}`
}
```

#### 2.3 自定义选项选项价格

**原来的做法**：
```typescript
const option = {
  displayName: '大杯',
  defaultPrice: 1.00  // 元
}
```

**新的做法**：
```typescript
// API返回的defaultPrice是分
const option = {
  displayName: '大杯',
  defaultPrice: 100   // 分
}

// 显示时转换
const display = formatPrice(option.defaultPrice)  // "¥1.00"
```

#### 2.4 商品自定义选项价格设置

**原来的做法**：
```typescript
async setItemModifierPrices(itemId, prices) {
  const payload = {
    prices: [
      { modifierOptionId: 'uuid-1', price: 1.50 }  // 元
    ]
  }
  return api.post('/items/:id/modifier-prices', payload)
}
```

**新的做法**：
```typescript
async setItemModifierPrices(itemId, prices) {
  const payload = {
    prices: [
      {
        modifierOptionId: 'uuid-1',
        price: yuanToCents(1.50)  // 转换为分: 150
      }
    ]
  }
  return api.post('/items/:id/modifier-prices', payload)
}
```

### 3. 菜单中心文件修改清单

#### 3.1 MenuCenter/index.tsx

**需要修改的地方**：

1. **商品列表显示**
   ```typescript
   // 在渲染商品价格时使用formatPrice
   <span>{formatPrice(item.basePrice)}</span>
   ```

2. **创建/编辑商品表单**
   ```typescript
   // 提交时转换
   const handleSubmit = (values: ItemFormData) => {
     const payload = {
       ...values,
       basePrice: yuanToCents(values.basePrice),
       cost: values.cost ? yuanToCents(values.cost) : undefined
     }
     // 调用API
   }
   ```

3. **自定义选项选项显示**
   ```typescript
   // 显示自定义选项默认价格
   <span>{formatPrice(option.defaultPrice)}</span>
   ```

#### 3.2 MenuCenter/ModifierGroupManager.tsx

**需要修改的地方**：

1. **自定义选项选项价格显示**
   ```typescript
   // 显示自定义选项选项的默认价格和商品级价格
   const displayPrice = (cents) => formatPrice(cents)
   ```

2. **编辑自定义选项选项**
   ```typescript
   // 编辑时转换
   const handleSaveOption = (option: ModifierOption) => {
     const payload = {
       ...option,
       defaultPrice: yuanToCents(option.defaultPrice)  // 用户输入的元转分
     }
   }
   ```

3. **商品级自定义选项价格覆盖**
   ```typescript
   // 设置商品级价格时
   const itemPrice = parseUserInput(userInput)  // 自动转换为分
   ```

#### 3.3 ItemManagement/index.tsx

**需要修改的地方**：

1. **商品列表价格列**
   ```typescript
   // 显示商品价格
   <Column
     title="售价"
     dataIndex="basePrice"
     render={(price) => formatPrice(price)}
   />
   ```

2. **创建/编辑商品**
   ```typescript
   // 同MenuCenter/index.tsx的修改
   ```

### 4. 服务层修改 - item-management.ts

**需要修改的地方**：

1. **商品相关API调用**
   ```typescript
   // 获取商品列表
   export async function getItems(params?: ItemListParams): Promise<Item[]> {
     const response = await httpService.get('/items', { params })
     // 如果需要立即显示，可以在这里转换，但通常交给组件处理
     return response.data
   }

   // 创建商品
   export async function createItem(data: Partial<Item>): Promise<Item> {
     const payload = {
       ...data,
       basePrice: toMinorUnit(data.basePrice),  // 转换为副单位
       cost: data.cost ? toMinorUnit(data.cost) : undefined
     }
     return httpService.post('/items', payload)
   }

   // 更新商品
   export async function updateItem(id: string, data: Partial<Item>): Promise<Item> {
     const payload: any = { ...data }
     if (data.basePrice !== undefined) {
       payload.basePrice = toMinorUnit(data.basePrice)
     }
     if (data.cost !== undefined) {
       payload.cost = toMinorUnit(data.cost)
     }
     return httpService.patch(`/items/${id}`, payload)
   }
   ```

2. **自定义选项相关API调用**
   ```typescript
   // 创建自定义选项选项
   export async function createModifierOption(
     groupId: string,
     data: CreateModifierOptionPayload
   ): Promise<ModifierOption> {
     const payload = {
       ...data,
       defaultPrice: data.defaultPrice ? toMinorUnit(data.defaultPrice) : 0,
       cost: data.cost ? toMinorUnit(data.cost) : undefined
     }
     return httpService.post(`/modifier-groups/${groupId}/options`, payload)
   }

   // 设置商品自定义选项价格
   export async function setItemModifierPrices(
     itemId: string,
     prices: Array<{ modifierOptionId: string; price: number }>
   ): Promise<void> {
     const payload = {
       prices: prices.map(p => ({
         ...p,
         price: toMinorUnit(p.price)  // 转换为副单位
       }))
     }
     return httpService.post(`/items/${itemId}/modifier-prices`, payload)
   }
   ```

3. **Combo相关API调用**
   ```typescript
   // 创建Combo
   export async function createCombo(data: CreateComboPayload): Promise<Combo> {
     const payload = {
       ...data,
       basePrice: toMinorUnit(data.basePrice),
       discount: data.discount ? toMinorUnit(data.discount) : undefined
     }
     return httpService.post('/combos', payload)
   }
   ```

### 5. 表单组件修改

#### 5.1 商品价格输入

```typescript
import { Form, Input } from 'antd'

<Form.Item name="basePrice" label="售价" rules={[{ required: true }]}>
  <Input
    type="number"
    step="0.01"
    placeholder="请输入元为单位的价格"
    // 用户输入的是元，保存时转换为分
  />
</Form.Item>
```

#### 5.2 显示价格

```typescript
// 显示从API获取的价格（分为单位）
<div>
  售价：{formatPrice(item.basePrice)}
</div>

// 或使用PriceFormatter工具类
const priceFormatter = new PriceFormatter('¥', 2)
<div>
  售价：{priceFormatter.format(item.basePrice)}
</div>
```

### 6. 高级用法 - PriceAPIAdapter

对于批量处理价格数据，使用`PriceAPIAdapter`工具：

```typescript
import { PriceAPIAdapter } from '@/utils/priceConverter'

// 获取商品列表后自动转换价格字段
async function getItemsDisplay() {
  const items = await getItems()

  // 转换价格为显示格式
  return PriceAPIAdapter.convertPriceArray(items, ['basePrice', 'cost'])

  // 返回的数据结构：
  // {
  //   basePrice: 599,           // 原始分
  //   basePriceDisplay: "5.99",  // 显示格式
  //   cost: 300,
  //   costDisplay: "3.00",
  //   ...
  // }
}
```

## 常见问题

### Q1: API返回的是BigInt还是number？
**A**: API返回的价格字段是`number`类型（不是JavaScript的BigInt）。后端在返回时已经转换为普通数字。

### Q2: 用户输入表单时应该以什么单位输入？
**A**: 用户输入应该以**元**为单位（这是自然的用户体验）。在发送API请求前，需要使用`yuanToCents()`转换为分。

### Q3: 如何处理小数点舍入？
**A**: 使用`yuanToCents()`函数，它内部使用`Math.round()`来处理舍入，确保精度。

### Q4: 为什么不直接用BigInt？
**A**: 为了兼容性。JavaScript中BigInt操作有限制，使用number类型（范围到2^53-1）足以表示全球任何货币的价格。

## 总结

| 操作 | 方向 | 函数 | 示例 |
|------|------|------|------|
| 用户输入 → 存储 | 主单位 → 副单位 | `toMinorUnit` | `toMinorUnit(5.99)` → `599` |
| API返回 → 显示 | 副单位 → 主单位 | `formatPrice` | `formatPrice(599)` → `"5.99"` |
| 获取纯数值 | 副单位 → 主单位 | `fromMinorUnit` | `fromMinorUnit(599)` → `5.99` |
| 用户输入字符串 | 字符串 → 副单位 | `parseUserInput` | `parseUserInput("5.99")` → `599` |

## 测试检查清单

- [ ] 商品列表显示价格正确
- [ ] 创建商品时价格转换正确
- [ ] 编辑商品时价格转换正确
- [ ] 自定义选项选项显示价格正确
- [ ] 设置商品自定义选项价格转换正确
- [ ] Combo组合商品价格转换正确
- [ ] 所有小数点舍入正确（避免出现 5.995 这样的显示）
- [ ] 菜单同步功能中的价格转换正确

## 参考

- 后端迁移文档：`../tymoe-item-management/PRICE_MIGRATION_IMPLEMENTATION_GUIDE.md`
- 价格工具函数：`src/utils/priceConverter.ts`
- 项目API服务：`src/services/item-management.ts`
