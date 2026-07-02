import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en'
import zhCN from './locales/zh-CN'
import zhTW from './locales/zh-TW'
import fr from './locales/fr'

const resources = { en, 'zh-CN': zhCN, 'zh-TW': zhTW, fr }
const STORAGE_KEY = 'app.lng'
const fallbackLng = 'en'

function detectInitialLanguage(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return saved
  } catch {}
  const nav = (navigator.languages && navigator.languages[0]) || navigator.language || ''
  if (/zh\-TW|zh\-Hant/i.test(nav)) return 'zh-TW'
  if (/zh|zh\-CN|zh\-Hans/i.test(nav)) return 'zh-CN'
  return fallbackLng
}

i18n.use(initReactI18next).init({
  resources,
  lng: detectInitialLanguage(),
  fallbackLng,
  defaultNS: 'translation',
  interpolation: { escapeValue: false }
})

export default i18n
