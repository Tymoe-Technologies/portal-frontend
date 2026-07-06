# 配方打印代码系统 - 完整指南

## 📋 概述

新的配方打印代码系统允许通过步骤编辑器自动生成打印代码，支持设备步骤包含其他步骤。

## 🎯 核心概念

### 1. 步骤类型（StepType）

每个步骤类型包含：
- **code**: 打印代码（如：`mk` 表示 milk）
- **name**: 显示名称（如：牛奶）
- **category**: 类别（ingredient/equipment/action）
- **isContainer**: 是否是容器步骤（设备步骤）
- **containerPrefix/Suffix**: 容器前后缀（如：`[` 和 `]`）

### 2. 配方步骤（RecipeStep）

每个步骤包含：
- **stepTypeId**: 步骤类型ID
- **instruction**: 用户输入的指令（数量/操作/快捷键等）
- **containedSteps**: 包含的其他步骤索引（设备步骤专用）
- **generatedPrintCode**: 自动生成的打印代码

### 3. 打印代码生成规则

#### 普通步骤
```
打印代码 = 步骤代码 + instruction
```

**示例**:
- Milk (mk) + 200 = `mk200`
- Sugar (sg) + 50 = `sg50`
- Heat (ht) + (空) = `ht`

#### 设备步骤（容器步骤）
```
打印代码 = [包含的步骤代码]设备instruction
```

**示例**:
- 搅拌机 ([]) 包含 mk200，按2键 = `[mk200]2`
- 搅拌机 ([]) 包含 mk200 + sg50，按3键 = `[mk200sg50]3`

#### 完整配方
```
recipe打印代码 = 所有未被包含的步骤代码连接
```

**被包含的步骤不会单独打印**

---

## 📝 使用示例

### 示例1：简单奶茶

**步骤设置**:
1. 步骤1: Milk (mk) + instruction: "200"
2. 步骤2: Tea (tea) + instruction: "100"
3. 步骤3: Sugar (sg) + instruction: "50"

**生成的打印代码**:
- 步骤1: `mk200`
- 步骤2: `tea100`
- 步骤3: `sg50`
- **Recipe打印代码**: `mk200tea100sg50`

---

### 示例2：带搅拌机的奶茶

**步骤设置**:
1. 步骤1: Milk (mk) + instruction: "200"
2. 步骤2: Tea (tea) + instruction: "100"
3. 步骤3: Blender ([]) + instruction: "2" + 包含: [步骤1, 步骤2]
4. 步骤4: Sugar (sg) + instruction: "50"

**生成的打印代码**:
- 步骤1: `mk200` (被包含，不单独打印)
- 步骤2: `tea100` (被包含，不单独打印)
- 步骤3: `[mk200tea100]2` ✅
- 步骤4: `sg50` ✅
- **Recipe打印代码**: `[mk200tea100]2sg50`

---

### 示例3：复杂场景 - 多层包含

**步骤设置**:
1. 步骤1: Water (wt) + instruction: "300"
2. 步骤2: Coffee Powder (cf) + instruction: "20g"
3. 步骤3: Coffee Machine (<>) + instruction: "hot" + 包含: [步骤1, 步骤2]
4. 步骤4: Milk (mk) + instruction: "200"
5. 步骤5: Blender ([]) + instruction: "3" + 包含: [步骤3, 步骤4]

**生成的打印代码**:
- 步骤1: `wt300` (被步骤3包含)
- 步骤2: `cf20g` (被步骤3包含)
- 步骤3: `<wt300cf20g>hot` (被步骤5包含)
- 步骤4: `mk200` (被步骤5包含)
- 步骤5: `[<wt300cf20g>hotmk200]3` ✅
- **Recipe打印代码**: `[<wt300cf20g>hotmk200]3`

---

## 🛠️ 前端实现

### 组件结构

```
RecipeFormWithSteps (表单)
  └── RecipeStepEditor (步骤编辑器)
        ├── 步骤列表
        ├── 实时预览
        └── 最终打印代码显示
```

### 核心文件

1. **类型定义**: `src/services/recipe/types.ts`
   - RecipeStep: 包含 instruction 和 containedSteps
   - StepType: 包含 isContainer 和容器前后缀

2. **打印代码生成器**: `src/utils/printCodeGenerator.ts`
   - `generateStepPrintCode()`: 生成单个步骤代码
   - `generateRecipePrintCode()`: 生成完整配方代码
   - `generateStepPreviews()`: 实时预览

3. **步骤编辑器**: `src/pages/RecipeGuide/RecipeStepEditor.tsx`
   - 添加/删除/排序步骤
   - 选择步骤类型
   - 输入 instruction
   - 设备步骤选择包含的步骤
   - 实时显示生成的打印代码

