import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const emulatorPath = env.VITE_EMULATOR_PATH
  const defaultEmulatorPath = '../openhw-studio-emulator'
  const dockerEmulatorPath = path.resolve(__dirname, 'src/emulator')
  
  let resolvedEmulatorPath = null
  if (emulatorPath) {
    resolvedEmulatorPath = path.resolve(__dirname, emulatorPath)
  } else if (fs.existsSync(path.resolve(__dirname, defaultEmulatorPath))) {
    resolvedEmulatorPath = path.resolve(__dirname, defaultEmulatorPath)
  } else if (fs.existsSync(dockerEmulatorPath)) {
    resolvedEmulatorPath = dockerEmulatorPath
  }

  const useAlias = !!resolvedEmulatorPath && fs.existsSync(resolvedEmulatorPath)

  return {
    plugins: [
      react({
        exclude: [/src[\\\/]worker[\\\/].*/, /openhw-studio-emulator[\\\/].*/],
      })
    ],
    worker: {
      format: 'es',
    },
    // ensure esbuild target supports optional catch binding and modern syntax
    esbuild: {
      target: 'es2020',
    },
    build: {
      target: 'es2020',
      minify: 'esbuild',
      cssMinify: true,
    },
    resolve: {
      alias: useAlias ? {
        '@openhw/emulator': resolvedEmulatorPath,
      } : {},
    },
    optimizeDeps: {
      exclude: ['@openhw/emulator'],
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
        ],
      },
    },
    ssr: {
      noExternal: ['rp2040js', 'avr8js', '@openhw/emulator', 'littlefs'],
    },
    test: {
      environment: 'jsdom',
      deps: {
        inline: ['rp2040js', 'avr8js', '@openhw/emulator', 'littlefs'],
      }
    },
    server: {
      fs: {
        allow: [
          path.resolve(__dirname, '..'),
          ...(useAlias ? [resolvedEmulatorPath] : []),
        ],
      },
    },
  }
})
