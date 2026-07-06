import { httpService } from './http'

const API_BASE = (import.meta.env.VITE_ITEM_MANAGE_BASE as string | undefined) ?? 'http://localhost:3000/api/item-manage/v1'

export const LOCALE_LABELS: Record<string, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'en': 'English',
  'fr': 'Français',
}

export interface BrandLocaleConfig {
  brand_id: string
  supported_locales: string[]
  default_locale: string
  available_locales: string[]
}

export async function getBrandLocale(): Promise<BrandLocaleConfig> {
  const res = await httpService.get<BrandLocaleConfig>(`${API_BASE}/brand-locale`)
  return res.data
}

export async function setBrandLocale(supported_locales: string[], default_locale: string): Promise<BrandLocaleConfig> {
  const res = await httpService.put<BrandLocaleConfig>(`${API_BASE}/brand-locale`, { supported_locales, default_locale })
  return res.data
}
