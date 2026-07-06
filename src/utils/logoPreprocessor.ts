/**
 * Logo 图片预处理工具
 *
 * 功能：
 * 1. 去除白色/浅色背景
 * 2. 增强对比度
 * 3. 转换为纯黑白图片
 * 4. 输出优化后的图片（PNG with transparency）
 *
 * 使用场景：在上传 Logo 到 Cloudinary 之前进行预处理
 */

export interface PreprocessOptions {
  // 背景去除阈值（0-255，越高越激进）默认：240
  backgroundThreshold?: number;

  // 黑白阈值（0-255，低于此值视为黑色）默认：128
  binarizeThreshold?: number;

  // 对比度增强系数（1.0 = 不变，> 1.0 = 增强）默认：1.5
  contrastFactor?: number;

  // 是否反色（黑底白字 -> 白底黑字）默认：false
  invert?: boolean;

  // 输出尺寸限制（像素）默认：800
  maxSize?: number;
}

export interface PreprocessResult {
  // 处理后的图片 Blob（PNG 格式）
  blob: Blob;

  // 处理后的图片 Data URL（用于预览）
  dataUrl: string;

  // 图片尺寸
  width: number;
  height: number;

  // 处理统计
  stats: {
    originalSize: number; // 原始文件大小（字节）
    processedSize: number; // 处理后文件大小（字节）
    removedPixels: number; // 移除的背景像素数
    blackPixels: number; // 黑色像素数
    whitePixels: number; // 白色像素数
  };
}

export class LogoPreprocessor {
  /**
   * 预处理图片文件
   */
  static async preprocessImage(
    file: File,
    options: PreprocessOptions = {}
  ): Promise<PreprocessResult> {
    const {
      backgroundThreshold = 240,
      binarizeThreshold = 128,
      contrastFactor = 1.5,
      invert = false,
      maxSize = 800,
    } = options;

    console.log('[LogoPreprocessor] 开始处理图片:', {
      fileName: file.name,
      fileSize: `${(file.size / 1024).toFixed(2)} KB`,
      options,
    });

    // 1. 加载图片
    const img = await this.loadImageFromFile(file);
    console.log('[LogoPreprocessor] 图片加载完成:', {
      width: img.width,
      height: img.height,
    });

    // 2. 调整尺寸（如果太大）
    const { canvas, ctx } = this.createCanvas(img, maxSize);

    // 3. 获取像素数据
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // 4. 预处理流程
    const processed = this.processImageData(imageData, {
      backgroundThreshold,
      binarizeThreshold,
      contrastFactor,
      invert,
    });

    // 5. 写回 Canvas
    ctx.putImageData(processed.imageData, 0, 0);

    // 6. 转换为 Blob 和 Data URL
    const blob = await this.canvasToBlob(canvas);
    const dataUrl = canvas.toDataURL('image/png');

    console.log('[LogoPreprocessor] ✅ 处理完成:', {
      processedSize: `${(blob.size / 1024).toFixed(2)} KB`,
      ...processed.stats,
    });

    return {
      blob,
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      stats: {
        originalSize: file.size,
        processedSize: blob.size,
        ...processed.stats,
      },
    };
  }

  /**
   * 从 File 加载图片
   */
  private static loadImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  /**
   * 创建 Canvas 并调整图片尺寸
   */
  private static createCanvas(
    img: HTMLImageElement,
    maxSize: number
  ): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');

    // 计算缩放比例
    let width = img.width;
    let height = img.height;

    if (width > maxSize || height > maxSize) {
      const scale = Math.min(maxSize / width, maxSize / height);
      width = Math.floor(width * scale);
      height = Math.floor(height * scale);
      console.log('[LogoPreprocessor] 缩放图片:', {
        from: `${img.width}x${img.height}`,
        to: `${width}x${height}`,
        scale: scale.toFixed(2),
      });
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // 绘制图片
    ctx.drawImage(img, 0, 0, width, height);

    return { canvas, ctx };
  }

  /**
   * 处理图片数据
   */
  private static processImageData(
    imageData: ImageData,
    options: Required<Omit<PreprocessOptions, 'maxSize'>>
  ): {
    imageData: ImageData;
    stats: {
      removedPixels: number;
      blackPixels: number;
      whitePixels: number;
    };
  } {
    const { width, height, data } = imageData;
    const { backgroundThreshold, binarizeThreshold, contrastFactor, invert } = options;

    let removedPixels = 0;
    let blackPixels = 0;
    let whitePixels = 0;

    // 处理每个像素
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // 1. 先检查原图 alpha 通道（如果已经是透明的，保持透明）
      if (a < 128) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 0; // 透明
        removedPixels++;
        continue;
      }

      // 2. 转换为灰度
      let gray = Math.floor(r * 0.299 + g * 0.587 + b * 0.114);

      // 3. 背景去除：检测浅色背景
      // 使用更严格的白色检测：RGB 三个通道都要高
      const isWhiteBackground = r > backgroundThreshold && g > backgroundThreshold && b > backgroundThreshold;

      if (isWhiteBackground) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 0; // 透明
        removedPixels++;
        continue;
      }

      // 3. 对比度增强
      gray = this.enhanceContrast(gray, contrastFactor);

      // 4. 二值化（纯黑白）
      const isBlack = gray < binarizeThreshold;
      const finalValue = isBlack ? 0 : 255;

      // 5. 反色（可选）
      const outputValue = invert ? 255 - finalValue : finalValue;

      // 6. 统计
      if (outputValue === 0) {
        blackPixels++;
      } else {
        whitePixels++;
      }

      // 7. 写入结果
      data[i] = outputValue;
      data[i + 1] = outputValue;
      data[i + 2] = outputValue;
      data[i + 3] = 255; // 不透明
    }

    return {
      imageData,
      stats: {
        removedPixels,
        blackPixels,
        whitePixels,
      },
    };
  }

  /**
   * 对比度增强
   */
  private static enhanceContrast(value: number, factor: number): number {
    // 对比度增强公式：((value - 128) * factor) + 128
    const enhanced = (value - 128) * factor + 128;
    return Math.max(0, Math.min(255, enhanced));
  }

  /**
   * Canvas 转 Blob
   */
  private static canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        },
        'image/png',
        1.0
      );
    });
  }

  /**
   * 快速预览（降低质量，加快处理速度）
   */
  static async quickPreview(
    file: File,
    options: PreprocessOptions = {}
  ): Promise<string> {
    const result = await this.preprocessImage(file, {
      ...options,
      maxSize: 400, // 降低分辨率加快预览
    });
    return result.dataUrl;
  }
}
