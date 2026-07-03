import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState, Spinner, AlertBox } from '@/components/ui-kit'
import RecipeByModifierManager from './RecipeByModifierManager'
import { getItem, itemManagementService, type Item, type ItemModifierGroup } from '@/services/item-management'

interface RecipeManagementByModifiersProps {
  itemId?: string
}

const RecipeManagementByModifiers: React.FC<RecipeManagementByModifiersProps> = ({ itemId }) => {
  const { t } = useTranslation()
  const [item, setItem] = useState<Item | null>(null)
  const [modifierGroups, setModifierGroups] = useState<ItemModifierGroup[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (itemId) {
      loadItemAndModifiers()
    } else {
      setItem(null)
      setModifierGroups([])
    }
  }, [itemId])

  const loadItemAndModifiers = async () => {
    if (!itemId) return

    setLoading(true)
    try {
      // 获取商品基本信息
      const itemData = await getItem(itemId)
      console.log('📦 加载的商品数据:', itemData)
      setItem(itemData)
      
      // 使用专门的 API 获取商品的自定义选项组
      // getItem 返回的数据可能没有完整的 modifierGroups，需要单独调用
      const modifiers = await itemManagementService.getItemModifiers(itemId)
      console.log('📦 商品的自定义选项组:', modifiers)
      setModifierGroups(modifiers)
    } catch (error: any) {
      console.error('加载商品失败:', error)
      setItem(null)
      setModifierGroups([])
    } finally {
      setLoading(false)
    }
  }

  if (!itemId) {
    return <div className="py-16"><EmptyState title={t('pages.recipeGuide.selectItemFirst')} /></div>
  }

  if (loading) {
    return <div className="text-center py-16"><Spinner className="w-8 h-8 mx-auto text-slate-400" /></div>
  }

  if (!item) {
    return <AlertBox type="error" title="商品不存在" description="无法加载商品信息，请重新选择" />
  }

  // 无论是否有自定义选项，都允许创建配方指引
  // 如果没有自定义选项，将显示"默认配方"供用户配置
  return (
    <RecipeByModifierManager
      itemId={item.id}
      itemName={item.name || '未命名商品'}
      modifierGroups={modifierGroups}
    />
  )
}

export default RecipeManagementByModifiers

