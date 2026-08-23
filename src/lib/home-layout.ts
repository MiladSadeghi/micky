export type AppScreen = 'home' | 'history' | 'chat' | 'settings'
export type MainWindowMode = 'expanded' | 'compact' | 'settings'

export const DEFAULT_CONVERSATION_PANEL_EXPANDED = false

export function resolveMainWindowMode(input: {
  onboardingActive: boolean
  screen: AppScreen
  conversationPanelExpanded: boolean
}): MainWindowMode {
  if (input.onboardingActive) return 'compact'
  if (input.screen === 'settings') return 'settings'
  if (input.screen !== 'home') return 'compact'
  return input.conversationPanelExpanded ? 'expanded' : 'compact'
}
