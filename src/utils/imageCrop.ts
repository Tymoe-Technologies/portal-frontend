/**
 * 图片裁剪工具函数
 * 基于 react-easy-crop 的 onCropComplete 回调结果，将裁剪区域从原图中提取出来
 */
export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 从原始图片 URL 中提取裁剪区域，返回 Blob
 */
export async function getCroppedImageBlob(
  imageSrc: string,
  croppedAreaPixels: CropArea,
  rotation = 0
): Promise<Blob> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  const maxSize = Math.max(image.width, image.height)
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2))

  // 设置 canvas 大小为安全区域（旋转时不会截掉边缘）
  canvas.width = safeArea
  canvas.height = safeArea

  // 移动到中心，旋转，再移回来
  ctx.translate(safeArea / 2, safeArea / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.translate(-safeArea / 2, -safeArea / 2)

  // 将原图绘制到 canvas 中心
  ctx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5
  )

  // 从 canvas 中提取裁剪区域
  const data = ctx.getImageData(0, 0, safeArea, safeArea)

  canvas.width = croppedAreaPixels.width
  canvas.height = croppedAreaPixels.height

  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width * 0.5 - croppedAreaPixels.x),
    Math.round(0 - safeArea / 2 + image.height * 0.5 - croppedAreaPixels.y)
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.src = src
  })
}
