import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { compression } from 'vite-plugin-compression2'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Gzip 预压缩：构建时生成 .gz 文件，Nginx 直接使用 gzip_static
    compression({
      algorithms: ['gzip', 'brotliCompress'],
      threshold: 1024, // 仅压缩大于 1KB 的文件
      exclude: [/\.(png|jpg|jpeg|gif|webp|ico)$/i],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  // Web 部署使用绝对路径，确保二级路由刷新后资源加载正确
  base: '/',

  // 生产环境移除 console.log 和 debugger，减少包体积并避免信息泄露
  esbuild: {
    drop: ['console', 'debugger'],
  },

  // ==================== 构建优化 ====================
  build: {
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 使用 esbuild 压缩（Vite 7 默认）
    minify: 'esbuild',
    // 代码分割策略
    rollupOptions: {
      output: {
        // 手动分包：将大型第三方库拆分为独立 chunk
        manualChunks: {
          // React 核心
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // ReactFlow 画布引擎
          'vendor-xyflow': ['@xyflow/react'],
          // 富文本编辑器
          'vendor-tiptap': ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-mention'],
          // UI 图标库
          'vendor-icons': ['@tabler/icons-react', 'lucide-react'],
          // 图片灯箱
          'vendor-lightbox': ['yet-another-react-lightbox'],
          // 工具库
          'vendor-utils': ['axios', 'zustand', 'sonner', 'clsx', 'tailwind-merge', 'idb-keyval'],
          // Radix UI 组件
          'vendor-radix': ['radix-ui', 'class-variance-authority'],
          // 拖拽库
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
        // 优化 chunk 文件名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // chunk 大小警告阈值
    chunkSizeWarningLimit: 500,
    // 启用源码映射（生产环境可关闭以减小体积）
    sourcemap: false,
  },

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
