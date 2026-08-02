// 手绘树坚果（核桃/杏仁类）轮廓，跟 PeanutIcon 同一套 tabler 描边风格（24x24、2px 圆角）。
// 花生是豆科植物，坚果（核桃/杏仁/腰果等）是完全不同的过敏原分类，两者不能共用一个图标，
// 常见图标库里也没有像样的"树坚果"图标，所以手绘一个跟花生形状明显区分开的版本：
// 一个椭圆壳身 + 中间一道波浪纹（模拟核桃壳的皱褶纹路）。
interface TreeNutIconProps {
  width?: number
  height?: number
  color?: string
}

export function TreeNutIcon({ width = 24, height = 24, color = 'currentColor' }: TreeNutIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="12" rx="6" ry="8" />
      <path d="M12 4c-1.5 2-1.5 4 0 6c1.5 2 1.5 4 0 6c-1.5 2-1.5 4 0 4" />
    </svg>
  )
}
