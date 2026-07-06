# 代码合并整合说明

## 合并完成时间
2026-03-11

## 合并内容

### 我的修改
1. **支付设置组织隔离修复** (`src/pages/PaymentSettings/index.tsx`)
   - 修复了支付设置页面未正确隔离组织数据的问题
   - 添加了组织未选择时的空状态提示
   - 确保切换组织时自动刷新数据

2. **税务管理组织隔离修复** (`src/pages/TaxManagement/index.tsx`)
   - 修复了税务管理页面未正确隔离组织数据的问题
   - 添加了组织未选择时的空状态提示
   - 确保切换组织时自动刷新数据

3. **套餐编辑功能优化** (`src/pages/MenuCenter/`)
   - 统一了套餐价格编辑位置
   - 套餐类型创建后不可修改
   - 优化了多选分组的 N选M 逻辑

4. **新增功能**
   - 在线点单配置 (`src/pages/OnlineOrderConfig/`)
   - 打印设置功能 (`src/pages/PrintSettings/`)
   - Stripe Connect 集成 (`src/pages/StripeConnectCallback.tsx`)

### 同事的修改
1. **预订管理功能** (`src/pages/BookingManagement/`)
   - Dashboard、Bookings、Resources、Settings 页面
   - 预订服务集成

2. **订阅管理功能** (`src/pages/SubscriptionManagement/`)
   - 订阅管理页面
   - 订阅服务集成

3. **服务路由优化**
   - auth-service 直连配置
   - booking-service 通过 Traefik 网关
   - subscription-service 通过 Traefik 网关

## 解决的冲突

### 1. `src/layouts/BaseLayout.tsx`
**冲突原因**: 双方都添加了新的菜单项
**解决方案**: 合并了所有图标导入和菜单项
- 保留了同事的预订管理（Booking）和订阅管理（Subscription）菜单
- 保留了我的在线点单配置（Online Order Config）菜单

### 2. `src/router/index.tsx`
**冲突原因**: 双方都添加了新的路由配置
**解决方案**: 合并了所有导入和路由配置
- 保留了同事的预订管理和订阅管理路由
- 保留了我的在线点单配置和 Stripe 回调路由

### 3. `src/services/http.ts`
**冲突原因**: 双方都修改了需要组织上下文的服务列表
**解决方案**: 合并了所有服务
- 保留了同事的 booking-service 和 subscription-service
- 保留了我的 order 服务

### 4. `tsconfig.tsbuildinfo`
**冲突原因**: TypeScript 编译缓存文件
**解决方案**: 使用了同事的版本（这个文件会自动重新生成）

## 额外的修复

### 1. 安装缺失的依赖
```bash
npm install framer-motion
```
同事的 `PublicBooking` 页面使用了 `framer-motion` 库，但这个依赖没有在 package.json 中。

### 2. 修复 Vite 代理配置 (`vite.config.ts`)
**问题**: 代理配置指向 localhost 服务，但本地没有运行这些服务
**修复**: 将所有代理目标改为 `https://tymoe.com`
- auth-service: localhost:8080 → https://tymoe.com
- oauth: localhost:8080 → https://tymoe.com  
- booking-service: localhost:9080 → https://tymoe.com
- subscription-service: localhost:9080 → https://tymoe.com

## 已知问题

### 1. Auth Service 500 错误
**现象**: 登录时返回 500 Internal Server Error
**可能原因**:
- 线上 auth-service 可能有问题
- 代理配置可能需要进一步调整
- 可能需要在本地运行完整的后端服务栈

**临时解决方案**:
- 如果需要本地开发，可能需要启动本地的 auth-service (端口 8080)
- 或者联系后端团队确认线上服务状态

### 2. 环境配置
当前使用的是 `.env.local` 配置，指向线上服务。如果需要本地开发：
1. 确保所有后端服务在本地运行
2. 恢复 `vite.config.ts` 中的 localhost 代理配置
3. 或者创建 `.env.local-dev` 配置文件

## Git 分支状态

- **main 分支**: 已合并所有修改，包含冲突解决
- **feature/org-isolation-fix 分支**: 保留了我的原始修改（可以删除）

## 下一步

1. ✅ 完成 Git 提交
2. ⏳ 推送到远程仓库
3. ⏳ 解决 auth-service 500 错误
4. ⏳ 测试所有功能是否正常工作
