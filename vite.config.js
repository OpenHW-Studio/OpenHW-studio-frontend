import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // Allow serving files from the emulator package which lives outside the frontend root
      allow: [
        path.resolve(__dirname, '..'),
      ],
    },
  },
})
