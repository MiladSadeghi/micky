import type { AppearanceSnapshot } from './settings'

export function applyAppearance({ theme, fontFamily }: AppearanceSnapshot): void {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
  root.style.colorScheme = theme
  root.style.setProperty('--app-font-family', quoteFontFamily(fontFamily))
}

function quoteFontFamily(fontFamily: string): string {
  return `"${fontFamily.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}
