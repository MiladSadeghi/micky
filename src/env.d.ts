/// <reference types="vite/client" />

interface Window {
  api: import('@/lib/desktop-api').MickyAPI
  flyoverApi: import('@/lib/flyover').FlyoverAPI
}
