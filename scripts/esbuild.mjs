import { build, context } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const watch = process.argv.includes('--watch')

const alias = {
  '@': path.join(root, 'src')
}

/** Shared options for bundling the Electron processes. */
const shared = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  alias,
  // Electron and native addons are provided at runtime.
  external: ['electron', 'onnxruntime-node', 'sherpa-onnx-node', '@napi-rs/keyring'],
  logLevel: 'info'
}

const mainConfig = {
  ...shared,
  entryPoints: [path.join(root, 'electron/main.ts')],
  outfile: path.join(root, 'dist-electron/main.js'),
  format: 'esm',
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);"
  }
}

const preloadConfig = {
  ...shared,
  entryPoints: [path.join(root, 'electron/preload.ts')],
  outfile: path.join(root, 'dist-electron/preload.cjs'),
  format: 'cjs'
}

const asrProcessConfig = {
  ...shared,
  entryPoints: [path.join(root, 'electron/speech/asr-process.ts')],
  outfile: path.join(root, 'dist-electron/asr-process.cjs'),
  format: 'cjs'
}

const wakeWordWorkerConfig = {
  ...shared,
  entryPoints: [path.join(root, 'electron/wake-word/worker.ts')],
  outfile: path.join(root, 'dist-electron/wake-word-worker.cjs'),
  format: 'cjs'
}

async function run() {
  if (watch) {
    const [mainCtx, preloadCtx, asrProcessCtx, wakeWordWorkerCtx] = await Promise.all([
      context(mainConfig),
      context(preloadConfig),
      context(asrProcessConfig),
      context(wakeWordWorkerConfig)
    ])
    await Promise.all([
      mainCtx.watch(),
      preloadCtx.watch(),
      asrProcessCtx.watch(),
      wakeWordWorkerCtx.watch()
    ])
    console.log('[esbuild] watching Electron main, preload, and speech workers...')
  } else {
    await Promise.all([
      build(mainConfig),
      build(preloadConfig),
      build(asrProcessConfig),
      build(wakeWordWorkerConfig)
    ])
    console.log('[esbuild] built Electron main, preload, and speech workers.')
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
