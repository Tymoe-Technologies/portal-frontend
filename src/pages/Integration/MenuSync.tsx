import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Btn,
  Badge,
  Modal,
  Drawer,
  Tabs,
  Checkbox,
  SectionCard,
  AlertBox,
  EmptyState,
  Spinner,
  ConfirmDialog,
  TextInput,
  toast,
  type Column,
  Table as KitTable,
} from '@/components/ui-kit'
import {
  Upload,
  RefreshCw,
  Settings,
  Save,
  CheckCircle2,
  XCircle,
  LayoutGrid,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import {
  uberMenuSyncService,
  MenuConfigItem,
  ModifierConfigItem,
  MenuGroup
} from '@/services/uberMenuSync'
import { uberService } from '@/services/uber'
import { itemManagementService } from '@/services/item-management'

interface MenuSyncProps {
  merchantId: string
  storeId: string
  storeName: string
  integrationId?: string
}

// 金额输入（带 $ 前缀，空值用 undefined；替代 antd InputNumber 的货币场景）
function MoneyInput({ value, onChange, min, max, step = 0.01, placeholder, className }: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  min?: number
  max?: number
  step?: number
  placeholder?: string
  className?: string
}) {
  return (
    <div className={`flex items-center rounded-lg border border-slate-200 bg-white px-2 focus-within:outline-2 focus-within:outline-slate-900 ${className || ''}`}>
      <span className="text-sm text-slate-400">$</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        placeholder={placeholder}
        className="w-full bg-transparent py-1.5 pl-1.5 text-sm text-slate-700 focus:outline-none"
      />
    </div>
  )
}

/**
 * 菜单同步组件
 * 支持：选择性同步、价格覆盖、同步历史
 */
