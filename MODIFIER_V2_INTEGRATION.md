# 商品自定义选项配置集成完成 (Modifier v2.0)

## 概述

已完成商品自定义选项配置功能的前端集成，基于后端 Modifier v2.0 API 规范。

## 完成的工作

### 1. 服务层更新 (`src/services/item-management.ts`)

- ✅ 添加了 `ConfigureItemModifierOptionsPayload` 类型
- ✅ 实现了 `configureItemModifierOptions()` 方法
- ✅ 实现了 `removeItemModifierOption()` 方法
- ✅ 更新了 `ModifierOption` 接口，添加 `itemOptions` 字段
- ✅ 导出新增的API方法

### 2. 新增商品自定义选项配置组件 (`src/pages/MenuCenter/index.tsx`)

创建了 `ItemModifierConfigInput` 组件，支持：

- **自定义选项组选择**: 从可用的自定义选项组中选择需要关联的组
- **选择规则配置**: 
  - 是否必选 (isRequired)
  - 最少选择数 (minSelections)
  - 最多选择数 (maxSelections)
- **选项配置**:
  - 启用/禁用特定选项 (isEnabled)
  - 设置默认选项 (isDefault)
  - 覆盖选项价格 (商品级价格)

### 3. 商品表单更新

- ✅ 替换旧的"自定义选项配置"标签页，使用新的 `ItemModifierConfigInput` 组件
- ✅ 表单字段从 `itemAddons` 更改为 `itemModifiers`

### 4. 商品创建/更新逻辑

更新了 `handleItemSubmit()` 函数，正确调用三个API:

1. **关联自定义选项组** (`POST /items/{itemId}/modifier-groups`)
   - 定义选择规则（是否必选、最少/最多选择数）
   
2. **配置选项行为** (`POST /items/{itemId}/modifier-options`)
   - 设置哪些选项启用/禁用
   - 设置默认选项
   - 定义显示顺序

3. **设置商品级价格** (`POST /items/{itemId}/modifier-prices`)
   - 为特定选项设置覆盖价格

### 5. 商品编辑功能

更新了 `handleEditItem()` 函数：

- ✅ 从 API 加载商品的自定义选项配置
- ✅ 正确解析 `itemOptions` 数据结构
- ✅ 填充表单以显示现有配置

### 6. 初始化数据加载

- ✅ 添加 `useEffect` 在页面初始化时加载自定义选项组
- ✅ 自定义选项组数据在创建/编辑商品时可用

## API 集成说明

根据 API 文档，自定义选项配置遵循三层结构：

```
1. ModifierGroup (自定义选项组级)
   └─ 定义什么是自定义选项组（如"杯型"、"加料"）

2. ModifierOption (自定义选项选项级)  
   └─ 定义选项本身（如"大杯"、"中杯"）
   └─ 定义默认价格和成本
   └─ ❌ 不定义：是否默认选中、启用状态

3. ItemModifierOption (商品关联级) ⭐ 核心
   └─ 定义选项在【特定商品】中的配置
   └─ 是否默认、是否启用、显示顺序
```

## 使用流程

### 创建商品并配置自定义选项

1. 打开"菜单中心"
2. 选择分类，点击"添加商品"
3. 填写基本信息
4. 切换到"自定义选项配置"标签页
5. 选择需要的自定义选项组（如"杯型"）
6. 配置选择规则（是否必选、最少/最多选择）
7. 为每个选项配置：
   - 是否启用
   - 是否设为默认
   - 覆盖价格（可选）
8. 保存商品

### 编辑商品自定义选项

1. 点击商品的"编辑"按钮
2. 切换到"自定义选项配置"标签页
3. 修改配置（系统会先清除旧配置，然后应用新配置）
4. 保存

## 注意事项

1. **自定义选项组管理**: 需要先在"自定义选项组"标签页创建自定义选项组和选项
2. **价格优先级**: 
   - 渠道覆盖价格 > 商品级定价 > 自定义选项默认价格
3. **套餐自定义选项**: Combo 不需要自己的自定义选项，通过 ComboItem 自动继承 Item 的自定义选项

## 待办事项

- [ ] 添加自定义选项配置的批量导入/导出功能
- [ ] 优化自定义选项组选择的 UI（支持搜索和筛选）
- [ ] 添加自定义选项配置预览功能
- [ ] 添加自定义选项配置模板功能

## 测试建议

1. 测试创建带自定义选项的商品
2. 测试编辑商品自定义选项配置
3. 测试价格覆盖是否正确保存和显示
4. 测试默认选项是否正确设置
5. 测试启用/禁用选项是否生效
6. 测试选择规则验证（最少/最多选择）

## 相关文件

- `src/services/item-management.ts` - API 服务层
- `src/pages/MenuCenter/index.tsx` - 菜单中心主页面
- `src/pages/MenuCenter/ModifierGroupManager.tsx` - 自定义选项组管理
- `src/pages/MenuCenter/ModifierGroupApi/api.md` - API 文档

---

**更新日期**: 2025-10-30
**版本**: 1.0.0

