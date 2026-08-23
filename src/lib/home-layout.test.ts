import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_CONVERSATION_PANEL_EXPANDED, resolveMainWindowMode } from './home-layout'

test('keeps the home conversation panel collapsed by default', () => {
  assert.equal(DEFAULT_CONVERSATION_PANEL_EXPANDED, false)
  assert.equal(
    resolveMainWindowMode({
      onboardingActive: false,
      screen: 'home',
      conversationPanelExpanded: DEFAULT_CONVERSATION_PANEL_EXPANDED
    }),
    'compact'
  )
})

test('keeps onboarding and archive screens compact', () => {
  assert.equal(
    resolveMainWindowMode({
      onboardingActive: true,
      screen: 'home',
      conversationPanelExpanded: true
    }),
    'compact'
  )
  assert.equal(
    resolveMainWindowMode({
      onboardingActive: false,
      screen: 'history',
      conversationPanelExpanded: true
    }),
    'compact'
  )
})

test('uses the dedicated settings size and honors a collapsed home panel', () => {
  assert.equal(
    resolveMainWindowMode({
      onboardingActive: false,
      screen: 'settings',
      conversationPanelExpanded: false
    }),
    'settings'
  )
  assert.equal(
    resolveMainWindowMode({
      onboardingActive: false,
      screen: 'home',
      conversationPanelExpanded: false
    }),
    'compact'
  )
})