const MenuSync: React.FC<MenuSyncProps> = ({
  merchantId,
  storeId,
  integrationId
}) => {
  const { t } = useTranslation()

  // 基础状态
  const [posSyncing, setPOSSyncing] = useState(false)

  // 配置管理状态
  const [configItems, setConfigItems] = useState<MenuConfigItem[]>([])
  const [configLoading, setConfigLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [modifiedItems, setModifiedItems] = useState<Map<string, { enabled?: boolean; uberPrice?: number | null }>>(new Map())

  // 自定义选项配置状态
  const [modifierModalVisible, setModifierModalVisible] = useState(false)
  const [modifierSaving, setModifierSaving] = useState(false)
  const [currentModifierItem, setCurrentModifierItem] = useState<MenuConfigItem | null>(null)
  const [modifierConfigs, setModifierConfigs] = useState<Map<string, ModifierConfigItem[]>>(new Map()) // posItemId -> ModifierConfigItem[]
  const [modifiedModifiers, setModifiedModifiers] = useState<Map<string, { enabled?: boolean; uberPrice?: number | null; posItemId?: string; modifierOptionId?: string }>>(new Map())

  // 当前 Tab（菜单组）
  const [activeTab, setActiveTab] = useState('')
  // 菜单内子 Tab（分类管理 / 商品配置）
  const [activeSubTab, setActiveSubTab] = useState('categories')

  // 统一调价工具状态
  const [priceAdjustmentModalVisible, setPriceAdjustmentModalVisible] = useState(false)
  const [priceAdjustmentPercent, setPriceAdjustmentPercent] = useState<number | undefined>(undefined)

  // 清理菜单状态
  const [clearingMenu, setClearingMenu] = useState(false)
  const [clearMenuConfirmOpen, setClearMenuConfirmOpen] = useState(false)

  // 菜单组管理状态
  const [menuGroups, setMenuGroups] = useState<MenuGroup[]>([])
  const [selectedMenuGroupId, setSelectedMenuGroupId] = useState<string>('')
  const [menuGroupLoading, setMenuGroupLoading] = useState(false)
  const [menuGroupModalVisible, setMenuGroupModalVisible] = useState(false)
  const [editingMenuGroup, setEditingMenuGroup] = useState<MenuGroup | null>(null)
  // 删除菜单组确认（受控，保存待删除对象）
  const [deleteMenuGroupTarget, setDeleteMenuGroupTarget] = useState<MenuGroup | null>(null)

  // 菜单配置状态（名称、营业时间）
  const [menuConfigModalVisible, setMenuConfigModalVisible] = useState(false)
  const [menuName, setMenuName] = useState('Menu')
  const [serviceAvailability, setServiceAvailability] = useState<Map<string, Array<{ startTime: string; endTime: string }>>>(
    new Map([
      ['monday', [{ startTime: '00:00', endTime: '23:59' }]],
      ['tuesday', [{ startTime: '00:00', endTime: '23:59' }]],
      ['wednesday', [{ startTime: '00:00', endTime: '23:59' }]],
      ['thursday', [{ startTime: '00:00', endTime: '23:59' }]],
      ['friday', [{ startTime: '00:00', endTime: '23:59' }]],
      ['saturday', [{ startTime: '00:00', endTime: '23:59' }]],
      ['sunday', [{ startTime: '00:00', endTime: '23:59' }]]
    ])
  )

  // 菜单分类管理状态
  const [systemCategories, setSystemCategories] = useState<any[]>([]) // 系统中的 POS 分类
  const [uberCategories, setUberCategories] = useState<any[]>([]) // 用户创建的 Uber 分类
  const [selectedSystemCategories, setSelectedSystemCategories] = useState<any[]>([]) // 选中的系统分类（用于配置）
  const [systemToUberCategoryMap, setSystemToUberCategoryMap] = useState<Map<string, string>>(new Map()) // 系统分类 ID -> Uber 分类 ID 映射
  const [categoryLoading, setcategoryLoading] = useState(false)
  const [customCategoryName, setCustomCategoryName] = useState('') // 新建自定义分类的名称
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<any | null>(null)
  const [categoryItems, setCategoryItems] = useState<any[]>([])
  const [posItems, setPosItems] = useState<any[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [itemSearch, setItemSearch] = useState('') // 抽屉内商品搜索

  // 删除菜单分类确认（受控，保存待删除对象）
  const [removeCategoryTarget, setRemoveCategoryTarget] = useState<{ id: string; name: string; isSystem: boolean } | null>(null)
  // 删除全局分类配置确认（分类 Tab）
  const [removeConfiguredCategoryTarget, setRemoveConfiguredCategoryTarget] = useState<{ id: string; name: string; isSystem: boolean } | null>(null)

  // 菜单特定分类管理状态
  const [menuCategories, setMenuCategories] = useState<any[]>([]) // 当前菜单的分类列表
  const [menuCategoriesLoading, setMenuCategoriesLoading] = useState(false)
  const [availableCategoriesForMenu, setAvailableCategoriesForMenu] = useState<any[]>([]) // 可以添加到菜单的分类（全局分类 - 菜单已有分类）

  // 获取租户 ID
  const getTenantId = (): string => {
    return localStorage.getItem('organization_id') || ''
  }

  // 加载菜单配置
  const loadMenuConfig = async (menuGroupId?: string) => {
    if (!integrationId) return

    const tenantId = getTenantId()
    if (!tenantId) {
      toast.error('无法获取租户信息')
      return
    }

    try {
      setConfigLoading(true)
      const result = await uberMenuSyncService.getMenuConfig(integrationId, tenantId, menuGroupId)
      setConfigItems(result.items)
      setModifiedItems(new Map())

      // 预加载所有商品的自定义选项配置
      const allModifierConfigs = new Map<string, ModifierConfigItem[]>()

      // 并行加载所有商品的自定义选项
      await Promise.all(
        result.items.map(async (item) => {
          try {
            const modifierResult = await uberMenuSyncService.getModifierConfig(
              integrationId,
              tenantId,
              item.posItemId,
              menuGroupId
            )
            allModifierConfigs.set(item.posItemId, modifierResult.modifiers)
          } catch (error) {
            console.warn(`加载商品 ${item.posItemId} 的自定义选项失败:`, error)
            // 即使某个商品的自定义选项加载失败，也继续加载其他商品
            allModifierConfigs.set(item.posItemId, [])
          }
        })
      )

      setModifierConfigs(allModifierConfigs)

      // 调试信息：显示加载的modifier数量
      const totalModifiers = Array.from(allModifierConfigs.values()).reduce((sum, mods) => sum + mods.length, 0)
      console.log('加载的商品数:', result.items.length)
      console.log('加载的modifier总数:', totalModifiers)
      console.log('modifierConfigs详情:', Array.from(allModifierConfigs.entries()).map(([id, mods]) => ({ itemId: id, count: mods.length })))
    } catch (error: any) {
      toast.error(error.message || '加载配置失败')
    } finally {
      setConfigLoading(false)
    }
  }

  // 加载系统中的 POS 分类及其商品
  const loadSystemCategories = async () => {
    try {
      console.log('🔍 开始加载系统分类...')
      const categories = await itemManagementService.getCategories()
      console.log('📦 获取到的分类数据:', categories)
      console.log('📦 分类数量:', categories?.length || 0)

      // 为每个分类加载其商品
      const categoriesWithItems = await Promise.all(
        (categories || []).map(async (cat: any) => {
          try {
            console.log(`🔍 加载分类 ${cat.name} (${cat.id}) 的商品...`)
            const itemsResponse = await itemManagementService.getItems({ categoryId: cat.id })
            console.log(`📦 分类 ${cat.name} 的商品数量:`, itemsResponse.data?.length || 0)
            return {
              ...cat,
              items: itemsResponse.data || [],
              itemCount: itemsResponse.data?.length || 0
            }
          } catch (error) {
            console.error(`❌ 加载分类 ${cat.id} 的商品失败:`, error)
            return {
              ...cat,
              items: [],
              itemCount: 0
            }
          }
        })
      )

      console.log('✅ 系统分类加载完成，总数:', categoriesWithItems.length)
      setSystemCategories(categoriesWithItems)
    } catch (error: any) {
      console.error('❌ 加载系统分类失败:', error)
      console.error('错误详情:', error.response || error.message || error)
    }
  }

  // 加载用户创建的 Uber 分类
  const loadUberCategories = async () => {
    if (!integrationId) return
    try {
      setcategoryLoading(true)
      const data = await uberService.getMenuCategories(integrationId)
      setUberCategories(data)
    } catch (error: any) {
      toast.error(error.message || '加载 Uber 分类失败')
    } finally {
      setcategoryLoading(false)
    }
  }

  // 加载 POS 商品
  const loadPosItems = async () => {
    if (!integrationId) return
    try {
      setItemsLoading(true)
      // 获取所有商品，不按分类过滤
      const response = await itemManagementService.getItems({})
      // response 可能是数组或对象，处理两种情况
      const items = Array.isArray(response) ? response : (response?.data || [])
      setPosItems(items || [])
    } catch (error: any) {
      console.error('加载商品失败:', error)
      toast.error(error.message || '加载商品失败')
    } finally {
      setItemsLoading(false)
    }
  }

  // 加载分类商品
  const loadCategoryItems = async (categoryId: string) => {
    try {
      setItemsLoading(true)
      const items = await uberService.getMenuCategoryItems(categoryId)
      setCategoryItems(items)
      // 重置选择，防止上一个分类的选择干扰新分类
      setSelectedItems([])
    } catch (error: any) {
      toast.error(error.message || '加载分类商品失败')
    } finally {
      setItemsLoading(false)
    }
  }

  // 初始加载
  useEffect(() => {
    if (integrationId) {
      loadSystemCategories() // 加载系统分类
      loadUberCategories() // 加载用户创建的 Uber 分类
      loadPosItems()
      loadMenuGroups() // 加载菜单组
    }
  }, [integrationId])

  // 当 Tab 切换时，重新加载对应菜单的配置和分类
  useEffect(() => {
    if (activeTab && integrationId) {
      loadMenuConfig(activeTab)
      loadMenuCategoriesForCurrentMenu(activeTab)
    }
  }, [activeTab])

  // 当菜单组加载完成后，设置默认激活的Tab
  useEffect(() => {
    if (menuGroups.length > 0 && !activeTab) {
      // 默认显示第一个菜单 Tab
      setActiveTab(menuGroups[0].id)
    }
  }, [menuGroups, activeTab])

  // 处理配置变更
  const handleConfigChange = (posItemId: string, field: 'enabled' | 'uberPrice', value: any) => {
    const newModified = new Map(modifiedItems)
    const existing = newModified.get(posItemId) || {}
    newModified.set(posItemId, { ...existing, [field]: value })
    setModifiedItems(newModified)
  }

  // 获取商品的有效值
  const getEffectiveValue = (item: MenuConfigItem, field: 'enabled' | 'uberPrice') => {
    const modified = modifiedItems.get(item.posItemId)
    if (modified && modified[field] !== undefined) {
      return modified[field]
    }
    return item[field]
  }

  // 获取商品名称，优先从POS商品列表中查找，其次使用已保存的名称
  const getItemName = (categoryItem: any): string => {
    if (categoryItem.posItemName) {
      return categoryItem.posItemName
    }
    // 从POS商品列表中查找
    const posItem = posItems.find(item => item.id === categoryItem.posItemId)
    return posItem?.name || categoryItem.posItemId
  }

  // 加载菜单组列表
  const loadMenuGroups = async () => {
    if (!integrationId) return
    try {
      setMenuGroupLoading(true)
      const groups = await uberMenuSyncService.getMenuGroups(storeId, integrationId)
      setMenuGroups(groups)
      if (groups.length > 0 && !selectedMenuGroupId) {
        setSelectedMenuGroupId(groups[0].id)
      }
      return groups
    } catch (error: any) {
      console.error('加载菜单组失败:', error)
      toast.error(error.message || '加载菜单组失败')
      return []
    } finally {
      setMenuGroupLoading(false)
    }
  }

  // 加载菜单的分类列表
  const loadMenuCategoriesForCurrentMenu = async (menuGroupId: string) => {
    if (!menuGroupId || !integrationId) return
    try {
      setMenuCategoriesLoading(true)
      const response = await uberMenuSyncService.getMenuGroupCategories(storeId, menuGroupId)
      setMenuCategories(response || [])

      // 计算可以添加到菜单的分类（已创建的 Uber 分类 - 菜单已有的分类）
      const menuCategoryIds = new Set((response || []).map((c: any) => c.id))
      const available = (uberCategories || []).filter((cat: any) => !menuCategoryIds.has(cat.id))
      setAvailableCategoriesForMenu(available)
    } catch (error: any) {
      console.error('加载菜单分类失败:', error)
      toast.error(error.message || '加载菜单分类失败')
    } finally {
      setMenuCategoriesLoading(false)
    }
  }

  // 添加分类到菜单
  const handleAddCategoryToMenu = async (categoryId: string) => {
    const menuGroupId = activeTab
    if (!menuGroupId || !integrationId) {
      toast.error('请先选择菜单')
      return
    }

    try {
      setMenuCategoriesLoading(true)
      await uberMenuSyncService.addCategoryToMenuGroup(
        storeId,
        menuGroupId,
        categoryId,
        integrationId
      )
      toast.success('分类已添加到菜单')
      await loadMenuCategoriesForCurrentMenu(menuGroupId)
    } catch (error: any) {
      toast.error(error.message || '添加分类失败')
    } finally {
      setMenuCategoriesLoading(false)
    }
  }

  // 从菜单删除分类
  const handleRemoveCategoryFromMenu = async (categoryId: string, categoryName: string, isSystemCategory: boolean) => {
    const menuGroupId = activeTab
    if (!menuGroupId) {
      toast.error('请先选择菜单')
      return
    }

    try {
      setMenuCategoriesLoading(true)

      if (isSystemCategory) {
        // 系统分类：只移除关联,保留分类本身
        await uberMenuSyncService.removeCategoryFromMenuGroup(storeId, menuGroupId, categoryId)
        toast.success(`系统分类「${categoryName}」已从菜单中移除(分类本身保留)`)
      } else {
        // 自定义分类：先移除关联,再彻底删除分类
        await uberMenuSyncService.removeCategoryFromMenuGroup(storeId, menuGroupId, categoryId)
        await uberService.deleteMenuCategory(categoryId)
        toast.success(`自定义分类「${categoryName}」已彻底删除`)
      }

      // 重新加载数据：先加载全局分类列表,确保删除操作已生效,然后再加载菜单分类
      await loadUberCategories()
      await loadMenuCategoriesForCurrentMenu(menuGroupId)
    } catch (error: any) {
      toast.error(error.message || '删除分类失败')
    } finally {
      setMenuCategoriesLoading(false)
    }
  }

  // 重新排序菜单分类
  const handleReorderMenuCategories = async (categoryIds: string[]) => {
    const menuGroupId = activeTab
    if (!menuGroupId) {
      toast.error('请先选择菜单')
      return
    }

    try {
      await uberMenuSyncService.reorderMenuGroupCategories(storeId, menuGroupId, categoryIds)
      toast.success('分类顺序已更新')
      await loadMenuCategoriesForCurrentMenu(menuGroupId)
    } catch (error: any) {
      toast.error(error.message || '重新排序失败')
    }
  }

  // 创建菜单组（只需要名称和营业时间，分类在菜单Tab中配置）
  const handleCreateMenuGroup = async (name: string, availability: any) => {
    if (!integrationId) return
    try {
      setMenuGroupLoading(true)
      await uberMenuSyncService.createMenuGroup(storeId, integrationId, {
        name,
        displayOrder: menuGroups.length,
        serviceAvailability: availability
      })
      toast.success('菜单创建成功')
      setMenuGroupModalVisible(false)
      const groups = await loadMenuGroups()
      // 自动切换到新创建的菜单
      if (groups && groups.length > 0) {
        setActiveTab(groups[groups.length - 1].id)
      }
    } catch (error: any) {
      toast.error(error.message || '创建菜单失败')
    } finally {
      setMenuGroupLoading(false)
    }
  }

  // 更新菜单组（只更新名称和营业时间，分类在菜单Tab中配置）
  const handleUpdateMenuGroup = async (groupId: string, name: string, availability: any) => {
    try {
      setMenuGroupLoading(true)
      await uberMenuSyncService.updateMenuGroup(storeId, groupId, {
        name,
        serviceAvailability: availability
      })
      toast.success('菜单更新成功')
      setMenuGroupModalVisible(false)
      await loadMenuGroups()
    } catch (error: any) {
      toast.error(error.message || '更新菜单失败')
    } finally {
      setMenuGroupLoading(false)
    }
  }

  // 删除菜单组（仅删除数据库配置）
  const handleDeleteMenuGroup = async (groupId: string) => {
    try {
      setMenuGroupLoading(true)

      // 删除数据库中的菜单配置
      await uberMenuSyncService.deleteMenuGroup(storeId, groupId)
      toast.success('菜单配置已删除')

      // 更新选中状态
      if (selectedMenuGroupId === groupId) {
        setSelectedMenuGroupId('')
      }

      // 重新加载菜单列表
      const groups = await loadMenuGroups()

      // 如果还有其他菜单，切换到第一个；否则清空activeTab
      if (groups && groups.length > 0) {
        setActiveTab(groups[0].id)
      } else {
        setActiveTab('')
      }

    } catch (error: any) {
      toast.error(error.message || '删除菜单失败')
    } finally {
      setMenuGroupLoading(false)
    }
  }

  // 保存配置（同时保存商品价格和自定义选项价格）
  const handleSaveConfig = async () => {
    if (!integrationId || (modifiedItems.size === 0 && modifiedModifiers.size === 0)) return

    const tenantId = getTenantId()
    if (!tenantId) {
      toast.error('无法获取租户信息')
      return
    }

    try {
      setConfigSaving(true)
      setModifierSaving(true)

      // 获取当前菜单组ID
      const menuGroupId = activeTab

      const savePromises = []

      // 保存商品价格配置
      if (modifiedItems.size > 0) {
        const itemsToSave = configItems.map((item) => {
          const modified = modifiedItems.get(item.posItemId)
          return {
            posItemId: item.posItemId,
            enabled: modified?.enabled ?? item.enabled,
            uberPrice: modified?.uberPrice !== undefined ? modified.uberPrice : item.uberPrice
          }
        })
        savePromises.push(
          uberMenuSyncService.saveMenuConfig(integrationId, tenantId, itemsToSave, menuGroupId)
        )
      }

      // 保存自定义选项价格配置
      if (modifiedModifiers.size > 0) {
        console.log('=== 开始保存自定义选项配置 ===')
        console.log('modifiedModifiers 总数:', modifiedModifiers.size)
        console.log('modifiedModifiers 内容:')
        modifiedModifiers.forEach((data, key) => {
          console.log(`  key: ${key}`)
          console.log(`  data:`, data)
        })

        // 收集所有需要保存的自定义选项
        const allModifiersToSave: any[] = []

        // 遍历 modifiedModifiers，直接获取需要保存的自定义选项
        modifiedModifiers.forEach((modifiedData: any, key: string) => {
          const posItemId = modifiedData.posItemId
          const modifierOptionId = modifiedData.modifierOptionId

          console.log(`\n处理 key: ${key}`)
          console.log(`  posItemId: ${posItemId}`)
          console.log(`  modifierOptionId: ${modifierOptionId}`)

          // 从 modifierConfigs 中找到对应的完整数据
          const modifiers = modifierConfigs.get(posItemId) || []
          console.log(`  该商品的所有自定义选项数量: ${modifiers.length}`)

          const mod = modifiers.find(m => m.modifierOptionId === modifierOptionId)

          if (mod) {
            console.log(`  找到自定义选项:`, {
              posItemName: configItems.find(i => i.posItemId === posItemId)?.posItemName,
              modifierOptionName: mod.modifierOptionName,
              modifierOptionId: mod.modifierOptionId,
              posPrice: mod.posPrice,
              originalUberPrice: mod.uberPrice,
              newUberPrice: modifiedData.uberPrice !== undefined ? modifiedData.uberPrice : mod.uberPrice
            })

            const toSave = {
              posItemId: mod.posItemId,
              modifierGroupId: mod.modifierGroupId,
              modifierOptionId: mod.modifierOptionId,
              modifierOptionName: mod.modifierOptionName,
              enabled: modifiedData.enabled !== undefined ? modifiedData.enabled : mod.enabled,
              uberPrice: modifiedData.uberPrice !== undefined ? modifiedData.uberPrice : mod.uberPrice
            }
            allModifiersToSave.push(toSave)
            console.log(`  将要保存的数据:`, toSave)
          } else {
            console.log(`  ⚠️ 未找到对应的自定义选项！`)
          }
        })

        console.log('\n=== 最终要保存的所有自定义选项 ===')
        console.log(`总数: ${allModifiersToSave.length}`)
        allModifiersToSave.forEach((mod, index) => {
          const itemName = configItems.find(i => i.posItemId === mod.posItemId)?.posItemName
          console.log(`${index + 1}. 商品: ${itemName}, 选项: ${mod.modifierOptionName}, 价格: ${mod.uberPrice}`)
        })

        if (allModifiersToSave.length > 0) {
          savePromises.push(
            uberMenuSyncService.saveModifierConfig(integrationId, allModifiersToSave, menuGroupId)
          )
        }
      }

      // 并行保存所有配置
      await Promise.all(savePromises)

      const savedCount = modifiedItems.size + modifiedModifiers.size
      toast.success(`配置保存成功（共 ${savedCount} 项更改），请点击"菜单同步"按钮来应用更改`)

      // 清空修改状态
      setModifiedItems(new Map())
      setModifiedModifiers(new Map())

      // 重新加载配置
      loadMenuConfig(menuGroupId)
    } catch (error: any) {
      toast.error(error.message || '保存失败')
    } finally {
      setConfigSaving(false)
      setModifierSaving(false)
    }
  }

  // 基于配置同步
  const handleSyncWithConfig = async () => {
    if (!integrationId) {
      toast.error('缺少集成信息')
      return
    }

    // 检查是否已有菜单
    if (menuGroups.length === 0) {
      toast.error('请先创建至少一个菜单')
      return
    }

    // 检查是否选择了菜单
    if (!activeTab) {
      toast.warning('请先选择要同步的菜单')
      return
    }

    // 打开菜单配置模态框来确认同步
    setMenuConfigModalVisible(true)
  }

  // 处理菜单配置确认 - 同步所有菜单到 Uber
  const handleConfirmMenuConfig = async () => {
    if (!integrationId) {
      toast.error('缺少集成信息')
      return
    }

    const tenantId = getTenantId()
    if (!tenantId) {
      toast.error('无法获取租户信息')
      return
    }

    // 如果有未保存的更改，先保存
    if (modifiedItems.size > 0) {
      await handleSaveConfig()
    }

    try {
      setPOSSyncing(true)

      // 同步所有菜单组到 Uber
      // 调用后端的菜单组同步接口
      await uberMenuSyncService.syncMenuGroupsToUber(
        storeId,
        merchantId,
        integrationId
      )

      toast.success('✓ 菜单已成功同步到 Uber')
      setMenuConfigModalVisible(false)

      // 重新加载菜单组
      await loadMenuGroups()
    } catch (error: any) {
      toast.error(error.message || '同步失败')
    } finally {
      setPOSSyncing(false)
    }
  }

  // 统一调价功能
  const handleApplyPriceAdjustment = () => {
    if (priceAdjustmentPercent === undefined) {
      toast.warning('请输入调价百分比')
      return
    }
    const percent = priceAdjustmentPercent

    // 调整商品价格（基于原价POS价格）
    const newModified = new Map(modifiedItems)
    configItems.forEach((item) => {
      // 调价始终基于原价，0% 表示恢复为原价
      const adjustedPrice = Math.round(item.posPrice * (1 + percent / 100))
      const existing = newModified.get(item.posItemId) || {}
      newModified.set(item.posItemId, { ...existing, uberPrice: adjustedPrice })
    })
    setModifiedItems(newModified)

    // 调整自定义选项价格
    const newModifierConfigs = new Map(modifierConfigs)
    const newModifiedModifiers = new Map(modifiedModifiers)

    modifierConfigs.forEach((modifiers, itemId) => {
      const newModifiers = modifiers.map((mod) => {
        // 调价始终基于原价，0% 表示恢复为原价
        const adjustedPrice = Math.round(mod.posPrice * (1 + percent / 100))
        // 使用 itemId-modifierOptionId 组合作为 key
        const key = `${itemId}-${mod.modifierOptionId}`
        const modified = newModifiedModifiers.get(key) || {}
        newModifiedModifiers.set(key, {
          ...modified,
          uberPrice: adjustedPrice,
          posItemId: itemId,
          modifierOptionId: mod.modifierOptionId
        })
        return {
          ...mod,
          uberPrice: adjustedPrice
        }
      })
      newModifierConfigs.set(itemId, newModifiers)
    })

    setModifierConfigs(newModifierConfigs)
    setModifiedModifiers(newModifiedModifiers)

    setPriceAdjustmentModalVisible(false)
    setPriceAdjustmentPercent(undefined)
    toast.success(`已应用 ${percent > 0 ? '+' : ''}${percent}% 的调价`)
  }

  const handleOpenItemsDrawer = async (category: any) => {
    setSelectedCategory(category)
    setDrawerVisible(true)
    setItemSearch('')
    // 并行加载分类商品和所有POS商品
    await Promise.all([
      loadCategoryItems(category.id),
      posItems.length === 0 ? loadPosItems() : Promise.resolve()
    ])
  }

  const handleAddItems = async () => {
    if (!selectedCategory || selectedItems.length === 0) {
      toast.warning('请选择商品')
      return
    }

    try {
      // 添加新的商品（排除已有的）
      const existingItemIds = categoryItems.map(item => item.posItemId)
      const newItemIds = selectedItems.filter(id => !existingItemIds.includes(id))

      for (const itemId of newItemIds) {
        const item = posItems.find(p => p.id === itemId)
        await uberService.addItemToMenuCategory(
          selectedCategory.id,
          itemId,
          item?.name,
          categoryItems.length + newItemIds.indexOf(itemId)
        )
      }

      toast.success(`添加了 ${newItemIds.length} 个商品`)
      // 更新分类商品列表、全局分类和当前菜单分类
      await Promise.all([
        loadCategoryItems(selectedCategory.id),
        loadUberCategories(),
        activeTab ? loadMenuCategoriesForCurrentMenu(activeTab) : Promise.resolve()
      ])
      setSelectedItems([])
    } catch (error: any) {
      toast.error(error.message || '添加失败')
    }
  }

  const handleRemoveItem = async (itemId: string) => {
    try {
      await uberService.removeItemFromMenuCategory(itemId)
      toast.success('移除成功')
      // 更新分类商品列表、全局分类和当前菜单分类
      await Promise.all([
        loadCategoryItems(selectedCategory!.id),
        loadUberCategories(),
        activeTab ? loadMenuCategoriesForCurrentMenu(activeTab) : Promise.resolve()
      ])
    } catch (error: any) {
      toast.error(error.message || '移除失败')
    }
  }

  // 直接修改表格中的自定义选项价格
  const handleModifierPriceChange = (itemId: string, modifierOptionId: string, price: number | null) => {
    const itemName = configItems.find(i => i.posItemId === itemId)?.posItemName || itemId
    const currentModifiers = modifierConfigs.get(itemId) || []
    const modifier = currentModifiers.find(m => m.modifierOptionId === modifierOptionId)

    console.log(`\n=== handleModifierPriceChange ===`)
    console.log(`商品: ${itemName} (${itemId})`)
    console.log(`自定义选项: ${modifier?.modifierOptionName} (${modifierOptionId})`)
    console.log(`输入价格: $${price}`)
    console.log(`保存价格（分）: ${price !== null ? Math.round(price * 100) : null}`)

    const newModifiers = currentModifiers.map(m => {
      if (m.modifierOptionId === modifierOptionId) {
        return {
          ...m,
          uberPrice: price !== null ? Math.round(price * 100) : m.posPrice
        }
      }
      return m
    })

    const newModifierConfigs = new Map(modifierConfigs)
    newModifierConfigs.set(itemId, newModifiers)
    setModifierConfigs(newModifierConfigs)

    // 标记为已修改，以便后续保存
    // 使用 itemId-modifierOptionId 组合作为 key
    const newModified = new Map(modifiedModifiers)
    const key = `${itemId}-${modifierOptionId}`
    const existing = newModified.get(key) || {}
    const dataToSave = {
      ...existing,
      uberPrice: price !== null ? Math.round(price * 100) : null,
      posItemId: itemId,
      modifierOptionId: modifierOptionId
    }
    newModified.set(key, dataToSave)

    console.log(`组合 key: ${key}`)
    console.log(`保存到 modifiedModifiers:`, dataToSave)
    console.log(`modifiedModifiers 当前大小: ${newModified.size}`)

    setModifiedModifiers(newModified)
  }

  // 处理自定义选项配置变更
  const handleModifierChange = (posItemId: string, optionId: string, field: 'enabled' | 'uberPrice', value: any) => {
    const newModified = new Map(modifiedModifiers)
    // 使用 posItemId-optionId 组合作为 key，以区分不同商品的相同自定义选项选项
    const key = `${posItemId}-${optionId}`
    const existing = newModified.get(key) || {}
    newModified.set(key, { ...existing, [field]: value, posItemId, modifierOptionId: optionId })
    setModifiedModifiers(newModified)
    console.log(`handleModifierChange: posItemId=${posItemId}, optionId=${optionId}, field=${field}, value=${value}, newSize=${newModified.size}`)
  }

  // 获取自定义选项的有效值
  const getModifierEffectiveValue = (modifier: ModifierConfigItem, field: 'enabled' | 'uberPrice') => {
    const key = `${modifier.posItemId}-${modifier.modifierOptionId}`
    const modified = modifiedModifiers.get(key)
    if (modified && modified[field] !== undefined) {
      return modified[field]
    }
    return modifier[field]
  }

  // 保存自定义选项配置
  const handleSaveModifierConfig = async () => {
    if (!integrationId || !currentModifierItem || modifiedModifiers.size === 0) return

    try {
      setModifierSaving(true)

      const currentModifiers = modifierConfigs.get(currentModifierItem.posItemId) || []
      const modifiersToSave = currentModifiers.map((m) => {
        const modified = modifiedModifiers.get(m.modifierOptionId)
        const result = {
          posItemId: m.posItemId,
          modifierGroupId: m.modifierGroupId,
          modifierOptionId: m.modifierOptionId,
          modifierOptionName: m.modifierOptionName,
          enabled: modified?.enabled !== undefined ? modified.enabled : m.enabled,
          uberPrice: modified?.uberPrice !== undefined ? modified.uberPrice : m.uberPrice
        }
        console.log(`自定义选项 ${m.modifierOptionId}:`, {
          modified: !!modified,
          enabled: result.enabled,
          uberPrice: result.uberPrice,
          isModified: modified
        })
        return result
      })

      console.log('准备保存的自定义选项配置:', modifiersToSave)
      await uberMenuSyncService.saveModifierConfig(integrationId, modifiersToSave)
      toast.success('自定义选项配置保存成功，请点击"菜单同步"按钮来应用更改')
      setModifiedModifiers(new Map())

      // 重新加载
      const tenantId = getTenantId()
      if (tenantId) {
        const result = await uberMenuSyncService.getModifierConfig(integrationId, tenantId, currentModifierItem.posItemId)
        const newModifierConfigs = new Map(modifierConfigs)
        newModifierConfigs.set(currentModifierItem.posItemId, result.modifiers)
        setModifierConfigs(newModifierConfigs)
      }
    } catch (error: any) {
      toast.error(error.message || '保存失败')
    } finally {
      setModifierSaving(false)
    }
  }

  // 计算统计数据
  const stats = useMemo(() => {
    let enabledCount = 0
    let customPriceCount = 0

    configItems.forEach((item) => {
      const enabled = getEffectiveValue(item, 'enabled')
      const uberPrice = getEffectiveValue(item, 'uberPrice')
      if (enabled) enabledCount++
      if (uberPrice !== undefined && uberPrice !== null) customPriceCount++
    })

    return {
      total: configItems.length,
      enabled: enabledCount,
      customPrice: customPriceCount
    }
  }, [configItems, modifiedItems])

  // 统计卡片
  const StatBox = ({ value, label, color }: { value: React.ReactNode; label: string; color: string }) => (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-slate-400 text-sm mt-1">{label}</div>
    </div>
  )

  // 渲染配置管理 Tab（商品配置）
  const renderConfigTab = () => (
    <div>
      {/* 统计信息 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatBox value={stats.total} label="总商品数" color="text-blue-600" />
        <StatBox value={stats.enabled} label="已启用" color="text-green-600" />
        <StatBox value={stats.customPrice} label="自定义价格" color="text-amber-500" />
        <StatBox value={modifiedItems.size} label="待保存更改" color="text-slate-700" />
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Btn
          variant="secondary"
          icon={<RefreshCw className="w-4 h-4" />}
          onClick={() => loadMenuConfig(activeTab)}
          loading={configLoading}
        >
          刷新配置
        </Btn>
        <Btn variant="secondary" onClick={() => setPriceAdjustmentModalVisible(true)}>
          统一调价
        </Btn>
        <Btn
          variant="primary"
          icon={<Save className="w-4 h-4" />}
          onClick={handleSaveConfig}
          loading={configSaving || modifierSaving}
          disabled={modifiedItems.size === 0 && modifiedModifiers.size === 0}
        >
          保存配置 {(modifiedItems.size + modifiedModifiers.size) > 0 && `(${modifiedItems.size + modifiedModifiers.size})`}
        </Btn>
      </div>

      {/* 商品配置表格 - 每个商品的自定义选项直接显示在商品下一行 */}
      <div className="overflow-x-auto">
        {configItems.map((item) => {
          const modifiers = modifierConfigs.get(item.posItemId) || []
          const hasModifiers = modifiers.length > 0
          const uberPriceCents = getEffectiveValue(item, 'uberPrice') as number | undefined | null
          return (
            <div key={item.posItemId} className="mb-4">
              {/* 商品主行 */}
              <div
                className="grid items-center gap-4 p-3.5 border border-slate-200 bg-slate-50 rounded-t-lg"
                style={{
                  gridTemplateColumns: '50px 1fr 100px 150px 100px',
                  borderBottom: hasModifiers ? 'none' : undefined,
                  borderTopLeftRadius: 8,
                  borderTopRightRadius: 8,
                  borderBottomLeftRadius: hasModifiers ? 0 : 8,
                  borderBottomRightRadius: hasModifiers ? 0 : 8,
                }}
              >
                {/* 启用复选框 */}
                <div className="text-center">
                  <Checkbox
                    checked={getEffectiveValue(item, 'enabled') as boolean}
                    onCheckedChange={(v) => handleConfigChange(item.posItemId, 'enabled', v)}
                  />
                </div>

                {/* 商品名称 - 高亮显示 */}
                <div className="pl-2 border-l-[3px] border-slate-400">
                  <div className="font-semibold mb-1.5 text-[15px] text-slate-900">
                    {item.posItemName}
                  </div>
                  <div className="flex gap-2 items-center flex-wrap">
                    {item.posCategoryName && (
                      <Badge variant="blue">{item.posCategoryName}</Badge>
                    )}
                    {hasModifiers && (
                      <Badge variant="green">
                        {modifiers.length} 个自定义选项
                      </Badge>
                    )}
                  </div>
                </div>

                {/* POS 价格 */}
                <div className="text-center">
                  <div className="text-[11px] text-slate-400 mb-1">POS 价格</div>
                  <div className="font-medium text-sm text-slate-700">
                    ${(item.posPrice / 100).toFixed(2)}
                  </div>
                </div>

                {/* Uber 价格输入 */}
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">Uber 价格</div>
                  <MoneyInput
                    placeholder="使用 POS 价格"
                    value={uberPriceCents ? uberPriceCents / 100 : undefined}
                    onChange={(val) => handleConfigChange(
                      item.posItemId,
                      'uberPrice',
                      val !== undefined ? Math.round(val * 100) : null
                    )}
                    min={0}
                    max={375}
                    step={0.01}
                  />
                </div>

                {/* 同步状态 */}
                <div className="text-center">
                  {!item.syncStatus && <Badge variant="default">未同步</Badge>}
                  {item.syncStatus === 'success' && (
                    <span title={item.lastSyncedAt ? `最后同步: ${new Date(item.lastSyncedAt).toLocaleString()}` : ''}>
                      <Badge variant="green" icon={<CheckCircle2 className="w-3 h-3" />}>已同步</Badge>
                    </span>
                  )}
                  {item.syncStatus === 'error' && (
                    <span title={item.syncError}>
                      <Badge variant="red" icon={<XCircle className="w-3 h-3" />}>失败</Badge>
                    </span>
                  )}
                </div>
              </div>

              {/* 自定义选项行 */}
              {hasModifiers && (
                <div className="p-3.5 border border-slate-200 border-t-0 bg-slate-100 flex flex-wrap gap-2.5 items-start rounded-b-lg">
                  <div className="w-full mb-2">
                    <span className="font-semibold text-[13px] text-slate-700">
                      自定义选项 ({modifiers.length})
                    </span>
                  </div>
                  {modifiers.map((mod) => {
                    const currentUberPrice = mod.uberPrice !== undefined && mod.uberPrice !== null ? mod.uberPrice : mod.posPrice
                    return (
                      <div
                        key={mod.modifierOptionId}
                        className="p-2 border border-slate-200 rounded bg-white shadow-sm"
                        style={{ minWidth: 180, flex: '0 0 auto' }}
                      >
                        {/* 第一行：选项名和选项组名 */}
                        <div className="flex justify-between items-start mb-1.5">
                          <span className="font-medium text-[11px] text-slate-700 flex-1 break-words">
                            {mod.modifierOptionName}
                          </span>
                          <span className="text-[9px] text-slate-400 ml-1 shrink-0 text-right">
                            {mod.modifierGroupName}
                          </span>
                        </div>

                        {/* 启用状态 */}
                        {!mod.enabled && (
                          <div className="mb-1">
                            <Badge variant="red">禁用</Badge>
                          </div>
                        )}

                        {/* POS 价格显示 */}
                        <div className="text-[9px] text-slate-400 mb-1">
                          POS: ${(mod.posPrice / 100).toFixed(2)}
                        </div>

                        {/* Uber 价格输入 */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500 min-w-[32px] shrink-0">Uber:</span>
                          <MoneyInput
                            value={currentUberPrice / 100}
                            onChange={(val) => handleModifierPriceChange(item.posItemId, mod.modifierOptionId, val === undefined ? null : val)}
                            min={0}
                            max={375}
                            step={0.01}
                            className="w-[90px]"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  // 添加系统分类到配置列表
  const handleAddSystemCategory = async (sysCategory: any) => {
    try {
      setcategoryLoading(true)
      const categoryName = sysCategory.name || sysCategory.displayName

      // 创建同名的 Uber 分类
      const createdCategory = await uberService.createMenuCategory(
        integrationId!,
        categoryName,
        selectedSystemCategories.length // 显示顺序为当前列表长度
      )

      // 保存映射关系：系统分类 ID -> Uber 分类 ID
      const newMap = new Map(systemToUberCategoryMap)
      newMap.set(sysCategory.id, createdCategory.id)
      setSystemToUberCategoryMap(newMap)

      // 如果系统分类中有商品，自动将这些商品添加到 Uber 分类中
      if (sysCategory.items && sysCategory.items.length > 0) {
        try {
          const itemsToAdd = sysCategory.items
          for (let i = 0; i < itemsToAdd.length; i++) {
            const item = itemsToAdd[i]
            await uberService.addItemToMenuCategory(
              createdCategory.id,
              item.id,
              item.name,
              i // displayOrder
            )
          }
          toast.success(`已添加「${categoryName}」及其 ${itemsToAdd.length} 个商品到配置列表`)
        } catch (error: any) {
          console.error('自动添加商品失败:', error)
          toast.warning(`已添加分类，但自动添加商品失败: ${error.message}`)
        }
      } else {
        toast.success(`已添加「${categoryName}」到配置列表`)
      }

      // 添加到选中列表
      setSelectedSystemCategories([...selectedSystemCategories, sysCategory])
      await loadUberCategories()
    } catch (error: any) {
      toast.error(error.message || '添加分类失败')
    } finally {
      setcategoryLoading(false)
    }
  }

  // 删除分类配置
  const handleRemoveCategory = async (categoryId: string, categoryName: string) => {
    try {
      setcategoryLoading(true)
      await uberService.deleteMenuCategory(categoryId)

      // 从选中列表中删除系统分类（根据系统分类 ID 或 Uber 分类 ID）
      const filteredCategories = selectedSystemCategories.filter(cat => {
        // 检查是否是该系统分类对应的 Uber 分类
        const uberCategoryId = systemToUberCategoryMap.get(cat.id)
        return uberCategoryId !== categoryId
      })
      setSelectedSystemCategories(filteredCategories)

      // 清除映射关系
      const newMap = new Map(systemToUberCategoryMap)
      // 找到对应的系统分类 ID 并删除映射
      for (const [sysCatId, uberCatId] of newMap.entries()) {
        if (uberCatId === categoryId) {
          newMap.delete(sysCatId)
        }
      }
      setSystemToUberCategoryMap(newMap)

      toast.success(`已删除「${categoryName}」`)
      await loadUberCategories()
    } catch (error: any) {
      toast.error(error.message || '删除失败')
    } finally {
      setcategoryLoading(false)
    }
  }

  // 上移分类
  const handleMoveUp = async (index: number) => {
    if (index === 0) return

    // 直接操作 uberCategories（数据库中的分类）
    const newList = [...uberCategories]
    const [item] = newList.splice(index, 1)
    newList.splice(index - 1, 0, item)

    // 更新显示顺序
    try {
      for (let i = 0; i < newList.length; i++) {
        await uberService.updateMenuCategory(newList[i].id, undefined, i)
      }
      await loadUberCategories()
    } catch (error: any) {
      toast.error('更新顺序失败')
    }
  }

  // 下移分类
  const handleMoveDown = async (index: number) => {
    if (index === uberCategories.length - 1) return

    // 直接操作 uberCategories（数据库中的分类）
    const newList = [...uberCategories]
    const [item] = newList.splice(index, 1)
    newList.splice(index + 1, 0, item)

    // 更新显示顺序
    try {
      for (let i = 0; i < newList.length; i++) {
        await uberService.updateMenuCategory(newList[i].id, undefined, i)
      }
      await loadUberCategories()
    } catch (error: any) {
      toast.error('更新顺序失败')
    }
  }

  // 添加自定义分类
  const handleAddCustomCategory = async () => {
    if (!customCategoryName.trim()) {
      toast.warning('请输入分类名称')
      return
    }

    try {
      setcategoryLoading(true)
      const newCategory = await uberService.createMenuCategory(
        integrationId!,
        customCategoryName,
        selectedSystemCategories.length
      )

      toast.success(`已创建自定义分类「${customCategoryName}」`)
      setCustomCategoryName('')

      // 先重新加载全局分类列表,确保新分类已经存在
      await loadUberCategories()

      // 如果有活动的菜单,自动添加新分类到当前菜单
      if (activeTab && newCategory?.id) {
        try {
          setMenuCategoriesLoading(true)
          await uberMenuSyncService.addCategoryToMenuGroup(
            storeId,
            activeTab,
            newCategory.id,
            integrationId!
          )
          // 添加成功后重新加载菜单分类列表
          await loadMenuCategoriesForCurrentMenu(activeTab)
          toast.success('新分类已自动添加到当前菜单')
        } catch (error: any) {
          console.warn('自动添加分类到菜单失败:', error)
          // 即使添加失败也要加载菜单分类,确保UI状态正确
          if (activeTab) {
            await loadMenuCategoriesForCurrentMenu(activeTab)
          }
        } finally {
          setMenuCategoriesLoading(false)
        }
      } else if (activeTab) {
        // 没有新分类ID时,仍然要刷新菜单分类列表
        await loadMenuCategoriesForCurrentMenu(activeTab)
      }
    } catch (error: any) {
      toast.error(error.message || '创建分类失败')
    } finally {
      setcategoryLoading(false)
    }
  }

  // 清理菜单处理函数（由 ConfirmDialog 触发）
  const handleClearMenu = async () => {
    if (!integrationId) {
      toast.error('缺少集成ID')
      return
    }

    try {
      setClearingMenu(true)
      toast.info('正在清理菜单...')

      const result = await uberMenuSyncService.clearMenuItems(
        merchantId,
        storeId,
        integrationId,
        'MENU_TYPE_FULFILLMENT_DELIVERY'
      )

      await loadMenuConfig()

      if (result.success) {
        toast.success('✓ 菜单已清理')
      } else {
        toast.warning(result.message || '菜单清理完成但可能有错误')
      }
    } catch (error: any) {
      toast.error(error.message || '清理菜单失败，请重试')
      console.error('清理菜单错误:', error)
    } finally {
      setClearingMenu(false)
      setClearMenuConfirmOpen(false)
    }
  }

  // 判断菜单分类是否为系统分类
  const isSystemMenuCategory = (cat: any) =>
    systemCategories.some((sys: any) => sys.name === cat.name || sys.displayName === cat.name)

  // 菜单特定的分类管理（在菜单 Tab 中显示）
  const renderMenuCategoriesManagement = () => {
    return (
      <div>
        {/* 分类管理提示 */}
        <div className="mb-5">
          <AlertBox
            type="info"
            title={t('pages.menuSync.categoryManagement')}
            description={t('pages.menuSync.categoryManagementTip')}
          />
        </div>

        {/* 已添加的分类 */}
        <div className="mb-6">
          <SectionCard
            title={
              <span className="flex items-center gap-2">
                <span>{t('pages.menuSync.categoriesOfMenu')}</span>
                <Badge variant="blue">{menuCategories.length}</Badge>
              </span>
            }
          >
            {menuCategories.length === 0 ? (
              <EmptyState title={t('pages.menuSync.noCategoriesAdded')} />
            ) : (
              <div className="flex flex-col gap-3">
                {menuCategories.map((cat: any, index: number) => (
                  <div
                    key={cat.id}
                    className="p-4 border border-slate-200 rounded-lg bg-white flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded font-semibold text-slate-500">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-[15px] font-medium mb-1 flex items-center gap-2 text-slate-900">
                          {cat.name}
                          {isSystemMenuCategory(cat) && (
                            <Badge variant="blue">系统分类</Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">
                          已配置 <strong>{cat.itemCount || 0}</strong> 个商品
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 items-center">
                      <Btn
                        variant="secondary"
                        size="sm"
                        icon={<ArrowUp className="w-4 h-4" />}
                        onClick={() => {
                          const newOrder = menuCategories.map(c => c.id)
                          const current = newOrder[index]
                          newOrder[index] = newOrder[index - 1]
                          newOrder[index - 1] = current
                          handleReorderMenuCategories(newOrder)
                        }}
                        disabled={index === 0 || menuCategoriesLoading}
                      >{''}</Btn>

                      <Btn
                        variant="secondary"
                        size="sm"
                        icon={<ArrowDown className="w-4 h-4" />}
                        onClick={() => {
                          const newOrder = menuCategories.map(c => c.id)
                          const current = newOrder[index]
                          newOrder[index] = newOrder[index + 1]
                          newOrder[index + 1] = current
                          handleReorderMenuCategories(newOrder)
                        }}
                        disabled={index === menuCategories.length - 1 || menuCategoriesLoading}
                      >{''}</Btn>

                      {/* 配置商品按钮 */}
                      <Btn
                        variant="secondary"
                        size="sm"
                        icon={<LayoutGrid className="w-4 h-4" />}
                        onClick={() => handleOpenItemsDrawer(cat)}
                      >
                        配置商品
                      </Btn>

                      <Btn
                        variant="danger"
                        size="sm"
                        icon={<Trash2 className="w-4 h-4" />}
                        loading={menuCategoriesLoading}
                        onClick={() => setRemoveCategoryTarget({ id: cat.id, name: cat.name, isSystem: isSystemMenuCategory(cat) })}
                      >{''}</Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* 从系统分类添加 */}
        {systemCategories.length > 0 && (
          <div className="mb-6">
            <SectionCard title="从 POS 系统分类添加">
              <p className="text-slate-500 mb-4 text-xs">
                点击下方分类可将其添加到当前菜单
              </p>
              <div className="flex gap-3 flex-wrap">
                {systemCategories
                  .filter((sysCategory: any) => {
                    // 过滤掉已经添加到当前菜单的分类
                    return !menuCategories.some((menuCat: any) =>
                      menuCat.name === sysCategory.name || menuCat.name === sysCategory.displayName
                    )
                  })
                  .map((sysCategory: any) => {
                    const categoryName = sysCategory.name || sysCategory.displayName
                    const totalItemCount = sysCategory.itemCount || 0

                    return (
                      <Btn
                        key={sysCategory.id}
                        variant="secondary"
                        loading={menuCategoriesLoading}
                        className="!h-auto !py-2 !px-4 min-w-[120px]"
                        onClick={async () => {
                          try {
                            setMenuCategoriesLoading(true)

                            // 按 POS 分类 ID 查找是否已关联
                            let targetCategory = uberCategories.find(
                              (cat: any) => cat.posSystemCategoryId === sysCategory.id
                            )

                            if (!targetCategory) {
                              // POS 分类还未关联,创建或更新 Uber 分类
                              targetCategory = await uberService.createMenuCategory(
                                integrationId,
                                categoryName,
                                uberCategories.length,
                                sysCategory.id || undefined  // 传递 POS 系统分类 ID
                              )
                            }

                            // 将分类添加到当前菜单(如果还没添加)
                            const alreadyInMenu = menuCategories.some((mc: any) => mc.id === targetCategory.id)
                            if (!alreadyInMenu) {
                              await handleAddCategoryToMenu(targetCategory.id)
                            }

                            // 将 POS 分类下的所有商品添加到 Uber 分类中
                            const catItems = sysCategory.items || []
                            if (catItems.length > 0) {
                              // 批量添加商品,忽略已存在的商品
                              const addPromises = catItems.map((item: any, index: number) =>
                                uberService.addItemToMenuCategory(
                                  targetCategory.id,
                                  item.id,
                                  item.name,
                                  index
                                ).catch((err: any) => {
                                  // 忽略"商品已存在"的错误
                                  if (!err.message?.includes('已在此分类中')) {
                                    throw err
                                  }
                                })
                              )
                              await Promise.all(addPromises)
                              toast.success(`已添加分类 "${categoryName}" 及其 ${catItems.length} 个商品到当前菜单`)
                            } else {
                              toast.success(`已添加分类 "${categoryName}" 到当前菜单`)
                            }

                            // 重新加载 Uber 分类列表
                            await loadUberCategories()
                          } catch (error: any) {
                            toast.error(error.message || '添加分类失败')
                          } finally {
                            setMenuCategoriesLoading(false)
                          }
                        }}
                      >
                        <div className="text-center">
                          <div className="font-medium">+ {categoryName}</div>
                          <div className="text-xs mt-1 text-slate-400">
                            {totalItemCount} 个商品
                          </div>
                        </div>
                      </Btn>
                    )
                  })}
              </div>
            </SectionCard>
          </div>
        )}

        {/* 添加分类 */}
        {availableCategoriesForMenu.length > 0 && (
          <div className="mb-6">
            <SectionCard title="从全局分类添加">
              <div className="flex gap-3 flex-wrap">
                {availableCategoriesForMenu.map((cat: any) => (
                  <Btn
                    key={cat.id}
                    variant="secondary"
                    loading={menuCategoriesLoading}
                    className="!h-auto !py-2 !px-4 min-w-[120px]"
                    onClick={() => handleAddCategoryToMenu(cat.id)}
                  >
                    <div className="text-center">
                      <div className="font-medium">+ {cat.name}</div>
                      {cat.itemCount > 0 && (
                        <div className="text-xs mt-1 text-slate-400">
                          {cat.itemCount} 个商品
                        </div>
                      )}
                    </div>
                  </Btn>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* 创建新分类 */}
        <div className="mb-6">
          <SectionCard title="创建新分类">
            <div className="flex gap-2">
              <TextInput
                placeholder="输入分类名称，如「早餐」、「限时优惠」"
                value={customCategoryName}
                onChange={setCustomCategoryName}
                className="flex-1"
              />
              <Btn
                variant="primary"
                icon={<Plus className="w-4 h-4" />}
                onClick={handleAddCustomCategory}
                loading={categoryLoading}
                className="w-[140px]"
              >
                创建分类
              </Btn>
            </div>
          </SectionCard>
        </div>

        {renderItemsDrawer(selectedCategory ? `为「${selectedCategory.name}」配置商品` : '配置分类商品')}
      </div>
    )
  }

  // 分类商品管理抽屉（categories Tab 与 分类 Tab 复用）
  const renderItemsDrawer = (title: string) => (
    <Drawer
      title={title}
      width={600}
      open={drawerVisible}
      onOpenChange={(v) => {
        if (!v) {
          setDrawerVisible(false)
          setSelectedCategory(null)
        }
      }}
    >
      {selectedCategory && (
        <div>
          {/* 已添加的商品列表 */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">已配置的商品 ({categoryItems.length})</h4>
            {categoryItems.length === 0 ? (
              <EmptyState title="该分类还没有配置任何商品。从下方添加。" />
            ) : (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {categoryItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-700 truncate">{getItemName(item)}</div>
                      <div className="text-xs text-slate-400">顺序: {item.displayOrder}</div>
                    </div>
                    <Btn variant="link" size="sm" className="text-red-500!" onClick={() => handleRemoveItem(item.id)}>
                      移除
                    </Btn>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 添加商品 */}
          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-sm font-semibold text-slate-900 mb-1">添加商品</h4>
            <p className="text-xs text-slate-400 mb-3">
              从下方选择要添加到该分类的商品。选中后点击「确认添加」。
            </p>
            {itemsLoading ? (
              <Spinner className="!py-8" />
            ) : (
              <>
                <TextInput
                  placeholder="搜索商品..."
                  value={itemSearch}
                  onChange={setItemSearch}
                  className="mb-3"
                />
                <div className="border border-slate-200 rounded-lg max-h-72 overflow-y-auto mb-4 divide-y divide-slate-100">
                  {(Array.isArray(posItems)
                    ? posItems
                        .filter(item => !categoryItems.find(ci => ci.posItemId === item.id))
                        .filter(item => (item.name ?? '').toLowerCase().includes(itemSearch.toLowerCase()))
                    : []
                  ).map(item => (
                    <div key={item.id} className="px-3 py-2">
                      <Checkbox
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={(v) => {
                          if (v) setSelectedItems([...selectedItems, item.id])
                          else setSelectedItems(selectedItems.filter(id => id !== item.id))
                        }}
                        label={item.name}
                      />
                    </div>
                  ))}
                  {(Array.isArray(posItems)
                    ? posItems.filter(item => !categoryItems.find(ci => ci.posItemId === item.id)).length === 0
                    : true) && (
                    <div className="px-3 py-4 text-center text-sm text-slate-400">暂无可添加的商品</div>
                  )}
                </div>
              </>
            )}
            <Btn
              variant="primary"
              onClick={handleAddItems}
              disabled={selectedItems.length === 0}
              className="w-full"
            >
              确认添加 ({selectedItems.length} 个)
            </Btn>
          </div>
        </div>
      )}
    </Drawer>
  )

  const renderCategoriesTab = () => {
    // 直接从数据库读取的 Uber 分类，进行分类：系统分类 vs 自定义分类
    const allConfiguredCategories = uberCategories.map((uberCat: any) => {
      // 判断这个 Uber 分类是否来自系统分类
      const matchedSystemCategory = systemCategories.find(
        (sys: any) => sys.name === uberCat.name || sys.displayName === uberCat.name
      )

      return {
        ...uberCat,
        type: matchedSystemCategory ? 'system' : 'custom',
        systemCategory: matchedSystemCategory // 如果是系统分类，保存原始的系统分类对象
      }
    })

    // 同步更新前端状态：确保 selectedSystemCategories 和 systemToUberCategoryMap 与数据库一致
    // 这样用户刷新页面时，前端状态能自动恢复
    const loadedSystemCategories = allConfiguredCategories
      .filter((cat: any) => cat.type === 'system')
      .map((cat: any) => cat.systemCategory)

    if (JSON.stringify(loadedSystemCategories) !== JSON.stringify(selectedSystemCategories)) {
      setSelectedSystemCategories(loadedSystemCategories)
    }

    // 同步映射关系
    const newMap = new Map<string, string>()
    allConfiguredCategories.forEach((cat: any) => {
      if (cat.systemCategory) {
        newMap.set(cat.systemCategory.id, cat.id)
      }
    })
    if (newMap.size !== systemToUberCategoryMap.size) {
      setSystemToUberCategoryMap(newMap)
    }

    return (
      <div>
        {/* 系统分类选择区 */}
        <div className="mb-6">
          <SectionCard title="1. 选择系统分类">
            {systemCategories.length === 0 ? (
              <EmptyState title="系统中没有分类。请先在 POS 系统中创建分类。" />
            ) : (
              <div>
                <p className="text-slate-500 mb-4 text-xs">
                  点击下方的分类卡片可将其添加到下方的配置列表中进行排序和商品配置。
                </p>
                <div className="flex gap-3 flex-wrap">
                  {systemCategories.map((sysCategory: any) => {
                    const categoryName = sysCategory.name || sysCategory.displayName
                    const isSelected = selectedSystemCategories.some(cat => cat.id === sysCategory.id)

                    // 获取该系统分类对应的 Uber 分类
                    const correspondingUberCategory = allConfiguredCategories.find(
                      cat => cat.type === 'system' && cat.systemCategory?.id === sysCategory.id
                    )

                    // 显示已配置的商品数量（从 Uber 分类的 itemCount）
                    const configuredItemCount = correspondingUberCategory?.itemCount || 0
                    // 显示 POS 系统中该分类的总商品数
                    const totalItemCount = sysCategory.itemCount || 0

                    return (
                      <Btn
                        key={sysCategory.id}
                        variant={isSelected ? 'primary' : 'secondary'}
                        loading={categoryLoading}
                        className="!h-auto !py-2 !px-4 min-w-[120px]"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedSystemCategories(
                              selectedSystemCategories.filter(cat => cat.id !== sysCategory.id)
                            )
                          } else {
                            handleAddSystemCategory(sysCategory)
                          }
                        }}
                      >
                        <div className="text-center">
                          <div className="font-medium">{categoryName}</div>
                          <div className="text-xs mt-1">
                            {isSelected ? (
                              <>
                                已配置 <strong>{configuredItemCount}</strong> 个商品
                                {configuredItemCount < totalItemCount && (
                                  <div className="text-[11px] mt-0.5 opacity-70">
                                    (共 {totalItemCount} 个)
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                {totalItemCount} 个商品
                              </>
                            )}
                          </div>
                        </div>
                      </Btn>
                    )
                  })}
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* 配置列表和自定义分类 */}
        <div className="mb-4">
          <SectionCard
            title={
              <span className="flex items-center gap-2">
                <span>2. 配置菜单分类</span>
                <Badge variant="blue">{allConfiguredCategories.length}</Badge>
              </span>
            }
          >
            {allConfiguredCategories.length === 0 ? (
              <EmptyState title="还没有配置任何菜单分类。请从上方选择系统分类或创建自定义分类。" />
            ) : (
              <div className="flex flex-col gap-3">
                {allConfiguredCategories.map((uberCategory: any, index: number) => {
                  const categoryName = uberCategory.name
                  const isSystemCategory = uberCategory.type === 'system'
                  const itemCount = uberCategory.itemCount || 0

                  // 安全检查：确保 Uber 分类有有效的 ID
                  if (!uberCategory || !uberCategory.id) {
                    console.warn('Warning: uberCategory missing', categoryName)
                    return null
                  }

                  return (
                    <div
                      key={`uber-${uberCategory.id}`}
                      className="p-4 border border-slate-200 rounded-lg bg-white flex items-center justify-between"
                    >
                      {/* 左侧：序号和分类信息 */}
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded font-semibold text-slate-500">
                          {index + 1}
                        </div>

                        <div className="flex-1">
                          <div className="text-[15px] font-medium mb-1 text-slate-900">
                            {categoryName}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2">
                            {isSystemCategory ? (
                              <Badge variant="blue">系统分类</Badge>
                            ) : (
                              <Badge variant="gold">自定义分类</Badge>
                            )}
                            <span>
                              已配置 <strong>{itemCount}</strong> 个商品
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 右侧：操作按钮 */}
                      <div className="flex gap-2 items-center">
                        {/* 排序按钮 */}
                        <Btn
                          variant="secondary"
                          size="sm"
                          icon={<ArrowUp className="w-4 h-4" />}
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                        >{''}</Btn>

                        <Btn
                          variant="secondary"
                          size="sm"
                          icon={<ArrowDown className="w-4 h-4" />}
                          onClick={() => handleMoveDown(index)}
                          disabled={index === allConfiguredCategories.length - 1}
                        >{''}</Btn>

                        {/* 配置商品按钮 */}
                        <Btn
                          variant="secondary"
                          size="sm"
                          icon={<LayoutGrid className="w-4 h-4" />}
                          onClick={() => handleOpenItemsDrawer(uberCategory)}
                        >
                          配置商品
                        </Btn>

                        {/* 删除按钮 */}
                        <Btn
                          variant="danger"
                          size="sm"
                          icon={<Trash2 className="w-4 h-4" />}
                          onClick={() => setRemoveConfiguredCategoryTarget({ id: uberCategory.id, name: categoryName, isSystem: isSystemCategory })}
                        >{''}</Btn>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* 创建自定义分类区 */}
        <div className="mb-4">
          <SectionCard title="3. 创建自定义分类（可选）">
            <div className="flex gap-2">
              <TextInput
                placeholder="输入自定义分类名称，如「限时优惠」、「新品推荐」"
                value={customCategoryName}
                onChange={setCustomCategoryName}
                className="flex-1"
              />
              <Btn
                variant="primary"
                icon={<Plus className="w-4 h-4" />}
                onClick={handleAddCustomCategory}
                loading={categoryLoading}
                className="w-[140px]"
              >
                创建分类
              </Btn>
            </div>
          </SectionCard>
        </div>

        {renderItemsDrawer(selectedCategory ? `为「${selectedCategory.name || selectedCategory.displayName}」配置商品` : '配置分类商品')}
      </div>
    )
  }

  // 渲染营业时间编辑器
  const renderServiceAvailabilityEditor = (menuGroup: MenuGroup) => {
    const currentAvailability = menuGroup.serviceAvailability || {}
    const availabilityMap = new Map(Object.entries(currentAvailability))

    return (
      <div className="mb-6">
        <SectionCard
          title="营业时间设置"
          action={
            <div className="flex items-center gap-2">
              <Btn
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingMenuGroup(menuGroup)
                  setMenuName(menuGroup.name || 'Menu')
                  setServiceAvailability(availabilityMap as any)
                  setMenuGroupModalVisible(true)
                }}
              >
                编辑菜单信息
              </Btn>
              <Btn
                variant="danger"
                size="sm"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={() => setDeleteMenuGroupTarget(menuGroup)}
              >
                删除菜单
              </Btn>
            </div>
          }
        >
          <div className="flex flex-wrap gap-3">
            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
              const times = currentAvailability[day] || []
              const dayNames: Record<string, string> = {
                monday: '周一',
                tuesday: '周二',
                wednesday: '周三',
                thursday: '周四',
                friday: '周五',
                saturday: '周六',
                sunday: '周日'
              }
              return (
                <div key={day} className="flex items-center gap-1.5 text-xs">
                  <span className="font-semibold text-slate-700 min-w-[30px]">
                    {dayNames[day]}
                  </span>
                  <span className="text-slate-500 min-w-fit">
                    {Array.isArray(times) && times.length > 0 ? (
                      times.map((time: any) => `${time.startTime}-${time.endTime}`).join(',')
                    ) : (
                      <span className="text-slate-400">休</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </SectionCard>
      </div>
    )
  }

  // 菜单内容子 Tab 项
  const subTabItems = [
    { key: 'categories', label: '分类管理', icon: <LayoutGrid className="w-4 h-4" /> },
    { key: 'items', label: '商品配置', icon: <Settings className="w-4 h-4" /> },
  ]

  // 自定义选项模态框表格列
  const modifierColumns: Column<ModifierConfigItem>[] = [
    {
      key: 'enabled',
      title: '启用',
      width: 60,
      render: (record) => (
        <Checkbox
          checked={getModifierEffectiveValue(record, 'enabled') as boolean}
          onCheckedChange={(v) => handleModifierChange(record.posItemId, record.modifierOptionId, 'enabled', v)}
        />
      )
    },
    {
      key: 'modifierGroupName',
      title: '自定义选项',
      width: 120,
      render: (record) => <Badge variant="blue">{record.modifierGroupName}</Badge>
    },
    {
      key: 'modifierOptionName',
      title: '选项名称',
      width: 150,
      render: (record) => record.modifierOptionName
    },
    {
      key: 'posPrice',
      title: 'POS 价格',
      width: 100,
      render: (record) => `$${(record.posPrice / 100).toFixed(2)}`
    },
    {
      key: 'uberPrice',
      title: 'Uber 价格',
      width: 150,
      render: (record) => {
        const currentValue = getModifierEffectiveValue(record, 'uberPrice') as number | undefined
        return (
          <MoneyInput
            placeholder="使用 POS"
            value={currentValue !== undefined && currentValue !== null ? currentValue / 100 : undefined}
            onChange={(val) => handleModifierChange(
              record.posItemId,
              record.modifierOptionId,
              'uberPrice',
              val !== undefined ? Math.round(val * 100) : null
            )}
            min={0}
            max={375}
            step={0.01}
            className="w-[110px]"
          />
        )
      }
    },
    {
      key: 'effectivePrice',
      title: '实际价格',
      width: 100,
      render: (record) => {
        const uberPrice = getModifierEffectiveValue(record, 'uberPrice') as number | undefined
        const price = uberPrice ?? record.effectivePrice
        return <strong>${(price / 100).toFixed(2)}</strong>
      }
    }
  ]

  return (
    <div className="menu-sync">
      <SectionCard
        title={
          <span className="flex items-center gap-2.5">
            <Upload className="w-5 h-5 text-blue-600" />
            <span>菜单同步</span>
            {modifiedItems.size > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[11px] font-medium"
                title="待保存的更改"
              >
                {modifiedItems.size}
              </span>
            )}
          </span>
        }
        action={integrationId ? (
          <div className="flex items-center gap-2">
            <Btn
              variant="primary"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={handleSyncWithConfig}
              loading={posSyncing}
              disabled={stats.enabled === 0}
            >
              同步到 Uber
            </Btn>
            <Btn
              variant="danger"
              icon={<Trash2 className="w-4 h-4" />}
              loading={clearingMenu}
              onClick={() => setClearMenuConfirmOpen(true)}
            >
              清理菜单
            </Btn>
          </div>
        ) : undefined}
      >
        {integrationId ? (
          <>
            {/* 菜单组 Tab 栏 + 新建菜单 */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="min-w-0 overflow-x-auto">
                {menuGroups.length > 0 ? (
                  <Tabs
                    items={menuGroups.map(group => ({
                      key: group.id,
                      label: group.name,
                      icon: <Settings className="w-4 h-4" />,
                    }))}
                    value={activeTab}
                    onChange={setActiveTab}
                  />
                ) : (
                  <Tabs
                    items={[{ key: 'empty', label: '暂无菜单' }]}
                    value="empty"
                    onChange={() => {}}
                  />
                )}
              </div>
              <Btn
                variant="primary"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setEditingMenuGroup(null)
                  setMenuName('Menu')
                  setServiceAvailability(
                    new Map([
                      ['monday', [{ startTime: '00:00', endTime: '23:59' }]],
                      ['tuesday', [{ startTime: '00:00', endTime: '23:59' }]],
                      ['wednesday', [{ startTime: '00:00', endTime: '23:59' }]],
                      ['thursday', [{ startTime: '00:00', endTime: '23:59' }]],
                      ['friday', [{ startTime: '00:00', endTime: '23:59' }]],
                      ['saturday', [{ startTime: '00:00', endTime: '23:59' }]],
                      ['sunday', [{ startTime: '00:00', endTime: '23:59' }]]
                    ])
                  )
                  setMenuGroupModalVisible(true)
                }}
              >
                新建菜单
              </Btn>
            </div>

            {/* 菜单组内容 */}
            {menuGroups.length > 0 ? (
              (() => {
                const group = menuGroups.find(g => g.id === activeTab)
                if (!group) return null
                return (
                  <div>
                    {/* 营业时间设置 */}
                    {renderServiceAvailabilityEditor(group)}

                    {/* 菜单内容子 Tab */}
                    <div className="mb-4">
                      <Tabs items={subTabItems} value={activeSubTab} onChange={setActiveSubTab} />
                    </div>
                    {activeSubTab === 'categories' && renderMenuCategoriesManagement()}
                    {activeSubTab === 'items' && renderConfigTab()}
                  </div>
                )
              })()
            ) : (
              <EmptyState
                title="还没有创建菜单"
                description="点击右上角的「新建菜单」按钮创建一个"
              />
            )}
          </>
        ) : (
          <div className="text-center py-10 text-slate-400">
            <p>请先完成 Uber 店铺绑定后再配置菜单同步</p>
          </div>
        )}
      </SectionCard>

      {/* 统一调价模态框 */}
      <Modal
        title="统一调价工具"
        open={priceAdjustmentModalVisible}
        onOpenChange={(v) => {
          if (!v) {
            setPriceAdjustmentModalVisible(false)
            setPriceAdjustmentPercent(undefined)
          }
        }}
        size="md"
        footer={
          <>
            <Btn variant="secondary" onClick={() => {
              setPriceAdjustmentModalVisible(false)
              setPriceAdjustmentPercent(undefined)
            }}>
              取消
            </Btn>
            <Btn variant="primary" onClick={handleApplyPriceAdjustment}>
              应用调价
            </Btn>
          </>
        }
      >
        <div>
          <p className="mb-4 text-slate-500 text-sm">
            输入调价百分比，系统将对所有商品进行统一调价。正数为涨价，负数为降价。
          </p>
          <div className="mb-2">
            <label className="block mb-2 font-medium text-sm text-slate-700">调价百分比 (%)</label>
            <div className="flex items-center rounded-lg border border-slate-200 bg-white px-3 focus-within:outline-2 focus-within:outline-slate-900">
              <input
                type="number"
                className="w-full bg-transparent py-2 text-sm text-slate-700 focus:outline-none"
                placeholder="例如：10 表示涨价 10%，-5 表示降价 5%"
                value={priceAdjustmentPercent ?? ''}
                onChange={(e) => setPriceAdjustmentPercent(e.target.value === '' ? undefined : Number(e.target.value))}
                step={0.1}
                min={-100}
                max={100}
              />
              <span className="text-sm text-slate-400">%</span>
            </div>
          </div>
          {priceAdjustmentPercent !== undefined && (
            <div className="p-3 bg-blue-50 rounded mt-4 border-l-[3px] border-blue-600">
              <div className="text-[13px] text-slate-700 mb-2">调价示例：</div>
              {configItems.slice(0, 2).map(item => {
                const posPrice = item.posPrice / 100
                const adjustedPrice = posPrice * (1 + priceAdjustmentPercent / 100)
                const modifiers = modifierConfigs.get(item.posItemId) || []
                return (
                  <div key={item.posItemId} className="text-xs text-slate-500 mb-2">
                    <div className="mb-1">
                      <strong>{item.posItemName}</strong>: ${posPrice.toFixed(2)} → ${adjustedPrice.toFixed(2)}
                    </div>
                    {modifiers.length > 0 && (
                      <div className="ml-3 text-slate-400">
                        {modifiers.slice(0, 2).map(mod => {
                          const modPrice = (mod.uberPrice !== undefined && mod.uberPrice !== null ? mod.uberPrice : mod.posPrice) / 100
                          const modAdjusted = modPrice * (1 + priceAdjustmentPercent / 100)
                          return (
                            <div key={mod.modifierOptionId} className="text-[11px] mb-0.5">
                              └ {mod.modifierOptionName}: ${modPrice.toFixed(2)} → ${modAdjusted.toFixed(2)}
                            </div>
                          )
                        })}
                        {modifiers.length > 2 && (
                          <div className="text-[11px] mb-0.5">
                            └ ... 还有 {modifiers.length - 2} 个选项
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {configItems.length > 2 && (
                <div className="text-xs text-slate-400 mt-1">
                  ... 共 {configItems.length} 个商品
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* 菜单创建/编辑模态框 */}
      <Modal
        title={
          <span className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" />
            {editingMenuGroup ? '编辑菜单' : '新建菜单'}
          </span>
        }
        open={menuGroupModalVisible}
        onOpenChange={(v) => {
          if (!v) {
            setMenuGroupModalVisible(false)
            setEditingMenuGroup(null)
            setMenuName('Menu')
          }
        }}
        size="xl"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setMenuGroupModalVisible(false)}>
              取消
            </Btn>
            <Btn
              variant="primary"
              loading={menuGroupLoading}
              onClick={() => {
                if (!menuName.trim()) {
                  toast.error('菜单名称不能为空')
                  return
                }

                const availabilityObj = Object.fromEntries(serviceAvailability)

                if (editingMenuGroup) {
                  handleUpdateMenuGroup(editingMenuGroup.id, menuName, availabilityObj)
                } else {
                  handleCreateMenuGroup(menuName, availabilityObj)
                }
              }}
            >
              {editingMenuGroup ? '保存更新' : '创建菜单'}
            </Btn>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {/* 菜单名称 */}
          <div>
            <label className="block mb-1.5 font-medium text-sm text-slate-700">菜单名称</label>
            <TextInput
              placeholder="例如: 早餐菜单、午餐菜单、晚餐菜单"
              value={menuName}
              onChange={setMenuName}
            />
          </div>

          {/* 营业时间 - 紧凑横向展示 */}
          <div>
            <label className="block mb-2 font-medium text-sm text-slate-700">营业时间（周一至周日）</label>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                const times = serviceAvailability.get(day) || []
                const dayNames: Record<string, string> = {
                  monday: '周一',
                  tuesday: '周二',
                  wednesday: '周三',
                  thursday: '周四',
                  friday: '周五',
                  saturday: '周六',
                  sunday: '周日'
                }
                return (
                  <div key={day} className="flex gap-1.5 items-start flex-wrap">
                    <span className="text-xs font-semibold text-slate-700 min-w-[32px] mt-1.5">
                      {dayNames[day]}
                    </span>
                    <div className="flex gap-1.5 flex-wrap items-center flex-1">
                      {times.length === 0 ? (
                        <span className="text-xs text-slate-400 mt-1.5">休息</span>
                      ) : (
                        times.map((time, idx) => (
                          <div key={idx} className="flex gap-1 items-center text-xs">
                            <input
                              type="time"
                              value={time.startTime || '00:00'}
                              onChange={(e) => {
                                const newTimes = [...times]
                                newTimes[idx] = { ...newTimes[idx], startTime: e.target.value || '00:00' }
                                const newAvailability = new Map(serviceAvailability)
                                newAvailability.set(day, newTimes)
                                setServiceAvailability(newAvailability)
                              }}
                              className="text-xs bg-white border border-slate-200 rounded-md px-1.5 py-1 text-slate-700 focus:outline-2 focus:outline-slate-900"
                            />
                            <span className="text-[11px] text-slate-400">-</span>
                            <input
                              type="time"
                              value={time.endTime || '00:00'}
                              onChange={(e) => {
                                const newTimes = [...times]
                                newTimes[idx] = { ...newTimes[idx], endTime: e.target.value || '00:00' }
                                const newAvailability = new Map(serviceAvailability)
                                newAvailability.set(day, newTimes)
                                setServiceAvailability(newAvailability)
                              }}
                              className="text-xs bg-white border border-slate-200 rounded-md px-1.5 py-1 text-slate-700 focus:outline-2 focus:outline-slate-900"
                            />
                            <Btn
                              variant="ghost"
                              size="sm"
                              icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
                              onClick={() => {
                                const newTimes = times.filter((_, i) => i !== idx)
                                const newAvailability = new Map(serviceAvailability)
                                newAvailability.set(day, newTimes)
                                setServiceAvailability(newAvailability)
                              }}
                              className="!px-1 !py-1"
                            >{''}</Btn>
                            {idx < times.length - 1 && <span className="text-slate-300">|</span>}
                          </div>
                        ))
                      )}
                      <Btn
                        variant="ghost"
                        size="sm"
                        icon={<Plus className="w-3.5 h-3.5 text-blue-600" />}
                        onClick={() => {
                          const newTimes = [...times, { startTime: '09:00', endTime: '17:00' }]
                          const newAvailability = new Map(serviceAvailability)
                          newAvailability.set(day, newTimes)
                          setServiceAvailability(newAvailability)
                        }}
                        className="!px-1 !py-1"
                      >{''}</Btn>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* 自定义选项配置模态框 */}
      <Modal
        title={
          <span className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            自定义选项配置 - {currentModifierItem?.posItemName}
            <span className="ml-2 text-xs text-slate-500">
              (已修改: {modifiedModifiers.size})
            </span>
          </span>
        }
        open={modifierModalVisible}
        onOpenChange={(v) => {
          if (!v) {
            setModifierModalVisible(false)
            setCurrentModifierItem(null)
          }
        }}
        size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setModifierModalVisible(false)}>
              取消
            </Btn>
            <Btn
              variant="secondary"
              onClick={() => {
                if (!currentModifierItem) return

                const currentModifiers = modifierConfigs.get(currentModifierItem.posItemId) || []
                const newModifiers = currentModifiers.map(m => ({
                  ...m,
                  uberPrice: m.posPrice
                }))

                // 更新 modifierConfigs Map
                const newModifierConfigs = new Map(modifierConfigs)
                newModifierConfigs.set(currentModifierItem.posItemId, newModifiers)
                setModifierConfigs(newModifierConfigs)

                // 更新 modifiedModifiers
                const newModified = new Map(modifiedModifiers)
                newModifiers.forEach(m => {
                  // 使用 posItemId-modifierOptionId 组合作为 key
                  const key = `${currentModifierItem.posItemId}-${m.modifierOptionId}`
                  const existing = newModified.get(key) || {}
                  newModified.set(key, {
                    ...existing,
                    uberPrice: m.posPrice,
                    posItemId: currentModifierItem.posItemId,
                    modifierOptionId: m.modifierOptionId
                  })
                })
                setModifiedModifiers(newModified)
                toast.success('已将所有 POS 价格应用到 Uber 价格')
              }}
            >
              应用 POS 价格
            </Btn>
            <Btn
              variant="primary"
              icon={<Save className="w-4 h-4" />}
              onClick={handleSaveModifierConfig}
              loading={modifierSaving}
              disabled={modifiedModifiers.size === 0}
            >
              保存配置 {modifiedModifiers.size > 0 && `(${modifiedModifiers.size})`}
            </Btn>
          </>
        }
      >
        {!currentModifierItem ? (
          <div className="text-center py-10 text-slate-400">
            未选择商品
          </div>
        ) : (modifierConfigs.get(currentModifierItem.posItemId) || []).length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            该商品没有自定义选项选项
          </div>
        ) : (
          <KitTable
            columns={modifierColumns}
            data={modifierConfigs.get(currentModifierItem.posItemId) || []}
            rowKey={(row) => row.modifierOptionId}
          />
        )}
      </Modal>

      {/* 菜单同步确认模态框 */}
      <Modal
        title="确认同步所有菜单到 Uber"
        open={menuConfigModalVisible}
        onOpenChange={(v) => { if (!v) setMenuConfigModalVisible(false) }}
        size="md"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setMenuConfigModalVisible(false)}>取消</Btn>
            <Btn variant="primary" loading={posSyncing} onClick={handleConfirmMenuConfig}>确认同步</Btn>
          </>
        }
      >
        <div className="text-center">
          <p className="text-sm mb-4 text-slate-700">
            将同步所有已配置的菜单到 Uber
          </p>

          <div className="bg-slate-50 p-4 rounded mb-4">
            <div className="mb-3">
              <strong className="text-slate-700">待同步菜单数：</strong>
              <span className="text-lg text-blue-600 ml-2">
                {menuGroups.length}
              </span>
            </div>

            {menuGroups.length > 0 && (
              <div className="text-left border-t border-slate-200 pt-3">
                <strong className="block mb-2 text-slate-700">菜单列表：</strong>
                <div className="max-h-52 overflow-y-auto">
                  {menuGroups.map((menu) => (
                    <div
                      key={menu.id}
                      className="p-2 mb-1 bg-white rounded text-xs text-slate-700"
                    >
                      📋 {menu.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
            <div className="text-xs text-slate-500">
              📌 将同时同步配送菜单和自取菜单到 Uber Eats
            </div>
            <div className="text-xs text-slate-400 mt-1">
              如需禁用自取功能，请在 Uber Eats 后台进行设置
            </div>
          </div>

          <p className="text-xs text-slate-400 m-0">
            同步过程中请勿关闭页面，这可能需要几秒钟
          </p>
        </div>
      </Modal>

      {/* 清理菜单确认 */}
      <ConfirmDialog
        open={clearMenuConfirmOpen}
        onOpenChange={setClearMenuConfirmOpen}
        title="清理菜单"
        danger
        loading={clearingMenu}
        confirmText="确认清理"
        cancelText="取消"
        description={
          <div>
            <div>确定要清理菜单中的所有商品、分类和自定义选项吗？</div>
            <div className="text-xs mt-3 text-slate-500 leading-relaxed">
              <div className="mb-2">注意：</div>
              <div>• 菜单内容将被完全删除</div>
              <div>• 由于 Uber API 限制，菜单本身无法通过 API 删除</div>
              <div>• 如需完全移除菜单，请联系 Uber</div>
            </div>
          </div>
        }
        onConfirm={handleClearMenu}
      />

      {/* 删除菜单组确认 */}
      <ConfirmDialog
        open={!!deleteMenuGroupTarget}
        onOpenChange={(v) => { if (!v) setDeleteMenuGroupTarget(null) }}
        title="删除菜单配置"
        danger
        confirmText="确定删除"
        cancelText="取消"
        description={
          <div>
            <div>确定要删除「{deleteMenuGroupTarget?.name}」菜单配置吗？</div>
            <div className="mt-2 text-xs text-slate-500">
              注意：此操作只删除数据库中的菜单配置，不会自动同步到Uber。
              <br />
              如需同步删除，请在删除后手动点击"同步到Uber"按钮。
            </div>
          </div>
        }
        onConfirm={() => {
          if (deleteMenuGroupTarget) handleDeleteMenuGroup(deleteMenuGroupTarget.id)
          setDeleteMenuGroupTarget(null)
        }}
      />

      {/* 从菜单删除分类确认 */}
      <ConfirmDialog
        open={!!removeCategoryTarget}
        onOpenChange={(v) => { if (!v) setRemoveCategoryTarget(null) }}
        title="删除分类"
        danger
        confirmText="删除"
        cancelText="取消"
        description={
          removeCategoryTarget?.isSystem
            ? `确定要从菜单中移除「${removeCategoryTarget?.name}」吗？系统分类将保留，可以再次添加。`
            : `确定要彻底删除「${removeCategoryTarget?.name}」吗？删除后无法恢复。`
        }
        onConfirm={() => {
          if (removeCategoryTarget) {
            handleRemoveCategoryFromMenu(removeCategoryTarget.id, removeCategoryTarget.name, removeCategoryTarget.isSystem)
          }
          setRemoveCategoryTarget(null)
        }}
      />

      {/* 删除全局分类配置确认 */}
      <ConfirmDialog
        open={!!removeConfiguredCategoryTarget}
        onOpenChange={(v) => { if (!v) setRemoveConfiguredCategoryTarget(null) }}
        title="确定删除？"
        danger
        confirmText="删除"
        cancelText="取消"
        description={
          removeConfiguredCategoryTarget?.isSystem
            ? '删除此分类配置后，已配置的商品映射将被清除。系统分类本身不会被删除。'
            : '删除后无法恢复。'
        }
        onConfirm={() => {
          if (removeConfiguredCategoryTarget) {
            handleRemoveCategory(removeConfiguredCategoryTarget.id, removeConfiguredCategoryTarget.name)
          }
          setRemoveConfiguredCategoryTarget(null)
        }}
      />
    </div>
  )
}

export default MenuSync
