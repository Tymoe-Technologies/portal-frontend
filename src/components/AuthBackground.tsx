import React from 'react'

// 认证页背景：深 slate 底 + 琥珀色柔光 + 细网格（无紫色）
const AuthBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-slate-900">
      {/* 琥珀色柔光 */}
      <div className="absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-amber-500/10 blur-3xl" />
      {/* slate 柔光 */}
      <div className="absolute -bottom-40 -left-28 h-96 w-96 rounded-full bg-slate-400/10 blur-3xl" />
      {/* 细网格 */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
    </div>
  )
}

export default AuthBackground
