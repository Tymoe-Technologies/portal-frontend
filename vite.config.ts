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
      // 注意：/api/item-manage 请求已通过环境变量配置为直接 CORS 请求到 https://tymoe.com
      // 不再使用 Vite 代理，前端直接向浏览器发送跨域请求
      // 因此禁用对 /api/item-manage 的所有代理
      // '/api/item-manage' 已禁用 - 使用环境变量VITE_ITEM_MANAGE_BASE直接CORS请求
      // Order Service 代理 - 指向已部署的域名服务
      '/api/order': {
        target: 'https://tymoe.com',
        changeOrigin: true,
        secure: true,
        ws: true,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('🔄 Order API Request:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('✅ Order API Response:', proxyRes.statusCode, req.url);
          });
        }
      },
      // Auth Service 代理 - 直连（auth-service 自身处理鉴权）
      '/api/auth-service': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('🔄 Auth API Request:', req.method, req.url);

            // 对于注册和登录请求，强制移除 Cookie 头部
            if (req.url?.includes('/identity/register') || req.url?.includes('/identity/login')) {
              const requestType = req.url.includes('/register') ? 'registration' : 'login'
              console.log(`🧹 Proxy: Removing cookies from ${requestType} request`);
              proxyReq.removeHeader('cookie');
              proxyReq.removeHeader('Cookie');
              proxyReq.removeHeader('authorization');
              proxyReq.removeHeader('Authorization');
            }
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('✅ Auth API Response:', proxyRes.statusCode, req.url);
          });
        }
      },
      // OAuth代理 - 直连
      '/oauth': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('🚨 OAuth Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('🔄 Sending OAuth Request to Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('✅ Received OAuth Response:', proxyRes.statusCode, req.url);
            if (proxyRes.statusCode >= 400) {
              console.log('❌ OAuth Error response detected for:', req.url);
            }
          });
        }
      },
      // Finance Service 代理 - 支付相关API
      '/api/finance': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        secure: false,
        ws: true
      },
      // Booking Service 代理 - 通过 Traefik 网关
      '/api/booking-service': {
        target: 'http://localhost:9080',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  define: {
    // 直接定义环境变量
    'import.meta.env.VITE_API_BASE': JSON.stringify('/api/auth-service/v1'),
    'import.meta.env.VITE_AUTH_BASE': JSON.stringify(''),
    'import.meta.env.VITE_AUTH_DISABLED': JSON.stringify('false'),
    'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify('0x4AAAAAAB2ATX6Vry7IHSDD'),
    // Item Management - 使用环境变量或默认的HTTPS地址（支持直接CORS访问）
    'import.meta.env.VITE_ITEM_MANAGE_BASE': JSON.stringify(
      env.VITE_ITEM_MANAGE_BASE || 'https://tymoe.com/api/item-manage/v1'
    ),
    // Order Service - 使用环境变量或默认的HTTPS地址（支持直接CORS访问）
    'import.meta.env.VITE_ORDER_API_BASE': JSON.stringify(
      env.VITE_ORDER_API_BASE || 'https://tymoe.com/api/order/v1'
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
