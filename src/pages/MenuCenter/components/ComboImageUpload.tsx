import React, { useEffect, useState } from 'react'
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
      toast.success('图片上传成功')
    } catch (error: any) {
      toast.error(error?.response?.data?.error || '图片上传失败')
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
      toast.success('图片删除成功')
    } catch (error: any) {
      toast.error(error?.response?.data?.error || '图片删除失败')
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
      hint="支持 JPG、PNG、WebP，最大 5MB"
    />
  )
}

export default ComboImageUpload
