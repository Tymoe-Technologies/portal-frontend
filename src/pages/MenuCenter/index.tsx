import React, { useEffect, useMemo, useRef, useState } from 'react'
import './index.css' // 添加样式文件
import { useTranslation } from 'react-i18next'
import { useAuthContext } from '../../auth/AuthProvider'
import { canEditModule } from '../../auth/permissions'
import { debugOrganizationIsolation } from '../../utils/debug-org'
import { getJWTInfo, checkJWTOrganizationInfo } from '../../utils/jwt-utils'
import { formatPrice, fromMinorUnit, toMinorUnit } from '../../utils/priceConverter'
import { getCurrencySymbol } from '../../config/currencyConfig'
import ModifierGroupManager from './ModifierGroupManager'
import ItemChannelConfig from './components/ItemChannelConfig'
import { storeMenuService, type StoreMenuConfig, type StoreModifierAvailability } from '../../services/store-menu'
import { getOrganization } from '../../services/auth'
import { SnoozeModal } from '@/components/SnoozeModal'
import { AvailabilityToggle } from '@/components/AvailabilityToggle'
import type { BusinessHours } from '@/utils/businessHours'
import {
  itemManagementService,
  type Item as APIItem,
  type Category as APICategory,
  type CreateItemPayload,
  type UpdateItemPayload,
  type CreateCategoryPayload,
  type UpdateCategoryPayload,
  type ItemAttributeType,
  type ItemAttributeOption,
  type ItemAttribute,
  type CreateItemAttributeTypePayload,
  type CreateItemAttributeOptionPayload,
  // 已废弃的 Addon 类型 - 迁移到 Modifier v2.0
  type Addon,
  type ItemAddon,
  // 新的 Modifier v2.0 类型
  type ModifierGroup,
  type ModifierOption,
  type CreateModifierGroupPayload,
  type CreateModifierOptionPayload,
  type AddModifierGroupToItemPayload,
  type Combo,
  type CreateComboPayload,
  type CreateComboItemPayload,
  type ComboItemGroup,
  type ComboAvailabilityRules,
  type ItemModifierGroup
} from '../../services/item-management'
import { ComboItemGroupsConfig } from './components/ComboItemGroupsConfig'
import { ComboAvailabilityConfig } from './components/ComboAvailabilityConfig'
import { ComboImageUpload } from './components/ComboImageUpload'
import ItemModifierConfigInputComponent, { type ItemModifierConfig as ItemModifierConfigType } from './components/ItemModifierConfigInput'
import SupplyTab from '../SupplyManagement'
import BrandLocaleSettings from '../BrandLocaleSettings'
import { getBrandLocale, LOCALE_LABELS } from '@/services/brand-locale'
// ─── 去 antd 迁移中：kit 命名空间导入（避免与 antd 同名冲突），逐段替换 ───
import * as UI from '@/components/ui-kit'
import {
  Pencil, Trash2, Plus, RotateCcw, MoreVertical, ArrowUp, ArrowDown,
  Image as ImageIcon, GitBranch, ChevronRight as ChevronRightIcon,
} from 'lucide-react'

// 为了兼容现有的UI，保留本地的接口定义
type ID = string

interface Category extends APICategory {
  // 继承API Category类型
}

// 商品属性值接口（用于前端表单）
interface ItemAttributeValue {
  attributeTypeId: string
  value: any
}

// 商品属性关联配置（用于前端表单）
interface ItemAttributeConfig {
  attributeTypeId: string
  isRequired: boolean
  optionOverrides?: Record<string, { priceModifier: number }>
  allowedOptions?: string[] // 允许的选项ID列表，用于选项过滤
  defaultOptionId?: string // 商品级默认选项
  optionOrder?: string[] // 选项显示顺序
}

interface Item extends APIItem {
  // 继承API Item类型
  attributes?: ItemAttribute[]
  attributeValues?: ItemAttributeValue[] // 用于存储属性值
  attributeConfigs?: ItemAttributeConfig[] // 用于存储属性配置
}

// 层级分类接口
interface HierarchicalCategory extends Category {
  children?: HierarchicalCategory[]
  level?: number
}

// ItemModifierConfig 类型和组件从独立文件导入
type ItemModifierConfig = ItemModifierConfigType

// 兼容旧调用（传了 t 参数），直接复用外部组件并忽略 t
const ItemModifierConfigInput: React.FC<{
  value?: ItemModifierConfig[];
  onChange?: (value: ItemModifierConfig[]) => void;
  modifierGroups: ModifierGroup[];
  t?: any;
}> = ({ value, onChange, modifierGroups }) => (
  <ItemModifierConfigInputComponent value={value} onChange={onChange} modifierGroups={modifierGroups} />
);

