import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import obfuscator from 'vite-plugin-obfuscator'


// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const isServe = command === 'serve';
  const isBuild = command === 'build';
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG;

  return {
    plugins: [
      react(),
      tailwindcss(),

      // ✅ 只在生产环境混淆
      !isServe &&
      obfuscator({
        include: ['out/renderer/assets/*.js'],
        compact: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        rotateStringArray: true
      })
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    build: {
      sourcemap,
      minify: 'terser',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react')) return 'react'
              return 'vendor'
            }
          }
        }
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
        // 快手 AI 服务代理
        '/lz': {
          target: 'https://aiopenapi.kuaizi.cn/ai-open-platform-api/v1',
          changeOrigin: true,
          // 超时设置（用于长时间运行的请求）
          timeout: 300000,
        },
        // Jikeing 后端服务代理
        '/api': {
          target: isBuild ? 'https://api.jikeing.com' :'http://localhost:9181',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          timeout: 300000,
        },
      },
    },
  }
})
