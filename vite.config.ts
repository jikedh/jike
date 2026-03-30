import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  // Web 部署使用绝对路径，确保二级路由刷新后资源加载正确
  base: '/',
  server: {
    port: 3004,
    host: '0.0.0.0',
    // 开发环境代理配置（解决跨域问题）
    proxy: {
      // AI 服务代理
      '/v1': {
        target: 'https://toapis.com',
        changeOrigin: true,
        // 超时设置（用于长时间运行的请求）
        timeout: 300000,
      },
      // ZeakAI 服务代理
      '/mj': {
        target: 'https://zeakai-api.api4midjourney.com',
        changeOrigin: true,
        // 超时设置
        timeout: 300000,
      },
    },
  },
})