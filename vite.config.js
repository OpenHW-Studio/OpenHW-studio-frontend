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
    resolvedEmulatorPath = dockerEmulatorPath;
  }

  const useAlias = !!resolvedEmulatorPath && fs.existsSync(resolvedEmulatorPath);

  return {
    plugins: [
      react({
        exclude: [/src[\\\/]worker[\\\/].*/, /openhw-studio-emulator[\\\/].*/],
      }),
      {
        name: 'version-generator',
        buildStart() {
          let appVer = '0.1.0';
          try {
            const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
            if (pkg.version) appVer = pkg.version;
          } catch (e) {}

          const versionData = {
            version: appVer,
            buildTime: Date.now()
          };
          const publicVersionPath = path.resolve(__dirname, 'public/version.json');
          try {
            fs.writeFileSync(publicVersionPath, JSON.stringify(versionData, null, 2));
          } catch (e) {
            // Non-fatal if read-only
          }
        },
        generateBundle() {
          let appVer = '0.1.0';
          try {
            const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
            if (pkg.version) appVer = pkg.version;
          } catch (e) {}

          this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: JSON.stringify({
              version: appVer,
              buildTime: Date.now()
            }, null, 2)
          });
        }
      }
    ],
    define: {
      __APP_BUILD_TIME__: JSON.stringify(Date.now()),
    },
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
      alias: resolvedEmulatorPath ? {
        '@openhw/emulator': resolvedEmulatorPath,
      } : {},
    },
    optimizeDeps: {
      include: useAlias ? [] : ['@openhw/emulator'],
      exclude: useAlias ? ['@openhw/emulator'] : [],
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
    ssr: {
      noExternal: ['rp2040js', 'avr8js', '@openhw/emulator', 'littlefs'],
    },
    test: {
      environment: 'jsdom',
      include: ['tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      deps: {
        inline: ['rp2040js', 'avr8js', '@openhw/emulator', 'littlefs'],
      }
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/auth': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
      },
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
      watch: {
        ignored: ['**/test-results/**', '**/playwright-report/**', '**/tests/fixtures/binary-cache/**']
      },
      fs: {
        allow: [
          path.resolve(__dirname, '..'),
          ...(resolvedEmulatorPath ? [resolvedEmulatorPath] : []),
        ],
      },
    },
  }
})
