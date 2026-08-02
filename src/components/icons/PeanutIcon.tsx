// 花生轮廓，跟 tabler 图标同一套线条风格（24x24 viewBox、2px 圆角描边）。
// 图案取自 line-md:peanut（已经是 stroke-width 2、round cap/join，跟 tabler 视觉完全一致，
// 只是去掉了它自带的描边动画），比之前自己瞎画的轮廓更像花生。
interface PeanutIconProps {
  width?: number
  height?: number
  color?: string
}

export function PeanutIcon({ width = 24, height = 24, color = 'currentColor' }: PeanutIconProps) {
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
      <path d="M12 2c2.5 0 5 2 5 5c0 1.13-.37 2.16-1 3c-.28.38-.5 1-.5 1.5c0 .5.2.91.5 1.23c.93.98 1.5 2.31 1.5 3.77c0 3.04-2.46 5.5-5.5 5.5c-3.04 0-5.5-2.46-5.5-5.5c0-1.46.57-2.79 1.5-3.77c.3-.32.5-.73.5-1.23c0-.5-.22-1.12-.5-1.5c-.63-.84-1-1.87-1-3c0-2.76 2-5 5-5Z" />
      <circle cx="13" cy="15" r="1" fill={color} stroke="none" />
      <circle cx="13" cy="6" r="1" fill={color} stroke="none" />
      <circle cx="11" cy="17" r="1" fill={color} stroke="none" />
      <circle cx="14" cy="18" r="1" fill={color} stroke="none" />
    </svg>
  )
}
