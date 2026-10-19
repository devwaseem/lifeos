import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const localApiTarget = 'http://127.0.0.1:8787'
export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
  ],
  server: {
    proxy: {
      '/api': {
        target: localApiTarget,
        changeOrigin: true,
      },
    },
  },
})
