# Portal 前端 UI 设计规范（单一来源）

> **适用范围：仅本仓库 `tymoe-mopai-portal-frontend`（商户后台 Portal 前端）。**
> 其他项目（POS、member、eazymember 等）不受此约束，各有各的技术栈。
>
> 本文件是 Portal 前端 UI 的**唯一权威规范**。新增或重写任何 Portal 页面前先读这里。
> 事实上的组件源码在同目录 [`ui-kit.tsx`](./ui-kit.tsx)——文档与源码冲突时以源码为准，并回来更新本文件。

---

## 0. 一句话原则

用 **Tailwind v4 + Radix** 手写、**slate 中性色**、**严禁紫色**，所有 UI 基础组件只从 `@/components/ui-kit` import，**不再内联复制、不再新增 antd**。

---

## 1. 技术栈与来源

- React + TypeScript + Vite 5 + **Tailwind CSS v4**（`@import "tailwindcss"`）。
- 交互态组件基于 **Radix UI**（Select / Dialog / Switch / Tabs 等）。
- **单一来源 kit**：`src/components/ui-kit.tsx`。页面**只从这里 import**，例如
  ```tsx
  import { Btn, Modal, SelectInput, toast } from '@/components/ui-kit'
  ```
- **antd 正在被移除**。店铺运营组、订单与配送组、商品管理组已零 antd。写新页面**不要再引 antd**；遇到老页面重写时一并迁移。

---

## 2. 配色与设计 token

- 主色走 token，定义在 [`src/styles/global.css`](../styles/global.css) 的 `@theme`：
  - `--color-brand: #0f172a`（slate-900） → 类名 `bg-brand` / `text-brand`
  - `--color-brand-hover: #1e293b`（slate-800） → `hover:bg-brand-hover`
  - 换主色改这一处即可全站生效。
- **中性色**：一律用 `slate-*`（不要用 `gray/zinc/neutral` 混搭）。
- **严禁紫色**：`indigo` / `violet` / `fuchsia` / `purple` 都不允许，任何场景都不行。
  - 迁移旧代码遇到紫色（如 antd 的 `purple` tag、`#722ed1`）→ 一律改 `slate`。
- **语义色**（仅用于状态表达，克制使用）：
  - 成功/启用 `green`，警告/待处理 `amber`，错误/危险 `red`，信息/链接 `blue`，青 `cyan`。
  - 特色/高亮功能用琥珀金 `amber`。
- 徽章统一写法：`bg-<c>-50 text-<c>-600 ring-1 ring-<c>-200`（如 `bg-green-50 text-green-600 ring-green-200`）。

---

## 3. 组件清单（全部来自 `ui-kit.tsx`）

| 组件 | 用途 | 关键 props |
| --- | --- | --- |
| `Btn` | 按钮 | `variant`: `primary`\|`secondary`\|`ghost`\|`link`\|`danger`；`size`: `sm`\|`md`；`icon`、`loading`、`onClick` |
| `Switch` | 开关 | `checked`、`onCheckedChange(v)`、`disabled` |
| `Checkbox` | 勾选 | `checked`、`onCheckedChange(v)`、`label` |
| `Slider` | 滑块 | `value`、`onChange(v)`、`min`/`max`/`step` |
| `TextInput` | 单行输入 | `value`、`onChange(v:string)`、`placeholder`、`type`、`className` |
| `Textarea` | 多行输入 | `value`、`onChange(v:string)`、`rows` |
| `NumberInput` | 数字输入 | `value`、`onChange(v:number)`、`min`/`max`、`suffix` |
| `SelectInput` | 下拉（Radix，**替代原生 `<select>`**） | `value`、`onChange(v)`、`options:{label,value}[]`、`placeholder` |
| `Field` / `FormRow` | 表单行容器 | `label`、`hint`、`error` |
| `SectionCard` | 卡片分区 | `title`、`description`、`action`、`bodyClassName` |
| `PageHeader` | 页头 | `title`、`description`、`badges`、`actions`、`onBack` |
| `Modal` | 弹窗 | `open`、`onOpenChange`、`title`、`footer`、`size`: `sm`\|`md`\|`lg`\|`xl` |
| `Drawer` | 抽屉 | `open`、`onOpenChange`、`title`、`footer`、`width` |
| `ConfirmDialog` | 确认框（**替代 Popconfirm / Modal.confirm**） | `open`、`onOpenChange`、`title`、`description`、`danger`、`onConfirm` |
| `Table` + `Column<T>` | 表格 | `columns`、`data`、`rowKey`、`empty`、`loading`、`expandable` |
| `Tabs` | 标签栏（**受控**，内容由父级条件渲染） | `items:{key,label,icon}[]`、`value`、`onChange` |
| `Badge` | 徽章 | `variant`: `default`\|`gold`\|`blue`\|`green`\|`red`、`icon` |
| `AlertBox` | 提示条 | `type`、`title`、`description`、`action` |
| `StatCard` | 数据卡 | `title`、`value`、`icon`、`tone` |
| `ProgressBar` | 进度条 | `percent`、`tone` |
| `Spinner` | 加载态 | `className` |
| `EmptyState` | 空状态 | `icon`、`title`、`description`、`action` |
| `ImageUpload` | 图片上传（隐藏 input + 预览 + 删除，自带类型/大小校验） | `url`、`onPick(file)`、`onRemove`、`maxMB`、`size` |
| `Transfer` | 双列穿梭选择 | 见源码 |
| `toast` | 全局提示（**替代 antd message**） | `toast.success/error/warning/info(msg)` |
| `ToastHost` | toast 挂载点 | 已在 `BaseLayout` 挂一次，**页面里不要再挂** |

