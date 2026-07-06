import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  // loadEnv 的第三个参数指定前缀，返回的对象键会移除这个前缀
  // 例如：prefix='VITE_' 会让 VITE_API_BASE 变成 env.API_BASE
  const env = loadEnv(mode, process.cwd(), '')

  console.log('🔍 [VITE CONFIG] Mode:', mode)
  console.log('🔍 [VITE CONFIG] Loaded env:', {
    VITE_API_BASE: env.VITE_API_BASE,
    VITE_AUTH_BASE: env.VITE_AUTH_BASE,
    VITE_ITEM_MANAGE_BASE: env.VITE_ITEM_MANAGE_BASE,
    VITE_ORDER_API_BASE: env.VITE_ORDER_API_BASE,
    VITE_MAPBOX_TOKEN: env.VITE_MAPBOX_TOKEN ? '(exists)' : '(missing)'
  })

  return {
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    open: false,
    host: true, // 允许外部访问
    allowedHosts: [
      'localhost',
      '.trycloudflare.com', // 允许所有 Cloudflare Tunnel 域名
      '.ngrok.io', // 允许 ngrok
    ],
    proxy: {
      // 所有 API 请求通过 Traefik 网关 (localhost:8000)
      // 网关负责路由、认证(ForwardAuth)、限流等

      // Auth Service 代理 - 通过网关
      '/api/auth-service': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('🔄 [GATEWAY] Auth API Request:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('✅ [GATEWAY] Auth API Response:', proxyRes.statusCode, req.url);
          });
        }
      },
      // OAuth 端点 - 通过网关
      '/oauth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('🚨 [GATEWAY] OAuth Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('🔄 [GATEWAY] OAuth Request:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('✅ [GATEWAY] OAuth Response:', proxyRes.statusCode, req.url);
          });
        }
      },
      // Order Service 代理 - 通过网关
      '/api/order': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('🔄 [GATEWAY] Order API Request:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('✅ [GATEWAY] Order API Response:', proxyRes.statusCode, req.url);
          });
        }
      },
      // Item Management 代理 - 通过网关
      '/api/item-manage': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      // Finance Service 代理 - 通过网关
      '/api/finance': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      // Booking Service 代理 - 通过网关
      '/api/booking-service': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      // Subscription Service 代理 - 通过网关
      '/api/subscription-service': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      // Member Service 代理 - 通过网关
      '/api/member': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err, req) => {
            console.error('❌ [MEMBER] Proxy error:', err.message, req.url)
          })
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log('🔄 [MEMBER] →', req.method, req.url)
          })
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log('✅ [MEMBER] ←', proxyRes.statusCode, req.url)
          })
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  define: {
    // Auth Service - 使用相对路径，通过 Vite proxy 转发到网关
    'import.meta.env.VITE_API_BASE': JSON.stringify(
      env.VITE_API_BASE || '/api/auth-service/v1'
    ),
    'import.meta.env.VITE_AUTH_BASE': JSON.stringify(
      env.VITE_AUTH_BASE || ''
    ),
    'import.meta.env.VITE_AUTH_DISABLED': JSON.stringify(
      env.VITE_AUTH_DISABLED || 'false'
    ),
    'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify(
      env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAB2ATX6Vry7IHSDD'
    ),
    // Item Management - 使用环境变量或默认相对路径（通过代理）
    'import.meta.env.VITE_ITEM_MANAGE_BASE': JSON.stringify(
      env.VITE_ITEM_MANAGE_BASE || '/api/item-manage/v1'
    ),
    // Order Service - 使用环境变量或默认相对路径（通过代理）
    'import.meta.env.VITE_ORDER_API_BASE': JSON.stringify(
      env.VITE_ORDER_API_BASE || '/api/order/v1'
    ),
    // Uber Service API - 用于订单管理
    'import.meta.env.VITE_UBER_API_BASE': JSON.stringify(
      env.VITE_UBER_API_BASE || 'http://localhost:3004/api/uber/v1'
    ),
    // Mapbox API Token - 从环境变量加载
    'import.meta.env.VITE_MAPBOX_TOKEN': JSON.stringify(env.VITE_MAPBOX_TOKEN || ''),
  }
  }
})
