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
                manualChunks(id) {
                    if (id.includes("node_modules")) {
                        if (id.includes("react")) return "react";
                        return "vendor";
                    }
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
