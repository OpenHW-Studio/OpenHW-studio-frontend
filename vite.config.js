import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
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

  // Engine folders (owner sources, pre-npm): runners import by exact
  // npm-shaped specifiers; these aliases are the single dev-resolution
  // point (folder now, npm packages later — flip targets, not sources).
  // NOTE: vendor mirrors under public/vendor keep their OpenHW patches
  // (SAB TextDecoder, mosiLog, Dallas) and are deploy-only; dev loads
  // folder bytes below.
  const picoFolder = '/home/danish1075/Documents/rp2350/Pico-emu/web';
  const esp32Folder = '/home/danish1075/Documents/esp32 emu/dist/sab';
  const stm32f4Folder = '/home/danish1075/Documents/stm32 F4/site';

  const useAlias = !!resolvedEmulatorPath && fs.existsSync(resolvedEmulatorPath);

  return {
    plugins: [
      wasm(),
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
      },
      {
        name: 'engine-precache',
        generateBundle(_options, bundle) {
          // Board engine = simulation worker + board runners + shared
          // registry/execute chunks + render/net workers + raw emulator
          // sources (emitted as ui-*.tsx / logic-*.ts) + wasm.
          // Hashed names change every build, so we emit the resolved list
          // here and sw.js precaches it at install time.
          const engineRe = [
            /^assets\/simulation\.worker-.*\.js$/,
            /^assets\/board\.worker-.*\.js$/,
            /^assets\/avr-runner-.*\.js$/,
            /^assets\/arm-runner-.*\.js$/,
            /^assets\/pico-runner-.*\.js$/,
            /^assets\/esp32-runner-.*\.js$/,
            /^assets\/stm32f1-runner-.*\.js$/,
            /^assets\/stm32f4-runner-.*\.js$/,
            /^assets\/rp2040-runner-.*\.js$/,
            /^assets\/execute-.*\.js$/,
            /^assets\/logic-.*\.js$/,
            /^assets\/emulatorLoader-.*\.js$/,
            /^assets\/display\.render\.worker-.*\.js$/,
            /^assets\/network\.worker-.*\.js$/,
            /^assets\/simulatorConstants-.*\.js$/,
            /^assets\/precompiledBinaries-.*\.js$/,
            /^assets\/guidedProject.*\.js$/,
            /^assets\/ui-.*\.tsx$/,
            /^assets\/logic-.*\.ts$/,
          ];
          const files = Object.keys(bundle)
            .filter((f) => engineRe.some((re) => re.test(f)))
            .map((f) => `/${f}`);
          // Any wasm emitted into the bundle (autowiring/grading engines)
          Object.keys(bundle).forEach((f) => {
            if (f.endsWith('.wasm') && !files.includes(`/${f}`)) files.push(`/${f}`);
          });
          // littlefs.wasm ships via public/wasm (not in bundle) — the sim
          // worker loads it for SD-card / filesystem emulation.
          if (!files.includes('/wasm/littlefs.wasm')) files.push('/wasm/littlefs.wasm');
          files.sort();
          this.emitFile({
            type: 'asset',
            fileName: 'engine-precache.json',
            source: JSON.stringify({ version: 1, buildTime: Date.now(), files }, null, 2),
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
    assetsInclude: ['**/*.wasm'],
    build: {
      target: 'es2020',
      minify: 'esbuild',
      cssMinify: true,
    },
    resolve: {
      alias: [
        ...(resolvedEmulatorPath ? [{
          find: '@openhw/emulator',
          replacement: resolvedEmulatorPath,
        }] : []),
        // Pico (folder-first): stock glue + wasm bytes from the owner
        // folder. The `.wasm?url` regex form is needed so the query
        // survives aliasing (exact strings don't match with ?url).
        { find: 'pico-emu/picoemu.wasm.js', replacement: path.join(picoFolder, 'picoemu.wasm.js') },
        // (Replacement `$1` re-appends the query: @rollup/plugin-alias
        // uses String.replace semantics, so captures survive.)
        { find: /^pico-emu\/picoemu\.wasm\.wasm(\?.*)?$/, replacement: path.join(picoFolder, 'picoemu.wasm.wasm') + '$1' },
        // Board-engine SAB proxy: package exports map only exposes ".",
        // whose root pulls node:crypto (no browser shim). Alias the deep
        // file so `import 'esp32-emu/dist/sab/worker-proxy.js'` resolves in
        // vite dev AND the worker build (file has zero node: imports).
        // Folder-first: owner `esp32 emu` checkout (dist == 1.2.0 bytes).
        { find: 'esp32-emu/dist/sab/worker-proxy.js', replacement: path.join(esp32Folder, 'worker-proxy.js') },
        // STM32F4: folder-first SUSPENDED 2026-10-15 — the owner folder
        // is mid-rebuild (site/emulator.js + bindings glue differ from
        // npm by hundreds of lines; folder wasm is dirty/uncommitted).
        // Glue+facade+wasm must version-match, so F4 stays on the blessed
        // npm pair until the owner lands. Flip back to stm32f4Folder then.
        // 'stm32f4-emu/stm32f4' intentionally unaliased (npm pair).
        // node:crypto has no browser build. The only in-repo consumer is
        // esp32-emu's partition-table MD5 (custom CSV path, never hit on
        // merged-bin boot) — stub it so the worker-entry transform loads.
        { find: 'node:crypto', replacement: path.resolve(__dirname, 'src/worker/shims/node-crypto-stub.ts') },
      ],
    },
    optimizeDeps: {
      // Board-engine emulators are worker-side ES modules with node:fs
      // fallbacks + relative wasm fetches. Pre-bundling them into
      // .vite/deps breaks resolution (deep subpaths, wasm URLs), so keep
      // them native: vite serves them as transformable ESM with proper
      // relative URLs. (Pico works pre-bundled today; excluding it too
      // keeps all four engines on one predictable path.)
      include: useAlias ? [] : ['@openhw/emulator'],
      exclude: ['@openhw/emulator', 'pico-emu', 'stm32f1-emu', 'stm32f4-emu', 'esp32-emu'],
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
          target: 'http://localhost:5001',
          changeOrigin: true,
        },
        '/auth': {
          target: 'http://localhost:5001',
          changeOrigin: true,
        },
      },
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
      watch: {
        // .tmp-vitest holds live Playwright browser profiles (leveldb LOCK/
        // MANIFEST/Code Cache churn constantly during e2e). Without this,
        // vite pushes a full page reload mid-run and every in-flight cell
        // dies with "execution context was destroyed". Never remove.
        ignored: ['**/test-results/**', '**/playwright-report/**', '**/tests/fixtures/binary-cache/**', '**/.tmp-vitest/**']
      },
      fs: {
        allow: [
          path.resolve(__dirname, '..'),
          // Owner engine folders (outside the repo root): folder-first
          // engine bytes for pico / esp32 / stm32f4.
          '/home/danish1075/Documents/rp2350/Pico-emu',
          '/home/danish1075/Documents/esp32 emu',
          '/home/danish1075/Documents/stm32 F4',
          ...(resolvedEmulatorPath ? [resolvedEmulatorPath] : []),
        ],
      },
    },
  }
})
