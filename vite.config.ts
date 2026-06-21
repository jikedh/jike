import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// Tauri 2 前端构建配置
// frontendDist: "../dist" 由 src-tauri/tauri.conf.json 引用
// devUrl: http://localhost:3004 由 src-tauri/tauri.conf.json 引用
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/renderer"),
      shared: path.resolve(__dirname, "./src/shared"),
      service: path.resolve(__dirname, "./src/service"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // 修复 Tauri 打包后白屏报错：
        // "Cannot access 'ge' before initialization"
        //
        // 根因：把 react/react-dom 拆成独立 chunk 后，
        // vendor chunk（包含 sonner）在模块顶层用到了
        // `ge.createElement(...)`（sonner 的 Loader/Icon 是
        // 顶层调用 React.createElement 初始化常量）。
        // Tauri 2 的 asset protocol 下 modulepreload 偶尔
        // 不保证同步顺序，导致 vendor 求值时 `ge` 仍处于
        // TDZ，从而整段 vendor 加载失败 → 渲染白屏。
        //
        // 修复：让 react/react-dom 与 sonner / scheduler
        // 等所有用到顶层 React.* 的依赖留在同一个 chunk，
        // 从根本上消除跨 chunk 初始化顺序问题。
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // 把 React 主包及任何顶层使用 React.* 的第三方库
          // 放进同一个 chunk（"react"）。这是修复打包后白屏
          // 报错的关键：sonner 等库在模块顶层调用
          // React.createElement(...) 初始化 SVG 常量，
          // 如果与 react/react-dom 不在同一个 chunk，Tauri
          // 下 modulepreload 偶发异步顺序会触发 TDZ。
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/") ||
            id.includes("node_modules/sonner/")
          ) {
            return "react";
          }
          // 其它第三方库全部合并到 vendor（保持小体积优势）
          return "vendor";
        },
      },
    },
  },
  base: "/",
  server: {
    port: 3004,
    host: "0.0.0.0",
    strictPort: true,
    proxy: {
      "/api": {
        target: "https://api.jikeing.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        timeout: 300000,
      },
    },
  },
  // Tauri 推荐的开发配置：避免 HMR 跨域
  clearScreen: false,
});
