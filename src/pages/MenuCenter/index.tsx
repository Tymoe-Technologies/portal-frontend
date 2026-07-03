import React, { useEffect, useMemo, useRef, useState } from 'react'
import './index.css' // 添加样式文件
import {
  Card,
  Button,
  Space,
  Typography,
  List,
  Input,
  Select,
  Form,
  Empty,
  Row,
  Col,
  Divider,
  message,
  Modal,
  Tag,
  Spin,
  InputNumber,
  Popconfirm,
  Switch,
  Tree,
  Dropdown,
  Tooltip,
  Table,
  Tabs,
  Upload,
  Image,
  Radio
} from 'antd'
import type { RcFile } from 'antd/es/upload/interface'
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  MoreOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  LoadingOutlined,
  PictureOutlined,
  BranchesOutlined
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useAuthContext } from '../../auth/AuthProvider'
import { debugOrganizationIsolation } from '../../utils/debug-org'
import { getJWTInfo, checkJWTOrganizationInfo } from '../../utils/jwt-utils'
import { formatPrice, fromMinorUnit, toMinorUnit } from '../../utils/priceConverter'
import ModifierGroupManager from './ModifierGroupManager'
import ItemChannelConfig from './components/ItemChannelConfig'
import { storeMenuService, type StoreMenuConfig } from '../../services/store-menu'
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
  type ComboAvailabilityRules
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
      <select
        className="w-full mb-4 text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 cursor-pointer focus:outline-2 focus:outline-slate-900"
        value=""
        onChange={(e) => { if (e.target.value) handleAddItem(e.target.value) }}
      >
        <option value="">{t('pages.menuCenter.selectItemToAdd')}</option>
        {availableItems.map(item => (
          <option key={item.id} value={item.id}>{item.name} - {formatPrice(item.basePrice)}</option>
        ))}
      </select>

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
                    <div className="text-xs text-slate-400 mb-1">额外费用</div>
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
                    <button onClick={() => handleRemoveItem(comboItem.itemId)} title={t('pages.menuCenter.remove')} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
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
  const { isAuthenticated, organizations } = useAuthContext()

  // 从 localStorage 找当前选中的 org，判断 orgType
  const currentOrgId = localStorage.getItem('organization_id')
  const currentOrg = organizations.find(o => o.id === currentOrgId)
  const isMain = !currentOrg || currentOrg.orgType === 'MAIN'

  // 品牌多语言配置：除默认语言外的所有额外语言
  const [additionalLocales, setAdditionalLocales] = useState<string[]>([])
  const [defaultLocale, setDefaultLocale] = useState<string>('zh-CN')

  // 非主店：品牌商品的门店配置（可用性 / 价格覆盖）
  const [storeConfigs, setStoreConfigs] = useState<Map<string, StoreMenuConfig>>(new Map())

  // 自定义加载图标
  const loadingIcon = <LoadingOutlined style={{ fontSize: 24, color: '#1890ff' }} spin />

  // 状态管理
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [allItems, setAllItems] = useState<Item[]>([]) // 所有商品,用于Combo选择
  const [selectedCategoryId, setSelectedCategoryId] = useState<ID | null>(null)
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
  const [addonModalVisible, setAddonModalVisible] = useState(false)
  const [modifierGroupModalVisible, setModifierGroupModalVisible] = useState(false)
  const [modifierOptionModalVisible, setModifierOptionModalVisible] = useState(false)
  const [comboModalVisible, setComboModalVisible] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [editingAttributeType, setEditingAttributeType] = useState<ItemAttributeType | null>(null)
  const [editingAttributeOption, setEditingAttributeOption] = useState<ItemAttributeOption | null>(null)
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null)
  const [editingModifierGroup, setEditingModifierGroup] = useState<ModifierGroup | null>(null)
  const [editingModifierOption, setEditingModifierOption] = useState<ModifierOption | null>(null)
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null)
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
  const [itemForm] = Form.useForm<{
    name: string;
    name_i18n?: Record<string, string>;
    description?: string;
    categoryId?: string;
    basePrice: number;
    cost?: number;
    isActive?: boolean;
    customFields?: any;
    attributeConfigs?: ItemAttributeConfig[];
    itemAddons?: ItemAddon[];
  }>()
  const [attributeTypeForm] = Form.useForm<CreateItemAttributeTypePayload & { options: ItemAttributeOption[] }>()
  const [attributeOptionForm] = Form.useForm<CreateItemAttributeOptionPayload>()
  const [modifierGroupForm] = Form.useForm<CreateModifierGroupPayload & { options: ModifierOption[] }>()
  const [modifierOptionForm] = Form.useForm<CreateModifierOptionPayload>()
  const [comboForm] = Form.useForm<CreateComboPayload>()

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
        if (!isMain) loadStoreConfigs()
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
      // 重新加载所有数据
      loadCategories()
      loadAttributeTypes()
      loadAddons()
      loadModifierGroups()
      loadCombos()
      loadAllItems()
      if (selectedCategoryId) {
        loadItems()
      }
    }

    window.addEventListener('organizationChanged', handleOrganizationChange as EventListener)
    
    return () => {
      window.removeEventListener('organizationChanged', handleOrganizationChange as EventListener)
    }
  }, [selectedCategoryId])

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
      UI.toast.error('加载分类失败')
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
      UI.toast.error('加载属性类型失败')
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
      UI.toast.error('加载属性选项失败')
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
      UI.toast.error('加载加料失败')
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
      UI.toast.error('加载商品加料失败')
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
      UI.toast.error('加载自定义选项组失败')
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
      UI.toast.error('加载自定义选项失败')
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
      UI.toast.error('加载组合商品失败')
      setCombos([])
    } finally {
      setLoading(prev => ({ ...prev, combos: false }))
    }
  }

  // 创建Combo
  const handleCreateCombo = () => {
    setEditingCombo(null)
    comboForm.resetFields()
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

    comboForm.setFieldsValue({
      name: combo.name,
      description: combo.description,
      categoryId: combo.categoryId,
      basePrice: fromMinorUnit(combo.basePrice),
      discount: discountValue,
      discountType: combo.discountType,
      isActive: combo.isActive,
      comboItems: comboItems
    })

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
  const handleSaveCombo = async (values: CreateComboPayload) => {
    setLoading(prev => ({ ...prev, creating: true }))
    try {
      // 可选套餐：验证分组配置
      if (comboType === 'selection') {
        if (comboItemGroups.length === 0) {
          UI.toast.error('可选套餐至少需要一个分组');
          setLoading(prev => ({ ...prev, creating: false }));
          return;
        }
        const hasEmptyGroupName = comboItemGroups.some(g => !g.name || g.name.trim() === '');
        if (hasEmptyGroupName) {
          UI.toast.error('所有分组必须有名称');
          setLoading(prev => ({ ...prev, creating: false }));
          return;
        }
        const comboItemsForValidation = values.comboItems || [];
        comboItemGroups.forEach(group => {
          const groupItems = comboItemsForValidation.filter(ci => ci.groupId === group.id);
          if (groupItems.length === 0) {
            throw new Error(`分组 "${group.name}" 中没有商品，请添加商品`);
          }
        });
      }

      // 直接使用 camelCase，后端负责所有 snake_case 转换
      const payload: any = {
        ...values,
        comboItems: values.comboItems || [],
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
            UI.toast.warning('套餐已保存，但图片上传失败，请在编辑时重新上传')
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
    
    setLoading(prev => ({ ...prev, items: true }))
    try {
      // 同时加载商品和套餐
      const [itemsResponse, combosResponse] = await Promise.all([
        itemManagementService.getItems({
          categoryId: selectedCategoryId,
          limit: 100
        }),
        itemManagementService.getCombos({
          categoryId: selectedCategoryId,
          limit: 100
        })
      ])
      
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
      console.error('Failed to load items:', error)
      UI.toast.error('加载商品失败')
      setItems([]) // 确保出错时也设置为空数组
    } finally {
      setLoading(prev => ({ ...prev, items: false }))
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
        UI.toast.success('分类更新成功')
      } else {
        const createPayload: CreateCategoryPayload = {
          name: catName,
          parentId: catParentId || undefined,
          ...(name_i18n && { name_i18n }) as any,
        }
        const newCategory = await itemManagementService.createCategory(createPayload)
        UI.toast.success('分类创建成功')
        setSelectedCategoryId(newCategory.id)
      }

      setCategoryModalVisible(false)
      loadCategories()
    } catch (error) {
      console.error('Failed to save category:', error)
      UI.toast.error(editingCategory ? '更新分类失败' : '创建分类失败')
    } finally {
      setLoading(prev => ({ ...prev, creating: false }))
    }
  }

  // 创建商品
  const handleCreateItem = async () => {
    if (!selectedCategoryId) {
      UI.toast.warning('请先选择一个分类')
      return
    }
    
    // 加载所有select类型属性的选项
    for (const attributeType of attributeTypes) {
      if (attributeType.inputType === 'select' && !attributeOptions[attributeType.id]) {
        await loadAttributeOptions(attributeType.id)
      }
    }
    
    setEditingItem(null)
    itemForm.resetFields()
    itemForm.setFieldsValue({
      isActive: true,
      categoryId: selectedCategoryId
    })
    setPreviewImageUrl(undefined)
    setItemModalVisible(true)
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
    
    // 转换API返回的attributes为前端表单需要的attributeConfigs格式
    const attributeConfigsData = item.attributes?.map(attr => ({
      attributeTypeId: attr.attributeTypeId,
      isRequired: attr.isRequired,
      optionOverrides: attr.optionOverrides || {},
      allowedOptions: attr.allowedOptions || [],
      defaultOptionId: attr.defaultOptionId,
      optionOrder: attr.optionOrder || []
    })) || []
    
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
    itemForm.resetFields()
    itemForm.setFieldsValue({
      name: item.name,
      name_i18n: (item as any).name_i18n ?? {},
      description: item.description,
      description_i18n: (item as any).description_i18n ?? {},
      categoryId: item.categoryId,
      basePrice: fromMinorUnit(item.basePrice),
      cost: item.cost !== undefined && item.cost !== null ? fromMinorUnit(item.cost) : undefined,
      isActive: item.isActive,
      customFields: item.customFields,
      attributeConfigs: attributeConfigsData,
      itemModifiers: itemModifiersData,
      scope: item.scope || 'BRAND',
      visibleStoreIds: item.visible_stores?.map(vs => vs.store_id) || []
    } as any)
    setPreviewImageUrl(item.imageUrl)
    setItemModalVisible(true)
  }

  // 图片上传前验证
  const beforeImageUpload = (file: RcFile): boolean | string => {
    const isValidType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    if (!isValidType) {
      UI.toast.error('只支持 JPG、PNG、WebP 格式的图片')
      return Upload.LIST_IGNORE
    }
    const isLt5M = file.size / 1024 / 1024 < 5
    if (!isLt5M) {
      UI.toast.error('图片大小不能超过 5MB')
      return Upload.LIST_IGNORE
    }
    return true
  }

  // 上传图片
  const handleImageUpload = async (file: RcFile) => {
    if (!editingItem) {
      UI.toast.warning('请先保存商品，然后再上传图片')
      return false
    }

    setImageUploading(true)
    try {
      const result = await itemManagementService.uploadItemImage(editingItem.id, file)
      setPreviewImageUrl(result.image.url)
      setEditingItem({ ...editingItem, imageUrl: result.image.url })
      UI.toast.success('图片上传成功')
      loadItems() // 刷新列表
      loadAllItems() // 刷新全部商品
    } catch (error: any) {
      console.error('Image upload failed:', error)
      UI.toast.error(error?.response?.data?.error || '图片上传失败')
    } finally {
      setImageUploading(false)
    }
    return false
  }

  // 删除图片
  const handleImageDelete = async () => {
    if (!editingItem) return

    Modal.confirm({
      title: '确认删除图片',
      content: '确定要删除这张商品图片吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await itemManagementService.deleteItemImage(editingItem.id)
          setPreviewImageUrl(undefined)
          setEditingItem({ ...editingItem, imageUrl: undefined })
          UI.toast.success('图片删除成功')
          loadItems()
          loadAllItems()
        } catch (error: any) {
          console.error('Image delete failed:', error)
          UI.toast.error(error?.response?.data?.error || '图片删除失败')
        }
      }
    })
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
        UI.toast.error('商品名称不能为空')
        return
      }

      if (typeof values.basePrice !== 'number' || isNaN(values.basePrice)) {
        UI.toast.error('请输入有效的商品售价')
        return
      }

      // 确定使用的分类ID
      const categoryId = values.categoryId || selectedCategoryId
      if (!categoryId) {
        UI.toast.error('请选择商品分类')
        return
      }

      // 验证分类ID是有效的UUID
      if (!isValidUUID(categoryId)) {
        UI.toast.error('分类ID格式无效')
        return
      }

      // 验证分类是否存在
      const categoryExists = categories.some(cat => cat.id === categoryId)
      if (!categoryExists) {
        UI.toast.error('所选分类不存在，请重新选择')
        return
      }

      // 验证成本价格（可选，但如果填写了必须是有效数字）
      if (values.cost !== undefined && values.cost !== null && values.cost !== '') {
        const costNumber = Number(values.cost)
        if (isNaN(costNumber) || costNumber < 0) {
          UI.toast.error('成本价格必须是有效的非负数字')
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
        
        UI.toast.success('商品更新成功')
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
        
        UI.toast.success('商品创建成功')
      }
      
      setItemModalVisible(false)
      loadItems()
    } catch (error) {
      console.error('Failed to save item:', error)
      UI.toast.error(editingItem ? '更新商品失败' : '创建商品失败')
    } finally {
      setLoading(prev => ({ ...prev, creating: false }))
    }
  }

  // ==================== 属性管理处理函数 ====================

  // 创建属性类型
  const handleCreateAttributeType = () => {
    setEditingAttributeType(null)
    attributeTypeForm.resetFields()
    setAttributeTypeModalVisible(true)
  }

  // 编辑属性类型
  const handleEditAttributeType = async (attributeType: ItemAttributeType) => {
    setEditingAttributeType(attributeType)
    
    // 加载属性选项
    await loadAttributeOptions(attributeType.id)
    const options = attributeOptions[attributeType.id] || []
    
    attributeTypeForm.setFieldsValue({
      name: attributeType.name,
      displayName: attributeType.displayName,
      inputType: attributeType.inputType,
      options: options
    })
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
  const handleAttributeTypeSubmit = async (values: CreateItemAttributeTypePayload & { options: ItemAttributeOption[] }) => {
    setLoading(prev => ({ ...prev, creating: true }))
    try {
      // 验证至少有一个选项
      if (!values.options || values.options.length === 0) {
        UI.toast.error(t('pages.menuCenter.atLeastOneOption'))
        return
      }
      
      // 验证选项值唯一性
      const optionValues = values.options.map(opt => opt.value)
      const uniqueValues = new Set(optionValues)
      if (optionValues.length !== uniqueValues.size) {
        UI.toast.error(t('pages.menuCenter.optionValueDuplicate'))
        return
      }
      
      // 创建属性类型
      const attributeTypePayload = {
        name: values.name,
        displayName: values.displayName,
        inputType: values.inputType
      }
      
      let attributeTypeId: string
      
      if (editingAttributeType) {
        await itemManagementService.updateAttributeType(editingAttributeType.id, attributeTypePayload)
        attributeTypeId = editingAttributeType.id
        UI.toast.success('属性类型更新成功')
      } else {
        const createdType = await itemManagementService.createAttributeType(attributeTypePayload)
        attributeTypeId = createdType.id
        UI.toast.success('属性类型创建成功')
      }
      
      // 创建或更新选项
      for (const option of values.options) {
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
    attributeOptionForm.resetFields()
    attributeOptionForm.setFieldsValue({ priceModifier: 0 })
    setAttributeOptionModalVisible(true)
  }

  // 编辑属性选项
  const handleEditAttributeOption = (option: ItemAttributeOption, typeId: string) => {
    setSelectedAttributeTypeId(typeId)
    setEditingAttributeOption(option)
    attributeOptionForm.setFieldsValue({
      value: option.value,
      displayName: option.displayName,
      priceModifier: option.priceModifier || 0
    })
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
  const handleAttributeOptionSubmit = async (values: CreateItemAttributeOptionPayload) => {
    if (!selectedAttributeTypeId) {
      UI.toast.error(t('pages.menuCenter.selectAttributeTypeFirst'))
      return
    }

    setLoading(prev => ({ ...prev, creating: true }))
    try {
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

  // 保存加料（创建或更新）
  // Modifier v2.0: 迁移到使用 createModifierGroup/updateModifierGroup
  const handleSaveAddon = async (values: any) => {
    setLoading(prev => ({ ...prev, creating: true }))
    try {
      const payload: CreateModifierGroupPayload = {
        name: values.description || values.name,
        displayName: values.name,
      }

      if (editingAddon) {
        // Modifier v2.0: 使用 updateModifierGroup
        await itemManagementService.updateModifierGroup(editingAddon.id, payload)
        UI.toast.success(t('pages.menuCenter.updateModifierSuccess'))
      } else {
        // 创建新的 ModifierGroup
        await itemManagementService.createModifierGroup(payload)
        UI.toast.success(t('pages.menuCenter.createModifierSuccess'))
      }
      setAddonModalVisible(false)
      setEditingAddon(null)
      loadAddons()
    } catch (error) {
      console.error('Failed to save addon:', error)
      UI.toast.error(editingAddon ? t('pages.menuCenter.updateModifierFailed') : t('pages.menuCenter.createModifierFailed'))
    } finally {
      setLoading(prev => ({ ...prev, creating: false }))
    }
  }

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
      UI.toast.success('添加加料成功')
      loadItemAddons(itemId)
    } catch (error) {
      console.error('Failed to add item addon:', error)
      UI.toast.error('添加加料失败')
    }
  }

  // 移除商品加料关联
  // Modifier v2.0: 使用 removeModifierGroupFromItem
  const handleRemoveItemAddon = async (itemId: string, addonId: string) => {
    try {
      // addonId 实际上是 modifierGroupId
      await itemManagementService.removeModifierGroupFromItem(itemId, addonId)
      UI.toast.success('移除加料成功')
      loadItemAddons(itemId)
    } catch (error) {
      console.error('Failed to remove item addon:', error)
      UI.toast.error('移除加料失败')
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

  // 生成Tree组件数据
  const treeData = useMemo(() => {
    const convertToTreeData = (categories: HierarchicalCategory[]): any[] => {
      return categories.map(category => ({
        key: category.id,
        title: (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Space style={{ flex: 1 }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: category.level === 0 ? '#1890ff' : '#52c41a',
                display: 'inline-block',
                marginRight: '4px'
              }} />
              <span style={{
                fontWeight: category.level === 0 ? 600 : 400,
                color: selectedCategoryId === category.id ? '#1890ff' : '#000'
              }}>
                {category.name}
              </span>
              {category.isSystem && (
                <Tag
                  color="default"
                  style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', marginLeft: 2 }}
                >
                  系统
                </Tag>
              )}
            </Space>
            {isMain && (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'edit',
                      label: t('pages.menuCenter.edit'),
                      icon: <EditOutlined />,
                      onClick: () => handleEditCategory(category)
                    },
                    // 系统分类不显示删除选项
                    ...(!category.isSystem ? [{
                      key: 'delete',
                      label: t('pages.menuCenter.delete'),
                      icon: <DeleteOutlined />,
                      danger: true,
                      onClick: () => {
                        Modal.confirm({
                          title: t('pages.menuCenter.deleteCategoryConfirm'),
                          content: t('pages.menuCenter.deleteCategoryContent', { name: category.name }),
                          okText: t('pages.menuCenter.delete'),
                          cancelText: t('pages.menuCenter.cancel'),
                          onOk: () => handleDeleteCategory(category.id)
                        })
                      }
                    }] : [])
                  ]
                }}
                trigger={['click']}
              >
                <Button
                  type="text"
                  size="small"
                  icon={<MoreOutlined />}
                  onClick={(e) => e.stopPropagation()}
                  style={{ opacity: 0.6 }}
                />
              </Dropdown>
            )}
          </div>
        ),
        icon: null, // 不显示文件夹图标
        children: category.children && category.children.length > 0 ? convertToTreeData(category.children) : undefined,
        selectable: true
      }))
    }
    
    return convertToTreeData(categoryTree)
  }, [categoryTree, selectedCategoryId])

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

  // 当选中分类变化时，加载商品和套餐
  React.useEffect(() => {
    if (selectedCategoryId) {
      loadItems()
    }
  }, [selectedCategoryId])

  // 如果未认证，显示提示
  if (!isAuthenticated) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Typography.Text>{t('pages.menuCenter.loginRequired')}</Typography.Text>
      </div>
    )
  }

  return (
    <Space direction="vertical" size={16} style={{ display: 'block' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        {t('pages.menuCenter.title')}
        {!isMain && (
          <Tag color="blue" style={{ marginLeft: 8, fontSize: 12 }}>
            {currentOrg?.orgType === 'FRANCHISE' ? '加盟店' : '分店'}
          </Tag>
        )}
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
        {t('pages.menuCenter.systemDescription')}
      </Typography.Paragraph>

      <Tabs
        defaultActiveKey="products"
        items={[
          {
            key: 'products',
            label: t('pages.menuCenter.menuManagement'),
            children: (
              <Tabs
                defaultActiveKey="items"
                items={[
                  {
                    key: 'items',
                    label: t('pages.menuCenter.itemList'),
                    children: (
              <Row gutter={16}>
        <Col xs={24} md={10} lg={8}>
          <Card 
            size="small" 
            title={
              <Space>
                {t('pages.menuCenter.categoriesTitle')}
                {isMain && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={handleCreateCategory}
                  >
                    {t('pages.menuCenter.addCategory')}
                  </Button>
                )}
                <Button 
                  size="small" 
                  icon={<ReloadOutlined />}
                  onClick={loadCategories}
                  loading={loading.categories}
                >
                  {t('pages.menuCenter.refresh')}
                </Button>
              </Space>
            }
          >
            <Spin spinning={loading.categories} indicator={loadingIcon} tip={t('pages.menuCenter.loadingCategories')}>
              {categories.length === 0 ? (
                <Empty description={t('pages.menuCenter.emptyCategories')}>
                  <Button type="primary" onClick={handleCreateCategory}>
                    {t('pages.menuCenter.createFirstCategoryCTA')}
                  </Button>
                </Empty>
              ) : (
                <Tree
                  treeData={treeData}
                  selectedKeys={selectedCategoryId ? [selectedCategoryId] : []}
                  defaultExpandAll
                  showIcon={false}
                  showLine={false}
                  switcherIcon={() => null} // 隐藏默认的switcher
                  onSelect={(selectedKeys) => {
                    if (selectedKeys.length > 0) {
                      setSelectedCategoryId(selectedKeys[0] as string)
                    }
                  }}
                  style={{
                    background: 'transparent',
                    fontSize: '14px'
                  }}
                  className="category-tree"
                />
              )}
            </Spin>
          </Card>
        </Col>

        <Col xs={24} md={14} lg={16}>
          <Card 
            size="small" 
            title={
              <Space>
                {t('pages.menuCenter.itemsTitle')}
                {selectedCategory && (
                  <>
                    {isMain && (
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={handleCreateItem}
                      >
                        {t('pages.menuCenter.addItem')}
                      </Button>
                    )}
                    <Button 
                      size="small" 
                      icon={<ReloadOutlined />}
                      onClick={loadItems}
                      loading={loading.items}
                    >
                      {t('pages.menuCenter.refresh')}
                    </Button>
                  </>
                )}
              </Space>
            }
          >
            <Spin spinning={loading.items} indicator={loadingIcon} tip={t('pages.menuCenter.loadingItems')}>
            {!selectedCategory ? (
              <Empty description={t('pages.menuCenter.selectCategoryPlaceholder')} />
            ) : (
              <>
                  <Typography.Text type="secondary">
                    {t('pages.menuCenter.currentCategory', { name: selectedCategory.name })}
                  </Typography.Text>
                  <Divider style={{ margin: '12px 0' }} />

                {categoryItems.length === 0 ? (
                    <Empty description={t('pages.menuCenter.emptyItems')}>
                      {isMain && (
                        <Button type="primary" onClick={handleCreateItem}>
                          创建第一个商品
                        </Button>
                      )}
                    </Empty>
                ) : (
                  <List
                    dataSource={categoryItems}
                      renderItem={(item) => (
                        <List.Item
                          actions={isMain ? [
                            <Button
                              key="edit"
                              type="link"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => handleEditItem(item)}
                            >
                              {t('pages.menuCenter.edit')}
                            </Button>,
                            <Button
                              key="channel"
                              type="link"
                              size="small"
                              icon={<BranchesOutlined />}
                              onClick={() => setChannelModal({ id: item.id, name: item.name })}
                            >
                              可售范围
                            </Button>,
                            <Popconfirm
                              key="delete"
                              title={t('pages.menuCenter.deleteItemConfirm')}
                              onConfirm={() => handleDeleteItem(item.id)}
                              okText={t('pages.menuCenter.delete')}
                              cancelText={t('pages.menuCenter.cancel')}
                            >
                              <Button
                                type="link"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                              >
                                {t('pages.menuCenter.delete')}
                              </Button>
                            </Popconfirm>
                          ] : [
                            <Switch
                              key="avail"
                              size="small"
                              checked={storeConfigs.get(item.id)?.isAvailable ?? true}
                              checkedChildren="上架"
                              unCheckedChildren="下架"
                              onChange={async (val) => {
                                await storeMenuService.upsertStoreMenuConfig(item.id, { isAvailable: val })
                                setStoreConfigs(prev => {
                                  const next = new Map(prev)
                                  const existing = prev.get(item.id)
                                  next.set(item.id, { ...(existing ?? { catalogItemId: item.id, priceOverride: null }), isAvailable: val })
                                  return next
                                })
                              }}
                            />,
                            <Button
                              key="price"
                              type="link"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => {
                                const cfg = storeConfigs.get(item.id)
                                Modal.confirm({
                                  title: `改价 — ${item.name}`,
                                  content: (
                                    <InputNumber
                                      id="price-override-input"
                                      defaultValue={cfg?.priceOverride ?? undefined}
                                      min={0}
                                      precision={2}
                                      placeholder={`品牌定价 ${formatPrice(item.basePrice)}，留空恢复默认`}
                                      style={{ width: '100%', marginTop: 8 }}
                                    />
                                  ),
                                  onOk: async () => {
                                    const el = document.getElementById('price-override-input') as HTMLInputElement
                                    const val = el?.value ? Number(el.value) : undefined
                                    await storeMenuService.upsertStoreMenuConfig(item.id, {
                                      priceOverride: val,
                                      isAvailable: storeConfigs.get(item.id)?.isAvailable ?? true,
                                    })
                                    await loadStoreConfigs()
                                    UI.toast.success('价格已更新')
                                  },
                                  okText: '保存',
                                  cancelText: '取消',
                                })
                              }}
                            >
                              改价
                            </Button>,
                            <Button
                              key="channel"
                              type="link"
                              size="small"
                              icon={<BranchesOutlined />}
                              onClick={() => setChannelModal({ id: item.id, name: item.name })}
                            >
                              可售范围
                            </Button>
                          ]}
                        >
                          <List.Item.Meta
                            title={
                              <Space>
                                {item.name}
                                <Tag color={item.isActive ? 'green' : 'red'}>
                                  {item.isActive ? t('pages.menuCenter.active') : t('pages.menuCenter.inactive')}
                                </Tag>
                                {item.scope === 'STORE_EXCLUSIVE' && (
                                  <Tag color="purple">专属</Tag>
                                )}
                              </Space>
                            }
                            description={
                              <Space direction="vertical" size={4}>
                                {item.description && (
                                  <Typography.Text type="secondary">
                                    {item.description}
                                  </Typography.Text>
                                )}
                                <Space>
                                  <Typography.Text strong>
                                    {t('pages.menuCenter.salePrice')}: {formatPrice(item.basePrice)}
                                  </Typography.Text>
                                  {!isMain && storeConfigs.get(item.id)?.priceOverride != null && (
                                    <>
                                      <Tag color="orange">已改价</Tag>
                                      <Typography.Text type="warning" strong>
                                        本店售价: {Number(storeConfigs.get(item.id)!.priceOverride!).toFixed(2)}
                                      </Typography.Text>
                                    </>
                                  )}
                                  {item.cost && (
                                    <Typography.Text type="secondary">
                                      {t('pages.menuCenter.cost')}: {formatPrice(item.cost)}
                                    </Typography.Text>
                                  )}
                                </Space>
                                {item.attributes && item.attributes.length > 0 && (
                                  <div style={{ marginTop: 4 }}>
                                    <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                      {t('pages.menuCenter.attributeConfig')}: 
                                    </Typography.Text>
                                    {item.attributes.map((attr, index) => {
                                      const attributeType = attr.attributeType || attributeTypes.find(type => type.id === attr.attributeTypeId)
                                      if (!attributeType) return null
                                      
                                      // 获取该属性类型的所有选项
                                      const allOptions = attributeOptions[attributeType.id] || []
                                      
                                      // 获取允许的选项（如果没有设置则显示所有）
                                      const allowedOptions = attr.allowedOptions && attr.allowedOptions.length > 0 
                                        ? allOptions.filter(opt => attr.allowedOptions!.includes(opt.id))
                                        : allOptions
                                      
                                      const optionNames = allowedOptions.map(opt => opt.displayName).join(', ')
                                      
                                      return (
                                        <Tag 
                                          key={index} 
                                          color="purple" 
                                          style={{ 
                                            marginBottom: 2, 
                                            fontWeight: 'bold',
                                            fontSize: '12px',
                                            padding: '2px 8px'
                                          }}
                                        >
                                          🏷️ {attributeType.displayName}({optionNames})
                                          {attr.isRequired && <span style={{ color: 'red', fontWeight: 'bold' }}> *</span>}
                                        </Tag>
                                      )
                                    })}
                                  </div>
                                )}
                                {/* 显示加料信息 */}
                                {itemAddons[item.id] && itemAddons[item.id].length > 0 && (
                                  <div style={{ marginTop: 4 }}>
                                    <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                      加料配置: 
                                    </Typography.Text>
                                    {itemAddons[item.id]
                                      .map((itemAddon, index) => {
                                        const addon = itemAddon.addon || addons.find(a => a.id === itemAddon.addonId)
                                        if (!addon) return null
                                        
                                        return (
                                          <Tag 
                                            key={index} 
                                            color="green" 
                                            style={{ 
                                              marginBottom: 2, 
                                              fontWeight: 'bold',
                                              fontSize: '12px',
                                              padding: '2px 8px'
                                            }}
                                          >
                                            {addon.name}
                                            <span style={{ fontSize: '10px', marginLeft: 4 }}>x{itemAddon.maxQuantity}</span>
                                            <span style={{ fontSize: '10px', marginLeft: 4 }}>{formatPrice(addon.price)}</span>
                                          </Tag>
                                        )
                                      })}
                                  </div>
                                )}
                                {item.customFields && Object.keys(item.customFields).length > 0 && (
                                  <div style={{ marginTop: 4 }}>
                                    <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                      自定义: 
                                    </Typography.Text>
                                    {Object.entries(item.customFields).map(([key, value]) => (
                                      <Tag key={key} color="blue" style={{ marginBottom: 2 }}>
                                        {key}: {String(value)}
                                      </Tag>
                                    ))}
                                  </div>
                                )}
                              </Space>
                            }
                          />
                      </List.Item>
                    )}
                  />
                )}

                {/* 套餐列表 */}
                {categoryCombos.length > 0 && (
                  <>
                    <Divider style={{ margin: '16px 0' }}>
                      <Typography.Text type="secondary">{t('pages.menuCenter.combosInCategory')}</Typography.Text>
                    </Divider>
                    <List
                      dataSource={categoryCombos}
                      renderItem={(combo) => {
                        // 价格以分为单位
                        const basePrice = Number(combo.basePrice) || 0
                        const discount = Number(combo.discount) || 0
                        let finalPrice = basePrice

                        if (combo.discountType === 'percentage') {
                          finalPrice = basePrice * (1 - discount / 100)
                        } else {
                          finalPrice = basePrice - discount
                        }
                        finalPrice = Math.max(0, finalPrice)
                        
                        return (
                          <List.Item
                            actions={[
                              <Button 
                                key="edit"
                                type="link" 
                                size="small" 
                                icon={<EditOutlined />}
                                onClick={() => handleEditCombo(combo)}
                              >
                                {t('pages.menuCenter.edit')}
                              </Button>,
                              <Popconfirm
                                key="delete"
                                title={t('pages.menuCenter.deleteComboConfirm')}
                                onConfirm={() => handleDeleteCombo(combo.id)}
                                okText={t('pages.menuCenter.delete')}
                                cancelText={t('pages.menuCenter.cancel')}
                              >
                                <Button 
                                  type="link" 
                                  size="small" 
                                  danger 
                                  icon={<DeleteOutlined />}
                                >
                                  {t('pages.menuCenter.delete')}
                                </Button>
                              </Popconfirm>
                            ]}
                          >
                            <List.Item.Meta
                              title={
                                <Space>
                                  <Tag color="orange">{t('pages.menuCenter.comboTag')}</Tag>
                                  {/* 套餐类型标签 */}
                                  {combo.itemGroups && combo.itemGroups.length > 0 ? (
                                    <Tag color="purple">可选套餐</Tag>
                                  ) : (
                                    <Tag color="cyan">固定套餐</Tag>
                                  )}
                                  <Typography.Text strong>{combo.name}</Typography.Text>
                                  {!combo.isActive && <Tag color="red">{t('pages.menuCenter.deactivated')}</Tag>}
                                </Space>
                              }
                              description={
                                <div>
                                  {combo.description && (
                                    <div style={{ marginBottom: 4 }}>
                                      <Typography.Text type="secondary">{combo.description}</Typography.Text>
                                    </div>
                                  )}
                                  
                                  {/* 固定套餐：显示商品列表 */}
                                  {(!combo.itemGroups || combo.itemGroups.length === 0) && combo.comboItems && combo.comboItems.length > 0 && (
                                    <div style={{ marginTop: 4 }}>
                                      <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                        {t('pages.menuCenter.includedItems')}: 
                                      </Typography.Text>
                                      {combo.comboItems.map((comboItem, index) => (
                                        <Tag key={index} color="blue" style={{ margin: '2px' }}>
                                          {allItems.find(i => i.id === comboItem.itemId)?.name || comboItem.item?.name || '未知'} ×{comboItem.quantity}
                                        </Tag>
                                      ))}
                                    </div>
                                  )}
                                  
                                  {/* 可选套餐：显示分组信息 */}
                                  {combo.itemGroups && combo.itemGroups.length > 0 && (
                                    <div style={{ marginTop: 4 }}>
                                      <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                        套餐分组: 
                                      </Typography.Text>
                                      <div style={{ marginTop: 4 }}>
                                        {combo.itemGroups.map((group, index) => {
                                          const groupItems = (combo.comboItems || []).filter(item => item.groupId === group.id);
                                          const groupItemCount = groupItems.length;
                                          const selectionText = group.selectionType === 'single' 
                                            ? '单选' 
                                            : `${groupItemCount}选${group.maxSelections || 1}`;
                                          
                                          return (
                                            <div key={index} style={{ marginBottom: 4 }}>
                                              <Tag color="geekblue" style={{ marginRight: 4 }}>
                                                {group.name} ({selectionText})
                                              </Tag>
                                              {groupItems.map((item, idx) => (
                                                <Tag key={idx} style={{ margin: '2px', fontSize: '12px' }}>
                                                  {allItems.find(i => i.id === item.itemId)?.name || '未知'}
                                                  {item.additionalPrice ? ` +${(item.additionalPrice / 100).toFixed(2)}` : ''}
                                                </Tag>
                                              ))}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div style={{ marginTop: 8 }}>
                                    <Space size="large">
                                      <span>
                                        <Typography.Text type="secondary" style={{ fontSize: '12px' }}>{t('pages.menuCenter.originalPrice')}: </Typography.Text>
                                        <Typography.Text style={{ textDecoration: discount > 0 ? 'line-through' : 'none' }}>
                                          {formatPrice(basePrice)}
                                        </Typography.Text>
                                      </span>
                                      {discount > 0 && (
                                        <>
                                          <span>
                                            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>{t('pages.menuCenter.discount')}: </Typography.Text>
                                            <Typography.Text type="danger">
                                              {combo.discountType === 'percentage' ? `-${discount}%` : `-${formatPrice(discount)}`}
                                            </Typography.Text>
                                          </span>
                                          <span>
                                            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>{t('pages.menuCenter.finalPrice')}: </Typography.Text>
                                            <Typography.Text strong style={{ color: '#52c41a', fontSize: '16px' }}>
                                              {formatPrice(finalPrice)}
                                            </Typography.Text>
                                          </span>
                                        </>
                                      )}
                                    </Space>
                                  </div>
                                </div>
                              }
                            />
                          </List.Item>
                        )
                      }}
                    />
                  </>
                )}
              </>
            )}
            </Spin>
          </Card>
        </Col>
              </Row>
                    )
                  },
                  {
                    key: 'modifiers',
                    label: '自定义选项组',
                    children: (
                      <ModifierGroupManager readOnly={!isMain} isMain={isMain} additionalLocales={additionalLocales} />
                    )
                  },

                ]}
              />
            )
          },
          {
            key: 'combos',
            label: t('pages.menuCenter.comboManagement'),
            children: (
              <Card 
                size="small" 
                title={
                  <Space>
                    {t('pages.menuCenter.comboList')}
                    <Button 
                      type="primary" 
                      size="small" 
                      icon={<PlusOutlined />}
                      onClick={handleCreateCombo}
                    >
                      {t('pages.menuCenter.createCombo')}
                    </Button>
                    <Button 
                      size="small" 
                      icon={<ReloadOutlined />}
                      onClick={loadCombos}
                      loading={loading.combos}
                    >
                      {t('pages.menuCenter.refresh')}
                    </Button>
                  </Space>
                }
              >
                <Table
                  dataSource={combos}
                  rowKey="id"
                  loading={{spinning: loading.combos, indicator: loadingIcon}}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    {
                      title: t('pages.menuCenter.comboName'),
                      dataIndex: 'name',
                      key: 'name',
                      width: 150,
                      render: (text: string, record: Combo) => (
                        <Space direction="vertical" size={2}>
                          <Typography.Text strong>{text}</Typography.Text>
                          {record.itemGroups && record.itemGroups.length > 0 ? (
                            <Tag color="purple" style={{ fontSize: '11px' }}>可选套餐</Tag>
                          ) : (
                            <Tag color="cyan" style={{ fontSize: '11px' }}>固定套餐</Tag>
                          )}
                        </Space>
                      )
                    },
                    {
                      title: t('pages.menuCenter.includedItems'),
                      key: 'items',
                      width: 300,
                      render: (_, record: Combo) => {
                        // 可选套餐：显示分组信息
                        if (record.itemGroups && record.itemGroups.length > 0) {
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {record.itemGroups.map((group, index) => {
                                const groupItems = (record.comboItems || []).filter(item => item.groupId === group.id);
                                const groupItemCount = groupItems.length;
                                const selectionText = group.selectionType === 'single' 
                                  ? '单选' 
                                  : `${groupItemCount}选${group.maxSelections || 1}`;
                                
                                return (
                                  <div key={index} style={{ marginBottom: 2 }}>
                                    <Tag color="geekblue" style={{ fontSize: '11px', marginRight: 4 }}>
                                      {group.name} ({selectionText})
                                    </Tag>
                                    {groupItems.slice(0, 3).map((item, idx) => {
                                      const itemName = allItems.find(i => i.id === item.itemId)?.name || '未知';
                                      return (
                                        <Tag key={idx} style={{ fontSize: '11px', margin: '0 2px' }}>
                                          {itemName}
                                          {item.additionalPrice ? ` +${(item.additionalPrice / 100).toFixed(2)}` : ''}
                                        </Tag>
                                      );
                                    })}
                                    {groupItems.length > 3 && (
                                      <Typography.Text type="secondary" style={{ fontSize: '11px' }}>
                                        等{groupItems.length}项
                                      </Typography.Text>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }
                        
                        // 固定套餐：显示商品列表
                        const items = record.comboItems || []
                        if (items.length === 0) {
                          return <Typography.Text type="secondary">暂无商品</Typography.Text>
                        }
                        return (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {items.map((comboItem, index) => {
                              const itemName = allItems.find(i => i.id === comboItem.itemId)?.name || comboItem.item?.name || '未知商品'
                              const quantity = comboItem.quantity || 1
                              return (
                                <Tag key={index} color="blue" style={{ margin: 0, fontSize: '11px' }}>
                                  {itemName} ×{quantity}
                                </Tag>
                              )
                            })}
                          </div>
                        )
                      }
                    },
                    {
                      title: '分类',
                      dataIndex: 'category',
                      key: 'category',
                      width: 100,
                      render: (category: Category) => category?.name || '-'
                    },
                    {
                      title: '原价',
                      dataIndex: 'basePrice',
                      key: 'basePrice',
                      width: 100,
                      render: (price: any) => {
                        return (
                          <Typography.Text style={{ fontSize: '14px' }}>
                            {formatPrice(price)}
                          </Typography.Text>
                        )
                      }
                    },
                    {
                      title: '折扣',
                      key: 'discount',
                      width: 100,
                      render: (_, record: Combo) => {
                        const discount = Number(record.discount) || 0
                        if (discount === 0) return <Typography.Text type="secondary">无</Typography.Text>
                        return (
                          <Typography.Text type="danger">
                            {record.discountType === 'percentage'
                              ? `-${discount}%`
                              : `-${formatPrice(discount)}`}
                          </Typography.Text>
                        )
                      }
                    },
                    {
                      title: '售价',
                      key: 'finalPrice',
                      width: 100,
                      render: (_, record: Combo) => {
                        const basePrice = Number(record.basePrice) || 0
                        const discount = Number(record.discount) || 0
                        let discountAmount = 0

                        if (record.discountType === 'percentage') {
                          discountAmount = basePrice * (discount / 100)
                        } else {
                          discountAmount = discount
                        }

                        const finalPrice = Math.max(0, basePrice - discountAmount)

                        return (
                          <Typography.Text strong style={{ color: '#52c41a', fontSize: '15px' }}>
                            {formatPrice(finalPrice)}
                          </Typography.Text>
                        )
                      }
                    },
                    {
                      title: t('pages.menuCenter.status'),
                      dataIndex: 'isActive',
                      key: 'isActive',
                      render: (isActive: boolean) => (
                        <Tag color={isActive ? 'green' : 'red'}>
                          {isActive ? t('pages.menuCenter.activated') : t('pages.menuCenter.deactivated')}
                        </Tag>
                      )
                    },
                    {
                      title: t('pages.menuCenter.action'),
                      key: 'actions',
                      render: (_, record: Combo) => (
                        <Space>
                          <Button
                            type="link"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleEditCombo(record)}
                          >
                            {t('pages.menuCenter.edit')}
                          </Button>
                          <Popconfirm
                            title={t('pages.menuCenter.deleteComboConfirm')}
                            onConfirm={() => handleDeleteCombo(record.id)}
                            okText={t('pages.menuCenter.confirm')}
                            cancelText={t('pages.menuCenter.cancel')}
                          >
                            <Button
                              type="link"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                            >
                              {t('pages.menuCenter.delete')}
                            </Button>
                          </Popconfirm>
                        </Space>
                      )
                    }
                  ]}
                />
              </Card>
            )
          },
          {
            key: 'supplies',
            label: '耗材管理',
            children: <SupplyTab />,
          },
          ...(isMain ? [{
            key: 'locale-settings',
            label: '语言设置',
            children: <BrandLocaleSettings />,
          }] : []),
        ]}
      />

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
          <UI.Field label={`${t('pages.menuCenter.categoryName')}（English，默认）`} required error={catErr}>
            <UI.TextInput value={catName} onChange={setCatName} placeholder={t('pages.menuCenter.categoryNamePlaceholder')} maxLength={50} />
          </UI.Field>
          {additionalLocales.map(locale => (
            <UI.Field key={locale} label={`分类名称（${LOCALE_LABELS[locale] ?? locale}）`}>
              <UI.TextInput value={catNameI18n[locale] ?? ''} onChange={(v) => setCatNameI18n(prev => ({ ...prev, [locale]: v }))} placeholder={`${LOCALE_LABELS[locale] ?? locale} 译名（可选）`} maxLength={50} />
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
      <Modal
        title={editingItem ? t('pages.menuCenter.editItem') : t('pages.menuCenter.createItem')}
        open={itemModalVisible}
        onCancel={() => setItemModalVisible(false)}
        footer={null}
        width={1200}
        style={{ top: 20 }}
      >
        <Form
          form={itemForm}
          layout="vertical"
          onFinish={handleItemSubmit}
        >
          <Tabs
            defaultActiveKey="basic"
            items={[
              {
                key: 'basic',
                label: t('pages.menuCenter.basicInfo'),
                children: (
                  <div>
                    <Card size="small" style={{ marginBottom: 16 }}>
                      <Row gutter={24}>
                        {/* 左栏：图片 */}
                        <Col flex="140px">
                          <Form.Item label="图片" style={{ marginBottom: 0 }}>
                            {editingItem ? (
                              previewImageUrl ? (
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                  <Image
                                    src={previewImageUrl}
                                    alt="商品图片"
                                    width={120}
                                    height={120}
                                    style={{ objectFit: 'cover', borderRadius: 8, display: 'block' }}
                                  />
                                  <Button
                                    type="text"
                                    danger
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    loading={imageUploading}
                                    onClick={handleImageDelete}
                                    style={{
                                      position: 'absolute',
                                      top: 4,
                                      right: 4,
                                      background: 'rgba(255,255,255,0.9)',
                                      borderRadius: '50%',
                                      padding: 4,
                                      minWidth: 24,
                                      height: 24,
                                    }}
                                  />
                                </div>
                              ) : (
                                <Upload
                                  accept=".jpg,.jpeg,.png,.webp"
                                  showUploadList={false}
                                  beforeUpload={beforeImageUpload}
                                  customRequest={({ file }) => handleImageUpload(file as RcFile)}
                                  disabled={imageUploading}
                                >
                                  <div style={{
                                    width: 120,
                                    height: 120,
                                    border: '1px dashed #d9d9d9',
                                    borderRadius: 8,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    background: '#fafafa',
                                  }}>
                                    {imageUploading ? (
                                      <LoadingOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                                    ) : (
                                      <>
                                        <PictureOutlined style={{ fontSize: 24, color: '#999' }} />
                                        <span style={{ marginTop: 8, color: '#999', fontSize: 12 }}>上传图片</span>
                                      </>
                                    )}
                                  </div>
                                </Upload>
                              )
                            ) : (
                              <div style={{
                                width: 120,
                                height: 120,
                                border: '1px dashed #d9d9d9',
                                borderRadius: 8,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#fafafa',
                              }}>
                                <PictureOutlined style={{ fontSize: 24, color: '#d9d9d9' }} />
                                <span style={{ marginTop: 8, color: '#bbb', fontSize: 11, textAlign: 'center', padding: '0 8px' }}>保存后可上传</span>
                              </div>
                            )}
                            <div style={{ color: '#bbb', fontSize: 11, marginTop: 6 }}>JPG / PNG / WebP，≤5MB</div>
                          </Form.Item>
                        </Col>

                        {/* 中栏：名称 + 描述（所有语言） */}
                        <Col flex="1" style={{ minWidth: 0 }}>
                          <Row gutter={12}>
                            <Col span={12}>
                              <Form.Item
                                name="name"
                                label="名称（English，默认）"
                                rules={[
                                  { required: true, message: t('pages.menuCenter.itemNameRequired') },
                                  { max: 255, message: t('pages.menuCenter.itemNameMaxLength') },
                                  { whitespace: true, message: t('pages.menuCenter.itemNameNoWhitespace') }
                                ]}
                                style={{ marginBottom: 12 }}
                              >
                                <Input placeholder={t('pages.menuCenter.itemNamePlaceholder')} maxLength={100} />
                              </Form.Item>
                              {additionalLocales.map(locale => (
                                <Form.Item
                                  key={locale}
                                  name={['name_i18n', locale]}
                                  label={`名称（${LOCALE_LABELS[locale] ?? locale}）`}
                                  style={{ marginBottom: 12 }}
                                >
                                  <Input placeholder={`可选`} maxLength={100} />
                                </Form.Item>
                              ))}
                            </Col>
                            <Col span={12}>
                              <Form.Item
                                name="description"
                                label="简介（English，默认）"
                                style={{ marginBottom: 12 }}
                              >
                                <Input.TextArea rows={2} placeholder={t('pages.menuCenter.itemDescriptionPlaceholder')} maxLength={500} />
                              </Form.Item>
                              {additionalLocales.map(locale => (
                                <Form.Item
                                  key={locale}
                                  name={['description_i18n', locale]}
                                  label={`简介（${LOCALE_LABELS[locale] ?? locale}）`}
                                  style={{ marginBottom: 12 }}
                                >
                                  <Input.TextArea rows={2} placeholder="可选" maxLength={500} />
                                </Form.Item>
                              ))}
                            </Col>
                          </Row>
                        </Col>

                        {/* 右栏：分类、价格、状态 */}
                        <Col flex="220px">
                          <Form.Item
                            name="categoryId"
                            label={t('pages.menuCenter.itemCategory')}
                            rules={[{ required: true, message: t('pages.menuCenter.selectCategoryRequired') }]}
                            style={{ marginBottom: 12 }}
                          >
                            <Select placeholder={t('pages.menuCenter.selectCategory')} allowClear>
                              {flatCategories.map(cat => (
                                <Select.Option key={cat.id} value={cat.id}>
                                  {cat.level && cat.level > 0 ? (
                                    <span style={{ color: '#666' }}>　└─ {cat.name}</span>
                                  ) : (
                                    <span style={{ fontWeight: 500 }}>{cat.name}</span>
                                  )}
                                </Select.Option>
                              ))}
                            </Select>
                          </Form.Item>
                          <Row gutter={12}>
                            <Col span={12}>
                              <Form.Item
                                name="basePrice"
                                label={t('pages.menuCenter.basePrice')}
                                rules={[
                                  { required: true, message: t('pages.menuCenter.basePriceRequired') },
                                  { type: 'number', message: t('pages.menuCenter.validNumber') }
                                ]}
                                style={{ marginBottom: 12 }}
                              >
                                <InputNumber style={{ width: '100%' }} placeholder="0.00" precision={2} />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item
                                name="cost"
                                label={t('pages.menuCenter.cost')}
                                rules={[
                                  { type: 'number', message: t('pages.menuCenter.validNumber') },
                                  {
                                    validator: (_, value) => {
                                      if (value !== undefined && value !== null && value !== '' && value < 0) {
                                        return Promise.reject(new Error(t('pages.menuCenter.costCannotBeNegative')))
                                      }
                                      return Promise.resolve()
                                    }
                                  }
                                ]}
                                style={{ marginBottom: 12 }}
                              >
                                <InputNumber style={{ width: '100%' }} placeholder="0.00" precision={2} />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Form.Item
                            name="isActive"
                            label={t('pages.menuCenter.status')}
                            valuePropName="checked"
                            style={{ marginBottom: 12 }}
                          >
                            <Switch checkedChildren={t('pages.menuCenter.active')} unCheckedChildren={t('pages.menuCenter.inactive')} />
                          </Form.Item>
                          {/* 商品范围（仅主店可配置） */}
                          {isMain && (
                            <>
                              <Form.Item
                                name="scope"
                                label="商品范围"
                                initialValue="BRAND"
                                style={{ marginBottom: 12 }}
                              >
                                <Select>
                                  <Select.Option value="BRAND">品牌商品（全部门店）</Select.Option>
                                  <Select.Option value="STORE_EXCLUSIVE">店铺专属</Select.Option>
                                </Select>
                              </Form.Item>
                              <Form.Item noStyle shouldUpdate={(prev, cur) => prev.scope !== cur.scope}>
                                {({ getFieldValue }) => getFieldValue('scope') === 'STORE_EXCLUSIVE' && (
                                  <Form.Item
                                    name="visibleStoreIds"
                                    label="可见门店"
                                    rules={[{ required: true, message: '请至少选择一个可见门店', type: 'array', min: 1 }]}
                                    style={{ marginBottom: 0 }}
                                  >
                                    <Select mode="multiple" placeholder="选择可见门店">
                                      {organizations.map((o: any) => (
                                        <Select.Option key={o.id} value={o.id}>
                                          {o.orgName}
                                          {o.orgType === 'MAIN' ? ' (主店)' : o.orgType === 'FRANCHISE' ? ' (加盟)' : ' (分店)'}
                                        </Select.Option>
                                      ))}
                                    </Select>
                                  </Form.Item>
                                )}
                              </Form.Item>
                            </>
                          )}
                        </Col>
                      </Row>
                    </Card>
                  </div>
                )
              },
              {
                key: 'modifiers',
                label: '自定义选项配置',
                children: (
                  <Form.Item
                    name="itemModifiers"
                    label={
                      <Space>
                        <span>自定义选项配置</span>
                        <Tooltip title="为商品配置自定义选项组，包括选择规则、默认选项和价格">
                          <Button type="link" size="small" style={{ padding: 0 }}>
                            ?
                          </Button>
                        </Tooltip>
                      </Space>
                    }
                  >
                    <ItemModifierConfigInput
                      modifierGroups={modifierGroups}
                      t={t}
                    />
                  </Form.Item>
                )
              }
            ]}
          />

          <Form.Item style={{ textAlign: 'right', marginBottom: 0, marginTop: 16 }}>
            <Space>
              <Button onClick={() => setItemModalVisible(false)}>
                {t('pages.menuCenter.cancel')}
              </Button>
              <Button type="primary" htmlType="submit" loading={loading.creating}>
                {editingItem ? t('pages.menuCenter.update') : t('pages.menuCenter.create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 属性类型创建/编辑模态框 */}
      <Modal
        title={editingAttributeType ? t('pages.menuCenter.editAttributeType') : t('pages.menuCenter.createAttributeType')}
        open={attributeTypeModalVisible}
        onCancel={() => setAttributeTypeModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={attributeTypeForm}
          layout="vertical"
          onFinish={handleAttributeTypeSubmit}
        >
          <Form.Item
            name="name"
            label={t('pages.menuCenter.attributeTypeName')}
            rules={[
              { required: true, message: t('pages.menuCenter.attributeTypeNameRequired') },
              { whitespace: true, message: t('pages.menuCenter.attributeTypeNameNoWhitespace') }
            ]}
          >
            <Input placeholder={t('pages.menuCenter.attributeTypeNamePlaceholder')} maxLength={255} />
          </Form.Item>

          <Form.Item
            name="displayName"
            label={t('pages.menuCenter.displayName')}
            rules={[
              { required: true, message: t('pages.menuCenter.displayNameRequired') }
            ]}
          >
            <Input placeholder={t('pages.menuCenter.displayNamePlaceholder')} maxLength={255} />
          </Form.Item>

          <Form.Item
            name="inputType"
            initialValue="select"
            hidden
          >
            <Input value="select" />
          </Form.Item>

          <Divider>{t('pages.menuCenter.optionSettings')}</Divider>
          
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Typography.Text strong>{t('pages.menuCenter.optionList')}</Typography.Text>
              <Button 
                type="dashed" 
                size="small"
                icon={<PlusOutlined />}
                onClick={() => {
                  const currentOptions = attributeTypeForm.getFieldValue('options') || [];
                  const newOptions = [...currentOptions, {
                    id: `temp_${Date.now()}`,
                    value: '',
                    displayName: '',
                    priceModifier: 0
                  }];
                  attributeTypeForm.setFieldValue('options', newOptions);
                }}
              >
                {t('pages.menuCenter.addOption')}
              </Button>
            </div>
            
            <Form.Item name="options" initialValue={[]}>
              <Form.List name="options">
                {(fields, { remove }) => (
                  <div>
                    {fields.map(({ key, name, ...restField }) => (
                      <Card key={key} size="small" style={{ marginBottom: 8 }}>
                        <Row gutter={8} align="middle">
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'value']}
                              label={t('pages.menuCenter.optionValue')}
                              rules={[
                                { required: true, message: t('pages.menuCenter.optionValueRequired') },
                                { whitespace: true, message: t('pages.menuCenter.optionValueNoWhitespace') }
                              ]}
                              style={{ marginBottom: 0 }}
                            >
                              <Input placeholder={t('pages.menuCenter.optionValuePlaceholder')} size="small" />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'displayName']}
                              label={t('pages.menuCenter.displayName')}
                              rules={[
                                { required: true, message: t('pages.menuCenter.displayNameRequired') }
                              ]}
                              style={{ marginBottom: 0 }}
                            >
                              <Input placeholder={t('pages.menuCenter.displayNameOptionPlaceholder')} size="small" />
                            </Form.Item>
                          </Col>
                          <Col span={5}>
                            <Form.Item
                              {...restField}
                              name={[name, 'priceModifier']}
                              label={t('pages.menuCenter.priceModifier')}
                              initialValue={0}
                              style={{ marginBottom: 0 }}
                            >
                              <InputNumber 
                                placeholder="0.00" 
                                precision={2}
                                size="small"
                                style={{ width: '100%' }}
                              />
                            </Form.Item>
                          </Col>
                          <Col span={4}>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              height: '100%', 
                              paddingTop: '24px',
                              color: '#666',
                              fontSize: '12px'
                            }}>
                              {t('pages.menuCenter.sortByCreateOrder')}
                            </div>
                          </Col>
                          <Col span={3}>
                            <Button 
                              type="text" 
                              danger 
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => remove(name)}
                              style={{ marginTop: 24 }}
                            />
                          </Col>
                        </Row>
                      </Card>
                    ))}
                    
                    {fields.length === 0 && (
                      <div style={{ 
                        textAlign: 'center', 
                        padding: '20px', 
                        backgroundColor: '#fafafa', 
                        borderRadius: '6px',
                        border: '1px dashed #d9d9d9'
                      }}>
                        <Typography.Text type="secondary">
                          {t('pages.menuCenter.noOptionsYet')}
                        </Typography.Text>
                      </div>
                    )}
                  </div>
                )}
              </Form.List>
            </Form.Item>
          </div>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setAttributeTypeModalVisible(false)}>
                {t('pages.menuCenter.cancel')}
              </Button>
              <Button type="primary" htmlType="submit" loading={loading.creating}>
                {editingAttributeType ? t('pages.menuCenter.update') : t('pages.menuCenter.create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 属性选项创建/编辑模态框 */}
      <Modal
        title={editingAttributeOption ? t('pages.menuCenter.editAttributeOption') : t('pages.menuCenter.createAttributeOption')}
        open={attributeOptionModalVisible}
        onCancel={() => setAttributeOptionModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={attributeOptionForm}
          layout="vertical"
          onFinish={handleAttributeOptionSubmit}
        >
          <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6 }}>
            <Typography.Text strong style={{ color: '#0369a1' }}>{t('pages.menuCenter.fillExample')}</Typography.Text>
            <div style={{ marginTop: 8 }}>
              <Typography.Text>{t('pages.menuCenter.iceOptionExample')}</Typography.Text>
              <ul style={{ margin: '4px 0', paddingLeft: 20, fontSize: '12px' }}>
                <li>选项值: <Typography.Text code>normal_ice</Typography.Text> → 显示名称: 正常冰</li>
                <li>选项值: <Typography.Text code>light_ice</Typography.Text> → 显示名称: 少冰</li>
                <li>选项值: <Typography.Text code>more_ice</Typography.Text> → 显示名称: 多冰</li>
                <li>选项值: <Typography.Text code>no_ice</Typography.Text> → 显示名称: 去冰</li>
              </ul>
            </div>
          </div>

          <Form.Item
            name="value"
            label={
              <Space>
                {t('pages.menuCenter.optionValue')}
                <Tooltip title={t('pages.menuCenter.optionValueTooltip')}>
                  <Button type="link" size="small" style={{ padding: 0 }}>?</Button>
                </Tooltip>
              </Space>
            }
            rules={[
              { required: true, message: t('pages.menuCenter.optionValueRequired') },
              { whitespace: true, message: t('pages.menuCenter.optionValueNoWhitespace') }
            ]}
          >
            <Input 
              placeholder={t('pages.menuCenter.optionValueExamplePlaceholder')} 
              maxLength={255}
              addonBefore={t('pages.menuCenter.systemStorage')}
            />
          </Form.Item>

          <Form.Item
            name="displayName"
            label={
              <Space>
                {t('pages.menuCenter.displayName')}
                <Tooltip title={t('pages.menuCenter.displayNameTooltip')}>
                  <Button type="link" size="small" style={{ padding: 0 }}>?</Button>
                </Tooltip>
              </Space>
            }
            rules={[
              { required: true, message: t('pages.menuCenter.displayNameRequired') }
            ]}
          >
            <Input 
              placeholder={t('pages.menuCenter.displayNameExamplePlaceholder')} 
              maxLength={255}
              addonBefore={t('pages.menuCenter.userDisplay')}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="priceModifier"
                label={t('pages.menuCenter.priceModifier')}
                rules={[
                  { type: 'number', message: t('pages.menuCenter.validNumberRequired') }
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="0.00"
                  precision={2}
                  formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value?.replace(/$\s?|(,*)/g, '') as any}
                />
              </Form.Item>
            </Col>
          </Row>


          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setAttributeOptionModalVisible(false)}>
                {t('pages.menuCenter.cancel')}
              </Button>
              <Button type="primary" htmlType="submit" loading={loading.creating}>
                {editingAttributeOption ? t('pages.menuCenter.update') : t('pages.menuCenter.create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 加料创建/编辑模态框 */}
      <Modal
        title={editingAddon ? t('pages.menuCenter.editModifier') : t('pages.menuCenter.createModifier')}
        open={addonModalVisible}
        onCancel={() => setAddonModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          layout="vertical"
          onFinish={handleSaveAddon}
          initialValues={editingAddon || {
            name: '',
            description: '',
            price: 0,
            cost: 0,
            trackInventory: false,
            currentStock: 0,
            isActive: true
          }}
        >
          <Form.Item
            name="name"
            label={t('pages.menuCenter.modifierName')}
            rules={[{ required: true, message: t('pages.menuCenter.modifierNameRequired') }]}
          >
            <Input placeholder={t('pages.menuCenter.modifierNamePlaceholder')} maxLength={50} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('pages.menuCenter.description')}
            rules={[{ required: true, message: t('pages.menuCenter.descriptionRequired') }]}
          >
            <Input.TextArea 
              placeholder={t('pages.menuCenter.descriptionPlaceholder')} 
              rows={3} 
              maxLength={200}
              showCount
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="price"
                label={t('pages.menuCenter.priceLabel')}
                rules={[
                  { required: true, message: t('pages.menuCenter.priceRequired') },
                  { type: 'number', min: 0, message: t('pages.menuCenter.priceCannotBeNegative') }
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder={t('pages.menuCenter.pricePlaceholder')}
                  precision={2}
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="cost"
                label={t('pages.menuCenter.costLabel')}
                rules={[
                  { required: true, message: t('pages.menuCenter.costRequired') },
                  { type: 'number', min: 0, message: t('pages.menuCenter.costCannotBeNegative') }
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder={t('pages.menuCenter.costPlaceholder')}
                  precision={2}
                  min={0}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="trackInventory" valuePropName="checked">
            <Space>
              <Switch />
              <span>{t('pages.menuCenter.enableInventory')}</span>
            </Space>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => 
              prevValues.trackInventory !== currentValues.trackInventory
            }
          >
            {({ getFieldValue }) => {
              const trackInventory = getFieldValue('trackInventory')
              return trackInventory ? (
                <Form.Item
                  name="currentStock"
                  label={t('pages.menuCenter.currentStock')}
                  rules={[
                    { required: true, message: t('pages.menuCenter.currentStockRequired') },
                    { type: 'number', min: 0, message: t('pages.menuCenter.stockCannotBeNegative') }
                  ]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder={t('pages.menuCenter.currentStockPlaceholder')}
                    min={0}
                    precision={0}
                  />
                </Form.Item>
              ) : null
            }}
          </Form.Item>

          <Form.Item name="isActive" valuePropName="checked">
            <Space>
              <Switch defaultChecked />
              <span>{t('pages.menuCenter.activeStatus')}</span>
            </Space>
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setAddonModalVisible(false)}>
                {t('pages.menuCenter.cancel')}
              </Button>
              <Button type="primary" htmlType="submit" loading={loading.creating}>
                {editingAddon ? t('pages.menuCenter.update') : t('pages.menuCenter.create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 套餐创建/编辑模态框 */}
      <Modal
        title={editingCombo ? t('pages.menuCenter.editCombo') : t('pages.menuCenter.createCombo')}
        open={comboModalVisible}
        onCancel={() => setComboModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form
          form={comboForm}
          layout="vertical"
          onFinish={handleSaveCombo}
          initialValues={{
            name: '',
            description: '',
            categoryId: undefined,
            basePrice: 0,
            discount: 0,
            discountType: 'fixed',
            isActive: true,
            comboItems: [],
            imageUrl: undefined,
            itemGroups: [],
            availabilityRules: undefined
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label={t('pages.menuCenter.comboName')}
                rules={[{ required: true, message: t('pages.menuCenter.comboNameRequired') }]}
              >
                <Input placeholder={t('pages.menuCenter.comboNamePlaceholder')} maxLength={100} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="categoryId"
                label="所属分类"
                rules={[{ required: true, message: '请选择分类' }]}
              >
                <Select placeholder="请选择分类">
                  {flatCategories.map(cat => (
                    <Select.Option key={cat.id} value={cat.id}>
                      {cat.level && cat.level > 0 ? (
                        <span style={{ color: '#666' }}>
                          　└─ {cat.name}
                        </span>
                      ) : (
                        <span style={{ fontWeight: 500 }}>
                          {cat.name}
                        </span>
                      )}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea
              placeholder={t('pages.menuCenter.comboDescriptionPlaceholder')}
              rows={3}
              maxLength={500}
              showCount
            />
          </Form.Item>

          {/* 套餐图片上传 */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              套餐图片
            </label>
            <ComboImageUpload
              comboId={editingCombo?.id}
              imageUrl={comboImageUrl}
              onImageChange={setComboImageUrl}
              onFileSelect={setComboImageFile}
            />
          </div>

          <Form.Item name="isActive" valuePropName="checked">
            <Space>
              <Switch defaultChecked />
              <span>{t('pages.menuCenter.activeStatus')}</span>
            </Space>
          </Form.Item>

          {/* 套餐类型选择 */}
          <Form.Item label="套餐类型">
            <Radio.Group
              value={comboType}
              disabled={!!editingCombo}
              onChange={(e) => {
                const newType = e.target.value as 'fixed' | 'selection';
                setComboType(newType);
                // 切换类型时清空对应数据，避免数据混用
                if (newType === 'fixed') {
                  setComboItemGroups([]);
                  // 清除 comboItems 中的 groupId
                  const items = comboForm.getFieldValue('comboItems') || [];
                  comboForm.setFieldsValue({
                    comboItems: items.map((i: any) => ({ ...i, groupId: undefined }))
                  });
                } else {
                  // 切到可选套餐时清空固定商品列表，用户从分组重新配置
                  comboForm.setFieldsValue({ comboItems: [] });
                }
              }}
            >
              <Radio.Button value="fixed">固定套餐</Radio.Button>
              <Radio.Button value="selection">可选套餐</Radio.Button>
            </Radio.Group>
            <div style={{ color: '#999', fontSize: 12, marginTop: 6 }}>
              {editingCombo ? (
                <span style={{ color: '#ff4d4f' }}>
                  ⚠️ 套餐创建后不能修改类型
                </span>
              ) : (
                <>
                  {comboType === 'fixed'
                    ? '包含固定商品，价格由各商品自动汇总'
                    : '顾客从各分组中自行选择，套餐价格手动设定'}
                </>
              )}
            </div>
          </Form.Item>

          <Divider>{t('pages.menuCenter.comboItemsConfig')}</Divider>

          {comboType === 'fixed' ? (
            <>
              {/* 固定套餐：商品列表 + 自动计算价格 */}
              <Form.Item name="comboItems" label="">
                <ComboItemsInput
                  allItems={allItems}
                  onPriceChange={(totalPrice) => {
                    comboForm.setFieldsValue({ basePrice: fromMinorUnit(totalPrice) });
                  }}
                  t={t}
                />
              </Form.Item>

              <Divider>套餐定价</Divider>

              <Form.Item noStyle shouldUpdate={(prev, curr) =>
                prev.basePrice !== curr.basePrice ||
                prev.discount !== curr.discount ||
                prev.discountType !== curr.discountType
              }>
                {({ getFieldValue }) => {
                  const basePrice = Number(getFieldValue('basePrice')) || 0;
                  const discount = Number(getFieldValue('discount')) || 0;
                  const discountType = getFieldValue('discountType') || 'fixed';
                  let discountAmount = discountType === 'fixed' ? discount : basePrice * (discount / 100);
                  const finalPrice = Math.max(0, basePrice - discountAmount);

                  return (
                    <div>
                      {/* 商品总价展示 */}
                      <div style={{ padding: '12px 16px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, marginBottom: 16 }}>
                        <Row align="middle">
                          <Col span={12}><Typography.Text type="secondary">商品总价（自动计算）</Typography.Text></Col>
                          <Col span={12} style={{ textAlign: 'right' }}>
                            <Typography.Text strong style={{ fontSize: 18, color: '#0369a1' }}>${basePrice.toFixed(2)}</Typography.Text>
                          </Col>
                        </Row>
                      </div>

                      {/* 折扣设置（可选） */}
                      <div style={{ marginBottom: 16 }}>
                        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                          折扣设置（可选）
                        </Typography.Text>
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item name="discountType" label="折扣类型" style={{ marginBottom: 0 }}>
                              <Select onChange={() => comboForm.setFieldValue('discount', 0)}>
                                <Select.Option value="fixed">固定金额</Select.Option>
                                <Select.Option value="percentage">百分比</Select.Option>
                              </Select>
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="discount" label={discountType === 'percentage' ? '折扣 (%)' : '折扣 ($)'} rules={[{ type: 'number', min: 0 }]} style={{ marginBottom: 0 }}>
                              {discountType === 'percentage' ? (
                                <InputNumber style={{ width: '100%' }} precision={0} min={0} max={100} placeholder="0" />
                              ) : (
                                <InputNumber style={{ width: '100%' }} precision={2} min={0} placeholder="0.00" />
                              )}
                            </Form.Item>
                          </Col>
                        </Row>
                      </div>

                      {/* 最终售价展示 */}
                      {basePrice > 0 && (
                        <div style={{ padding: 16, backgroundColor: '#f6ffed', border: '2px solid #52c41a', borderRadius: 6 }}>
                          <Row align="middle">
                            <Col span={12}>
                              <Typography.Text strong style={{ fontSize: 16 }}>最终售价</Typography.Text>
                              {discountAmount > 0 && (
                                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                                  原价 ${basePrice.toFixed(2)} - 折扣 {discountType === 'percentage' ? `${discount}%` : `$${discount.toFixed(2)}`}
                                </div>
                              )}
                            </Col>
                            <Col span={12} style={{ textAlign: 'right' }}>
                              <Typography.Text strong style={{ fontSize: 24, color: '#52c41a' }}>${finalPrice.toFixed(2)}</Typography.Text>
                            </Col>
                          </Row>
                        </div>
                      )}
                    </div>
                  );
                }}
              </Form.Item>

              {/* 隐藏字段存储自动计算的价格 */}
              <Form.Item name="basePrice" hidden><InputNumber /></Form.Item>
            </>
          ) : (
            <>
              {/* 分组配置：用 shouldUpdate 确保 comboItems 变化时重新渲染 */}
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.comboItems !== curr.comboItems}>
                {({ getFieldValue }) => (
                  <ComboItemGroupsConfig
                    groups={comboItemGroups}
                    onGroupsChange={setComboItemGroups}
                    comboItems={getFieldValue('comboItems') || []}
                    onComboItemsChange={(items) => comboForm.setFieldsValue({ comboItems: items })}
                    allItems={allItems}
                  />
                )}
              </Form.Item>
              {/* comboItems 隐藏字段（分组配置通过 onComboItemsChange 写入） */}
              <Form.Item name="comboItems" hidden><Input /></Form.Item>

              <Divider>套餐定价</Divider>

              {/* 可选套餐：只设置基础价格 */}
              <Form.Item
                name="basePrice"
                label="套餐价格"
                rules={[{ required: true, message: '请填写套餐价格' }, { type: 'number', min: 0 }]}
              >
                <InputNumber precision={2} min={0} style={{ width: 200 }} placeholder="0.00" />
              </Form.Item>
              <div style={{ color: '#999', fontSize: 12, marginTop: -12, marginBottom: 16 }}>
                顾客选择分组商品后，各选项的额外费用将在此价格基础上累加
              </div>
            </>
          )}

          {/* 时段限制配置 */}
          <ComboAvailabilityConfig
            value={comboAvailabilityRules}
            onChange={setComboAvailabilityRules}
          />

          <Form.Item style={{ textAlign: 'right', marginBottom: 0, marginTop: 16 }}>
            <Space>
              <Button onClick={() => setComboModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={loading.creating}>
                {editingCombo ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {channelModal && (
        <ItemChannelConfig
          open={!!channelModal}
          itemId={channelModal.id}
          itemName={channelModal.name}
          onClose={() => setChannelModal(null)}
        />
      )}
    </Space>
  )
}

export default MenuCenter