4. **配方表单**: `src/pages/RecipeGuide/RecipeFormWithSteps.tsx`
   - 整合步骤编辑器
   - 提交到后端

---

## 🔧 后端要求

### 数据库字段

**recipes 表**:
- `print_code`: 商品打印代码（如：LICE）
- `recipe_print_code`: 完整制作打印代码（自动生成）

**recipe_steps 表**:
- `step_type_id`: 步骤类型ID
- `instruction`: 用户输入的instruction
- `contained_steps`: JSON数组，包含的步骤ID
- `generated_print_code`: 生成的打印代码
- `display_order`: 显示顺序

**step_types 表**:
- `code`: 打印代码
- `is_container`: 是否是容器步骤
- `container_prefix`: 容器前缀（默认：`[`）
- `container_suffix`: 容器后缀（默认：`]`）

### API 更新

#### 创建/更新配方
```typescript
POST /recipes
{
  "itemId": "item-001",
  "printCode": "LICE",
  "conditions": [...],
  "steps": [
    {
      "stepTypeId": "type-001",
      "displayOrder": 1,
      "instruction": "200",
      "containedSteps": []  // 步骤索引数组
    },
    {
      "stepTypeId": "type-002",
      "displayOrder": 2,
      "instruction": "2",
      "containedSteps": [0]  // 包含步骤0
    }
  ]
}
```

后端需要：
1. 加载所有步骤类型
2. 根据步骤顺序和包含关系生成打印代码
3. 保存 `recipe_print_code` 到数据库

---

## 📊 UI/UX 设计

### 步骤卡片

```
┌────────────────────────────────────────┐
│ 步骤 1                    mk200 [↑][↓][×]│
├────────────────────────────────────────┤
│ 步骤类型: [Milk (mk)            ▼]     │
│ Instruction: [200_____________]        │
│                                        │
│ ℹ️ 代码: mk + 200 = mk200              │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 步骤 2  🔧设备  [mk200]2  [↑][↓][×]    │
├────────────────────────────────────────┤
│ 步骤类型: [Blender ([])         ▼]     │
│ Instruction: [2________________]       │
│                                        │
│ 包含的步骤:                             │
│ ☑ 步骤1: Milk mk200                    │
│                                        │
│ ℹ️ 代码: [mk200]2                      │
└────────────────────────────────────────┘
```

### 最终预览

```
┌────────────────────────────────────────┐
│ ℹ️ Recipe打印代码                       │
│                                        │
│ [mk200]2                               │
│                                        │
│ 此代码将保存到数据库，用于订单打印      │
└────────────────────────────────────────┘
```

---

## ✅ 实现检查清单

### 前端
- [x] 更新类型定义（instruction, containedSteps, isContainer等）
- [x] 创建打印代码生成器工具
- [x] 创建步骤编辑器组件
- [x] 创建配方表单组件
- [ ] 集成到现有的配方管理页面
- [ ] 添加i18n翻译

### 后端
- [ ] 更新数据库schema
  - [ ] 添加 recipe_print_code 字段
  - [ ] 添加 instruction 字段
  - [ ] 添加 contained_steps JSON字段
  - [ ] 添加 is_container, container_prefix, container_suffix 字段
- [ ] 实现打印代码生成逻辑
- [ ] 更新 API 响应包含新字段
- [ ] 添加打印代码验证

---

## 🎯 使用流程

### 创建配方

1. 用户选择商品和自定义选项组合
2. 输入商品打印代码（如：LICE）
3. **添加制作步骤**：
   - 点击"添加步骤"
   - 选择步骤类型（milk, tea, blender等）
   - 输入instruction（200, 2键等）
   - 如果是设备步骤，勾选要包含的步骤
4. **实时预览**：
   - 每个步骤显示生成的打印代码
   - 顶部显示最终的recipe打印代码
   - 被包含的步骤显示"已被包含"标记
5. 提交保存

### 查看/编辑配方

1. 从列表选择配方
2. 查看所有步骤和打印代码
3. 修改instruction或调整包含关系
4. 实时更新打印代码预览
5. 保存更新

---

## 🚀 扩展功能

### 未来可能的增强

1. **步骤模板**：常用步骤组合保存为模板
2. **打印代码验证**：检查代码格式和长度
3. **步骤复制**：快速复制现有步骤
4. **批量编辑**：同时修改多个配方的步骤
5. **代码映射表**：维护打印代码到设备命令的映射
6. **可视化流程图**：图形化显示步骤流程和包含关系

---

**版本**: 1.0.0  
**最后更新**: 2025-10-31  
**作者**: AI Assistant














