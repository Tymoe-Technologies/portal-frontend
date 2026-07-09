import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getBrandLocale, setBrandLocale, LOCALE_LABELS } from '@/services/brand-locale'
import { SectionCard, Btn, Spinner, toast } from '@/components/ui-kit'

export default function BrandLocaleSettings() {
  const { t } = useTranslation()
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
      .catch(() => toast.error(t('pages.brandLocaleSettings.loadFailed')))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      // 所有可用语言都支持，只需保存默认语言
      await setBrandLocale(available, defaultLocale)
      toast.success(t('pages.brandLocaleSettings.saveSuccess'))
    } catch {
      toast.error(t('pages.brandLocaleSettings.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner className="py-16" />

  return (
    <div className="max-w-lg">
      <SectionCard title={t('pages.brandLocaleSettings.pageTitle')} action={<Btn variant="primary" loading={saving} onClick={handleSave}>{t('common.save')}</Btn>}>
        <p className="text-sm text-slate-500 mb-4">
          {t('pages.brandLocaleSettings.pageDesc')}
        </p>

        <p className="text-sm font-medium text-slate-700 mb-2">{t('pages.brandLocaleSettings.defaultLocaleLabel')}</p>
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
