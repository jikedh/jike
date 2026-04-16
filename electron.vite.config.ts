import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";

  return {
    main: {
      build: {
        outDir: "out/main",
        sourcemap: !isProduction,
        rollupOptions: {
          output: {
            entryFileNames: "index.js",
            chunkFileNames: "chunks/[name].js",
            assetFileNames: "assets/[name]-[hash][extname]",
          },
        },
      },
      resolve: {
        alias: {
          main: resolve(__dirname, "src/main"),
          shared: resolve(__dirname, "src/shared"),
          service: resolve(__dirname, "src/service"),
        },
      },
    },
    preload: {
      build: {
        outDir: "out/preload",
        sourcemap: !isProduction,
        rollupOptions: {
          output: {
            entryFileNames: "index.js",
            chunkFileNames: "chunks/[name].js",
            assetFileNames: "assets/[name]-[hash][extname]",
          },
        },
      },
      resolve: {
        alias: {
          preload: resolve(__dirname, "src/preload"),
          shared: resolve(__dirname, "src/shared"),
        },
      },
    },
    renderer: {
      root: ".",
      base: "./",
      build: {
        outDir: "out/renderer",
        rollupOptions: {
          input: resolve(__dirname, "index.html"),
          output: {
            chunkFileNames: "assets/js/[name]-[hash].js",
            entryFileNames: "assets/js/[name]-[hash].js",
            assetFileNames: "assets/[name]-[hash][extname]",
          },
        },
        minify: "terser",
        sourcemap: !isProduction,
      },
      resolve: {
        alias: {
          "@": resolve(__dirname, "src/renderer"),
          shared: resolve(__dirname, "src/shared"),
          service: resolve(__dirname, "src/service"),
          main: resolve(__dirname, "src/main"),
          preload: resolve(__dirname, "src/preload"),
        },
      },
      plugins: [react(), tailwindcss()],
    },
  };
});
