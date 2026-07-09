import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { itemManagementService } from '@/services/item-management'
import { ImageUpload, toast } from '@/components/ui-kit'

interface ComboImageUploadProps {
  comboId?: string  // 编辑时传入，新建时为空
  imageUrl?: string
  onImageChange: (url: string | undefined) => void
  onFileSelect?: (file: File | null) => void  // 新建时用来传递待上传文件
}

export const ComboImageUpload: React.FC<ComboImageUploadProps> = ({
  comboId,
  imageUrl,
  onImageChange,
  onFileSelect,
}) => {
  const { t } = useTranslation()
  const [uploading, setUploading] = useState(false)
  // 本地预览 URL（仅新建套餐时使用，还未上传到服务器）
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | undefined>()

  // 当外部 imageUrl 变化（如保存后回填真实 URL），清除本地预览
  useEffect(() => {
    if (imageUrl) setLocalPreviewUrl(undefined)
  }, [imageUrl])

  const displayUrl = imageUrl || localPreviewUrl

  const handlePick = async (file: File) => {
    if (!comboId) {
      // 新建模式：本地预览，保存套餐时再上传
      setLocalPreviewUrl(URL.createObjectURL(file))
      onFileSelect?.(file)
      return
    }
    setUploading(true)
    try {
      const result = await itemManagementService.uploadComboImage(comboId, file)
      onImageChange(result.image.url)
      toast.success(t('pages.menuCenter.itemImageUploadSuccess'))
    } catch (error: any) {
      toast.error(error?.response?.data?.error || t('pages.menuCenter.itemImageUploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    if (!comboId) {
      // 新建模式：清除本地预览
      setLocalPreviewUrl(undefined)
      onFileSelect?.(null)
      onImageChange(undefined)
      return
    }
    setUploading(true)
    try {
      await itemManagementService.deleteComboImage(comboId)
      onImageChange(undefined)
      toast.success(t('pages.menuCenter.itemImageDeleteSuccess'))
    } catch (error: any) {
      toast.error(error?.response?.data?.error || t('pages.menuCenter.itemImageDeleteFailed'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <ImageUpload
      url={displayUrl}
      loading={uploading}
      onPick={handlePick}
      onRemove={handleRemove}
      hint={t('pages.menuCenter.comboImageUpload.hint')}
    />
  )
}

export default ComboImageUpload
