import React, { useState, useRef, useCallback } from 'react'
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Modal, Btn } from '@/components/ui-kit'

interface Props {
  open: boolean
  imageSrc: string        // 原图 dataURL
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

/**
 * 从 canvas 获取裁剪后的 Blob
 */
async function getCroppedBlob(
  image: HTMLImageElement,
  crop: PixelCrop
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height

  canvas.width = Math.round(crop.width * scaleX)
  canvas.height = Math.round(crop.height * scaleY)

  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  )

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas toBlob 失败'))
      },
      'image/png'
    )
  })
}

/**
 * 初始居中裁剪区域（默认 80% 宽度）
 */
function getDefaultCrop(width: number, height: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 80 }, width / height, width, height),
    width,
    height
  )
}

const LogoCropModal: React.FC<Props> = ({ open, imageSrc, onConfirm, onCancel }) => {
  const imgRef = useRef<HTMLImageElement>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [confirming, setConfirming] = useState(false)

  // 图片加载后设置初始裁剪区域
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    setCrop(getDefaultCrop(width, height))
  }, [])

  const handleConfirm = async () => {
    if (!completedCrop || !imgRef.current) return
    setConfirming(true)
    try {
      const blob = await getCroppedBlob(imgRef.current, completedCrop)
      onConfirm(blob)
    } finally {
      setConfirming(false)
    }
  }

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      onCancel()
      // 关闭后重置裁剪状态
      setCrop(undefined)
      setCompletedCrop(undefined)
    }
  }

  return (
    <Modal
      title="裁剪 Logo"
      open={open}
      onOpenChange={handleOpenChange}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Btn variant="secondary" onClick={onCancel}>取消</Btn>
          <Btn variant="primary" loading={confirming} onClick={handleConfirm}>确认裁剪</Btn>
        </div>
      }
    >
      <div className="flex justify-center py-2">
        {imageSrc && (
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            style={{ maxHeight: 420 }}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="裁剪预览"
              onLoad={onImageLoad}
              style={{ maxHeight: 420, maxWidth: '100%', display: 'block' }}
            />
          </ReactCrop>
        )}
      </div>
      <p className="text-xs text-slate-400 mt-2 mb-0">
        拖动裁剪框四个角/边可自由调整大小，拖动裁剪框内部可移动位置
      </p>
    </Modal>
  )
}

export default LogoCropModal
