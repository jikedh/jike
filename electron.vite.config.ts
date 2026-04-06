import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'

  return {
    main: {},
    preload: {},
    renderer: {
      root: '.',
      build: {
        rollupOptions: {
          input: resolve(__dirname, 'index.html')
        },
        minify: 'terser',
        sourcemap: !isProduction
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src')
        }
      },
      plugins: [react(), tailwindcss()]
    }
  }
})
