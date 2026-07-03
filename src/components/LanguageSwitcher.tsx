import React from 'react'
import { useTranslation } from 'react-i18next'
import { SelectInput } from '@/components/ui-kit'

interface LanguageSwitcherProps {
  size?: 'small' | 'middle' | 'large'   // 兼容旧调用，样式统一由 kit 决定
  style?: React.CSSProperties
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ style }) => {
  const { i18n } = useTranslation()

  const handleLanguageChange = (lng: string) => {
    try {
      localStorage.setItem('app.lng', lng)
    } catch {}
    i18n.changeLanguage(lng)
  }

  return (
    <div style={{ minWidth: 140, ...style }}>
      <SelectInput
        className="w-full"
        value={i18n.language}
        onChange={(v) => handleLanguageChange(String(v))}
        options={[
          { label: '中文（简体）', value: 'zh-CN' },
          { label: '中文（繁體）', value: 'zh-TW' },
          { label: 'English', value: 'en' },
        ]}
      />
    </div>
  )
}

export default LanguageSwitcher
