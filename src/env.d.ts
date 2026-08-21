/// <reference types="vite/client" />

interface Window {
  api: import('@/lib/desktop-api').MickyAPI
  flyoverApi: import('@/lib/flyover').FlyoverAPI
  queryLocalFonts?: () => Promise<readonly LocalFontData[]>
}

interface LocalFontData {
  readonly family: string
  readonly fullName: string
  readonly postscriptName: string
  readonly style: string
  blob(): Promise<Blob>
}
