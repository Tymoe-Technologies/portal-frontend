import React from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import * as Collapsible from '@radix-ui/react-collapsible'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as Select from '@radix-ui/react-select'
import { useTranslation } from 'react-i18next'
import { useAuthContext } from '../auth/AuthProvider'
import { message } from 'antd'
import clsx from 'clsx'
import {
  LayoutDashboard, Package, ListOrdered, ShoppingCart, Store, Users,
  Wallet, ChevronDown, ChevronRight, LogOut, User, Settings,
  Globe, CreditCard, Car, Printer, Calendar, Gift, FileText,
  Smartphone, Trash2, Sparkles, PanelLeftClose, PanelLeftOpen,
  Check, ChevronsUpDown,
} from 'lucide-react'

// ─── 侧边栏导航项类型 ──────────────────────────────────────────────────────────

interface NavItem {
  key: string
  label: string
  to?: string
  icon: React.ReactNode
  children?: NavItem[]
}

// ─── Tooltip 封装（收起时显示菜单名） ─────────────────────────────────────────

function NavTooltip({ label, collapsed, children }: { label: string; collapsed: boolean; children: React.ReactNode }) {
  if (!collapsed) return <>{children}</>
  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          className="bg-slate-900 text-white text-xs px-2 py-1 rounded-md shadow-lg z-50"
          sideOffset={8}
        >
          {label}
          <Tooltip.Arrow className="fill-slate-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

// ─── 头部下拉选择（替代原生 select，统一 Radix 样式） ───────────────────────────

interface SelectOption { value: string; label: string }

function HeaderSelect({ value, options, onChange, placeholder, ariaLabel, className }: {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        aria-label={ariaLabel}
        className={clsx(
          'group inline-flex min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700',
          'hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 data-[state=open]:border-slate-400',
          '[&>span:first-child]:truncate',
          className,
        )}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <ChevronsUpDown className="w-4 h-4 text-slate-400 group-hover:text-slate-500" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg p-1"
        >
          <Select.Viewport className="max-h-72">
            {options.map(opt => (
              <Select.Item
                key={opt.value}
                value={opt.value}
                className={clsx(
                  'relative flex items-center rounded-lg pl-8 pr-3 py-2 text-sm text-slate-700 select-none cursor-pointer outline-none',
                  'data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900',
                  'data-[state=checked]:font-medium data-[state=checked]:text-slate-900',
                )}
              >
                <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                  <Check className="w-4 h-4 text-slate-900" />
                </Select.ItemIndicator>
                <Select.ItemText>{opt.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

// ─── 单个导航叶子项 ────────────────────────────────────────────────────────────

function NavLeaf({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  return (
    <NavTooltip label={item.label} collapsed={collapsed}>
      <Link
        to={item.to!}
        className={clsx(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-all duration-150',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900',
          active
            ? 'bg-slate-100 text-slate-900'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
          collapsed && 'justify-center px-2',
        )}
      >
        {/* 活跃指示条 */}
        {active && !collapsed && (
          <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-slate-900" />
        )}
        <span
          className={clsx(
            'shrink-0 w-[18px] h-[18px] transition-colors',
            active ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600',
          )}
        >
          {item.icon}
        </span>
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    </NavTooltip>
  )
}

// ─── 折叠分组 ─────────────────────────────────────────────────────────────────

function NavGroup({ item, activeKey, collapsed, defaultOpen }: {
  item: NavItem
  activeKey: string
  collapsed: boolean
  defaultOpen: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  React.useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])

  const hasActiveChild = item.children?.some(child => child.key === activeKey)

  if (collapsed) {
    // 收起时只显示图标，子项无需展开；组间用细分隔线区隔
    return (
      <div className="space-y-1 border-t border-slate-100 pt-1.5 mt-1.5 first:border-0 first:pt-0 first:mt-0">
        {item.children?.map(child => (
          <NavLeaf key={child.key} item={child} active={activeKey === child.key} collapsed />
        ))}
      </div>
    )
  }

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="mt-4 first:mt-1">
      <Collapsible.Trigger className="group w-full flex items-center justify-between rounded-md px-3 py-1.5 cursor-pointer select-none hover:bg-slate-50 transition-colors">
        <span className={clsx(
          'text-xs font-semibold uppercase tracking-wider transition-colors',
          hasActiveChild ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600',
        )}>
          {item.label}
        </span>
        <ChevronRight className={clsx(
          'w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-transform duration-200',
          open && 'rotate-90',
        )} />
      </Collapsible.Trigger>
      <Collapsible.Content className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="mt-1 space-y-1 pl-2 border-l border-slate-100 ml-3">
          {item.children?.map(child => (
            <NavLeaf key={child.key} item={child} active={activeKey === child.key} collapsed={false} />
          ))}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

// ─── 主布局 ───────────────────────────────────────────────────────────────────

const BaseLayout: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout, organizations } = useAuthContext()
  const currentOrgId = localStorage.getItem('organization_id') || ''
  const currentOrg = organizations.find(o => o.id === currentOrgId)
  const isMainStore = currentOrg?.orgType === 'MAIN'
  const [collapsed, setCollapsed] = React.useState(false)
  const [clearingData, setClearingData] = React.useState(false)
  const [clearDialogOpen, setClearDialogOpen] = React.useState(false)
  const [selectedOrgId, setSelectedOrgId] = React.useState<string>(
    localStorage.getItem('organization_id') || ''
  )

  const handleClearTestData = async () => {
    setClearingData(true)
    try {
      const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || ''
      const tenantId = localStorage.getItem('organization_id') || ''
      const [financeRes, orderRes] = await Promise.all([
        fetch(`/api/finance/v1/admin/dev/clear-test-data`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
        fetch(`/api/order/v1/admin/dev/clear-test-data`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}`, 'X-Merchant-Id': tenantId },
        }).catch(() => null),
      ])
      const financeData = financeRes?.ok ? await financeRes.json().catch(() => ({})) : { error: `HTTP ${financeRes?.status}` }
      const orderData = orderRes?.ok ? await orderRes.json().catch(() => ({})) : { error: `HTTP ${orderRes?.status}` }
      message.success(`已清除 — Finance: ${JSON.stringify(financeData.deleted ?? financeData)} | Order: ${JSON.stringify(orderData.deleted ?? orderData)}`)
    } catch (err: any) {
      message.error(err.message || '清除失败')
    } finally {
      setClearingData(false)
      setClearDialogOpen(false)
    }
  }

  // 路径规范化
  const normalizeKey = (path: string): string => {
    const map: Record<string, string> = {
      '/order-config/channels': '/channel-management',
      '/order-config/channel-settlement': '/channel-management',
      '/order-config/pricing': '/order-config',
      '/order-config/pickup-number': '/order-config',
      '/menu-center/categories': '/menu-center',
      '/menu-center/items': '/menu-center',
      '/recipe-guide': '/features',
      '/booking/bookings': '/booking',
      '/booking/resources': '/booking',
      '/booking/settings': '/booking',
      '/reward-management': '/member-management',
    }
    return map[path] || path
  }

  const activeKey = normalizeKey(pathname)

  // 哪些分组包含当前活跃项
  const keyToGroup: Record<string, string> = {
    '/menu-center': 'group-menu', '/multi-menu': 'group-menu', '/tax-management': 'group-menu',
    '/order-config': 'group-order', '/online-order-config': 'group-order',
    '/channel-management': 'group-order', '/direct-delivery': 'group-order',
    '/settings/integrations/uber': 'group-order',
    '/payment-settings': 'group-store', '/gift-card-settings': 'group-store',
    '/print-settings': 'group-store', '/booking': 'group-store',
    '/organizations': 'group-org', '/accounts': 'group-org',
    '/devices': 'group-org', '/member-management': 'group-org',
    '/subscription': 'group-system',
  }
  const activeGroup = keyToGroup[activeKey] || ''

  const handleOrganizationChange = (value: string) => {
    setSelectedOrgId(value)
    localStorage.setItem('organization_id', value)
    window.location.reload()
  }

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value)
    localStorage.setItem('app.lng', value)
  }

  // 导航结构
  const navItems: NavItem[] = [
    {
      key: '/dashboard',
      to: '/dashboard',
      label: t('nav.dashboard'),
      icon: <LayoutDashboard className="w-[18px] h-[18px]" />,
    },
    {
      key: 'group-menu',
      label: t('nav.groupMenu'),
      icon: <Package className="w-[18px] h-[18px]" />,
      children: [
        { key: '/menu-center', to: '/menu-center', label: t('nav.menuCenter'), icon: <Package className="w-[18px] h-[18px]" /> },
        { key: '/multi-menu', to: '/multi-menu', label: t('nav.multiMenu'), icon: <ListOrdered className="w-[18px] h-[18px]" /> },
        { key: '/tax-management', to: '/tax-management', label: t('nav.taxManagement'), icon: <FileText className="w-[18px] h-[18px]" /> },
      ],
    },
    {
      key: 'group-order',
      label: t('nav.groupOrder'),
      icon: <ShoppingCart className="w-[18px] h-[18px]" />,
      children: [
        { key: '/order-config', to: '/order-config', label: t('nav.orderConfig') || '取餐号配置', icon: <ListOrdered className="w-[18px] h-[18px]" /> },
        { key: '/online-order-config', to: '/online-order-config', label: t('nav.onlineOrderConfig'), icon: <Globe className="w-[18px] h-[18px]" /> },
        { key: '/channel-management', to: '/channel-management', label: t('nav.channelManagement') || '渠道管理', icon: <CreditCard className="w-[18px] h-[18px]" /> },
        { key: '/direct-delivery', to: '/direct-delivery', label: t('nav.directDelivery'), icon: <Car className="w-[18px] h-[18px]" /> },
        { key: '/settings/integrations/uber', to: '/settings/integrations/uber', label: t('nav.uberIntegration'), icon: <Settings className="w-[18px] h-[18px]" /> },
      ],
    },
    {
      key: 'group-store',
      label: t('nav.groupStore'),
      icon: <Store className="w-[18px] h-[18px]" />,
      children: [
        { key: '/payment-settings', to: '/payment-settings', label: t('nav.paymentSettings'), icon: <CreditCard className="w-[18px] h-[18px]" /> },
        ...(isMainStore ? [{ key: '/gift-card-settings', to: '/gift-card-settings', label: t('nav.giftCardSettings'), icon: <Gift className="w-[18px] h-[18px]" /> }] : []),
        { key: '/print-settings', to: '/print-settings', label: t('nav.printSettings'), icon: <Printer className="w-[18px] h-[18px]" /> },
        { key: '/booking', to: '/booking', label: t('nav.booking'), icon: <Calendar className="w-[18px] h-[18px]" /> },
      ],
    },
    {
      key: 'group-org',
      label: t('nav.groupOrg'),
      icon: <Users className="w-[18px] h-[18px]" />,
      children: [
        { key: '/organizations', to: '/organizations', label: t('nav.organizations'), icon: <Store className="w-[18px] h-[18px]" /> },
        { key: '/accounts', to: '/accounts', label: t('nav.accounts'), icon: <User className="w-[18px] h-[18px]" /> },
        { key: '/devices', to: '/devices', label: t('nav.devices'), icon: <Smartphone className="w-[18px] h-[18px]" /> },
        { key: '/member-management', to: '/member-management', label: t('nav.memberManagement'), icon: <Gift className="w-[18px] h-[18px]" /> },
      ],
    },
    {
      key: 'group-system',
      label: t('nav.groupSystem'),
      icon: <Wallet className="w-[18px] h-[18px]" />,
      children: [
        { key: '/subscription', to: '/subscription', label: t('nav.subscription'), icon: <Wallet className="w-[18px] h-[18px]" /> },
      ],
    },
  ]

  const sidebarW = collapsed ? 76 : 256

  return (
    <Tooltip.Provider>
      <div className="flex min-h-screen bg-slate-50">

        {/* ── 侧边栏 ──────────────────────────────────────────── */}
        <aside
          style={{ width: sidebarW }}
          className="fixed inset-y-0 left-0 z-30 flex flex-col bg-white border-r border-slate-200 shadow-sm transition-[width] duration-200 ease-out"
        >
          {/* Logo */}
          <div className={clsx(
            'flex items-center h-16 shrink-0 border-b border-slate-100',
            collapsed ? 'justify-center px-2' : 'px-4 gap-3'
          )}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white font-bold text-base shadow-sm shadow-slate-900/20">
              T
            </div>
            {!collapsed && (
              <span className="font-semibold text-base text-slate-900 truncate tracking-tight">{t('app.title')}</span>
            )}
          </div>

          {/* 导航 */}
          <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {navItems.map(item => {
              if (item.to) {
                // 顶级叶子（仪表盘）
                return (
                  <NavLeaf key={item.key} item={item} active={activeKey === item.key} collapsed={collapsed} />
                )
              }
              return (
                <NavGroup
                  key={item.key}
                  item={item}
                  activeKey={activeKey}
                  collapsed={collapsed}
                  defaultOpen={activeGroup === item.key}
                />
              )
            })}

            {/* 特色功能 — 琥珀金高亮（非紫、实心可读） */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <NavTooltip label={t('nav.features')} collapsed={collapsed}>
                <Link
                  to="/features"
                  className={clsx(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-semibold transition-all duration-150',
                    'ring-1 ring-inset',
                    activeKey === '/features'
                      ? 'bg-amber-50 ring-amber-200 text-amber-700'
                      : 'ring-transparent text-amber-600 hover:bg-amber-50/60',
                    collapsed && 'justify-center px-2',
                  )}
                >
                  <Sparkles className="w-4 h-4 shrink-0 text-amber-500 transition-transform group-hover:scale-110" />
                  {!collapsed && <span className="truncate">{t('nav.features')}</span>}
                </Link>
              </NavTooltip>
            </div>
          </nav>

          {/* 折叠按钮 */}
          <div className="shrink-0 border-t border-slate-100 p-2">
            <NavTooltip label={collapsed ? '展开' : '收起'} collapsed={collapsed}>
              <button
                onClick={() => setCollapsed(v => !v)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer text-sm font-medium',
                  collapsed && 'justify-center',
                )}
              >
                {collapsed
                  ? <PanelLeftOpen className="w-4 h-4 shrink-0" />
                  : <PanelLeftClose className="w-4 h-4 shrink-0" />}
                {!collapsed && <span>收起菜单</span>}
              </button>
            </NavTooltip>
          </div>
        </aside>

        {/* ── 主体区域 ────────────────────────────────────────── */}
        <div
          style={{ marginLeft: sidebarW }}
          className="flex flex-col flex-1 min-w-0 transition-all duration-200"
        >
          {/* Header */}
          <header className="sticky top-0 z-20 flex items-center justify-between h-16 bg-white border-b border-slate-200 px-6">
            <div />
            <div className="flex items-center gap-3">
              {/* 组织选择 */}
              {organizations.length > 0 && (
                <HeaderSelect
                  ariaLabel="选择店铺"
                  value={selectedOrgId}
                  onChange={handleOrganizationChange}
                  options={organizations.map(org => ({ value: org.id, label: org.orgName }))}
                  className="max-w-[200px]"
                />
              )}

              {/* 语言选择 */}
              <HeaderSelect
                ariaLabel="选择语言"
                value={i18n.language}
                onChange={handleLanguageChange}
                options={[
                  { value: 'zh-CN', label: '简体中文' },
                  { value: 'zh-TW', label: '繁體中文' },
                  { value: 'en', label: 'English' },
                  { value: 'fr', label: 'Français' },
                ]}
              />

              {/* 用户菜单 */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-slate-900">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white text-xs font-semibold shrink-0">
                      {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex flex-col items-start leading-none">
                      <span className="text-sm font-medium text-slate-900">{user?.name || 'User'}</span>
                      <span className="text-xs text-slate-400">{user?.email || ''}</span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className="z-50 min-w-44 bg-white rounded-xl border border-slate-200 shadow-lg p-1 text-sm"
                  >
                    <DropdownMenu.Item
                      onSelect={() => navigate('/profile')}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer outline-none"
                    >
                      <User className="w-[18px] h-[18px]" />{t('nav.profile')}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer outline-none"
                    >
                      <Settings className="w-[18px] h-[18px]" />{t('nav.settings')}
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator className="my-1 border-t border-slate-100" />
                    <DropdownMenu.Item
                      onSelect={() => { logout(); navigate('/login') }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer outline-none"
                    >
                      <LogOut className="w-[18px] h-[18px]" />{t('nav.logout')}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </header>

          {/* 内容区 */}
          <main className="flex-1 p-6">
            <Outlet />
          </main>

          <footer className="text-center text-xs text-slate-400 py-4 border-t border-slate-100">
            Portal Admin ©{new Date().getFullYear()}
          </footer>
        </div>

        {/* 开发环境：清除测试数据 */}
        {import.meta.env.DEV && (
          <AlertDialog.Root open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
            <AlertDialog.Trigger asChild>
              <button
                title="清除测试数据"
                className="fixed bottom-8 right-8 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white! shadow-lg hover:bg-red-600 transition-colors cursor-pointer"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
              <AlertDialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl border border-slate-200 shadow-xl p-6 w-full max-w-md">
                <AlertDialog.Title className="text-base font-semibold text-slate-900">确认清除所有测试数据？</AlertDialog.Title>
                <AlertDialog.Description className="mt-2 text-sm text-slate-500">
                  将删除所有礼品卡、支付记录、订单等数据，不可撤销。
                </AlertDialog.Description>
                <div className="mt-5 flex justify-end gap-2">
                  <AlertDialog.Cancel asChild>
                    <button className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                      取消
                    </button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action asChild>
                    <button
                      onClick={handleClearTestData}
                      disabled={clearingData}
                      className="px-4 py-2 text-sm font-medium text-white! bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 cursor-pointer"
                    >
                      {clearingData ? '清除中...' : '确认删除'}
                    </button>
                  </AlertDialog.Action>
                </div>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        )}
      </div>
    </Tooltip.Provider>
  )
}

export default BaseLayout
