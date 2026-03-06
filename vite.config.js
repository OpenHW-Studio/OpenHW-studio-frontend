import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Use the local emulator source instead of the git-pinned npm package.
      // This makes all component UI, ContextMenu, and logic changes immediately
      // visible to the frontend without needing to push to git or reinstall.
      '@openhw/emulator': path.resolve(__dirname, '../openhw-studio-emulator-danish'),
    },
  },
})