// Combo子商品配置组件
const ComboItemsInput: React.FC<{
  value?: CreateComboItemPayload[];
  onChange?: (value: CreateComboItemPayload[]) => void;
  allItems: Item[];
  onPriceChange?: (totalPrice: number) => void;
  t: any;
}> = ({ value = [], onChange, allItems, onPriceChange, t }) => {
  const [selectedItems, setSelectedItems] = useState<CreateComboItemPayload[]>(value);
  const lastPriceRef = useRef<number>(0);
  const onPriceChangeRef = useRef(onPriceChange);
  onPriceChangeRef.current = onPriceChange;

  useEffect(() => {
    // 仅当 value 内容真正变化时才更新
    const newJson = JSON.stringify(value || []);
    const oldJson = JSON.stringify(selectedItems);
    if (newJson !== oldJson) {
      setSelectedItems(value || []);
    }
  }, [value]);

  // 计算总价
  const calculateTotalPrice = (items: CreateComboItemPayload[]) => {
    let total = 0;
    items.forEach(comboItem => {
      const item = allItems.find(i => i.id === comboItem.itemId);
      if (item) {
        // 商品原价 + 额外费用，都是分，乘以数量
        const pricePerUnit = (Math.round(Number(item.basePrice)) || 0) + (Math.round(comboItem.additionalPrice || 0));
        total += pricePerUnit * (comboItem.quantity || 1);
      }
    });
    return total;
  };

  // 当商品列表变化时,通知父组件价格变化
  useEffect(() => {
    const totalPrice = calculateTotalPrice(selectedItems);
    if (totalPrice !== lastPriceRef.current) {
      lastPriceRef.current = totalPrice;
      onPriceChangeRef.current?.(totalPrice);
    }
  }, [selectedItems, allItems]);

  const handleAddItem = (itemId: string) => {
    const existingItem = selectedItems.find(item => item.itemId === itemId);
    if (existingItem) {
      UI.toast.warning(t('pages.menuCenter.itemAlreadyAdded'));
      return;
    }

    const newItem: CreateComboItemPayload = {
      itemId,
      quantity: 1,
      isRequired: true,
      sortOrder: selectedItems.length,
      additionalPrice: 0
    };

    const newSelectedItems = [...selectedItems, newItem];
    setSelectedItems(newSelectedItems);
    onChange?.(newSelectedItems);
  };

  const handleRemoveItem = (itemId: string) => {
    const newSelectedItems = selectedItems.filter(item => item.itemId !== itemId);
    // 重新排序
    const reorderedItems = newSelectedItems.map((item, index) => ({
      ...item,
      sortOrder: index
    }));
    setSelectedItems(reorderedItems);
    onChange?.(reorderedItems);
  };

  const handleUpdateItem = (itemId: string, updates: Partial<CreateComboItemPayload>) => {
    const newSelectedItems = selectedItems.map(item =>
      item.itemId === itemId ? { ...item, ...updates } : item
    );
    setSelectedItems(newSelectedItems);
    onChange?.(newSelectedItems);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newSelectedItems = [...selectedItems];
    [newSelectedItems[index], newSelectedItems[index - 1]] = [newSelectedItems[index - 1], newSelectedItems[index]];
    // 更新sortOrder
    const reorderedItems = newSelectedItems.map((item, idx) => ({
      ...item,
      sortOrder: idx
    }));
    setSelectedItems(reorderedItems);
    onChange?.(reorderedItems);
  };

  const handleMoveDown = (index: number) => {
    if (index === selectedItems.length - 1) return;
    const newSelectedItems = [...selectedItems];
    [newSelectedItems[index], newSelectedItems[index + 1]] = [newSelectedItems[index + 1], newSelectedItems[index]];
    // 更新sortOrder
    const reorderedItems = newSelectedItems.map((item, idx) => ({
      ...item,
      sortOrder: idx
    }));
    setSelectedItems(reorderedItems);
    onChange?.(reorderedItems);
  };

  const availableItems = allItems.filter(item => 
    !selectedItems.some(selected => selected.itemId === item.id)
  );

  return (
    <div>
      <p className="text-sm font-semibold text-slate-800 mb-2">{t('pages.menuCenter.selectComboItems')}</p>

      {/* 添加商品选择器 */}
      <div className="mb-4">
        <UI.SelectInput
          value=""
          onChange={(v) => { if (v) handleAddItem(String(v)) }}
          placeholder={t('pages.menuCenter.selectItemToAdd')}
          className="w-full"
          options={availableItems.map(item => ({ label: `${item.name} - ${formatPrice(item.basePrice)}`, value: item.id }))}
        />
      </div>

      {/* 已选商品列表 */}
      {selectedItems.length === 0 ? (
        <div className="text-center py-5 rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
          {t('pages.menuCenter.noItemsInCombo')}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {selectedItems.map((comboItem, index) => {
            const item = allItems.find(i => i.id === comboItem.itemId);
            if (!item) return null;

            return (
              <div key={comboItem.itemId} className="rounded-lg border border-slate-200 p-3">
                <div className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-3">
                    <div className="font-medium text-slate-800">{item.name}</div>
                    <div className="text-xs text-slate-400">{formatPrice(item.basePrice)}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-slate-400 mb-1">{t('pages.menuCenter.quantity')}</div>
                    <input type="number" min={1} max={10} value={comboItem.quantity}
                      onChange={(e) => handleUpdateItem(comboItem.itemId, { quantity: Number(e.target.value) || 1 })}
                      className="w-full text-sm border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:outline-2 focus:outline-slate-900" />
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-slate-400 mb-1">{t('pages.menuCenter.extraFeeLabel')}</div>
                    <input type="number" min={0} step={0.01}
                      value={comboItem.additionalPrice ? fromMinorUnit(comboItem.additionalPrice) : 0}
                      onChange={(e) => handleUpdateItem(comboItem.itemId, { additionalPrice: toMinorUnit(Number(e.target.value) || 0) })}
                      className="w-full text-sm border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:outline-2 focus:outline-slate-900" />
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-slate-400 mb-1">{t('pages.menuCenter.required')}</div>
                    <UI.Switch checked={comboItem.isRequired} onCheckedChange={(c) => handleUpdateItem(comboItem.itemId, { isRequired: c })} />
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-slate-400 mb-1">{t('pages.menuCenter.sortOrder')}</div>
                    <div className="flex items-center gap-1">
                      <button disabled={index === 0} onClick={() => handleMoveUp(index)} className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 cursor-pointer"><ArrowUp className="w-4 h-4" /></button>
                      <button disabled={index === selectedItems.length - 1} onClick={() => handleMoveDown(index)} className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 cursor-pointer"><ArrowDown className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <UI.Tooltip label={t('pages.menuCenter.remove')}><button onClick={() => handleRemoveItem(comboItem.itemId)} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button></UI.Tooltip>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// 获取商品可用的属性选项
const getAvailableOptions = (attribute: ItemAttribute): ItemAttributeOption[] => {
  const allOptions = attribute.attributeType?.options || [];
  
  // 如果没有设置 allowedOptions，返回所有选项
  if (!attribute.allowedOptions || attribute.allowedOptions.length === 0) {
    return allOptions;
  }
  
  // 只返回允许的选项
  return allOptions.filter(option => 
    attribute.allowedOptions!.includes(option.id)
  );
};

// 构建分类树的工具函数
const buildCategoryTree = (categories: Category[]): HierarchicalCategory[] => {
  const categoryMap = new Map<string, HierarchicalCategory>()
  const roots: HierarchicalCategory[] = []
  
  // 首先创建所有分类的映射
  categories.forEach(category => {
    categoryMap.set(category.id, { ...category, children: [], level: 0 })
  })
  
  // 构建树形结构
  categories.forEach(category => {
    const categoryNode = categoryMap.get(category.id)!
    
    if (category.parentId) {
      // 有父分类，添加到父分类的children中
      const parent = categoryMap.get(category.parentId)
      if (parent) {
        categoryNode.level = (parent.level || 0) + 1
        parent.children = parent.children || []
        parent.children.push(categoryNode)
      } else {
        // 父分类不存在，当作根分类处理
        roots.push(categoryNode)
      }
    } else {
      // 根分类
      roots.push(categoryNode)
    }
  })
  
  return roots
}

// 扁平化分类树，用于渲染
const flattenCategoryTree = (tree: HierarchicalCategory[]): HierarchicalCategory[] => {
  const result: HierarchicalCategory[] = []
  
  const traverse = (nodes: HierarchicalCategory[]) => {
    nodes.forEach(node => {
      result.push(node)
      if (node.children && node.children.length > 0) {
        traverse(node.children)
      }
    })
  }
  
  traverse(tree)
  return result
}


const MenuCenter: React.FC = () => {
  const { t } = useTranslation()
  const { isAuthenticated, organizations, role, permissions } = useAuthContext()
  const canEdit = canEditModule('menuCatalog', role, permissions)
  const canEditAvailability = canEditModule('menuAvailability', role, permissions)
  const canEditPricing = canEditModule('menuPricingCosts', role, permissions)
  // 当前系统货币符号（config/currencyConfig.ts 目前是硬编码 $ 的占位实现，
  // 后端接入按商户货币配置后这里会自动跟着变，不需要改这个文件）
  const currencySymbol = getCurrencySymbol()

  // 从 localStorage 找当前选中的 org，判断 orgType
  const currentOrgId = localStorage.getItem('organization_id')
  const currentOrg = organizations.find(o => o.id === currentOrgId)
  const isMain = !currentOrg || currentOrg.orgType === 'MAIN'

  // 品牌多语言配置：除默认语言外的所有额外语言
  const [additionalLocales, setAdditionalLocales] = useState<string[]>([])
  const [defaultLocale, setDefaultLocale] = useState<string>('zh-CN')

  // 非主店：品牌商品的门店配置（可用性 / 价格覆盖）
  const [storeConfigs, setStoreConfigs] = useState<Map<string, StoreMenuConfig>>(new Map())
  // 非主店：modifier 选项的门店可用性覆盖（临时下架/86'd）
  const [modifierAvailability, setModifierAvailability] = useState<Map<string, StoreModifierAvailability>>(new Map())
  // 当前门店营业时间 + 时区（供“临时下架至今日营业结束”预设使用）；
  // organizations 列表在 ACCOUNT 登录下可能缺失这两个字段，缺失时回退单独请求
  const [storeBusinessHours, setStoreBusinessHours] = useState<BusinessHours | null>(null)
  const [storeTimezone, setStoreTimezone] = useState<string | null>(null)
  // 临时下架弹窗（商品或 modifier 选项通用）
  const [snoozeTarget, setSnoozeTarget] = useState<{ type: 'item' | 'modifierOption'; id: string; name: string } | null>(null)

  // 自定义加载图标

  // 状态管理
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [allItems, setAllItems] = useState<Item[]>([]) // 所有商品,用于Combo选择
  const [selectedCategoryId, setSelectedCategoryId] = useState<ID | null>(null)
  // 记录最近一次发起的商品请求对应的分类——快速切换分类时，旧请求可能比新请求晚返回，
  // 用它在 setItems 前校验请求是否已过期，避免把上一个分类的商品渲染成当前分类的
  const loadItemsRequestIdRef = useRef<ID | null>(null)
  const [attributeTypes, setAttributeTypes] = useState<ItemAttributeType[]>([])
  const [attributeOptions, setAttributeOptions] = useState<Record<string, ItemAttributeOption[]>>({})
  // Modifier v2.0: 使用 ModifierGroup 替代 Addon
  // 为了兼容现有 UI，我们将 ModifierGroup 强制转换为 Addon 类型
  const [addons, setAddons] = useState<Addon[]>([])
  const [itemAddons, setItemAddons] = useState<Record<string, ItemAddon[]>>({})
  // 自定义选项组（统一的 ModifierGroup 管理）
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([])
  const [modifierGroupOptions, setModifierGroupOptions] = useState<Record<string, ModifierOption[]>>({})
  const [combos, setCombos] = useState<Combo[]>([])
  const [categoryCombos, setCategoryCombos] = useState<Combo[]>([]) // 当前分类下的套餐
  const [loading, setLoading] = useState({
    categories: false,
    items: false,
    creating: false,
    updating: false,
    attributes: false,
    modifiers: false,
    combos: false
  })

  // 模态框状态
  const [categoryModalVisible, setCategoryModalVisible] = useState(false)
  const [itemModalVisible, setItemModalVisible] = useState(false)
  const [channelModal, setChannelModal] = useState<{ id: string; name: string } | null>(null)
  const [attributeTypeModalVisible, setAttributeTypeModalVisible] = useState(false)
  const [attributeOptionModalVisible, setAttributeOptionModalVisible] = useState(false)
  const [modifierGroupModalVisible, setModifierGroupModalVisible] = useState(false)
  const [modifierOptionModalVisible, setModifierOptionModalVisible] = useState(false)
  const [comboModalVisible, setComboModalVisible] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [editingAttributeType, setEditingAttributeType] = useState<ItemAttributeType | null>(null)
  const [editingAttributeOption, setEditingAttributeOption] = useState<ItemAttributeOption | null>(null)
  const [editingModifierGroup, setEditingModifierGroup] = useState<ModifierGroup | null>(null)
  const [editingModifierOption, setEditingModifierOption] = useState<ModifierOption | null>(null)
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null)
  // 显示骨架去 antd：删除确认目标
  const [comboDeleteTarget, setComboDeleteTarget] = useState<Combo | null>(null)
  const [itemDeleteTarget, setItemDeleteTarget] = useState<Item | null>(null)
  const [categoryDeleteTarget, setCategoryDeleteTarget] = useState<Category | null>(null)
  // 门店改价（替代原 Modal.confirm + getElementById DOM hack）
  const [priceOverrideTarget, setPriceOverrideTarget] = useState<Item | null>(null)
  const [priceOverrideValue, setPriceOverrideValue] = useState<number>(NaN)
  // 门店改价弹窗内的选项加价（分店/加盟店可改本店选项加价，产品规则）
  const [priceOverrideModifierGroups, setPriceOverrideModifierGroups] = useState<ItemModifierGroup[]>([])
  const [priceOverrideModifierValues, setPriceOverrideModifierValues] = useState<Record<string, string>>({})
  const [priceOverrideModifierLoading, setPriceOverrideModifierLoading] = useState(false)
  const [priceOverrideSaving, setPriceOverrideSaving] = useState(false)
  // 套餐增强功能状态
  const [comboImageUrl, setComboImageUrl] = useState<string | undefined>()
  // 新建套餐时选择的待上传图片文件（保存套餐成功后自动上传）
  const [comboImageFile, setComboImageFile] = useState<File | null>(null)
  const [comboItemGroups, setComboItemGroups] = useState<ComboItemGroup[]>([])
  const [comboAvailabilityRules, setComboAvailabilityRules] = useState<ComboAvailabilityRules | undefined>()
  // 套餐类型：fixed=固定套餐，selection=可选套餐（分组模式）
  const [comboType, setComboType] = useState<'fixed' | 'selection'>('fixed')
  const [selectedAttributeTypeId, setSelectedAttributeTypeId] = useState<string | null>(null)
  const [selectedModifierGroupId, setSelectedModifierGroupId] = useState<string | null>(null)
  const [modifierGroupTypeFilter] = useState<string>('all')

  // 图片上传状态
  const [imageUploading, setImageUploading] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | undefined>(undefined)

  // 表单
  // 分类表单（受控，去 antd Form）
  const [catName, setCatName] = useState('')
  const [catNameI18n, setCatNameI18n] = useState<Record<string, string>>({})
  const [catParentId, setCatParentId] = useState<string | undefined>(undefined)
  const [catErr, setCatErr] = useState('')
  // 顶层/嵌套 Tabs（去 antd Tabs）
  const [topTab, setTopTab] = useState<'products' | 'combos' | 'supplies' | 'locale-settings'>('products')
  const [productsTab, setProductsTab] = useState<'items' | 'modifiers'>('items')
  // 商品表单（受控，去 antd Form；提交时组装 values 传给 handleItemSubmit）
  const [itemModalTab, setItemModalTab] = useState<'basic' | 'modifiers'>('basic')
  const [itName, setItName] = useState('')
  const [itNameI18n, setItNameI18n] = useState<Record<string, string>>({})
  const [itDescription, setItDescription] = useState('')
  const [itDescriptionI18n, setItDescriptionI18n] = useState<Record<string, string>>({})
  const [itCategoryId, setItCategoryId] = useState<string | undefined>(undefined)
  const [itBasePrice, setItBasePrice] = useState<number>(NaN)
  const [itCost, setItCost] = useState<number>(NaN)
  const [itIsActive, setItIsActive] = useState(true)
  const [itScope, setItScope] = useState<string>('BRAND')
  const [itVisibleStoreIds, setItVisibleStoreIds] = useState<string[]>([])
  const [itCustomFields, setItCustomFields] = useState<any>(undefined)
  const [itModifiers, setItModifiers] = useState<ItemModifierConfig[]>([])
  // 属性类型表单（受控，含动态选项列表）
  const [atName, setAtName] = useState('')
  const [atDisplayName, setAtDisplayName] = useState('')
  const [atOptions, setAtOptions] = useState<Array<{ id: string; value: string; displayName: string; priceModifier: number }>>([])
  const [atErr, setAtErr] = useState<{ name?: string; displayName?: string }>({})
  // 属性选项表单（受控）
  const [aoValue, setAoValue] = useState('')
  const [aoDisplayName, setAoDisplayName] = useState('')
  const [aoPriceModifier, setAoPriceModifier] = useState<number>(0)
  const [aoErr, setAoErr] = useState<{ value?: string; displayName?: string }>({})
  // 套餐表单（受控，基础字段；图片/分组/时段/类型另有独立 state）
  const [cbName, setCbName] = useState('')
  const [cbDescription, setCbDescription] = useState('')
  const [cbCategoryId, setCbCategoryId] = useState<string | undefined>(undefined)
  const [cbBasePrice, setCbBasePrice] = useState<number>(0)
  const [cbDiscount, setCbDiscount] = useState<number>(0)
  const [cbDiscountType, setCbDiscountType] = useState<'fixed' | 'percentage'>('fixed')
  const [cbIsActive, setCbIsActive] = useState(true)
  const [cbComboItems, setCbComboItems] = useState<CreateComboItemPayload[]>([])
  const [cbErr, setCbErr] = useState<{ name?: string; categoryId?: string; basePrice?: string }>({})

  // 初始化数据
  
  useEffect(() => {
    console.log('🔍 [MENU CENTER] Component mounted, isAuthenticated:', isAuthenticated)
    
    if (isAuthenticated) {
      try {
        // 调试组织隔离
        debugOrganizationIsolation()
        
        // 检查JWT中的组织信息
        getJWTInfo()
        const hasOrgInfo = checkJWTOrganizationInfo()
        
        if (!hasOrgInfo) {
          console.warn('⚠️ [MENU CENTER] JWT中缺少组织信息，可能导致数据隔离失效！')
          console.warn('💡 [MENU CENTER] 建议重新登录以获取正确的JWT')
        }
        
        loadCategories()
        loadAttributeTypes()
        loadAddons()
        loadModifierGroups()
        loadCombos()
        loadAllItems()
        // 临时下架是门店级覆盖（store_menu_items/store_modifier_availability），主店对自己的 store_id
        // 同样适用——不只是分店/加盟店才需要，所以这三个一律加载，不再按 isMain 区分
        loadStoreConfigs(); loadModifierAvailability(); loadStoreBusinessHours()
        // 加载品牌语言配置以显示译名输入框
        getBrandLocale().then(cfg => {
          setDefaultLocale(cfg.default_locale)
          // 额外语言 = 全部可用语言排除默认语言，每种都显示译名输入框
          setAdditionalLocales(cfg.available_locales.filter(l => l !== cfg.default_locale))
        }).catch(() => { /* 静默失败 */ })
      } catch (error) {
        console.error('❌ [MENU CENTER] Error in useEffect:', error)
      }
    }
  }, [isAuthenticated, modifierGroupTypeFilter])

  // 当选择分类时加载该分类下的商品
  useEffect(() => {
    if (selectedCategoryId && isAuthenticated) {
      loadItems()
    }
  }, [selectedCategoryId, isAuthenticated])

  // 监听组织切换事件
  useEffect(() => {
    const handleOrganizationChange = (event: CustomEvent) => {
      console.log('🔄 [MENU CENTER] Organization changed, reloading data...', event.detail)
      // selectedCategoryId 是上一个组织的分类 ID，对新组织无意义——必须先清空，
      // 否则下面 loadCategories() 里"没有选中分类才默认选第一个"的逻辑不会触发，
      // 会一直拿着这个跨组织的旧 categoryId 去取商品，显示成上一个组织的数据
      loadItemsRequestIdRef.current = null
      setSelectedCategoryId(null)
      setItems([])
      setCategoryCombos([])
      // 重新加载所有数据
      loadCategories()
      loadAttributeTypes()
      loadAddons()
      loadModifierGroups()
      loadCombos()
      loadAllItems()
    }

    window.addEventListener('organizationChanged', handleOrganizationChange as EventListener)

    return () => {
      window.removeEventListener('organizationChanged', handleOrganizationChange as EventListener)
    }
  }, [])

  // 加载分类列表
  // 加载非主店的门店配置（用于显示品牌商品的本店可用状态）
  const loadStoreConfigs = async () => {
    try {
      const configs = await storeMenuService.getStoreMenuConfigs()
      setStoreConfigs(new Map(configs.map(c => [c.catalogItemId, c])))
    } catch {
      // 配置加载失败不影响主功能
    }
  }

  const loadModifierAvailability = async () => {
    try {
      const list = await storeMenuService.getStoreModifierAvailability()
      setModifierAvailability(new Map(list.map(a => [a.modifierOptionId, a])))
    } catch {
      // 配置加载失败不影响主功能
    }
  }

  // 加载当前门店营业时间/时区（供“临时下架至今日营业结束”预设计算下一个营业开始时刻）；
  // ACCOUNT 登录下 organizations 列表可能没带 businessHours/timezone，缺失时单独请求一次权威数据
  const loadStoreBusinessHours = async () => {
    if (!currentOrg) return
    if (currentOrg.businessHours || currentOrg.timezone) {
      setStoreBusinessHours((currentOrg.businessHours as BusinessHours) ?? null)
      setStoreTimezone(currentOrg.timezone ?? null)
      return
    }
    try {
      const org = await getOrganization(currentOrg.id)
      setStoreBusinessHours((org.businessHours as BusinessHours) ?? null)
      setStoreTimezone(org.timezone ?? null)
    } catch {
      // 拿不到营业时间时，弹窗里“今日营业结束”预设会自动禁用，不影响其他预设
    }
  }

  const loadCategories = async () => {
    setLoading(prev => ({ ...prev, categories: true }))
    try {
      const categoryList = await itemManagementService.getCategories()
      const categories = Array.isArray(categoryList) ? categoryList : []
      setCategories(categories)
      
      // 如果有分类且没有选中的分类，默认选中第一个
      if (categories.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(categories[0].id)
      }
      
      // 静默加载分类，不显示成功消息
    } catch (error) {
      console.error('Failed to load categories:', error)
      UI.toast.error(t('pages.menuCenter.loadCategoriesFailed'))
      setCategories([]) // 确保出错时也设置为空数组
    } finally {
      setLoading(prev => ({ ...prev, categories: false }))
    }
  }

  // 加载属性类型列表
  const loadAttributeTypes = async () => {
    setLoading(prev => ({ ...prev, attributes: true }))
    try {
      const types = await itemManagementService.getAttributeTypes()
      setAttributeTypes(types)
      // 静默加载属性类型，不显示成功消息
    } catch (error) {
      console.error('Failed to load attribute types:', error)
      UI.toast.error(t('pages.menuCenter.loadAttributeTypesFailed'))
      setAttributeTypes([])
    } finally {
      setLoading(prev => ({ ...prev, attributes: false }))
    }
  }

  // 加载属性选项
  const loadAttributeOptions = async (typeId: string) => {
    try {
      const options = await itemManagementService.getAttributeOptions(typeId)
      setAttributeOptions(prev => ({
        ...prev,
        [typeId]: options
      }))
    } catch (error) {
      console.error('Failed to load attribute options:', error)
      UI.toast.error(t('pages.menuCenter.loadAttributeOptionsFailed'))
    }
  }

  // 加载加料列表
  // Modifier v2.0: 使用 getModifierGroups 代替 getAddons
  const loadAddons = async () => {
    try {
      const modifierGroups = await itemManagementService.getModifierGroups({ isActive: true })
      // 将 ModifierGroup 适配为 Addon 类型供 UI 使用
      const adaptedAddons = modifierGroups.map(group => ({
        id: group.id,
        name: group.displayName,
        description: group.name,
        price: 0, // Modifier 中价格在 ItemModifierPrice 中定义
        cost: 0,
        trackInventory: false,
        currentStock: 0,
        isActive: group.isActive
      })) as Addon[]
      setAddons(adaptedAddons)
    } catch (error) {
      console.error('Failed to load addons:', error)
      UI.toast.error(t('pages.menuCenter.loadAddonsFailed'))
      setAddons([])
    }
  }

  // 加载商品加料关联
  // Modifier v2.0: 使用 getItemModifiers 代替 getItemAddons
  const loadItemAddons = async (itemId: string) => {
    try {
      const itemModifiers = await itemManagementService.getItemModifiers(itemId)
      // 将 ItemModifierGroup 适配为 ItemAddon 类型供 UI 使用
      const adaptedItemAddons = itemModifiers
        .map(im => ({
          id: im.id,
          itemId: im.itemId,
          addonId: im.modifierGroupId,
          maxQuantity: im.maxSelections || 1,
          addon: {
            id: im.modifierGroupId,
            name: im.group?.displayName || '',
            description: im.group?.name || '',
            price: 0,
            cost: 0,
            trackInventory: false,
            currentStock: 0,
            isActive: im.group?.isActive || false
          }
        })) as ItemAddon[]
      setItemAddons(prev => ({
        ...prev,
        [itemId]: adaptedItemAddons
      }))
    } catch (error) {
      console.error('Failed to load item addons:', error)
      UI.toast.error(t('pages.menuCenter.loadItemAddonsFailed'))
    }
  }

  // 加载自定义选项组（ModifierGroups）
  const loadModifierGroups = async () => {
    setLoading(prev => ({ ...prev, modifiers: true }))
    try {
      const groups = await itemManagementService.getModifierGroups({ isActive: true })
      setModifierGroups(groups)
      console.log('✅ Loaded modifier groups:', groups)
    } catch (error) {
      console.error('Failed to load modifier groups:', error)
      UI.toast.error(t('pages.menuCenter.loadModifierGroupsFailed'))
      setModifierGroups([])
    } finally {
      setLoading(prev => ({ ...prev, modifiers: false }))
    }
  }

  // 加载自定义选项（ModifierOptions）
  const loadModifierGroupOptions = async (groupId: string) => {
    try {
      // 从 ModifierGroup 中直接获取 options（如果后端支持详细查询）
      // 这里暂时假设 getModifierGroups 返回完整的 options 信息
      const groups = await itemManagementService.getModifierGroups()
      const group = groups.find(g => g.id === groupId)
      if (group && group.options) {
        setModifierGroupOptions(prev => ({ ...prev, [groupId]: group.options || [] }))
      }
    } catch (error) {
      console.error('Failed to load modifier options:', error)
      UI.toast.error(t('pages.menuCenter.loadModifierOptionsFailed'))
    }
  }

  // 加载所有商品(用于Combo选择)
  const loadAllItems = async () => {
    try {
      const response = await itemManagementService.getItems({ limit: 1000 })
      setAllItems(response.data || [])
    } catch (error) {
      console.error('Failed to load all items:', error)
      setAllItems([])
    }
  }

  // 加载Combo列表
  const loadCombos = async () => {
    setLoading(prev => ({ ...prev, combos: true }))
    try {
      const response = await itemManagementService.getCombos({ limit: 100 })
      setCombos(response.data || [])
    } catch (error) {
      console.error('Failed to load combos:', error)
      UI.toast.error(t('pages.menuCenter.loadCombosFailed'))
      setCombos([])
    } finally {
      setLoading(prev => ({ ...prev, combos: false }))
    }
  }

  // 创建Combo
  const handleCreateCombo = () => {
    setEditingCombo(null)
    setCbName(''); setCbDescription(''); setCbCategoryId(undefined); setCbBasePrice(0)
    setCbDiscount(0); setCbDiscountType('fixed'); setCbIsActive(true); setCbComboItems([]); setCbErr({})
    setComboImageUrl(undefined)
    setComboImageFile(null)
    setComboItemGroups([])
    setComboAvailabilityRules(undefined)
    setComboType('fixed')
    setComboModalVisible(true)
  }

  // 编辑Combo
  const handleEditCombo = (combo: Combo) => {
    setEditingCombo(combo)

    // 根据 itemGroups 判断套餐类型
    const type: 'fixed' | 'selection' = (combo.itemGroups && combo.itemGroups.length > 0) ? 'selection' : 'fixed'
    setComboType(type)

    // 转换comboItems为表单需要的格式
    const comboItems: CreateComboItemPayload[] = (combo.comboItems || []).map(item => ({
      itemId: item.itemId,
      quantity: item.quantity,
      isRequired: item.isRequired,
      sortOrder: item.sortOrder,
      attributeSelections: item.attributeSelections,
      addonSelections: item.addonSelections,
      groupId: item.groupId,
      additionalPrice: item.additionalPrice || 0
    }))

    // 将价格从分转换为元
    let discountValue: number | undefined = undefined
    if (combo.discount !== undefined && combo.discount !== null) {
      if (combo.discountType === 'percentage') {
        discountValue = Number(combo.discount)
      } else {
        discountValue = fromMinorUnit(combo.discount)
      }
    }

    setCbName(combo.name)
    setCbDescription(combo.description || '')
    setCbCategoryId(combo.categoryId)
    setCbBasePrice(fromMinorUnit(combo.basePrice))
    setCbDiscount(discountValue ?? 0)
    setCbDiscountType((combo.discountType as 'fixed' | 'percentage') || 'fixed')
    setCbIsActive(combo.isActive)
    setCbComboItems(comboItems)
    setCbErr({})

    // 加载增强功能字段
    setComboImageUrl(combo.imageUrl)
    setComboImageFile(null)  // 编辑模式不需要待上传文件

    // 兼容 snake_case 响应（防御性处理）
    const normalizedGroups = (combo.itemGroups || []).map(group => {
      if ('selection_type' in group) {
        return {
          id: group.id,
          name: group.name,
          selectionType: (group as any).selection_type,
          minSelections: (group as any).min_selections,
          maxSelections: (group as any).max_selections,
          sortOrder: (group as any).sort_order
        } as ComboItemGroup
      }
      return group
    })
    setComboItemGroups(normalizedGroups)

    setComboAvailabilityRules(combo.availabilityRules || { enabled: false })

    setComboModalVisible(true)
  }

  // 保存Combo
  const handleSaveCombo = async () => {
    const err: { name?: string; categoryId?: string; basePrice?: string } = {}
    if (!cbName.trim()) err.name = t('pages.menuCenter.comboNameRequired')
    if (!cbCategoryId) err.categoryId = t('pages.menuCenter.pleaseSelectCategory')
    if (comboType === 'selection' && (cbBasePrice == null || Number.isNaN(cbBasePrice))) err.basePrice = t('pages.menuCenter.pleaseEnterComboPrice')
    setCbErr(err)
    if (Object.keys(err).length) return

    setLoading(prev => ({ ...prev, creating: true }))
    try {
      // 可选套餐：验证分组配置
      if (comboType === 'selection') {
        if (comboItemGroups.length === 0) {
          UI.toast.error(t('pages.menuCenter.selectionComboNeedsGroup'));
          setLoading(prev => ({ ...prev, creating: false }));
          return;
        }
        const hasEmptyGroupName = comboItemGroups.some(g => !g.name || g.name.trim() === '');
        if (hasEmptyGroupName) {
          UI.toast.error(t('pages.menuCenter.allGroupsNeedName'));
          setLoading(prev => ({ ...prev, creating: false }));
          return;
        }
        comboItemGroups.forEach(group => {
          const groupItems = cbComboItems.filter(ci => ci.groupId === group.id);
          if (groupItems.length === 0) {
            throw new Error(t('pages.menuCenter.groupNoItemsError', { name: group.name }));
          }
        });
      }

      // 直接使用 camelCase，后端负责所有 snake_case 转换
      const payload: any = {
        name: cbName,
        description: cbDescription,
        categoryId: cbCategoryId,
        basePrice: cbBasePrice,
        discount: cbDiscount,
        discountType: cbDiscountType,
        isActive: cbIsActive,
        comboItems: cbComboItems || [],
        imageUrl: comboImageUrl,
        // 可选套餐才发送 itemGroups
        itemGroups: comboType === 'selection' ? comboItemGroups : undefined,
        availabilityRules: comboAvailabilityRules?.enabled ? comboAvailabilityRules : undefined
      }

      if (editingCombo) {
        await itemManagementService.updateCombo(editingCombo.id, payload)
        UI.toast.success(t('pages.menuCenter.updateComboSuccess'))
      } else {
        const newCombo = await itemManagementService.createCombo(payload)
        // 如果用户在创建时选了图片，保存成功后立即上传（uploadComboImage 会自动更新 combo.imageUrl）
        if (comboImageFile && newCombo?.id) {
          try {
            await itemManagementService.uploadComboImage(newCombo.id, comboImageFile)
          } catch (imgError) {
            console.error('Image upload after create failed:', imgError)
            UI.toast.warning(t('pages.menuCenter.comboSavedImageUploadFailed'))
          }
        }
        setComboImageFile(null)
        UI.toast.success(t('pages.menuCenter.createComboSuccess'))
      }
      setComboModalVisible(false)
      loadCombos()
    } catch (error) {
      console.error('Failed to save combo:', error)
      UI.toast.error(editingCombo ? t('pages.menuCenter.updateComboFailed') : t('pages.menuCenter.createComboFailed'))
    } finally {
      setLoading(prev => ({ ...prev, creating: false }))
    }
  }

  // 删除Combo
  const handleDeleteCombo = async (id: string) => {
    try {
      await itemManagementService.deleteCombo(id)
      UI.toast.success(t('pages.menuCenter.deleteComboSuccess'))
      loadCombos()
    } catch (error) {
      console.error('Failed to delete combo:', error)
      UI.toast.error(t('pages.menuCenter.deleteComboFailed'))
    }
  }

  // 加载商品列表
  const loadItems = async () => {
    if (!selectedCategoryId) {
      return
    }

    if (!isAuthenticated) {
      return
    }

    const requestedCategoryId = selectedCategoryId
    loadItemsRequestIdRef.current = requestedCategoryId

    setLoading(prev => ({ ...prev, items: true }))
    try {
      // 同时加载商品和套餐
      const [itemsResponse, combosResponse] = await Promise.all([
        itemManagementService.getItems({
          categoryId: requestedCategoryId,
          limit: 100,
          includeInactive: true // 管理端商品列表：显示全部（含未激活），靠状态徽章区分
        }),
        itemManagementService.getCombos({
          categoryId: requestedCategoryId,
          limit: 100
        })
      ])

      // 快速切换分类时，慢的旧请求可能晚于新请求返回——这时它的结果已经过期，
      // 不能再写入 items/categoryCombos，否则会把上一个分类的商品显示成当前分类的
      if (loadItemsRequestIdRef.current !== requestedCategoryId) {
        return
      }

      const items = itemsResponse.data || []
      const categoryCombos = combosResponse.data || []

      setItems(items)
      setCategoryCombos(categoryCombos)

      // 收集所有商品中使用的属性类型ID
      const usedAttributeTypeIds = new Set<string>()
      items.forEach(item => {
        const itemWithAttrs = item as Item // 使用本地扩展的Item类型
        if (itemWithAttrs.attributes && Array.isArray(itemWithAttrs.attributes)) {
          itemWithAttrs.attributes.forEach((attr: ItemAttribute) => {
            if (attr.attributeTypeId) {
              usedAttributeTypeIds.add(attr.attributeTypeId)
            }
          })
        }
      })

      // 为所有使用的属性类型加载选项数据（如果还没有加载）
      for (const typeId of usedAttributeTypeIds) {
        if (!attributeOptions[typeId]) {
          try {
            await loadAttributeOptions(typeId)
          } catch (error) {
            console.warn(`Failed to load options for attribute type ${typeId}:`, error)
          }
        }
      }

      // 静默加载商品，不显示加载消息
    } catch (error) {
      if (loadItemsRequestIdRef.current !== requestedCategoryId) {
        return // 已过期的请求，报错也不该影响当前分类的展示
      }
      console.error('Failed to load items:', error)
      UI.toast.error(t('pages.menuCenter.loadItemsFailed'))
      setItems([]) // 确保出错时也设置为空数组
    } finally {
      if (loadItemsRequestIdRef.current === requestedCategoryId) {
        setLoading(prev => ({ ...prev, items: false }))
      }
    }
  }

  // 创建分类
  const handleCreateCategory = () => {
    setEditingCategory(null)
    setCatName(''); setCatNameI18n({}); setCatParentId(undefined); setCatErr('')
    setCategoryModalVisible(true)
  }

  // 编辑分类
  const handleEditCategory = (category: Category) => {
    setEditingCategory(category)
    setCatName(category.name)
    setCatNameI18n((category as any).name_i18n ?? {})
    setCatParentId(category.parentId)
    setCatErr('')
    setCategoryModalVisible(true)
  }
  // 删除分类
  const handleDeleteCategory = async (categoryId: string) => {
    try {
      await itemManagementService.deleteCategory(categoryId)
      UI.toast.success(t('pages.menuCenter.deleteCategorySuccess'))
      
      // 如果删除的是当前选中的分类，清空选择
      if (selectedCategoryId === categoryId) {
        setSelectedCategoryId(null)
      }
      
      loadCategories()
    } catch (error) {
      console.error('Failed to delete category:', error)
      UI.toast.error(t('pages.menuCenter.deleteCategoryFailed'))
    }
  }

  // 提交分类表单
  const handleCategorySubmit = async () => {
    if (!catName.trim()) { setCatErr(t('pages.menuCenter.categoryNameRequired')); return }
    setLoading(prev => ({ ...prev, creating: true }))
    try {
      const i18nRaw = Object.fromEntries(Object.entries(catNameI18n).filter(([, v]) => v))
      const name_i18n = Object.keys(i18nRaw).length ? i18nRaw : undefined

      if (editingCategory) {
        const updatePayload: UpdateCategoryPayload = {
          name: catName,
          parentId: catParentId || undefined,
          ...(name_i18n && { name_i18n }) as any,
        }
        await itemManagementService.updateCategory(editingCategory.id, updatePayload)
        UI.toast.success(t('pages.menuCenter.categoryUpdateSuccess'))
      } else {
        const createPayload: CreateCategoryPayload = {
          name: catName,
          parentId: catParentId || undefined,
          ...(name_i18n && { name_i18n }) as any,
        }
        const newCategory = await itemManagementService.createCategory(createPayload)
        UI.toast.success(t('pages.menuCenter.categoryCreateSuccess'))
        setSelectedCategoryId(newCategory.id)
      }

      setCategoryModalVisible(false)
      loadCategories()
    } catch (error) {
      console.error('Failed to save category:', error)
      UI.toast.error(editingCategory ? t('pages.menuCenter.categoryUpdateFailed') : t('pages.menuCenter.categoryCreateFailed'))
    } finally {
      setLoading(prev => ({ ...prev, creating: false }))
    }
  }

  // 创建商品
  const handleCreateItem = async () => {
    if (!selectedCategoryId) {
      UI.toast.warning(t('pages.menuCenter.pleaseSelectCategoryFirst'))
      return
    }
    
    // 加载所有select类型属性的选项
    for (const attributeType of attributeTypes) {
      if (attributeType.inputType === 'select' && !attributeOptions[attributeType.id]) {
        await loadAttributeOptions(attributeType.id)
      }
    }
    
    setEditingItem(null)
    setItName(''); setItNameI18n({}); setItDescription(''); setItDescriptionI18n({})
    setItCategoryId(selectedCategoryId || undefined); setItBasePrice(NaN); setItCost(NaN)
    setItIsActive(true); setItScope('BRAND'); setItVisibleStoreIds([]); setItCustomFields(undefined); setItModifiers([])
    setItemModalTab('basic')
    setPreviewImageUrl(undefined)
    setItemModalVisible(true)
  }

  // 门店改价弹窗：打开时并行加载该商品的选项组（品牌默认价）+ 本店已保存的选项加价覆盖
  /**
   * 商品的门店级可用性控制：合并了原本分开的"上下架开关"和"临时下架"——
   * 一个按钮显示当前状态（在售/临时下架中/已下架），点击统一打开 SnoozeModal，
   * 由用户在弹窗里选择 1小时/3小时/今日营业结束/永久下架，或直接恢复。
   */
  const renderAvailabilityControl = (item: Item) => {
    if (!canEditAvailability) return null
    const cfg = storeConfigs.get(item.id)
    return (
      <AvailabilityToggle
        isAvailable={cfg?.isAvailable ?? true}
        unavailableUntil={cfg?.unavailableUntil}
        catalogIsActive={item.isActive}
        onClick={() => setSnoozeTarget({ type: 'item', id: item.id, name: item.name })}
      />
    )
  }

  const openPriceOverride = async (item: Item) => {
    setPriceOverrideTarget(item)
    setPriceOverrideValue(storeConfigs.get(item.id)?.priceOverride ?? NaN)
    setPriceOverrideModifierGroups([])
    setPriceOverrideModifierValues({})
    setPriceOverrideModifierLoading(true)
    try {
      const [groups, overrides] = await Promise.all([
        itemManagementService.getItemModifiers(item.id),
        storeMenuService.getStoreModifierPrices(item.id),
      ])
      setPriceOverrideModifierGroups(groups)
      const prefill: Record<string, string> = {}
      for (const [optionId, price] of Object.entries(overrides)) {
        prefill[optionId] = String(price)
      }
      setPriceOverrideModifierValues(prefill)
    } catch {
      // 选项加价加载失败不阻断本店价格的修改
    } finally {
      setPriceOverrideModifierLoading(false)
    }
  }

  // 编辑商品
  const handleEditItem = async (item: Item) => {
    setEditingItem(item)
    
    // 加载所有select类型属性的选项
    for (const attributeType of attributeTypes) {
      if (attributeType.inputType === 'select' && !attributeOptions[attributeType.id]) {
        await loadAttributeOptions(attributeType.id)
      }
    }
    
    // 加载商品的自定义选项配置（Modifier v2.0）
    let itemModifiersData: ItemModifierConfig[] = []
    try {
      // 获取商品的自定义选项组关联
      const itemModifierGroups = await itemManagementService.getItemModifiers(item.id)
      
      // 转换为表单需要的格式
      itemModifiersData = itemModifierGroups.map(itemModGroup => {
        const group = itemModGroup.group
        const options = group?.options || []
        
        // 提取启用的选项、默认选项和价格覆盖
        const enabledOptions: string[] = []
        let defaultOptionId: string | undefined = undefined
        const optionPrices: Record<string, number> = {}
        
        options.forEach(option => {
          // 检查选项的 itemOptions 配置
          if (option.itemOptions && option.itemOptions.length > 0) {
            const itemOption = option.itemOptions[0]

            // 如果选项已启用，添加到 enabledOptions
            if (itemOption.isEnabled) {
              enabledOptions.push(option.id)
            }

            // 如果是默认选项，记录
            if (itemOption.isDefault) {
              defaultOptionId = option.id
            }
          }
          // 🔑 修改：如果没有 itemOptions 配置，不默认启用
          // 这样新增的选项不会自动关联到已有商品
          
          // 检查是否有商品级价格覆盖
          // 服务层 getItemModifiers() 已经将价格从分转换为元
          if (option.itemPrice !== null && option.itemPrice !== undefined) {
            optionPrices[option.id] = typeof option.itemPrice === 'string'
              ? parseFloat(option.itemPrice)
              : option.itemPrice
          }
        })
        
        return {
          groupId: itemModGroup.modifierGroupId,
          isRequired: itemModGroup.isRequired,
          minSelections: itemModGroup.minSelections,
          maxSelections: itemModGroup.maxSelections,
          sortOrder: itemModGroup.sortOrder,
          enabledOptions,
          defaultOptionId,
          optionPrices
        }
      })
    } catch (error) {
      console.error('Failed to load item modifiers:', error)
      // 不阻塞编辑流程，只是记录错误
    }
    
    // 将价格从分转换为元（后端存储的是分，表单显示的是元）
    setItName(item.name)
    setItNameI18n((item as any).name_i18n ?? {})
    setItDescription(item.description || '')
    setItDescriptionI18n((item as any).description_i18n ?? {})
    setItCategoryId(item.categoryId)
    setItBasePrice(fromMinorUnit(item.basePrice))
    setItCost(item.cost !== undefined && item.cost !== null ? fromMinorUnit(item.cost) : NaN)
    setItIsActive(item.isActive)
    setItCustomFields(item.customFields)
    setItModifiers(itemModifiersData)
    setItScope(item.scope || 'BRAND')
    setItVisibleStoreIds(item.visible_stores?.map(vs => vs.store_id) || [])
    setItemModalTab('basic')
    setPreviewImageUrl(item.imageUrl)
    setItemModalVisible(true)
  }

  // 上传图片
  const handleImageUpload = async (file: File) => {
    if (!editingItem) {
      UI.toast.warning(t('pages.menuCenter.pleaseSaveItemFirst'))
      return false
    }

    setImageUploading(true)
    try {
      const result = await itemManagementService.uploadItemImage(editingItem.id, file)
      setPreviewImageUrl(result.image.url)
      setEditingItem({ ...editingItem, imageUrl: result.image.url })
      UI.toast.success(t('pages.menuCenter.itemImageUploadSuccess'))
      loadItems() // 刷新列表
      loadAllItems() // 刷新全部商品
    } catch (error: any) {
      console.error('Image upload failed:', error)
      UI.toast.error(error?.response?.data?.error || t('pages.menuCenter.itemImageUploadFailed'))
    } finally {
      setImageUploading(false)
    }
    return false
  }

  // 删除图片（kit ImageUpload 的删除按钮已是显式操作，直接删除）
  const handleImageDelete = async () => {
    if (!editingItem) return
    try {
      await itemManagementService.deleteItemImage(editingItem.id)
      setPreviewImageUrl(undefined)
      setEditingItem({ ...editingItem, imageUrl: undefined })
      UI.toast.success(t('pages.menuCenter.itemImageDeleteSuccess'))
      loadItems()
      loadAllItems()
    } catch (error: any) {
      console.error('Image delete failed:', error)
      UI.toast.error(error?.response?.data?.error || t('pages.menuCenter.itemImageDeleteFailed'))
    }
  }

  // 删除商品
  const handleDeleteItem = async (itemId: string) => {
    try {
      await itemManagementService.deleteItem(itemId)
      UI.toast.success(t('pages.menuCenter.deleteItemSuccess'))
      loadItems()
    } catch (error) {
      console.error('Failed to delete item:', error)
      UI.toast.error(t('pages.menuCenter.deleteItemFailed'))
    }
  }

  // 提交商品表单
  // UUID验证函数
  const isValidUUID = (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }

  const handleItemSubmit = async (values: any) => {
    setLoading(prev => ({ ...prev, creating: true }))
    
    try {
      // 验证必要字段
      if (!values.name?.trim()) {
        UI.toast.error(t('pages.menuCenter.itemNameEmpty'))
        return
      }

      if (typeof values.basePrice !== 'number' || isNaN(values.basePrice)) {
        UI.toast.error(t('pages.menuCenter.pleaseEnterValidPrice'))
        return
      }

      // 确定使用的分类ID
      const categoryId = values.categoryId || selectedCategoryId
      if (!categoryId) {
        UI.toast.error(t('pages.menuCenter.pleaseSelectItemCategory'))
        return
      }

      // 验证分类ID是有效的UUID
      if (!isValidUUID(categoryId)) {
        UI.toast.error(t('pages.menuCenter.invalidCategoryIdFormat'))
        return
      }

      // 验证分类是否存在
      const categoryExists = categories.some(cat => cat.id === categoryId)
      if (!categoryExists) {
        UI.toast.error(t('pages.menuCenter.categoryNotExist'))
        return
      }

      // 验证成本价格（可选，但如果填写了必须是有效数字）
      if (values.cost !== undefined && values.cost !== null && values.cost !== '') {
        const costNumber = Number(values.cost)
        if (isNaN(costNumber) || costNumber < 0) {
          UI.toast.error(t('pages.menuCenter.costPriceInvalid'))
          return
        }
      }

      // 注：属性管理已迁移到自定义选项系统 (Modifier v2.0)
      // 属性现在通过以下 API 单独管理:
      //   - POST /items/{itemId}/modifier-groups (关联自定义选项组)
      //   - POST /items/{itemId}/modifier-options (配置选项行为)

//       // 转换attributeConfigs为API期望的attributes格式
//       const attributes = values.attributeConfigs?.map((config: ItemAttributeConfig) => ({
//         attributeTypeId: config.attributeTypeId,
//         isRequired: config.isRequired,
//         optionOverrides: config.optionOverrides || {},
//         allowedOptions: config.allowedOptions && config.allowedOptions.length > 0 ? config.allowedOptions : undefined,
//         defaultOptionId: config.defaultOptionId,
//         optionOrder: config.optionOrder && config.optionOrder.length > 0 ? config.optionOrder : undefined
//       })) || []

      if (editingItem) {
        // 更新商品
        const updatePayload: UpdateItemPayload = {
          name: values.name.trim(),
          description: values.description?.trim(),
          categoryId: categoryId,
          basePrice: Number(values.basePrice),
          cost: (values.cost !== undefined && values.cost !== null && values.cost !== '') ? Number(values.cost) : undefined,
          isActive: Boolean(values.isActive),
          customFields: values.customFields,
          ...(values.name_i18n && Object.keys(values.name_i18n).length > 0 && { name_i18n: values.name_i18n }),
          ...(values.description_i18n && Object.keys(values.description_i18n).length > 0 && { description_i18n: values.description_i18n }),
        }

        // 如果是主店，附带 scope 和 visibleStoreIds 一起更新
        if (isMain) {
          const newScope: string = values.scope || 'BRAND'
          ;(updatePayload as any).scope = newScope
          ;(updatePayload as any).visibleStoreIds = newScope === 'STORE_EXCLUSIVE' ? (values.visibleStoreIds || []) : []
        }

        await itemManagementService.updateItem(editingItem.id, updatePayload)

        // 处理自定义选项配置（Modifier v2.0）
        if (values.itemModifiers && Array.isArray(values.itemModifiers)) {
          // 1. 先清除现有的自定义选项组关联
          const existingModifiers = await itemManagementService.getItemModifiers(editingItem.id)
          for (const existingModifier of existingModifiers) {
            await itemManagementService.removeModifierGroupFromItem(editingItem.id, existingModifier.modifierGroupId)
          }
          
          // 2. 添加新的自定义选项组关联并配置选项
          for (const modifierConfig of values.itemModifiers as ItemModifierConfig[]) {
            // 2.1 关联自定义选项组（定义选择规则）
            const groupPayload: AddModifierGroupToItemPayload = {
              modifierGroupId: modifierConfig.groupId,
              isRequired: modifierConfig.isRequired,
              minSelections: modifierConfig.minSelections,
              maxSelections: modifierConfig.maxSelections,
              sortOrder: modifierConfig.sortOrder
            }
            await itemManagementService.addModifierGroupToItem(editingItem.id, groupPayload)
            
            // 2.2 配置选项行为（isDefault, isEnabled, displayOrder）
            const group = modifierGroups.find(g => g.id === modifierConfig.groupId)
            if (group && group.options) {
              const optionConfigs = group.options.map((option, index) => ({
                modifierOptionId: option.id,
                isDefault: modifierConfig.defaultOptionId === option.id,
                isEnabled: modifierConfig.enabledOptions.includes(option.id),
                displayOrder: index
              }))
              
              if (optionConfigs.length > 0) {
                await itemManagementService.configureItemModifierOptions(editingItem.id, {
                  options: optionConfigs
                })
              }
            }
            
            // 2.3 设置商品级自定义选项价格（如果有覆盖）
            if (Object.keys(modifierConfig.optionPrices).length > 0) {
              const priceOverrides = Object.entries(modifierConfig.optionPrices).map(([optionId, price]) => ({
                modifierOptionId: optionId,
                price: price
              }))
              await itemManagementService.setItemModifierPrices(editingItem.id, {
                prices: priceOverrides
              })
            }
          }
        }
        
        UI.toast.success(t('pages.menuCenter.itemUpdateSuccess'))
      } else {
        // 主店创建商品（BRAND 或 STORE_EXCLUSIVE）
        const scope = values.scope || 'BRAND'
        const visibleStoreIds: string[] = scope === 'STORE_EXCLUSIVE' ? (values.visibleStoreIds || []) : []
        const createPayload: CreateItemPayload = {
          name: values.name.trim(),
          description: values.description?.trim(),
          categoryId: categoryId,
          basePrice: Number(values.basePrice),
          cost: (values.cost !== undefined && values.cost !== null && values.cost !== '') ? Number(values.cost) : undefined,
          isActive: values.isActive !== false,
          customFields: values.customFields,
          scope,
          visibleStoreIds: scope === 'STORE_EXCLUSIVE' ? visibleStoreIds : undefined,
          ...(values.name_i18n && Object.keys(values.name_i18n).length > 0 && { name_i18n: values.name_i18n }),
          ...(values.description_i18n && Object.keys(values.description_i18n).length > 0 && { description_i18n: values.description_i18n }),
        } as any

        const createdItem = await itemManagementService.createItem(createPayload)
        
        // 处理自定义选项配置（Modifier v2.0）
        if (values.itemModifiers && Array.isArray(values.itemModifiers) && createdItem.id) {
          for (const modifierConfig of values.itemModifiers as ItemModifierConfig[]) {
            // 1. 关联自定义选项组（定义选择规则）
            const groupPayload: AddModifierGroupToItemPayload = {
              modifierGroupId: modifierConfig.groupId,
              isRequired: modifierConfig.isRequired,
              minSelections: modifierConfig.minSelections,
              maxSelections: modifierConfig.maxSelections,
              sortOrder: modifierConfig.sortOrder
            }
            await itemManagementService.addModifierGroupToItem(createdItem.id, groupPayload)
            
            // 2. 配置选项行为（isDefault, isEnabled, displayOrder）
            const group = modifierGroups.find(g => g.id === modifierConfig.groupId)
            if (group && group.options) {
              const optionConfigs = group.options.map((option, index) => ({
                modifierOptionId: option.id,
                isDefault: modifierConfig.defaultOptionId === option.id,
                isEnabled: modifierConfig.enabledOptions.includes(option.id),
                displayOrder: index
              }))
              
              if (optionConfigs.length > 0) {
                await itemManagementService.configureItemModifierOptions(createdItem.id, {
                  options: optionConfigs
                })
              }
            }
            
            // 3. 设置商品级自定义选项价格（如果有覆盖）
            if (Object.keys(modifierConfig.optionPrices).length > 0) {
              const priceOverrides = Object.entries(modifierConfig.optionPrices).map(([optionId, price]) => ({
                modifierOptionId: optionId,
                price: price
              }))
              await itemManagementService.setItemModifierPrices(createdItem.id, {
                prices: priceOverrides
              })
            }
          }
        }
        
        UI.toast.success(t('pages.menuCenter.itemCreateSuccess'))
      }
      
      setItemModalVisible(false)
      loadItems()
    } catch (error) {
      console.error('Failed to save item:', error)
      UI.toast.error(editingItem ? t('pages.menuCenter.itemUpdateFailed') : t('pages.menuCenter.itemCreateFailed'))
    } finally {
      setLoading(prev => ({ ...prev, creating: false }))
    }
  }

  // ==================== 属性管理处理函数 ====================

  // 创建属性类型
  const handleCreateAttributeType = () => {
    setEditingAttributeType(null)
    setAtName(''); setAtDisplayName(''); setAtOptions([]); setAtErr({})
    setAttributeTypeModalVisible(true)
  }

  // 编辑属性类型
  const handleEditAttributeType = async (attributeType: ItemAttributeType) => {
    setEditingAttributeType(attributeType)
    // 加载属性选项
    await loadAttributeOptions(attributeType.id)
    const options = attributeOptions[attributeType.id] || []
    setAtName(attributeType.name)
    setAtDisplayName(attributeType.displayName)
    setAtOptions(options.map(o => ({ id: o.id, value: o.value, displayName: o.displayName, priceModifier: o.priceModifier || 0 })))
    setAtErr({})
    setAttributeTypeModalVisible(true)
  }

  // 删除属性类型
  const handleDeleteAttributeType = async (id: string) => {
    try {
      await itemManagementService.deleteAttributeType(id)
      UI.toast.success(t('pages.menuCenter.deleteAttributeTypeSuccess'))
      loadAttributeTypes()
    } catch (error) {
      console.error('Failed to delete attribute type:', error)
      UI.toast.error(t('pages.menuCenter.deleteAttributeTypeFailed'))
    }
  }

  // 提交属性类型表单
  const handleAttributeTypeSubmit = async () => {
    const err: { name?: string; displayName?: string } = {}
    if (!atName.trim()) err.name = t('pages.menuCenter.attributeTypeNameRequired')
    if (!atDisplayName.trim()) err.displayName = t('pages.menuCenter.displayNameRequired')
    setAtErr(err)
    if (Object.keys(err).length) return

    setLoading(prev => ({ ...prev, creating: true }))
    try {
      // 验证至少有一个选项
      if (!atOptions || atOptions.length === 0) {
        UI.toast.error(t('pages.menuCenter.atLeastOneOption'))
        return
      }

      // 验证选项值唯一性
      const optionValues = atOptions.map(opt => opt.value)
      const uniqueValues = new Set(optionValues)
      if (optionValues.length !== uniqueValues.size) {
        UI.toast.error(t('pages.menuCenter.optionValueDuplicate'))
        return
      }

      // 创建属性类型
      const attributeTypePayload = {
        name: atName,
        displayName: atDisplayName,
        inputType: 'select',
      }

      let attributeTypeId: string

      if (editingAttributeType) {
        await itemManagementService.updateAttributeType(editingAttributeType.id, attributeTypePayload)
        attributeTypeId = editingAttributeType.id
        UI.toast.success(t('pages.menuCenter.attrTypeUpdateSuccess'))
      } else {
        const createdType = await itemManagementService.createAttributeType(attributeTypePayload)
        attributeTypeId = createdType.id
        UI.toast.success(t('pages.menuCenter.attrTypeCreateSuccess'))
      }

      // 创建或更新选项
      for (const option of atOptions) {
        const optionPayload = {
          value: option.value,
          displayName: option.displayName,
          priceModifier: option.priceModifier || 0
        }
        
        if (option.id && !option.id.startsWith('temp_')) {
          // 更新已存在的选项
          await itemManagementService.updateAttributeOption(option.id, optionPayload)
        } else {
          // 创建新选项
          await itemManagementService.createAttributeOption(attributeTypeId, optionPayload)
        }
      }
      
      setAttributeTypeModalVisible(false)
      loadAttributeTypes()
      // 重新加载选项数据
      await loadAttributeOptions(attributeTypeId)
    } catch (error) {
      console.error('Failed to save attribute type:', error)
      UI.toast.error(editingAttributeType ? t('pages.menuCenter.updateAttributeTypeFailed') : t('pages.menuCenter.createAttributeTypeFailed'))
    } finally {
      setLoading(prev => ({ ...prev, creating: false }))
    }
  }

  // 创建属性选项
  const handleCreateAttributeOption = (typeId: string) => {
    setSelectedAttributeTypeId(typeId)
    setEditingAttributeOption(null)
    setAoValue(''); setAoDisplayName(''); setAoPriceModifier(0); setAoErr({})
    setAttributeOptionModalVisible(true)
  }

  // 编辑属性选项
  const handleEditAttributeOption = (option: ItemAttributeOption, typeId: string) => {
    setSelectedAttributeTypeId(typeId)
    setEditingAttributeOption(option)
    setAoValue(option.value)
    setAoDisplayName(option.displayName)
    setAoPriceModifier(option.priceModifier || 0)
    setAoErr({})
    setAttributeOptionModalVisible(true)
  }

  // 删除属性选项
  const handleDeleteAttributeOption = async (optionId: string, typeId: string) => {
    try {
      await itemManagementService.deleteAttributeOption(optionId)
      UI.toast.success(t('pages.menuCenter.deleteAttributeOptionSuccess'))
      loadAttributeOptions(typeId)
    } catch (error) {
      console.error('Failed to delete attribute option:', error)
      UI.toast.error(t('pages.menuCenter.deleteAttributeOptionFailed'))
    }
  }

  // 提交属性选项表单
  const handleAttributeOptionSubmit = async () => {
    if (!selectedAttributeTypeId) {
      UI.toast.error(t('pages.menuCenter.selectAttributeTypeFirst'))
      return
    }
    const err: { value?: string; displayName?: string } = {}
    if (!aoValue.trim()) err.value = t('pages.menuCenter.optionValueRequired')
    if (!aoDisplayName.trim()) err.displayName = t('pages.menuCenter.displayNameRequired')
    setAoErr(err)
    if (Object.keys(err).length) return

    setLoading(prev => ({ ...prev, creating: true }))
    try {
      const values = { value: aoValue.trim(), displayName: aoDisplayName, priceModifier: Number.isNaN(aoPriceModifier) ? 0 : aoPriceModifier } as CreateItemAttributeOptionPayload
      if (editingAttributeOption) {
        await itemManagementService.updateAttributeOption(editingAttributeOption.id, values)
        UI.toast.success(t('pages.menuCenter.updateAttributeOptionSuccess'))
      } else {
        await itemManagementService.createAttributeOption(selectedAttributeTypeId, values)
        UI.toast.success(t('pages.menuCenter.createAttributeOptionSuccess'))
      }
      setAttributeOptionModalVisible(false)
      loadAttributeOptions(selectedAttributeTypeId)
    } catch (error) {
      console.error('Failed to save attribute option:', error)
      UI.toast.error(editingAttributeOption ? t('pages.menuCenter.updateAttributeOptionFailed') : t('pages.menuCenter.createAttributeOptionFailed'))
    } finally {
      setLoading(prev => ({ ...prev, creating: false }))
    }
  }

  // ==================== 加料管理 ====================

  // 删除加料
  // Modifier v2.0: 使用删除 ModifierGroup
  const handleDeleteAddon = async (id: string) => {
    try {
      // Modifier v2.0: 使用 deleteModifierGroup（软删除，设置 is_active=false）
      await itemManagementService.deleteModifierGroup(id)
      UI.toast.success(t('pages.menuCenter.deleteModifierSuccess'))
      loadAddons()
    } catch (error) {
      console.error('Failed to delete addon:', error)
      UI.toast.error(t('pages.menuCenter.deleteModifierFailed'))
    }
  }

  // 加料保存逻辑已随废弃弹窗移除（Modifier v2.0 用 ModifierGroupManager）

  // 添加商品加料关联
  // Modifier v2.0: 使用 addModifierGroupToItem
  const handleAddItemAddon = async (itemId: string, payload: { addonId: string; maxQuantity: number }) => {
    try {
      // 适配 ItemAddon 到 ItemModifierGroup
      const addonId = payload.addonId // 这在新架构中是 modifierGroupId
      const modifierPayload: AddModifierGroupToItemPayload = {
        modifierGroupId: addonId,
        isRequired: false,
        minSelections: 0,
        maxSelections: payload.maxQuantity || 1
      }
      await itemManagementService.addModifierGroupToItem(itemId, modifierPayload)
      UI.toast.success(t('pages.menuCenter.addAddonSuccess'))
      loadItemAddons(itemId)
    } catch (error) {
      console.error('Failed to add item addon:', error)
      UI.toast.error(t('pages.menuCenter.addAddonFailed'))
    }
  }

  // 移除商品加料关联
  // Modifier v2.0: 使用 removeModifierGroupFromItem
  const handleRemoveItemAddon = async (itemId: string, addonId: string) => {
    try {
      // addonId 实际上是 modifierGroupId
      await itemManagementService.removeModifierGroupFromItem(itemId, addonId)
      UI.toast.success(t('pages.menuCenter.removeAddonSuccess'))
      loadItemAddons(itemId)
    } catch (error) {
      console.error('Failed to remove item addon:', error)
      UI.toast.error(t('pages.menuCenter.removeAddonFailed'))
    }
  }

  const selectedCategory = useMemo(
    () => categories.find(c => c.id === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  )

  // 构建层级分类树
  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories])

  // 扁平化的分类列表（用于渲染）
  const flatCategories = useMemo(() => flattenCategoryTree(categoryTree), [categoryTree])

  // 分类树递归渲染（去 antd Tree）
  const renderCategoryNodes = (nodes: HierarchicalCategory[], depth = 0): React.ReactNode =>
    nodes.map(category => (
      <div key={category.id}>
        <div
          onClick={() => setSelectedCategoryId(category.id)}
          style={{ paddingLeft: 8 + depth * 16 }}
          className={`group flex items-center justify-between gap-2 rounded-md pr-2 py-1.5 cursor-pointer text-sm transition-colors ${selectedCategoryId === category.id ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${category.level === 0 ? 'bg-slate-900' : 'bg-slate-400'}`} />
            <span className="truncate">{category.name}</span>
            {category.isSystem && <UI.Badge>{t('pages.menuCenter.systemBadge')}</UI.Badge>}
          </span>
          {isMain && canEdit && (
            <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <UI.Tooltip label={t('pages.menuCenter.edit')}><button onClick={() => handleEditCategory(category)} className="p-1 rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600 cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button></UI.Tooltip>
              {!category.isSystem && (
                <UI.Tooltip label={t('pages.menuCenter.delete')}><button onClick={() => setCategoryDeleteTarget(category)} className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button></UI.Tooltip>
              )}
            </span>
          )}
        </div>
        {category.children && category.children.length > 0 && renderCategoryNodes(category.children, depth + 1)}
      </div>
    ))

  const categoryItems = useMemo(
    () => {
      console.log('🔍 [MENU CENTER] Filtering items for category:', selectedCategoryId)
      console.log('📦 [MENU CENTER] All loaded items:', items)
      
      if (!items || !Array.isArray(items)) return []
      
      // 移除严格的分类ID过滤，因为:
      // 1. API已经根据categoryId过滤了返回的数据
      // 2. 某些情况下(如子分类) items中的categoryId可能与selectedCategoryId不完全匹配
      // 3. 调试显示后端返回了数据，但前端过滤导致显示为空
      return items
    },
    [items, selectedCategoryId]
  )

  // 初始化数据加载
  React.useEffect(() => {
    if (isAuthenticated) {
      loadCategories()
      loadAttributeTypes()
      loadModifierGroups() // 加载自定义选项组
    }
  }, [isAuthenticated])

  // 如果未认证，显示提示
  if (!isAuthenticated) {
    return (
      <div className="p-6 text-center text-slate-600">
        {t('pages.menuCenter.loginRequired')}
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <UI.PageHeader
        title={<span className="inline-flex items-center gap-2">{t('pages.menuCenter.title')}{!isMain && <UI.Badge variant="blue">{currentOrg?.orgType === 'FRANCHISE' ? t('pages.menuCenter.franchiseBadge') : t('pages.menuCenter.branchBadge')}</UI.Badge>}</span>}
        description={t('pages.menuCenter.systemDescription')}
      />

      <UI.Tabs
        value={topTab}
        onChange={(k) => setTopTab(k as any)}
        items={[
          { key: 'products', label: t('pages.menuCenter.menuManagement') },
          { key: 'combos', label: t('pages.menuCenter.comboManagement') },
          { key: 'supplies', label: t('pages.menuCenter.suppliesManagement') },
          ...(isMain ? [{ key: 'locale-settings', label: t('pages.menuCenter.localeSettings') }] : []),
        ]}
      />

      <div className="mt-4">
      {topTab === 'products' && (
        <>
          <UI.Tabs
            value={productsTab}
            onChange={(k) => setProductsTab(k as any)}
            items={[
              { key: 'items', label: t('pages.menuCenter.itemList') },
              { key: 'modifiers', label: t('pages.menuCenter.customOptionGroupsTab') },
            ]}
          />
          <div className="mt-4">
          {productsTab === 'items' && (
              <div className="flex flex-col md:flex-row gap-4 items-start">
        <div className="w-full md:w-72 shrink-0">
          <UI.SectionCard
            title={t('pages.menuCenter.categoriesTitle')}
            action={
              <div className="flex items-center gap-1.5">
                {isMain && canEdit && <UI.Btn variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleCreateCategory}>{t('pages.menuCenter.addCategory')}</UI.Btn>}
                <UI.Btn variant="secondary" size="sm" icon={<RotateCcw className="w-3.5 h-3.5" />} loading={loading.categories} onClick={loadCategories} />
              </div>
            }
          >
            {loading.categories ? (
              <UI.Spinner />
            ) : categories.length === 0 ? (
              <UI.EmptyState title={t('pages.menuCenter.emptyCategories')} action={<UI.Btn variant="primary" onClick={handleCreateCategory}>{t('pages.menuCenter.createFirstCategoryCTA')}</UI.Btn>} />
            ) : (
              <div className="space-y-0.5">{renderCategoryNodes(categoryTree)}</div>
            )}
          </UI.SectionCard>
        </div>

        <div className="flex-1 min-w-0 w-full">
          <UI.SectionCard
            title={t('pages.menuCenter.itemsTitle')}
            action={selectedCategory && (
              <div className="flex items-center gap-1.5">
                {isMain && canEdit && <UI.Btn variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleCreateItem}>{t('pages.menuCenter.addItem')}</UI.Btn>}
                <UI.Btn variant="secondary" size="sm" icon={<RotateCcw className="w-3.5 h-3.5" />} loading={loading.items} onClick={loadItems} />
              </div>
            )}
            bodyClassName="p-0"
          >
            <div className="p-4">
            {loading.items ? (
              <UI.Spinner />
            ) : !selectedCategory ? (
              <UI.EmptyState title={t('pages.menuCenter.selectCategoryPlaceholder')} />
            ) : (
              <>
                <p className="text-sm text-slate-500 pb-3 mb-3 border-b border-slate-100">
                  {t('pages.menuCenter.currentCategory', { name: selectedCategory.name })}
                </p>

                {categoryItems.length === 0 ? (
                  <UI.EmptyState title={t('pages.menuCenter.emptyItems')} action={isMain && canEdit ? <UI.Btn variant="primary" onClick={handleCreateItem}>{t('pages.menuCenter.createFirstItemBtn')}</UI.Btn> : undefined} />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {categoryItems.map(item => (
                      <div key={item.id} className="flex items-start justify-between gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          {/* 标题行 */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-800">{item.name}</span>
                            <UI.Badge variant={item.isActive ? 'green' : 'red'}>{item.isActive ? t('pages.menuCenter.active') : t('pages.menuCenter.inactive')}</UI.Badge>
                            {item.scope === 'STORE_EXCLUSIVE' && <UI.Badge variant="gold">{t('pages.menuCenter.storeExclusiveBadge')}</UI.Badge>}
                          </div>
                          {/* 描述 + 价格 */}
                          {item.description && <p className="text-sm text-slate-500 mt-1">{item.description}</p>}
                          <div className="flex items-center gap-2 flex-wrap mt-1 text-sm">
                            <span className="font-medium text-slate-700">{t('pages.menuCenter.salePrice')}: {formatPrice(item.basePrice)}</span>
                            {!isMain && storeConfigs.get(item.id)?.priceOverride != null && (
                              <>
                                <UI.Badge variant="gold">{t('pages.menuCenter.priceChangedBadge')}</UI.Badge>
                                <span className="font-medium text-amber-600">{t('pages.menuCenter.storePriceLabel', { price: Number(storeConfigs.get(item.id)!.priceOverride!).toFixed(2) })}</span>
                              </>
                            )}
                            {item.cost && <span className="text-slate-400">{t('pages.menuCenter.cost')}: {formatPrice(item.cost)}</span>}
                          </div>
                          {/* 属性配置 */}
                          {item.attributes && item.attributes.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap mt-1.5">
                              <span className="text-xs text-slate-400">{t('pages.menuCenter.attributeConfig')}:</span>
                              {item.attributes.map((attr, index) => {
                                const attributeType = attr.attributeType || attributeTypes.find(type => type.id === attr.attributeTypeId)
                                if (!attributeType) return null
                                const allOptions = attributeOptions[attributeType.id] || []
                                const allowedOptions = attr.allowedOptions && attr.allowedOptions.length > 0 ? allOptions.filter(opt => attr.allowedOptions!.includes(opt.id)) : allOptions
                                const optionNames = allowedOptions.map(opt => opt.displayName).join(', ')
                                return (
                                  <UI.Badge key={index} variant="blue">🏷️ {attributeType.displayName}({optionNames}){attr.isRequired && <span className="text-red-500 font-bold"> *</span>}</UI.Badge>
                                )
                              })}
                            </div>
                          )}
                          {/* 加料 */}
                          {itemAddons[item.id] && itemAddons[item.id].length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap mt-1.5">
                              <span className="text-xs text-slate-400">{t('pages.menuCenter.addonConfigLabel')}</span>
                              {itemAddons[item.id].map((itemAddon, index) => {
                                const addon = itemAddon.addon || addons.find(a => a.id === itemAddon.addonId)
                                if (!addon) return null
                                return <UI.Badge key={index} variant="green">{addon.name} x{itemAddon.maxQuantity} {formatPrice(addon.price)}</UI.Badge>
                              })}
                            </div>
                          )}
                          {/* 自定义字段 */}
                          {item.customFields && Object.keys(item.customFields).length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap mt-1.5">
                              <span className="text-xs text-slate-400">{t('pages.menuCenter.customFieldLabel')}</span>
                              {Object.entries(item.customFields).map(([key, value]) => (
                                <UI.Badge key={key} variant="blue">{key}: {String(value)}</UI.Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* 操作 */}
                        <div className="flex items-center gap-1 shrink-0">
                          {isMain ? (
                            <>
                              {canEdit && <UI.Btn variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => handleEditItem(item)}>{t('pages.menuCenter.edit')}</UI.Btn>}
                              {canEdit && <UI.Btn variant="ghost" size="sm" icon={<GitBranch className="w-3.5 h-3.5" />} onClick={() => setChannelModal({ id: item.id, name: item.name })}>{t('pages.menuCenter.saleRange')}</UI.Btn>}
                              {renderAvailabilityControl(item)}
                              {canEdit && <UI.Tooltip label={t('pages.menuCenter.delete')}><button onClick={() => setItemDeleteTarget(item)} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button></UI.Tooltip>}
                            </>
                          ) : (
                            <>
                              {renderAvailabilityControl(item)}
                              {canEditPricing && <UI.Btn variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openPriceOverride(item)}>{t('pages.menuCenter.changePriceBtn')}</UI.Btn>}
                              {canEdit && <UI.Btn variant="ghost" size="sm" icon={<GitBranch className="w-3.5 h-3.5" />} onClick={() => setChannelModal({ id: item.id, name: item.name })}>{t('pages.menuCenter.saleRange')}</UI.Btn>}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 套餐列表 */}
                {categoryCombos.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 my-4">
                      <span className="text-xs font-medium text-slate-400">{t('pages.menuCenter.combosInCategory')}</span>
                      <span className="flex-1 h-px bg-slate-100" />
                    </div>
                    <div className="divide-y divide-slate-100">
                      {categoryCombos.map(combo => {
                        const basePrice = Number(combo.basePrice) || 0
                        const discount = Number(combo.discount) || 0
                        const finalPrice = Math.max(0, combo.discountType === 'percentage' ? basePrice * (1 - discount / 100) : basePrice - discount)
                        return (
                          <div key={combo.id} className="flex items-start justify-between gap-3 py-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <UI.Badge variant="gold">{t('pages.menuCenter.comboTag')}</UI.Badge>
                                {combo.itemGroups && combo.itemGroups.length > 0 ? <UI.Badge variant="gold">{t('pages.menuCenter.selectableComboBadge')}</UI.Badge> : <UI.Badge variant="blue">{t('pages.menuCenter.fixedComboBadge')}</UI.Badge>}
                                <span className="font-medium text-slate-800">{combo.name}</span>
                                {!combo.isActive && <UI.Badge variant="red">{t('pages.menuCenter.deactivated')}</UI.Badge>}
                              </div>
                              {combo.description && <p className="text-sm text-slate-500 mt-1">{combo.description}</p>}
                              {(!combo.itemGroups || combo.itemGroups.length === 0) && combo.comboItems && combo.comboItems.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap mt-1.5">
                                  <span className="text-xs text-slate-400">{t('pages.menuCenter.includedItems')}:</span>
                                  {combo.comboItems.map((comboItem, index) => (
                                    <UI.Badge key={index} variant="blue">{allItems.find(i => i.id === comboItem.itemId)?.name || comboItem.item?.name || t('pages.menuCenter.unknownItem')} ×{comboItem.quantity}</UI.Badge>
                                  ))}
                                </div>
                              )}
                              {combo.itemGroups && combo.itemGroups.length > 0 && (
                                <div className="mt-1.5 space-y-1">
                                  <span className="text-xs text-slate-400">{t('pages.menuCenter.comboGroupsLabel')}</span>
                                  {combo.itemGroups.map((group, index) => {
                                    const groupItems = (combo.comboItems || []).filter(item => item.groupId === group.id)
                                    const selectionText = group.selectionType === 'single' ? t('pages.menuCenter.singleSelect') : t('pages.menuCenter.multiSelectFormat', { count: groupItems.length, max: group.maxSelections || 1 })
                                    return (
                                      <div key={index} className="flex items-center gap-1 flex-wrap">
                                        <UI.Badge variant="blue">{group.name} ({selectionText})</UI.Badge>
                                        {groupItems.map((item, idx) => (
                                          <UI.Badge key={idx}>{allItems.find(i => i.id === item.itemId)?.name || t('pages.menuCenter.unknownItem')}{item.additionalPrice ? ` +${(item.additionalPrice / 100).toFixed(2)}` : ''}</UI.Badge>
                                        ))}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-sm">
                                <span>
                                  <span className="text-xs text-slate-400">{t('pages.menuCenter.originalPrice')}: </span>
                                  <span className={discount > 0 ? 'line-through text-slate-400' : 'text-slate-700'}>{formatPrice(basePrice)}</span>
                                </span>
                                {discount > 0 && (
                                  <>
                                    <span>
                                      <span className="text-xs text-slate-400">{t('pages.menuCenter.discount')}: </span>
                                      <span className="text-red-600">{combo.discountType === 'percentage' ? `-${discount}%` : `-${formatPrice(discount)}`}</span>
                                    </span>
                                    <span>
                                      <span className="text-xs text-slate-400">{t('pages.menuCenter.finalPrice')}: </span>
                                      <span className="font-semibold text-emerald-600">{formatPrice(finalPrice)}</span>
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            {canEdit && (
                              <div className="flex items-center gap-1 shrink-0">
                                <UI.Btn variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => handleEditCombo(combo)}>{t('pages.menuCenter.edit')}</UI.Btn>
                                <UI.Tooltip label={t('pages.menuCenter.delete')}><button onClick={() => setComboDeleteTarget(combo)} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button></UI.Tooltip>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </>
            )}
            </div>
          </UI.SectionCard>
        </div>
              </div>
          )}
          {productsTab === 'modifiers' && (
            <ModifierGroupManager
              readOnly={!isMain || !canEdit}
              isMain={isMain}
              additionalLocales={additionalLocales}
              canEditAvailability={canEditAvailability}
              modifierAvailability={modifierAvailability}
              onSnoozeOption={(option) => setSnoozeTarget({ type: 'modifierOption', id: option.id, name: option.displayName })}
            />
          )}
          </div>
        </>
      )}
      {topTab === 'combos' && (
              <UI.SectionCard
                title={t('pages.menuCenter.comboList')}
                action={
                  <div className="flex items-center gap-1.5">
                    {canEdit && <UI.Btn variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleCreateCombo}>{t('pages.menuCenter.createCombo')}</UI.Btn>}
                    <UI.Btn variant="secondary" size="sm" icon={<RotateCcw className="w-3.5 h-3.5" />} loading={loading.combos} onClick={loadCombos} />
                  </div>
                }
                bodyClassName="p-0"
              >
                <div className="p-4">
                <UI.Table
                  data={combos}
                  rowKey={(r: Combo) => r.id}
                  loading={loading.combos}
                  columns={[
                    {
                      key: 'name', title: t('pages.menuCenter.comboName'), width: 150,
                      render: (record: Combo) => (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="font-medium text-slate-800">{record.name}</span>
                          {record.itemGroups && record.itemGroups.length > 0
                            ? <UI.Badge variant="gold">{t('pages.menuCenter.selectableComboBadge')}</UI.Badge>
                            : <UI.Badge variant="blue">{t('pages.menuCenter.fixedComboBadge')}</UI.Badge>}
                        </div>
                      ),
                    },
                    {
                      key: 'items', title: t('pages.menuCenter.includedItems'), width: 300,
                      render: (record: Combo) => {
                        if (record.itemGroups && record.itemGroups.length > 0) {
                          return (
                            <div className="flex flex-col gap-1">
                              {record.itemGroups.map((group, index) => {
                                const groupItems = (record.comboItems || []).filter(item => item.groupId === group.id)
                                const selectionText = group.selectionType === 'single' ? t('pages.menuCenter.singleSelect') : t('pages.menuCenter.multiSelectFormat', { count: groupItems.length, max: group.maxSelections || 1 })
                                return (
                                  <div key={index} className="flex flex-wrap items-center gap-1">
                                    <UI.Badge variant="blue">{group.name} ({selectionText})</UI.Badge>
                                    {groupItems.slice(0, 3).map((item, idx) => (
                                      <UI.Badge key={idx}>{allItems.find(i => i.id === item.itemId)?.name || t('pages.menuCenter.unknownItem')}{item.additionalPrice ? ` +${(item.additionalPrice / 100).toFixed(2)}` : ''}</UI.Badge>
                                    ))}
                                    {groupItems.length > 3 && <span className="text-xs text-slate-400">{t('pages.menuCenter.andMoreItems', { count: groupItems.length })}</span>}
                                  </div>
                                )
                              })}
                            </div>
                          )
                        }
                        const items = record.comboItems || []
                        if (items.length === 0) return <span className="text-slate-400">{t('pages.menuCenter.noItemsYet')}</span>
                        return (
                          <div className="flex flex-wrap gap-1">
                            {items.map((comboItem, index) => (
                              <UI.Badge key={index} variant="blue">{allItems.find(i => i.id === comboItem.itemId)?.name || comboItem.item?.name || t('pages.menuCenter.unknownItemFull')} ×{comboItem.quantity || 1}</UI.Badge>
                            ))}
                          </div>
                        )
                      },
                    },
                    { key: 'category', title: t('pages.menuCenter.colCategory'), width: 100, render: (r: Combo) => (r as any).category?.name || '-' },
                    { key: 'basePrice', title: t('pages.menuCenter.colOriginalPrice'), width: 100, render: (r: Combo) => <span className="text-slate-700">{formatPrice(r.basePrice)}</span> },
                    {
                      key: 'discount', title: t('pages.menuCenter.colDiscount'), width: 100,
                      render: (r: Combo) => {
                        const discount = Number(r.discount) || 0
                        if (discount === 0) return <span className="text-slate-400">{t('pages.menuCenter.noDiscount')}</span>
                        return <span className="text-red-600">{r.discountType === 'percentage' ? `-${discount}%` : `-${formatPrice(discount)}`}</span>
                      },
                    },
                    {
                      key: 'finalPrice', title: t('pages.menuCenter.colSalePrice'), width: 100,
                      render: (r: Combo) => {
                        const basePrice = Number(r.basePrice) || 0
                        const discount = Number(r.discount) || 0
                        const discountAmount = r.discountType === 'percentage' ? basePrice * (discount / 100) : discount
                        return <span className="font-semibold text-emerald-600">{formatPrice(Math.max(0, basePrice - discountAmount))}</span>
                      },
                    },
                    { key: 'isActive', title: t('pages.menuCenter.status'), render: (r: Combo) => <UI.Badge variant={r.isActive ? 'green' : 'red'}>{r.isActive ? t('pages.menuCenter.activated') : t('pages.menuCenter.deactivated')}</UI.Badge> },
                    {
                      key: 'actions', title: t('pages.menuCenter.action'),
                      render: (record: Combo) => canEdit ? (
                        <div className="flex items-center gap-1">
                          <UI.Btn variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => handleEditCombo(record)}>{t('pages.menuCenter.edit')}</UI.Btn>
                          <UI.Tooltip label={t('pages.menuCenter.delete')}><button onClick={() => setComboDeleteTarget(record)} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button></UI.Tooltip>
                        </div>
                      ) : null,
                    },
                  ]}
                />
                </div>
              </UI.SectionCard>
      )}
      {topTab === 'supplies' && <SupplyTab />}
      {topTab === 'locale-settings' && isMain && <BrandLocaleSettings />}
      </div>

      {/* 分类创建/编辑模态框 */}
      <UI.Modal
        open={categoryModalVisible}
        onOpenChange={(v) => !v && setCategoryModalVisible(false)}
        title={editingCategory ? t('pages.menuCenter.editCategory') : t('pages.menuCenter.createCategory')}
        footer={
          <>
            <UI.Btn variant="secondary" onClick={() => setCategoryModalVisible(false)}>{t('pages.menuCenter.cancel')}</UI.Btn>
            <UI.Btn variant="primary" loading={loading.creating} onClick={handleCategorySubmit}>
              {editingCategory ? t('pages.menuCenter.update') : t('pages.menuCenter.create')}
            </UI.Btn>
          </>
        }
      >
        <div className="space-y-4">
          <UI.Field label={`${t('pages.menuCenter.categoryName')}${t('pages.menuCenter.englishDefaultSuffix')}`} required error={catErr}>
            <UI.TextInput value={catName} onChange={setCatName} placeholder={t('pages.menuCenter.categoryNamePlaceholder')} maxLength={50} />
          </UI.Field>
          {additionalLocales.map(locale => (
            <UI.Field key={locale} label={t('pages.menuCenter.categoryNameLocaleLabel', { locale: LOCALE_LABELS[locale] ?? locale })}>
              <UI.TextInput value={catNameI18n[locale] ?? ''} onChange={(v) => setCatNameI18n(prev => ({ ...prev, [locale]: v }))} placeholder={t('pages.menuCenter.localeTranslationPlaceholder', { locale: LOCALE_LABELS[locale] ?? locale })} maxLength={50} />
            </UI.Field>
          ))}

          <UI.Field
            label={t('pages.menuCenter.parentCategory')}
            hint={flatCategories.filter(cat => (cat.level || 0) === 0).length === 0 ? t('pages.menuCenter.noParentCategoryHint') : t('pages.menuCenter.parentCategoryTooltip')}
          >
            <UI.SelectInput
              value={catParentId ?? ''}
              onChange={(v) => setCatParentId(v || undefined)}
              className="w-full"
              options={[
                { label: t('pages.menuCenter.parentCategoryPlaceholder'), value: '' },
                ...flatCategories.filter(cat => (cat.level || 0) === 0).map(cat => ({ label: cat.name, value: cat.id })),
              ]}
            />
          </UI.Field>
        </div>
      </UI.Modal>

      {/* 商品创建/编辑模态框 */}
      <UI.Modal
        open={itemModalVisible}
        onOpenChange={(v) => !v && setItemModalVisible(false)}
        title={editingItem ? t('pages.menuCenter.editItem') : t('pages.menuCenter.createItem')}
        size="xl"
        footer={
          <>
            <UI.Btn variant="secondary" onClick={() => setItemModalVisible(false)}>{t('pages.menuCenter.cancel')}</UI.Btn>
            <UI.Btn variant="primary" loading={loading.creating} onClick={() => handleItemSubmit({
              name: itName,
              name_i18n: itNameI18n,
              description: itDescription,
              description_i18n: itDescriptionI18n,
              categoryId: itCategoryId,
              basePrice: itBasePrice,
              cost: Number.isNaN(itCost) ? undefined : itCost,
              isActive: itIsActive,
              customFields: itCustomFields,
              itemModifiers: itModifiers,
              scope: itScope,
              visibleStoreIds: itVisibleStoreIds,
            })}>
              {editingItem ? t('pages.menuCenter.update') : t('pages.menuCenter.create')}
            </UI.Btn>
          </>
        }
      >
        <UI.Tabs
          value={itemModalTab}
          onChange={(k) => setItemModalTab(k as 'basic' | 'modifiers')}
          items={[
            { key: 'basic', label: t('pages.menuCenter.basicInfo') },
            { key: 'modifiers', label: t('pages.menuCenter.customOptionConfigTab') },
          ]}
        />

        <div className="pt-4">
          {itemModalTab === 'basic' ? (
            <div className="flex flex-col lg:flex-row gap-5">
              {/* 左：图片 */}
              <div className="shrink-0">
                <div className="text-sm font-medium text-slate-700 mb-1.5">{t('pages.menuCenter.imageLabel')}</div>
                {editingItem ? (
                  <UI.ImageUpload url={previewImageUrl} loading={imageUploading} onPick={handleImageUpload} onRemove={handleImageDelete} hint="JPG / PNG / WebP，≤5MB" />
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-slate-400" style={{ width: 120, height: 120 }}>
                    <ImageIcon className="w-6 h-6" />
                    <span className="text-[11px] mt-1.5 text-center px-2">{t('pages.menuCenter.saveToUpload')}</span>
                  </div>
                )}
              </div>

              {/* 中：名称 + 简介（多语言） */}
              <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-3">
                  <UI.Field label={`${t('pages.menuCenter.itemName')}${t('pages.menuCenter.englishDefaultSuffix')}`} required>
                    <UI.TextInput value={itName} onChange={setItName} placeholder={t('pages.menuCenter.itemNamePlaceholder')} maxLength={100} />
                  </UI.Field>
                  {additionalLocales.map(locale => (
                    <UI.Field key={locale} label={t('pages.menuCenter.nameLocaleLabel', { locale: LOCALE_LABELS[locale] ?? locale })}>
                      <UI.TextInput value={itNameI18n[locale] ?? ''} onChange={(v) => setItNameI18n(prev => ({ ...prev, [locale]: v }))} placeholder={t('pages.menuCenter.optional')} maxLength={100} />
                    </UI.Field>
                  ))}
                </div>
                <div className="space-y-3">
                  <UI.Field label={`${t('pages.menuCenter.itemDescription')}${t('pages.menuCenter.englishDefaultSuffix')}`}>
                    <UI.Textarea value={itDescription} onChange={setItDescription} rows={2} placeholder={t('pages.menuCenter.itemDescriptionPlaceholder')} />
                  </UI.Field>
                  {additionalLocales.map(locale => (
                    <UI.Field key={locale} label={t('pages.menuCenter.introLocaleLabel', { locale: LOCALE_LABELS[locale] ?? locale })}>
                      <UI.Textarea value={itDescriptionI18n[locale] ?? ''} onChange={(v) => setItDescriptionI18n(prev => ({ ...prev, [locale]: v }))} rows={2} placeholder={t('pages.menuCenter.optional')} />
                    </UI.Field>
                  ))}
                </div>
              </div>

              {/* 右：分类、价格、状态、范围 */}
              <div className="shrink-0 w-full lg:w-60 space-y-3">
                <UI.Field label={t('pages.menuCenter.itemCategory')} required>
                  <UI.SelectInput
                    value={itCategoryId ?? ''}
                    onChange={(v) => setItCategoryId(v || undefined)}
                    className="w-full"
                    options={[
                      { label: t('pages.menuCenter.selectCategory'), value: '' },
                      ...flatCategories.map(cat => ({ label: (cat.level && cat.level > 0 ? '　└─ ' : '') + cat.name, value: cat.id })),
                    ]}
                  />
                </UI.Field>
                <div className="grid grid-cols-2 gap-2">
                  <UI.Field label={t('pages.menuCenter.basePrice')} required>
                    <UI.NumberInput value={itBasePrice} onChange={setItBasePrice} min={0} className="w-full" />
                  </UI.Field>
                  <UI.Field label={t('pages.menuCenter.cost')}>
                    <UI.NumberInput value={itCost} onChange={setItCost} min={0} className="w-full" />
                  </UI.Field>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{t('pages.menuCenter.status')}</span>
                  <UI.Switch checked={itIsActive} onCheckedChange={setItIsActive} />
                </div>
                {isMain && (
                  <>
                    <UI.Field label={t('pages.menuCenter.itemScopeLabel')}>
                      <UI.SelectInput
                        value={itScope}
                        onChange={(v) => setItScope(String(v))}
                        className="w-full"
                        options={[
                          { label: t('pages.menuCenter.brandItemOption'), value: 'BRAND' },
                          { label: t('pages.menuCenter.storeExclusiveOption'), value: 'STORE_EXCLUSIVE' },
                        ]}
                      />
                    </UI.Field>
                    {itScope === 'STORE_EXCLUSIVE' && (
                      <UI.Field label={t('pages.menuCenter.visibleStoresLabel')}>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto sidebar-scroll rounded-lg border border-slate-200 p-2">
                          {organizations.map((o: any) => (
                            <UI.Checkbox
                              key={o.id}
                              checked={itVisibleStoreIds.includes(o.id)}
                              onCheckedChange={(c) => setItVisibleStoreIds(prev => c ? [...prev, o.id] : prev.filter(id => id !== o.id))}
                              label={`${o.orgName}${o.orgType === 'MAIN' ? t('pages.menuCenter.mainStoreSuffix') : o.orgType === 'FRANCHISE' ? t('pages.menuCenter.franchiseSuffix') : t('pages.menuCenter.branchSuffix')}`}
                            />
                          ))}
                        </div>
                      </UI.Field>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <ItemModifierConfigInput
              value={itModifiers}
              onChange={setItModifiers}
              modifierGroups={modifierGroups}
              t={t}
            />
          )}
        </div>
      </UI.Modal>

      {/* 属性类型创建/编辑模态框 */}
      <UI.Modal
        open={attributeTypeModalVisible}
        onOpenChange={(v) => !v && setAttributeTypeModalVisible(false)}
        title={editingAttributeType ? t('pages.menuCenter.editAttributeType') : t('pages.menuCenter.createAttributeType')}
        size="lg"
        footer={
          <>
            <UI.Btn variant="secondary" onClick={() => setAttributeTypeModalVisible(false)}>{t('pages.menuCenter.cancel')}</UI.Btn>
            <UI.Btn variant="primary" loading={loading.creating} onClick={handleAttributeTypeSubmit}>
              {editingAttributeType ? t('pages.menuCenter.update') : t('pages.menuCenter.create')}
            </UI.Btn>
          </>
        }
      >
        <div className="space-y-4">
          <UI.Field label={t('pages.menuCenter.attributeTypeName')} required error={atErr.name}>
            <UI.TextInput value={atName} onChange={setAtName} placeholder={t('pages.menuCenter.attributeTypeNamePlaceholder')} maxLength={255} />
          </UI.Field>

          <UI.Field label={t('pages.menuCenter.displayName')} required error={atErr.displayName}>
            <UI.TextInput value={atDisplayName} onChange={setAtDisplayName} placeholder={t('pages.menuCenter.displayNamePlaceholder')} maxLength={255} />
          </UI.Field>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t('pages.menuCenter.optionList')}</span>
              </div>
              <UI.Btn
                variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setAtOptions(prev => [...prev, { id: `temp_${Date.now()}`, value: '', displayName: '', priceModifier: 0 }])}
              >
                {t('pages.menuCenter.addOption')}
              </UI.Btn>
            </div>

            {atOptions.length === 0 ? (
              <div className="text-center py-5 rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
                {t('pages.menuCenter.noOptionsYet')}
              </div>
            ) : (
              <div className="space-y-2">
                {atOptions.map((opt, idx) => (
                  <div key={opt.id} className="rounded-lg border border-slate-200 p-2.5">
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <div className="text-xs text-slate-400 mb-1">{t('pages.menuCenter.optionValue')}</div>
                        <input className="w-full text-sm border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:outline-2 focus:outline-slate-900"
                          placeholder={t('pages.menuCenter.optionValuePlaceholder')}
                          value={opt.value} onChange={(e) => setAtOptions(prev => prev.map((o, i) => i === idx ? { ...o, value: e.target.value } : o))} />
                      </div>
                      <div className="col-span-4">
                        <div className="text-xs text-slate-400 mb-1">{t('pages.menuCenter.displayName')}</div>
                        <input className="w-full text-sm border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:outline-2 focus:outline-slate-900"
                          placeholder={t('pages.menuCenter.displayNameOptionPlaceholder')}
                          value={opt.displayName} onChange={(e) => setAtOptions(prev => prev.map((o, i) => i === idx ? { ...o, displayName: e.target.value } : o))} />
                      </div>
                      <div className="col-span-3">
                        <div className="text-xs text-slate-400 mb-1">{t('pages.menuCenter.priceModifier')}</div>
                        <input type="number" step="0.01" className="w-full text-sm border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:outline-2 focus:outline-slate-900"
                          placeholder="0.00"
                          value={opt.priceModifier} onChange={(e) => setAtOptions(prev => prev.map((o, i) => i === idx ? { ...o, priceModifier: Number(e.target.value) || 0 } : o))} />
                      </div>
                      <div className="col-span-1 flex justify-end pb-0.5">
                        <button onClick={() => setAtOptions(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-slate-400">{t('pages.menuCenter.sortByCreateOrder')}</p>
              </div>
            )}
          </div>
        </div>
      </UI.Modal>

      {/* 属性选项创建/编辑模态框 */}
      <UI.Modal
        open={attributeOptionModalVisible}
        onOpenChange={(v) => !v && setAttributeOptionModalVisible(false)}
        title={editingAttributeOption ? t('pages.menuCenter.editAttributeOption') : t('pages.menuCenter.createAttributeOption')}
        size="lg"
        footer={
          <>
            <UI.Btn variant="secondary" onClick={() => setAttributeOptionModalVisible(false)}>{t('pages.menuCenter.cancel')}</UI.Btn>
            <UI.Btn variant="primary" loading={loading.creating} onClick={handleAttributeOptionSubmit}>
              {editingAttributeOption ? t('pages.menuCenter.update') : t('pages.menuCenter.create')}
            </UI.Btn>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm">
            <p className="font-medium text-blue-800">{t('pages.menuCenter.fillExample')}</p>
            <p className="text-slate-600 mt-1">{t('pages.menuCenter.iceOptionExample')}</p>
            <ul className="list-disc pl-5 mt-1 text-xs text-slate-500 space-y-0.5">
              <li>{t('pages.menuCenter.optionValueColonLabel')} <code className="font-mono">normal_ice</code> → {t('pages.menuCenter.displayNameColonLabel')} {t('pages.menuCenter.iceNormalExample')}</li>
              <li>{t('pages.menuCenter.optionValueColonLabel')} <code className="font-mono">light_ice</code> → {t('pages.menuCenter.displayNameColonLabel')} {t('pages.menuCenter.iceLightExample')}</li>
              <li>{t('pages.menuCenter.optionValueColonLabel')} <code className="font-mono">more_ice</code> → {t('pages.menuCenter.displayNameColonLabel')} {t('pages.menuCenter.iceMoreExample')}</li>
              <li>{t('pages.menuCenter.optionValueColonLabel')} <code className="font-mono">no_ice</code> → {t('pages.menuCenter.displayNameColonLabel')} {t('pages.menuCenter.iceNoneExample')}</li>
            </ul>
          </div>

          <UI.Field label={t('pages.menuCenter.optionValue')} required error={aoErr.value} hint={`${t('pages.menuCenter.systemStorage')} · ${t('pages.menuCenter.optionValueTooltip')}`}>
            <UI.TextInput value={aoValue} onChange={setAoValue} placeholder={t('pages.menuCenter.optionValueExamplePlaceholder')} maxLength={255} />
          </UI.Field>

          <UI.Field label={t('pages.menuCenter.displayName')} required error={aoErr.displayName} hint={`${t('pages.menuCenter.userDisplay')} · ${t('pages.menuCenter.displayNameTooltip')}`}>
            <UI.TextInput value={aoDisplayName} onChange={setAoDisplayName} placeholder={t('pages.menuCenter.displayNameExamplePlaceholder')} maxLength={255} />
          </UI.Field>

          <div className="w-1/2">
            <UI.Field label={t('pages.menuCenter.priceModifier')}>
              <UI.NumberInput value={aoPriceModifier} onChange={setAoPriceModifier} suffix="$" className="w-full" />
            </UI.Field>
          </div>
        </div>
      </UI.Modal>

      {/* 加料模态框已移除（Addon 已废弃，迁移至 Modifier v2.0，且该弹窗无入口） */}

      {/* 套餐创建/编辑模态框 */}
      <UI.Modal
        open={comboModalVisible}
        onOpenChange={(v) => !v && setComboModalVisible(false)}
        title={editingCombo ? t('pages.menuCenter.editCombo') : t('pages.menuCenter.createCombo')}
        size="lg"
        footer={
          <>
            <UI.Btn variant="secondary" onClick={() => setComboModalVisible(false)}>{t('pages.menuCenter.cancel')}</UI.Btn>
            <UI.Btn variant="primary" loading={loading.creating} onClick={handleSaveCombo}>{editingCombo ? t('pages.menuCenter.update') : t('pages.menuCenter.create')}</UI.Btn>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <UI.Field label={t('pages.menuCenter.comboName')} required error={cbErr.name}>
              <UI.TextInput value={cbName} onChange={setCbName} placeholder={t('pages.menuCenter.comboNamePlaceholder')} maxLength={100} />
            </UI.Field>
            <UI.Field label={t('pages.menuCenter.belongsToCategoryLabel')} required error={cbErr.categoryId}>
              <UI.SelectInput
                value={cbCategoryId ?? ''}
                onChange={(v) => setCbCategoryId(v || undefined)}
                className="w-full"
                options={[
                  { label: t('pages.menuCenter.pleaseSelectCategoryOption'), value: '' },
                  ...flatCategories.map(cat => ({ label: (cat.level && cat.level > 0 ? '　└─ ' : '') + cat.name, value: cat.id })),
                ]}
              />
            </UI.Field>
          </div>

          <UI.Field label={t('pages.menuCenter.descriptionLabel')}>
            <UI.Textarea value={cbDescription} onChange={setCbDescription} rows={3} placeholder={t('pages.menuCenter.comboDescriptionPlaceholder')} />
          </UI.Field>

          {/* 套餐图片上传 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('pages.menuCenter.comboImageLabel')}</label>
            <ComboImageUpload
              comboId={editingCombo?.id}
              imageUrl={comboImageUrl}
              onImageChange={setComboImageUrl}
              onFileSelect={setComboImageFile}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-slate-700">{t('pages.menuCenter.activeStatus')}</span>
            <UI.Switch checked={cbIsActive} onCheckedChange={setCbIsActive} />
          </div>

          {/* 套餐类型 */}
          <div>
            <div className="text-sm font-medium text-slate-700 mb-1.5">{t('pages.menuCenter.comboTypeLabel')}</div>
            <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
              {([['fixed', t('pages.menuCenter.fixedComboOption')], ['selection', t('pages.menuCenter.selectionComboOption')]] as const).map(([v, label]) => (
                <button
                  key={v}
                  disabled={!!editingCombo}
                  onClick={() => {
                    setComboType(v)
                    if (v === 'fixed') { setComboItemGroups([]); setCbComboItems(prev => prev.map(i => ({ ...i, groupId: undefined }))) }
                    else { setCbComboItems([]) }
                  }}
                  className={`px-3.5 py-1.5 text-sm transition-colors ${comboType === v ? 'bg-slate-900 text-white!' : 'bg-white text-slate-600 hover:bg-slate-50'} ${editingCombo ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="text-xs mt-1.5">
              {editingCombo
                ? <span className="text-red-500">{t('pages.menuCenter.comboTypeLockedWarning')}</span>
                : <span className="text-slate-400">{comboType === 'fixed' ? t('pages.menuCenter.fixedComboHint') : t('pages.menuCenter.selectionComboHint')}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t('pages.menuCenter.comboItemsConfig')}</span>
            <span className="flex-1 h-px bg-slate-100" />
          </div>

          {comboType === 'fixed' ? (
            <>
              <ComboItemsInput
                value={cbComboItems}
                onChange={setCbComboItems}
                allItems={allItems}
                onPriceChange={(totalPrice) => setCbBasePrice(fromMinorUnit(totalPrice))}
                t={t}
              />

              {(() => {
                const basePrice = Number(cbBasePrice) || 0
                const discount = Number(cbDiscount) || 0
                const discountAmount = cbDiscountType === 'fixed' ? discount : basePrice * (discount / 100)
                const finalPrice = Math.max(0, basePrice - discountAmount)
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
                      <span className="text-sm text-slate-500">{t('pages.menuCenter.itemsTotalPriceAuto')}</span>
                      <span className="text-lg font-semibold text-blue-700">${basePrice.toFixed(2)}</span>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-2">{t('pages.menuCenter.discountSettingsOptional')}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <UI.Field label={t('pages.menuCenter.discountTypeLabel')}>
                          <UI.SelectInput
                            value={cbDiscountType}
                            onChange={(v) => { setCbDiscountType(v); setCbDiscount(0) }}
                            className="w-full"
                            options={[{ label: t('pages.menuCenter.fixedAmountOption'), value: 'fixed' }, { label: t('pages.menuCenter.percentageOption'), value: 'percentage' }]}
                          />
                        </UI.Field>
                        <UI.Field label={cbDiscountType === 'percentage' ? t('pages.menuCenter.discountPercentLabel') : t('pages.menuCenter.discountAmountLabel')}>
                          <UI.NumberInput value={cbDiscount} onChange={setCbDiscount} min={0} max={cbDiscountType === 'percentage' ? 100 : undefined} className="w-full" />
                        </UI.Field>
                      </div>
                    </div>
                    {basePrice > 0 && (
                      <div className="flex items-center justify-between rounded-lg bg-emerald-50 border-2 border-emerald-500 px-4 py-3">
                        <div>
                          <span className="text-base font-semibold text-slate-800">{t('pages.menuCenter.finalPriceLabel')}</span>
                          {discountAmount > 0 && (
                            <div className="text-xs text-slate-500 mt-0.5">{t('pages.menuCenter.originalPriceMinusDiscount', { base: basePrice.toFixed(2), discount: cbDiscountType === 'percentage' ? `${discount}%` : `$${discount.toFixed(2)}` })}</div>
                          )}
                        </div>
                        <span className="text-2xl font-bold text-emerald-600">${finalPrice.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )
              })()}
            </>
          ) : (
            <>
              <ComboItemGroupsConfig
                groups={comboItemGroups}
                onGroupsChange={setComboItemGroups}
                comboItems={cbComboItems}
                onComboItemsChange={setCbComboItems}
                allItems={allItems}
              />
              <UI.Field label={t('pages.menuCenter.comboPriceLabel')} required error={cbErr.basePrice} hint={t('pages.menuCenter.comboPriceHint')}>
                <div className="w-52">
                  <UI.NumberInput value={cbBasePrice} onChange={setCbBasePrice} min={0} className="w-full" />
                </div>
              </UI.Field>
            </>
          )}

          {/* 时段限制配置 */}
          <ComboAvailabilityConfig value={comboAvailabilityRules} onChange={setComboAvailabilityRules} />
        </div>
      </UI.Modal>

      {/* 门店改价弹窗（受控，替代原 Modal.confirm DOM hack）——本店价格 + 本店选项加价 */}
      <UI.Modal
        open={!!priceOverrideTarget}
        onOpenChange={(v) => !v && setPriceOverrideTarget(null)}
        title={priceOverrideTarget ? t('pages.menuCenter.changePriceModalTitle', { name: priceOverrideTarget.name }) : t('pages.menuCenter.changePriceModalTitleDefault')}
        size="xl"
        footer={
          <>
            <UI.Btn variant="secondary" onClick={() => setPriceOverrideTarget(null)}>{t('pages.menuCenter.cancel')}</UI.Btn>
            <UI.Btn variant="primary" loading={priceOverrideSaving} onClick={async () => {
              if (!priceOverrideTarget) return
              setPriceOverrideSaving(true)
              try {
                await storeMenuService.upsertStoreMenuConfig(priceOverrideTarget.id, {
                  priceOverride: Number.isNaN(priceOverrideValue) ? undefined : priceOverrideValue,
                  isAvailable: storeConfigs.get(priceOverrideTarget.id)?.isAvailable ?? true,
                })
                const modifierPrices = Object.entries(priceOverrideModifierValues)
                  .filter(([, v]) => v !== '' && v != null)
                  .map(([modifierOptionId, price]) => ({ modifierOptionId, price: parseFloat(price) }))
                if (modifierPrices.length > 0) {
                  await storeMenuService.setStoreModifierPrices(priceOverrideTarget.id, modifierPrices)
                }
                await loadStoreConfigs()
                UI.toast.success(t('pages.menuCenter.priceUpdatedSuccess'))
                setPriceOverrideTarget(null)
              } finally {
                setPriceOverrideSaving(false)
              }
            }}>{t('common.save')}</UI.Btn>
          </>
        }
      >
        <div className="space-y-3">
          <UI.Field
            label={t('pages.menuCenter.storePriceInYuanLabel')}
            hint={priceOverrideTarget ? (
              <span>{t('pages.menuCenter.brandPriceLabelPrefix')}<span className="font-semibold text-slate-600">{currencySymbol}{formatPrice(priceOverrideTarget.basePrice)}</span>{t('pages.menuCenter.restoreDefaultHint')}</span>
            ) : undefined}
          >
            <UI.NumberInput value={priceOverrideValue} onChange={setPriceOverrideValue} min={0} prefix={currencySymbol} className="w-full font-semibold" />
          </UI.Field>

          {priceOverrideModifierLoading ? (
            <div className="py-6 flex justify-center"><UI.Spinner /></div>
          ) : priceOverrideModifierGroups.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-slate-400">{t('pages.menuCenter.modifierOverrideTitle')}</span>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400">{t('pages.menuCenter.modifierOverrideHint')}</span>
                <span className="flex-1 h-px bg-slate-100" />
              </div>
              {/* 紧凑网格：每组一块浅灰底卡片做强区分，组内两列，输入框紧跟在名称后面 */}
              <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-2.5">
                {priceOverrideModifierGroups.map(mg => (
                  <div key={mg.modifierGroupId} className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs font-semibold text-slate-500 mb-1.5">{mg.group?.displayName || mg.modifierGroupId}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
                      {(mg.group?.options || []).map(opt => {
                        const rawValue = priceOverrideModifierValues[opt.id] ?? ''
                        const numericValue = rawValue === '' ? NaN : Number(rawValue)
                        const hasOverride = rawValue !== '' && !Number.isNaN(numericValue)
                        // 品牌价优先用 finalPrice（已合并商品级覆盖 catalog_item_modifier_prices，
                        // 即总部对"这个商品的这个选项"单独设的价），没有才回退选项默认价。
                        // 注意：getItemModifiers() 已经把这两个字段转换成元了，不能再传给
                        // formatPrice()（它的入参约定是分，会再除一次 100），这里直接 toFixed
                        const brandPrice = Number(opt.finalPrice ?? opt.defaultPrice ?? 0).toFixed(2)
                        return (
                          // 不用 flex-1/justify-between 撑开：输入框紧跟在文字后面，不被推到行尾
                          <div key={opt.id} className="flex items-center flex-wrap gap-x-2 gap-y-1 py-1">
                            <span className="text-sm text-slate-700">{opt.displayName}</span>
                            <span className="text-xs text-slate-400">
                              {t('pages.menuCenter.brandPriceLabel')} <span className="font-medium text-slate-500">{currencySymbol}{brandPrice}</span>
                            </span>
                            {hasOverride && <UI.Badge variant="gold">{t('pages.menuCenter.overriddenBadge')}</UI.Badge>}
                            <UI.NumberInput
                              value={numericValue}
                              onChange={v => setPriceOverrideModifierValues(prev => ({ ...prev, [opt.id]: Number.isNaN(v) ? '' : String(v) }))}
                              min={0}
                              prefix={currencySymbol}
                              className="font-semibold"
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </UI.Modal>

      {channelModal && (
        <ItemChannelConfig
          open={!!channelModal}
          itemId={channelModal.id}
          itemName={channelModal.name}
          onClose={() => setChannelModal(null)}
        />
      )}

      {/* 删除确认（套餐/商品/分类，供列表与树复用） */}
      <UI.ConfirmDialog
        open={!!comboDeleteTarget}
        onOpenChange={(v) => !v && setComboDeleteTarget(null)}
        title={t('pages.menuCenter.deleteComboConfirm')}
        confirmText={t('pages.menuCenter.delete')}
        danger
        onConfirm={() => { if (comboDeleteTarget) { handleDeleteCombo(comboDeleteTarget.id); setComboDeleteTarget(null) } }}
      />
      <UI.ConfirmDialog
        open={!!itemDeleteTarget}
        onOpenChange={(v) => !v && setItemDeleteTarget(null)}
        title={t('pages.menuCenter.deleteItemConfirm')}
        confirmText={t('pages.menuCenter.delete')}
        danger
        onConfirm={() => { if (itemDeleteTarget) { handleDeleteItem(itemDeleteTarget.id); setItemDeleteTarget(null) } }}
      />
      <UI.ConfirmDialog
        open={!!categoryDeleteTarget}
        onOpenChange={(v) => !v && setCategoryDeleteTarget(null)}
        title={t('pages.menuCenter.deleteCategoryConfirm')}
        description={categoryDeleteTarget ? t('pages.menuCenter.deleteCategoryContent', { name: categoryDeleteTarget.name }) : undefined}
        confirmText={t('pages.menuCenter.delete')}
        danger
        onConfirm={() => { if (categoryDeleteTarget) { handleDeleteCategory(categoryDeleteTarget.id); setCategoryDeleteTarget(null) } }}
      />

      {/* 门店级可用性控制弹窗：上下架开关 + 临时下架合并为一个入口，商品和 modifier 选项共用 */}
      {snoozeTarget && (
        <SnoozeModal
          open={!!snoozeTarget}
          onOpenChange={(v) => !v && setSnoozeTarget(null)}
          targetName={snoozeTarget.name}
          businessHours={storeBusinessHours}
          timezone={storeTimezone}
          currentIsAvailable={
            snoozeTarget.type === 'item'
              ? storeConfigs.get(snoozeTarget.id)?.isAvailable ?? true
              : modifierAvailability.get(snoozeTarget.id)?.isAvailable ?? true
          }
          currentUnavailableUntil={
            snoozeTarget.type === 'item'
              ? storeConfigs.get(snoozeTarget.id)?.unavailableUntil
              : modifierAvailability.get(snoozeTarget.id)?.unavailableUntil
          }
          onConfirm={async ({ isAvailable, unavailableUntil }) => {
            if (snoozeTarget.type === 'item') {
              // upsertStoreMenuConfig 返回的 updated 已经是完整、规范化的 StoreMenuConfig，直接替换即可
              const updated = await storeMenuService.upsertStoreMenuConfig(snoozeTarget.id, { isAvailable, unavailableUntil })
              setStoreConfigs(prev => {
                const next = new Map(prev)
                next.set(snoozeTarget.id, updated)
                return next
              })
            } else {
              const updated = await storeMenuService.upsertStoreModifierAvailability(snoozeTarget.id, { isAvailable, unavailableUntil })
              setModifierAvailability(prev => {
                const next = new Map(prev)
                next.set(snoozeTarget.id, updated)
                return next
              })
            }
          }}
        />
      )}
    </div>
  )
}

export default MenuCenter
