import { httpService } from './http'

const FINANCE_API_BASE = '/api/finance/v1'

export interface GiftCardConfig {
  id?: string
  tenantId: string
  enabled: boolean
  presetDenominations: number[]   // 单位：分，如 [1000, 2500, 5000, 10000]
  cardImageUrl: string | null
  cardImageUrls: string[]          // 多款卡面图片 URL 数组
  createdAt?: string
  updatedAt?: string
}

export interface GiftCardConfigDTO {
  enabled?: boolean
  presetDenominations?: number[]
  cardImageUrl?: string | null
  cardImageUrls?: string[]
}

export interface IssuedGiftCard {
  cardId: string
  cardNumber: string
  pin: string                     // 明文 PIN，仅发行时返回一次
  initialBalance: number          // 分
  currency: string
}

export const getGiftCardConfig = async (): Promise<GiftCardConfig | null> => {
  try {
    const res = await httpService.get<{ success: boolean; data: GiftCardConfig }>(
      `${FINANCE_API_BASE}/admin/gift-cards/config`
    )
    return res.data?.data ?? null
  } catch (err: any) {
    if (err.response?.status === 404) return null
    throw err
  }
}

export const upsertGiftCardConfig = async (dto: GiftCardConfigDTO): Promise<GiftCardConfig> => {
  const res = await httpService.put<{ success: boolean; data: GiftCardConfig }>(
    `${FINANCE_API_BASE}/admin/gift-cards/config`,
    dto
  )
  if (!res.data?.success || !res.data?.data) throw new Error('保存礼品卡配置失败')
  return res.data.data
}

export const issueGiftCard = async (params: {
  initialBalance: number
  currency?: string
  recipientEmail?: string
  note?: string
}): Promise<IssuedGiftCard> => {
  const res = await httpService.post<{ success: boolean; data: IssuedGiftCard }>(
    `${FINANCE_API_BASE}/admin/gift-cards/issue`,
    params
  )
  if (!res.data?.success || !res.data?.data) throw new Error('发行礼品卡失败')
  return res.data.data
}

export const uploadGiftCardImage = async (file: File): Promise<{ url: string; config: GiftCardConfig }> => {
  const formData = new FormData()
  formData.append('image', file)
  const res = await httpService.post<{ success: boolean; data: { url: string; config: GiftCardConfig } }>(
    `${FINANCE_API_BASE}/admin/gift-cards/config/image`,
    formData
  )
  if (!res.data?.success || !res.data?.data) throw new Error('图片上传失败')
  return res.data.data
}

export const deleteGiftCardImage = async (): Promise<GiftCardConfig> => {
  const res = await httpService.delete<{ success: boolean; data: { config: GiftCardConfig } }>(
    `${FINANCE_API_BASE}/admin/gift-cards/config/image`
  )
  if (!res.data?.success || !res.data?.data) throw new Error('删除图片失败')
  return res.data.data.config
}

// 上传一张图片追加到多卡面列表
export const uploadGiftCardImageToList = async (file: File): Promise<{ url: string; config: GiftCardConfig }> => {
  const formData = new FormData()
  formData.append('image', file)
  const res = await httpService.post<{ success: boolean; data: { url: string; config: GiftCardConfig } }>(
    `${FINANCE_API_BASE}/admin/gift-cards/config/images`,
    formData
  )
  if (!res.data?.success || !res.data?.data) throw new Error('图片上传失败')
  return res.data.data
}

// 从多卡面列表删除指定 URL
export const deleteGiftCardImageFromList = async (url: string): Promise<GiftCardConfig> => {
  const res = await httpService.delete<{ success: boolean; data: { config: GiftCardConfig } }>(
    `${FINANCE_API_BASE}/admin/gift-cards/config/images`,
    { data: { url } }
  )
  if (!res.data?.success || !res.data?.data) throw new Error('删除图片失败')
  return res.data.data.config
}
