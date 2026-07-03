import { useEffect, useState } from 'react'
import { getBrandLocale, setBrandLocale, LOCALE_LABELS } from '@/services/brand-locale'
import { SectionCard, Btn, Spinner, toast } from '@/components/ui-kit'

export default function BrandLocaleSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [available, setAvailable] = useState<string[]>([])
  const [defaultLocale, setDefaultLocale] = useState<string>('zh-CN')

  useEffect(() => {
    getBrandLocale()
      .then(data => {
        setAvailable(data.available_locales)
        setDefaultLocale(data.default_locale)
      })
      .catch(() => toast.error('获取语言配置失败'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      // 所有可用语言都支持，只需保存默认语言
      await setBrandLocale(available, defaultLocale)
      toast.success('语言配置已保存')
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner className="py-16" />

  return (
    <div className="max-w-lg">
      <SectionCard title="菜单语言设置" action={<Btn variant="primary" loading={saving} onClick={handleSave}>保存</Btn>}>
        <p className="text-sm text-slate-500 mb-4">
          商品名称支持所有语言的翻译。设置默认语言后，当某语言没有对应译名时将显示默认语言的名称。
        </p>

        <p className="text-sm font-medium text-slate-700 mb-2">默认语言（无对应译名时显示）</p>
        <div className="space-y-1.5">
          {available.map(locale => (
            <label key={locale} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
              <input
                type="radio"
                name="brand-default-locale"
                checked={defaultLocale === locale}
                onChange={() => setDefaultLocale(locale)}
                className="w-4 h-4 accent-slate-900 cursor-pointer"
              />
              {LOCALE_LABELS[locale] ?? locale}
            </label>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
