import React, { useEffect, useState } from 'react'
import { Plus, ArrowLeft, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { formatPrice } from '../../utils/priceConverter'
import { getCurrencySymbol } from '../../config/currencyConfig'
import {
  getSalesChannels,
  type SalesChannel
} from '../../services/order-config'
import {
  queryChannelPrices,
  queryComboprices,
  batchSaveAllPrices,
  type SourcePriceProfile
} from '../../services/channel-pricing'
import { itemManagementService } from '../../services/item-management'
import { SectionCard, SelectInput, Btn, AlertBox, EmptyState, Tabs, Spinner, toast } from '@/components/ui-kit'
import ItemPricingModal from './ItemPricingModal'

interface PriceItem {
  id: string
  name?: string
  basePrice?: number
  price?: number
  priceDiff?: number
  strategy?: string
  modified: boolean
  editMode: 'none' | 'price' | 'fixed' | 'percentage'
  editPrice?: number
  editPriceDiff?: number
  editPercentage?: number
  editFinalPrice?: number
  profilePriceId?: string
}

const PricingManagement: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [selectedChannelId, setSelectedChannelId] = useState<string>('')
  const [selectedChannel, setSelectedChannel] = useState<SalesChannel | null>(null)
  const [channels, setChannels] = useState<SalesChannel[]>([])
  const [, setPriceProfile] = useState<SourcePriceProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<PriceItem[]>([])
  const [addons, setAddons] = useState<PriceItem[]>([])
  const [combos, setCombos] = useState<PriceItem[]>([])
  const [, setStrategyType] = useState<'absolute' | 'fixed' | 'percentage'>('absolute')
  const [activeTab, setActiveTab] = useState<'items' | 'combos'>('items')

  // 顶部定价器状态
  const [pricingMode, setPricingMode] = useState<'none' | 'percentage' | 'adjustment'>('none')
  const [globalPercentage, setGlobalPercentage] = useState<number | undefined>(undefined)
  const [globalAdjustment, setGlobalAdjustment] = useState<number | undefined>(undefined)

  // 商品定价详情模态框
  const [pricingModalVisible, setPricingModalVisible] = useState(false)
  const [selectedItem, setSelectedItem] = useState<{
    item: PriceItem
    setter: (items: PriceItem[]) => void
    list: PriceItem[]
  } | null>(null)

  const tenantId = localStorage.getItem('organization_id') || ''

  // 加载渠道列表
  useEffect(() => {
    if (!tenantId) {
      toast.error(t('organization.selectOrg'))
      return
    }
    loadChannels()
  }, [tenantId])

  // 从URL参数读取预选渠道并自动选中
  useEffect(() => {
    if (channels.length === 0) return
    const channelIdParam = searchParams.get('channelId')
    const sourceParam = searchParams.get('source')
    let channel: SalesChannel | undefined
    if (channelIdParam) {
      channel = channels.find(c => c.id === channelIdParam)
    } else if (sourceParam) {
      channel = channels.find(c => c.sourceType === sourceParam)
    }
    if (channel) {
      handleChannelChange(channel.id)
    }
  }, [searchParams, channels])

  const loadChannels = async () => {
    try {
      setLoading(true)
      const data = await getSalesChannels()
      setChannels(data)
    } catch (error) {
      toast.error(t('pages.orderConfig.loadChannelsFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 处理渠道选择变化
  const handleChannelChange = (channelId: string) => {
    setSelectedChannelId(channelId)
    const channel = channels.find(c => c.id === channelId)
    setSelectedChannel(channel || null)
    if (channel) {
      loadPriceProfile(channelId)
    }
  }

  // 加载渠道的价格配置
  const loadPriceProfile = async (channelId: string) => {
    try {
      setLoading(true)

      const channel = channels.find(c => c.id === channelId)
      if (!channel) {
        toast.error(t('pages.orderConfig.channelInfoIncomplete'))
        return
      }

      const sourceCode = channel.sourceType || channel.sourceName

      const [itemPricesResponse, comboPricesResponse, itemsResponse, combosResponse] = await Promise.all([
        queryChannelPrices(sourceCode),
        queryComboprices(sourceCode),
        itemManagementService.getItems({ limit: 1000 }),
        itemManagementService.getCombos({ limit: 100 })
      ])

      const allItemsData = itemsResponse.data || []
      const allCombosData = combosResponse.data || []

      const itemPriceMap = new Map(
        (itemPricesResponse?.prices || []).map(item => [item.itemId, { price: item.price, id: item.id }])
      )
      const comboPriceMap = new Map(
        (comboPricesResponse?.prices || []).map(combo => [combo.comboId, { price: combo.price, id: combo.id }])
      )

      const itemsList = allItemsData.map(item => {
        const priceData = itemPriceMap.get(item.id)
        const overridePrice = priceData?.price
        const profilePriceId = priceData?.id
        const editMode: 'none' | 'price' | 'fixed' | 'percentage' =
          overridePrice !== undefined ? 'price' : 'none'

        return {
          id: item.id,
          name: item.name,
          basePrice: Number(item.basePrice),
          price: overridePrice,
          priceDiff: undefined,
          strategy: undefined,
          profilePriceId,
          modified: false,
          editMode,
          editPrice: editMode === 'price' ? overridePrice : undefined,
          editPriceDiff: undefined,
          editPercentage: undefined,
          editFinalPrice: undefined
        }
      })

      const combosList = allCombosData.map(combo => {
        const priceData = comboPriceMap.get(combo.id)
        const overridePrice = priceData?.price
        const profilePriceId = priceData?.id
        const editMode: 'none' | 'price' | 'fixed' | 'percentage' =
          overridePrice !== undefined ? 'price' : 'none'

        return {
          id: combo.id,
          name: combo.name,
          basePrice: Number(combo.basePrice),
          price: overridePrice,
          priceDiff: undefined,
          strategy: undefined,
          profilePriceId,
          modified: false,
          editMode,
          editPrice: editMode === 'price' ? overridePrice : undefined,
          editPriceDiff: undefined,
          editPercentage: undefined,
          editFinalPrice: undefined
        }
      })

      setItems(itemsList)
      setAddons([])
      setCombos(combosList)
      setPriceProfile(null)
      setStrategyType('absolute')
    } catch (error) {
      setPriceProfile(null)
      setItems([])
      setAddons([])
      setCombos([])
      setStrategyType('absolute')
      toast.error(t('pages.orderConfig.loadPricesFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 批量应用定价器到选中的商品
  const applyGlobalPricing = () => {
    if (pricingMode === 'none') {
      toast.warning(t('pages.orderConfig.selectPricingMethodFirst'))
      return
    }

    if (pricingMode === 'percentage' && globalPercentage === undefined) {
      toast.warning(t('pages.orderConfig.enterPercentageWarning'))
      return
    }

    if (pricingMode === 'adjustment' && globalAdjustment === undefined) {
      toast.warning(t('pages.orderConfig.enterAdjustmentAmountWarning'))
      return
    }

    const updateList = (list: PriceItem[]) => list.map(item => {
      if (item.basePrice === undefined) return item

      if (pricingMode === 'percentage') {
        const finalPrice = Number(item.basePrice) * (1 + globalPercentage! / 100)
        return {
          ...item,
          editMode: 'percentage' as const,
          editPrice: undefined,
          editPercentage: globalPercentage,
          editFinalPrice: finalPrice,
          modified: true
        }
      } else {
        const finalPrice = Number(item.basePrice) + globalAdjustment!
        return {
          ...item,
          editMode: 'price' as const,
          editPrice: finalPrice,
          editPercentage: undefined,
          editFinalPrice: undefined,
          modified: true
        }
      }
    })

    setItems(updateList(items))
    setAddons(updateList(addons))
    setCombos(updateList(combos))

    if (pricingMode === 'percentage') {
      toast.success(t('pages.orderConfig.batchAppliedPercentage', {
        sign: globalPercentage! > 0 ? '+' : '',
        value: globalPercentage
      }))
    } else {
      toast.success(t('pages.orderConfig.batchAppliedAdjustment', {
        sign: globalAdjustment! > 0 ? '+' : '',
        symbol: getCurrencySymbol(),
        value: globalAdjustment
      }))
    }
  }

  // 重置定价器
  const resetGlobalPricing = () => {
    setPricingMode('none')
    setGlobalPercentage(undefined)
    setGlobalAdjustment(undefined)
  }

  // 处理保存
  const handleSave = async () => {
    if (!selectedChannel) {
      toast.error(t('pages.orderConfig.selectChannelFirst'))
      return
    }

    const sourceCode = selectedChannel.sourceType || selectedChannel.sourceName
    if (!sourceCode) {
      toast.error(t('pages.orderConfig.channelCodeIncomplete'))
      return
    }

    try {
      setSaving(true)

      const itemPrices = items
        .filter(item => item.modified)
        .map(item => {
          let finalPrice: number | undefined = undefined
          if (item.editMode === 'percentage') {
            finalPrice = item.editFinalPrice
          } else if (item.editMode === 'price') {
            finalPrice = item.editPrice
          }
          return { itemId: item.id, price: finalPrice }
        })

      const comboPrices = combos
        .filter(combo => combo.modified)
        .map(combo => {
          let finalPrice: number | undefined = undefined
          if (combo.editMode === 'percentage') {
            finalPrice = combo.editFinalPrice
          } else if (combo.editMode === 'price') {
            finalPrice = combo.editPrice
          }
          return { comboId: combo.id, price: finalPrice, profilePriceId: combo.profilePriceId }
        })

      if (itemPrices.length === 0 && comboPrices.length === 0) {
        toast.info(t('pages.orderConfig.noChanges'))
        setSaving(false)
        return
      }

      const batchData: {
        items?: Array<{ sourceCode: string; itemId: string; price: number }>
        combos?: Array<{ sourceCode: string; comboId: string; price: number }>
      } = {}

      if (itemPrices.length > 0) {
        batchData.items = itemPrices
          .filter(p => p.price !== undefined)
          .map(p => ({ sourceCode, itemId: p.itemId, price: p.price! }))
      }

      if (comboPrices.length > 0) {
        batchData.combos = comboPrices
          .filter(p => p.price !== undefined)
          .map(p => ({ sourceCode, comboId: p.comboId, price: p.price! }))
      }

      await batchSaveAllPrices(batchData)

      toast.success(t('common.success'))
      loadPriceProfile(selectedChannel.id)
    } catch (error) {
      toast.error(t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const renderPriceCards = (list: PriceItem[], setter: (items: PriceItem[]) => void) => {
    if (list.length === 0) {
      return <div className="py-10"><EmptyState title={t('common.noData')} /></div>
    }

    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {list.map(item => {
          // 计算显示的最终价格
          let displayPrice = item.basePrice
          let priceLabel = t('pages.orderConfig.originalPrice')
          let priceColor = 'text-slate-500'

          if (item.editMode === 'price' && item.editPrice !== undefined) {
            displayPrice = item.editPrice
            priceLabel = t('pages.orderConfig.fixedPriceLabel')
            priceColor = 'text-blue-600'
          } else if (item.editMode === 'percentage' && item.editFinalPrice !== undefined) {
            displayPrice = item.editFinalPrice
            priceLabel = `${item.editPercentage && item.editPercentage > 0 ? '+' : ''}${item.editPercentage?.toFixed(1)}%`
            priceColor = item.editPercentage && item.editPercentage > 0 ? 'text-green-600' : 'text-amber-600'
          }

          return (
            <div
              key={item.id}
              onClick={() => {
                setSelectedItem({ item, setter, list })
                setPricingModalVisible(true)
              }}
              className={`cursor-pointer rounded-lg border p-3 transition-colors hover:border-slate-300 hover:shadow-sm ${
                item.modified ? 'border-2 border-amber-400 bg-amber-50/50' : 'border-slate-200 bg-white'
              }`}
            >
              {/* 商品名称 */}
              <div className="mb-2 truncate text-[13px] font-medium leading-tight text-slate-700">
                {item.name || 'N/A'}
              </div>

              {/* 价格显示 */}
              <div className={`mb-1 text-lg font-semibold ${priceColor}`}>
                {displayPrice !== undefined ? formatPrice(displayPrice) : 'N/A'}
              </div>

              {/* 价格标签 */}
              <div className="text-[11px] text-slate-400">
                {priceLabel}
                {item.modified && <span className="ml-1 text-amber-500">●</span>}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="px-6">
      <div className="mb-6 flex items-center">
        <Btn variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => navigate('/order-config')} className="mr-4">
          {t('common.back')}
        </Btn>
        <h2 className="m-0 text-xl font-semibold text-slate-800">{t('pages.orderConfig.pricingManagement')}</h2>
      </div>

      <SectionCard>
        {!tenantId && (
          <div className="mb-4">
            <AlertBox type="warning" title={t('organization.selectOrg')} />
          </div>
        )}

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-slate-700">{t('pages.orderConfig.selectChannel')}</label>
          <div className="max-w-md">
            <SelectInput
              value={selectedChannelId}
              onChange={handleChannelChange}
              placeholder={t('pages.orderConfig.selectChannelPlaceholder')}
              disabled={loading || channels.length === 0}
              options={channels.map(channel => ({ value: channel.id, label: channel.sourceName }))}
            />
          </div>
        </div>

        {selectedChannel && (
          <>
            <div className="mb-6 rounded-lg bg-slate-50 p-4">
              <p className="m-0 mb-2 text-slate-600">
                {t('pages.orderConfig.selectedChannel')}: <strong>{selectedChannel.sourceName}</strong>
              </p>
              <p className="m-0 text-xs text-slate-400">
                {selectedChannel.description && `${t('pages.orderConfig.channelDescriptionLabel')}: ${selectedChannel.description}`}
              </p>
            </div>

            {/* 顶部定价器 */}
            <div className="mb-5">
              <SectionCard
                title={t('pages.orderConfig.batchPricingTool')}
                action={<Btn variant="secondary" size="sm" onClick={resetGlobalPricing}>{t('pages.orderConfig.reset')}</Btn>}
              >
                <div className="flex flex-wrap items-end gap-4">
                  <div className="w-56">
                    <div className="mb-2 text-[13px] font-medium text-slate-700">{t('pages.orderConfig.pricingMethod')}</div>
                    <SelectInput
                      value={pricingMode === 'none' ? '' : pricingMode}
                      onChange={(value) => setPricingMode((value || 'none') as any)}
                      placeholder={t('pages.orderConfig.selectPricingMethod')}
                      options={[
                        { value: 'percentage', label: t('pages.orderConfig.percentageDiscount') },
                        { value: 'adjustment', label: t('pages.orderConfig.adjustmentAmount') }
                      ]}
                    />
                  </div>

                  {pricingMode === 'percentage' && (
                    <>
                      <div className="w-40">
                        <div className="mb-2 text-[13px] font-medium text-slate-700">{t('pages.orderConfig.discountPercentage')}</div>
                        <div className="flex items-center rounded-lg border border-slate-200 bg-white px-3 focus-within:outline-2 focus-within:outline-slate-900">
                          <input
                            type="number"
                            min={-100}
                            max={100}
                            step={1}
                            value={globalPercentage ?? ''}
                            onChange={(e) => setGlobalPercentage(e.target.value === '' ? undefined : Number(e.target.value))}
                            placeholder={t('pages.orderConfig.percentagePlaceholderShort')}
                            className="w-full bg-transparent py-2 text-sm text-slate-700 focus:outline-none"
                          />
                          <span className="text-sm text-slate-400">%</span>
                        </div>
                      </div>
                      {globalPercentage !== undefined && (
                        <div className="min-w-56 flex-1">
                          <AlertBox
                            type="info"
                            title={
                              <span className="text-[13px]">
                                {t('pages.orderConfig.preview')}: {formatPrice(10000)} →
                                <strong className={`ml-1.5 ${globalPercentage > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                                  {formatPrice(Math.round(10000 * (1 + globalPercentage / 100)))}
                                </strong>
                              </span>
                            }
                          />
                        </div>
                      )}
                      <Btn variant="primary" onClick={applyGlobalPricing} icon={<Plus size={16} />}>
                        {t('pages.orderConfig.applyToAll')}
                      </Btn>
                    </>
                  )}

                  {pricingMode === 'adjustment' && (
                    <>
                      <div className="w-40">
                        <div className="mb-2 text-[13px] font-medium text-slate-700">{t('pages.orderConfig.adjustmentAmountLabel')}</div>
                        <div className="flex items-center rounded-lg border border-slate-200 bg-white px-3 focus-within:outline-2 focus-within:outline-slate-900">
                          <span className="text-sm text-slate-400">{getCurrencySymbol()}</span>
                          <input
                            type="number"
                            step={0.5}
                            value={globalAdjustment ?? ''}
                            onChange={(e) => setGlobalAdjustment(e.target.value === '' ? undefined : Number(e.target.value))}
                            placeholder={t('pages.orderConfig.adjustmentPlaceholder')}
                            className="w-full bg-transparent py-2 pl-2 text-sm text-slate-700 focus:outline-none"
                          />
                        </div>
                      </div>
                      {globalAdjustment !== undefined && (
                        <div className="min-w-56 flex-1">
                          <AlertBox
                            type="info"
                            title={
                              <span className="text-[13px]">
                                {t('pages.orderConfig.preview')}: {formatPrice(10000)} →
                                <strong className={`ml-1.5 ${globalAdjustment > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                                  {formatPrice(10000 + Math.round(globalAdjustment * 100))}
                                </strong>
                              </span>
                            }
                          />
                        </div>
                      )}
                      <Btn variant="primary" onClick={applyGlobalPricing} icon={<Plus size={16} />}>
                        {t('pages.orderConfig.applyToAll')}
                      </Btn>
                    </>
                  )}
                </div>
              </SectionCard>
            </div>

            {loading ? (
              <div className="py-10 text-center"><Spinner /></div>
            ) : (
              <>
                <Tabs
                  value={activeTab}
                  onChange={(k) => setActiveTab(k as any)}
                  items={[
                    { key: 'items', label: t('pages.orderConfig.itemPricingTab', { count: items.length }) },
                    { key: 'combos', label: t('pages.orderConfig.comboPricingTab', { count: combos.length }) }
                  ]}
                />
                <div className="mt-4">
                  {activeTab === 'items' && renderPriceCards(items, setItems)}
                  {activeTab === 'combos' && renderPriceCards(combos, setCombos)}
                </div>
              </>
            )}

            <div className="mt-6 flex items-center justify-between">
              <div className="text-[13px] text-slate-400">
                {saving && <span className="inline-flex items-center gap-2"><Spinner className="h-4 w-4" />{t('pages.orderConfig.savingInProgress')}</span>}
              </div>
              <Btn variant="primary" icon={<Save size={16} />} onClick={handleSave} loading={saving} disabled={loading}>
                {t('pages.orderConfig.applyAll')}
              </Btn>
            </div>
          </>
        )}
      </SectionCard>

      {/* 商品定价详情模态框 */}
      {selectedItem && selectedChannel && (
        <ItemPricingModal
          visible={pricingModalVisible}
          itemId={selectedItem.item.id}
          itemName={selectedItem.item.name || 'N/A'}
          basePrice={selectedItem.item.basePrice || 0}
          currentPrice={selectedItem.item.editPrice}
          sourceCode={selectedChannel.sourceType || selectedChannel.sourceName}
          sourceName={selectedChannel.sourceName}
          isExternalChannel={!selectedChannel.isSystemChannel}
          onClose={() => {
            setPricingModalVisible(false)
            setSelectedItem(null)
          }}
          onSave={(newPrice) => {
            const { item, setter, list } = selectedItem
            const updated = list.map(i =>
              i.id === item.id
                ? { ...i, editMode: 'price' as const, editPrice: newPrice, modified: true }
                : i
            )
            setter(updated)
            toast.success(t('pages.orderConfig.priceUpdated'))
          }}
        />
      )}
    </div>
  )
}

export default PricingManagement
