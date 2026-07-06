# 认证系统Token刷新策略 - 三层防线设计

## 概述

实现了一套完整的token过期处理方案，采用"三层防线"设计，确保用户在token过期时能获得最佳体验。

## 架构设计

### 第一层：主动预刷新（最佳体验）
- **位置**: `http.ts` 中的 `startTokenExpiryChecker()`
- **触发条件**: 定时检查（每30秒），token剩余时间 < 5分钟
- **行为**: 自动调用refresh_token端点，用户完全无感
- **优势**: 99%情况下用户不会被中断

```typescript
// 每30秒检查一次token有效期
setInterval(() => {
  const timeLeft = getTokenTimeLeft()  // 获取剩余时间
  if (0 < timeLeft < 5 * 60 * 1000) {  // 剩余5分钟内
    proactiveTokenRefresh()  // 主动刷新
  }
}, 30000)
```

### 第二层：被动自动重试（双保险）
- **位置**: `http.ts` 响应拦截器
- **触发条件**: 请求返回401且错误码为 `token_expired`
- **行为**: 自动使用refresh_token刷新，然后重试原始请求
- **优势**: 即使第一层失效，仍可自动恢复

```typescript
if (errorCode === 'token_expired') {
  return handleTokenExpired(error)  // 刷新并重试
}
```

### 第三层：应用启动检查（安全防线）
- **位置**: `AuthProvider.tsx` 初始化
- **触发条件**: 应用启动时
- **行为**: 检查localStorage中的token是否过期，过期则清除
- **优势**: 防止使用过期token，确保启动时状态正确

```typescript
if (isTokenExpired(token)) {
  console.warn('[AUTH] Token is expired at startup, clearing credentials')
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}
```

## 后端API变更

### 新的401错误响应格式

#### token_expired（可刷新）
```json
{
  "error": "token_expired",
  "code": "token_expired",
  "message": "Access token has expired"
}
```
**处理**: 前端自动调用refresh_token重试

#### token_revoked（需要登出）
```json
{
  "error": "token_revoked",
  "code": "token_revoked",
  "reason": "user_logout|admin_revoke|security_alert",
  "message": "Token has been revoked"
}
```
**处理**: 前端清除credentials并跳转登录

#### invalid_token（无效token）
```json
{
  "error": "invalid_token",
  "code": "invalid_token",
  "message": "Invalid token signature or format"
}
```
**处理**: 前端清除credentials并跳转登录

### 改动文件

**后端**:
- `auth-service/src/middleware/bearer.ts` - 区分错误类型
- `auth-service/src/controllers/identity.ts` - logout时存储reason到blacklist

**前端**:
- `src/services/http.ts` - 响应拦截器、token预刷新、工具函数
- `src/auth/AuthProvider.tsx` - 启动时检查token过期

## 使用指南

### 工具函数

```typescript
import {
  isTokenExpired,        // 检查token是否过期
  getTokenTimeLeft,      // 获取剩余有效时间（毫秒）
  isAuthenticated,       // 检查是否认证且token未过期
  clearAuthStorage       // 清除所有认证信息
} from '@/services/http'

// 示例
if (isTokenExpired()) {
  console.log('Token has expired')
}

const timeLeft = getTokenTimeLeft()  // 返回毫秒
if (timeLeft > 0) {
  console.log(`Token expires in ${(timeLeft / 1000 / 60).toFixed(1)} minutes`)
}
```

### 错误处理

前端的http服务会自动处理以下情况：

1. **token_expired**:
   - 自动刷新，用户无感
   - 如果刷新失败，清除token并跳转登录

2. **token_revoked**:
   - 立即清除credentials
   - 跳转登录页面
   - 如果是security_alert原因，可在logout前显示警告

3. **invalid_token**:
   - 立即清除credentials
   - 跳转登录页面

### 日志

所有token相关操作都有日志输出，前缀为 `[AUTH]`:

```
[AUTH] Token expired, will attempt refresh
[AUTH] Token proactively refreshed
[AUTH] Token revoked: user_logout
[AUTH] Token has been revoked, clearing credentials
[AUTH] Token is invalid, clearing credentials
```

## 性能考量

- **定时检查间隔**: 30秒（可配置）
- **预刷新阈值**: 5分钟（可配置）
- **刷新重试延迟**: 100ms（避免多个401同时处理）

## 安全特性

1. **防重放攻击**: 使用JWT中的jti字段追踪
2. **黑名单机制**: logout时将token JTI加入Redis黑名单
3. **reason追踪**: 记录token撤销原因（logout/admin_revoke/security_alert）
4. **时钟容错**: JWT验证时有30秒时钟容错

## 未来扩展

可以轻松扩展支持：

1. **管理员强制下线**:
   ```json
   {
     "error": "token_revoked",
     "reason": "admin_revoke",
     "message": "Your session has been terminated by administrator"
   }
   ```

2. **安全警报**:
   ```json
   {
     "error": "token_revoked",
     "reason": "security_alert",
     "message": "Suspicious activity detected, please re-authenticate"
   }
   ```

3. **多设备管理**: 记录token对应的device_id，支持选择性吊销

## 故障排查

| 问题 | 原因 | 解决方案 |
|-----|-----|--------|
| 频繁跳转登录 | Token持续过期 | 检查后端系统时间，检查refresh_token有效期 |
| 刷新失败 | refresh_token也过期 | 需要重新登录 |
| Redis错误导致token验证失败 | Redis连接问题 | 检查Redis可用性，middleware会fallback继续 |
| token不被刷新 | 没有发送请求 | 可能在离线状态，建议应用启动时主动刷新 |

## 测试建议

```typescript
// 测试主动刷新
// 1. 登录后，在开发者工具中手动修改access_token使其看起来即将过期
// 2. 观察是否自动刷新（查看console中[AUTH]日志）

// 测试被动刷新
// 1. 登录后，手动删除access_token
// 2. 发送任何请求，应该自动刷新并重试

// 测试强制登出
// 1. 后端数据库中将refresh_token标记为REVOKED
// 2. 应用应该自动检测并清除credentials
```
