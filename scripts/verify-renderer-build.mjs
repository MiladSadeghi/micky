import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const indexPath = fileURLToPath(new URL('../dist/index.html', import.meta.url))
const html = await readFile(indexPath, 'utf8')
const rootAbsoluteAsset = /(?:src|href)=["']\/(?!\/)/

if (rootAbsoluteAsset.test(html)) {
  throw new Error(
    'Renderer build contains a root-absolute asset URL, which cannot load through Electron file://.'
  )
}

if (!html.includes('src="./assets/') || !html.includes('href="./assets/')) {
  throw new Error('Renderer build is missing the expected relative JavaScript or CSS asset URL.')
}

console.log('[verify-renderer-build] packaged asset URLs are relative.')
