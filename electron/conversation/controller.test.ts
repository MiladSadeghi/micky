import assert from 'node:assert/strict'
import test from 'node:test'
import { FOLLOWUP_WINDOW_MS } from '@/lib/conversation'
import { ConversationController } from './controller'

type Harness = ReturnType<typeof createHarness>

function createHarness(
  respond: () => Promise<'completed' | 'aborted' | 'skipped'> = async () => 'completed'
) {
  const speech = {
    started: 0,
    cancelled: 0,
    async startSession() {
      this.started += 1
    },
    cancelSession() {
      this.cancelled += 1
    },
    getStatus() {
      return { phase: 'listening' as const }
    }
  }
  const wake = {
    resumed: 0,
    resumeListening() {
      this.resumed += 1
    }
  }
  const agent = {
    aborted: 0,
    respond,
    abort() {
      this.aborted += 1
    }
  }
  const controller = new ConversationController({
    settings: { get: () => ({ onboardingCompleted: true }) },
    llm: { isConfigured: () => true },
    getAgent: () => agent,
    getSpeech: () => speech,
    getWakeWord: () => wake,
    getWindow: () => null
  } as never)

  return { controller, speech, wake, agent }
}

async function waitForFollowup(harness: Harness, started = 1): Promise<void> {
  for (let i = 0; i < 20; i++) {
    if (harness.controller.getStatus().mode === 'followup' && harness.speech.started >= started) {
      return
    }
    await new Promise((resolve) => setImmediate(resolve))
  }
  assert.equal(harness.controller.getStatus().mode, 'followup')
  assert.ok(harness.speech.started >= started)
}

test('opens a longer followup listen window after the agent finishes', async () => {
  const harness = createHarness()
  harness.controller.onFinalTranscript('ساعت چنده؟')
  await waitForFollowup(harness)

  const status = harness.controller.getStatus()
  assert.equal(harness.speech.started, 1)
  assert.equal(status.followupHeard, false)
  assert.ok(status.followupUntil)
  assert.ok((status.followupUntil ?? 0) - Date.now() > FOLLOWUP_WINDOW_MS - 250)
})

test('keeps listening if the user starts speaking during followup', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const harness = createHarness()
  harness.controller.onFinalTranscript('سلام')
  await waitForFollowup(harness)

  harness.controller.onPartialTranscript('و فردا چی')
  assert.equal(harness.controller.getStatus().followupHeard, true)
  assert.equal(harness.controller.getStatus().followupUntil, null)

  t.mock.timers.tick(FOLLOWUP_WINDOW_MS + 1_000)
  assert.equal(harness.controller.getStatus().mode, 'followup')
  assert.equal(harness.speech.cancelled, 0)
  assert.equal(harness.wake.resumed, 0)
})

test('returns to wake-word listening when followup stays silent', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const harness = createHarness()
  harness.controller.onFinalTranscript('سلام')
  await waitForFollowup(harness)

  t.mock.timers.tick(FOLLOWUP_WINDOW_MS)
  assert.equal(harness.controller.getStatus().mode, 'idle')
  assert.equal(harness.speech.cancelled, 1)
  assert.equal(harness.wake.resumed, 1)
})

test('ignores empty ASR silence endpoints and keeps the followup window', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const harness = createHarness()
  harness.controller.onFinalTranscript('سلام')
  await waitForFollowup(harness)

  const until = harness.controller.getStatus().followupUntil
  harness.controller.onFinalTranscript('   ')
  await waitForFollowup(harness, 2)

  assert.equal(harness.controller.getStatus().mode, 'followup')
  assert.equal(harness.controller.getStatus().followupHeard, false)
  assert.equal(harness.controller.getStatus().followupUntil, until)
  assert.equal(harness.speech.started, 2)
  assert.equal(harness.wake.resumed, 0)

  t.mock.timers.tick(FOLLOWUP_WINDOW_MS)
  assert.equal(harness.controller.getStatus().mode, 'idle')
  assert.equal(harness.wake.resumed, 1)
})

test('does not treat a blip as speech during followup', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const harness = createHarness()
  harness.controller.onFinalTranscript('سلام')
  await waitForFollowup(harness)

  harness.controller.onPartialTranscript('.')
  harness.controller.onPartialTranscript('ا')
  assert.equal(harness.controller.getStatus().followupHeard, false)
  assert.ok(harness.controller.getStatus().followupUntil)

  t.mock.timers.tick(FOLLOWUP_WINDOW_MS)
  assert.equal(harness.controller.getStatus().mode, 'idle')
})