图标统一用 **lucide-react**（不要用 `@ant-design/icons`）。

---

## 4. antd → kit 迁移映射（重写老页面时对照）

| antd | 换成 |
| --- | --- |
| `message.xxx()` | `toast.xxx()` |
| `Popconfirm` / `Modal.confirm` | `ConfirmDialog`（配一个 `open` state） |
| `Form` + `Form.useForm` | 受控 `useState`（每个字段一个 state，或一个 form 对象 + `setF`），手写校验 |
| `Table`（columns 模型） | `Table` + `Column<T>[]`，`render(row,index)` |
| `Tabs`（items 含 children） | `Tabs`（只是标签栏）+ 父级 `{active === 'x' && <Panel/>}` 条件渲染 |
| `Select` / 原生 `<select>` | `SelectInput`（Radix，空值用内部 sentinel，不用 `value=""`） |
| `InputNumber` | `NumberInput`（小数/带 `$` 前缀时用原生 `<input type=number step=0.01>` 自定义） |
| `Upload` | `ImageUpload` 或隐藏 `<input type=file>` + `useRef` |
| `Collapse` | `SectionCard` 分区，或自建 `openIds:Set` 手风琴 |
| `TimePicker`（+ dayjs） | 原生 `<input type="time" step={900}>`，值即 `"HH:mm"` 字符串 |
| `Descriptions` | `<dl>` + Tailwind grid |
| `Divider` | `<div className="border-t border-slate-100" />` |
| `Tooltip` | 元素 `title` 属性（轻量场景足够） |
| `Row/Col`、`Space` | Tailwind `grid` / `flex gap-*` |

---

## 5. antd 隔离边界（临时桥，antd 清完即拆）

antd 的 `reset.css` 有一条**无 `@layer`** 的 `button,input,...{color:inherit}`；CSS 级联里无 layer 的规则会压过 Tailwind v4 **有 layer** 的 `text-white`，导致深底按钮文字变深看不清。

- cascade-layer 方案**已验证不可靠**（`@tailwindcss/vite` + Vite 构建会丢掉 `@layer` 顺序声明）。
- 当前解法：kit 的 `Btn` 用 Tailwind v4 **important 后缀** `text-white!` / `text-slate-700!` 把关键文字色钉死，**集中在 kit 一处**（是隔离边界，不是散落 hack）。
- **根治 = 移除 antd**；届时把这些 `!` 一起删掉即可。写页面时不用关心它——从 kit 用 `Btn` 就已经安全。

---

## 6. 写新页面的检查清单

1. 只从 `@/components/ui-kit` import 基础组件；图标用 lucide-react。
2. 配色 slate + 少量语义色，**没有紫色**。
3. 反馈用 `toast`，确认用 `ConfirmDialog`，表单用受控 state。
4. 交付前跑：`npx tsc --noEmit -p tsconfig.json` +  `npx vite build`（注意 `noUnusedLocals`，清掉死代码/未用 import）。
5. 该页面不再出现 `from 'antd'` / `@ant-design/*`。
