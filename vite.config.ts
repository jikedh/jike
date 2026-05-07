import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/renderer"),
      shared: path.resolve(__dirname, "./src/shared"),
      service: path.resolve(__dirname, "./src/service"),
      main: path.resolve(__dirname, "./src/main"),
      preload: path.resolve(__dirname, "./src/preload"),
    },
  },
  build: {
    // sourcemap: true,
    // outDir: "out",
    // minify: "terser",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react")) return "react";
            return "vendor";
          }
        },
      },
    },
  },
  // Web 部署使用绝对路径，确保二级路由刷新后资源加载正确
  base: "/",
  server: {
    port: 3004,
    host: "0.0.0.0",
    // 开发环境代理配置（解决跨域问题）
    proxy: {
      // Jikeing 后端服务代理 - 统一使用云端
      "/api": {
        target: "https://api.jikeing.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        timeout: 300000,
      },
    },
  },
});
