import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

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
  optimizeDeps: {
    esbuildOptions: {
      plugins: [
        {
          // During dep pre-bundling esbuild doesn't understand Vite's ?raw modifier.
          // This plugin resolves *.html?raw imports and returns them as JS string exports.
          name: 'raw-html',
          setup(build) {
            build.onResolve({ filter: /\.html\?raw$/ }, (args) => ({
              path: path.resolve(path.dirname(args.importer), args.path.replace(/\?raw$/, '')),
              namespace: 'raw-html',
            }))
            build.onLoad({ filter: /.*/, namespace: 'raw-html' }, (args) => ({
              contents: `export default ${JSON.stringify(fs.readFileSync(args.path, 'utf8'))}`,
              loader: 'js',
            }))
          },
        },
      ],
    },
  },
})
