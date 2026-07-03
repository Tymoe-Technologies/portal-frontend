import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState, Spinner, AlertBox } from '@/components/ui-kit'
import RecipeByAttributeManager from './RecipeByAttributeManager'
import { getItem, getItemAttributes, type Item, type ItemAttribute } from '@/services/item-management'

interface RecipeManagementByAttributeProps {
  itemId?: string
}

const RecipeManagementByAttribute: React.FC<RecipeManagementByAttributeProps> = ({ itemId }) => {
  const { t } = useTranslation()
  const [item, setItem] = useState<any>(null)  // 使用any避免类型错误
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (itemId) {
      loadItem()
    } else {
      setItem(null)
    }
  }, [itemId])

  const loadItem = async () => {
    if (!itemId) return

    setLoading(true)
    try {
      // 获取商品基本信息
      const itemData = await getItem(itemId)
      
      // 获取商品属性
      const itemAttributes = await getItemAttributes(itemId)
      
      // 组合数据
      const itemWithAttributes: any = {
        ...itemData,
        attributes: itemAttributes.map((attr: ItemAttribute) => ({
          name: attr.attributeType?.name || '',
          label: attr.attributeType?.displayName || '',
          options: (attr.attributeType?.options || []).map((opt) => ({
            value: opt.value,
            label: opt.displayName
          }))
        }))
      }
      
      console.log('加载的商品数据:', itemWithAttributes)
      setItem(itemWithAttributes)
    } catch (error: any) {
      console.error('加载商品失败:', error)
      setItem(null)
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

  // 检查商品是否有属性定义
  if (!item.attributes || item.attributes.length === 0) {
    return <AlertBox type="warning" title="商品未配置属性" description="此商品没有配置属性（如杯型、温度等），无法使用按属性组合管理配方。请先在商品管理中配置属性。" />
  }

  // 转换属性格式
  const itemAttributes = (item.attributes || []).map((attr: any) => ({
    name: attr.name || attr.key,
    label: attr.label || attr.name,
    options: (attr.options || attr.values || []).map((opt: any) => ({
      value: typeof opt === 'string' ? opt : opt.value,
      label: typeof opt === 'string' ? opt : opt.label || opt.value
    }))
  }))

  return (
    <RecipeByAttributeManager
      itemId={item.id}
      itemName={item.name}
      itemAttributes={itemAttributes}
    />
  )
}

export default RecipeManagementByAttribute
