// src/auth/permissions.ts
// Portal 前端的角色/权限-页面可见性表（UX 层，不是安全边界——真正的强制在网关层
// 的 gatewayPolicy.ts。这里只负责隐藏菜单/跳转，避免员工账号误操作）

export type PortalRole = 'USER' | 'ACCOUNT'

// 只有 USER（老板）能访问的页面路径，员工账号一律不可见/不可进入，
// 不受权限集控制——品牌/资本层面的东西，任何权限集都碰不到
const USER_ONLY_PATHS = [
  'organizations',
  'subscription',
  'payment-settings',
  'settings/integrations/uber',
  'direct-delivery',
  'online-order-config',
  'permission-sets', // 权限组管理本身只有老板能碰，哪怕员工有 accounts.edit 也不行
]

// 地板以内的页面 → 对应的权限模块 key（见 auth-service src/config/permissionCatalog.ts）。
// 没在这张表里的页面（dashboard/profile 等）任何登录用户都能进。
const PATH_TO_MODULE: Record<string, string> = {
  'devices': 'devices',
  'print-settings': 'printSettings',
  'menu-center': 'menuCatalog',
  'multi-menu': 'multiMenu',
  'tax-management': 'taxSettings',
  'channel-management': 'salesChannels',
  'gift-card-settings': 'giftCards',
  'member-management': 'members',
  'reward-management': 'loyaltyRewards',
  'accounts': 'accounts',
  'reports': 'reports',
  'booking': 'bookings',
}

function matchPath(clean: string, path: string): boolean {
  return clean === path || clean.startsWith(`${path}/`)
}

export function isPathAllowed(pathname: string, role: PortalRole, permissions: string[] = []): boolean {
  if (role === 'USER') return true

  const clean = pathname.replace(/^\//, '')

  if (USER_ONLY_PATHS.some(p => matchPath(clean, p))) return false

  const moduleEntry = Object.entries(PATH_TO_MODULE).find(([path]) => matchPath(clean, path))
  if (moduleEntry) {
    const [, moduleKey] = moduleEntry
    return permissions.includes(`${moduleKey}.view`)
  }

  return true
}

// 页面内部按钮级别的权限判断（新建/编辑/删除这类写操作）。USER 永远放行；
// 员工账号必须拿到对应模块的 `.edit` 位才显示这些按钮。
// 跟 isPathAllowed 一样是 UX 层隐藏，不是安全边界——真正拦截在网关 + 各微服务后端。
export function canEditModule(module: string, role: PortalRole, permissions: string[] = []): boolean {
  if (role === 'USER') return true
  return permissions.includes(`${module}.edit`)
}
