import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const emulatorPath = env.VITE_EMULATOR_PATH
  const resolvedEmulatorPath = emulatorPath ? path.resolve(__dirname, emulatorPath) : null

  // Default path to openhw-studio-emulator if not specified
  const defaultEmulatorPath = path.resolve(__dirname, '../openhw-studio-emulator')
  
  // Use explicit path if set, otherwise default to local package
  const aliasPath = resolvedEmulatorPath && fs.existsSync(resolvedEmulatorPath) 
    ? resolvedEmulatorPath 
    : (fs.existsSync(defaultEmulatorPath) ? defaultEmulatorPath : null)

  return {
    plugins: [react()],
    resolve: {
      alias: aliasPath ? {
        '@openhw/emulator': aliasPath,
      } : {},
    },
    optimizeDeps: {
      include: ['@openhw/emulator'],
      esbuildOptions: {
         plugins: [
           {
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
           {
             name: 'raw-ts',
             setup(build) {
               build.onResolve({ filter: /\.(ts|tsx)\?raw$/ }, (args) => ({
                 path: path.resolve(path.dirname(args.importer), args.path.replace(/\?raw$/, '')),
                 namespace: 'raw-ts',
               }))
               build.onLoad({ filter: /.*/, namespace: 'raw-ts' }, (args) => ({
                 contents: `export default ${JSON.stringify(fs.readFileSync(args.path, 'utf8'))}`,
                 loader: 'js',
               }))
             },
           },
         ],
      },
    },
    server: {
      fs: {
        allow: [
          path.resolve(__dirname, '..'),
          ...(aliasPath ? [aliasPath] : []),
        ],
      },
    },
  }
})
