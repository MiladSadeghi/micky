import assert from 'node:assert/strict'
import test from 'node:test'
import { CONFIRM_WINDOW_MS, FOLLOWUP_WINDOW_MS } from '@/lib/conversation'
import { ConversationController } from './controller'

type Harness = ReturnType<typeof createHarness>

function createHarness(
  respond: () => Promise<'completed' | 'ended' | 'aborted' | 'skipped'> = async () => 'completed',
  shouldUseVoice: () => boolean = () => true,
  chats: Record<string, unknown> | null = null
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
    resetCount: 0,
    resolved: [] as boolean[],
    confirmText: null as string | null,
    histories: [] as unknown[][],
    respond,
    getStatus() {
      return { turn: { replyText: 'جواب میکی', confirmText: this.confirmText } }
    },
    abort() {
      this.aborted += 1
      this.resolveApproval(false)
    },
    reset() {
      this.resetCount += 1
      this.resolveApproval(false)
    },
    replaceHistory(messages: unknown[]) {
      this.histories.push(messages)
    },
    resolveApproval(approved: boolean) {
      this.resolved.push(approved)
    }
  }
  const tts = {
    spoken: [] as string[],
    stopped: 0,
    async speak(text: string): Promise<'completed' | 'aborted'> {
      this.spoken.push(text)
      return 'completed' as const
    },
    stop() {
      this.stopped += 1
    }
  }
  const controller = new ConversationController({
    settings: { get: () => ({ onboardingCompleted: true }) },
    llm: { isConfigured: () => true },
    getAgent: () => agent,
    getSpeech: () => speech,
    getTts: () => tts,
    getWakeWord: () => wake,
    getChats: () => chats,
    getWindow: () => null,
    shouldUseVoice
  } as never)

  return { controller, speech, wake, agent, tts, chats }
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
  assert.deepEqual(harness.tts.spoken, ['جواب میکی'])
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

test('holds the followup window while the user types a draft', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const harness = createHarness()
  harness.controller.onFinalTranscript('سلام')
  await waitForFollowup(harness)

  harness.controller.holdListenWindow()
  assert.equal(harness.controller.getStatus().mode, 'followup')
  assert.equal(harness.controller.getStatus().followupHeard, true)

  t.mock.timers.tick(FOLLOWUP_WINDOW_MS + 1_000)
  assert.equal(harness.controller.getStatus().mode, 'followup')
  assert.equal(harness.wake.resumed, 0)

  harness.controller.onFinalTranscript('فردا چی کار داریم')
  await waitForFollowup(harness, 2)
  assert.equal(harness.controller.getStatus().mode, 'followup')
  assert.deepEqual(harness.tts.spoken, ['جواب میکی', 'جواب میکی'])
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

test('starts a fresh conversation and returns to wake-word listening', async () => {
  const harness = createHarness()
  harness.controller.onFinalTranscript('سلام')
  await waitForFollowup(harness)

  harness.controller.startFresh()
  assert.equal(harness.controller.getStatus().mode, 'idle')
  assert.equal(harness.agent.resetCount, 1)
  assert.equal(harness.speech.cancelled, 1)
  assert.equal(harness.wake.resumed, 1)
})

test('persists the final user and assistant messages around an agent turn', async () => {
  const appended: Array<Record<string, unknown>> = []
  const chats = {
    ensureActiveChat: () => ({ chatId: 'chat-1', created: true }),
    getContext: () => [{ role: 'assistant', content: 'قبل‌تر اینجا بودیم' }],
    appendMessage: (_chatId: string, message: Record<string, unknown>) => appended.push(message),
    endActiveChat: () => {}
  }
  const harness = createHarness(
    async () => 'completed',
    () => true,
    chats
  )
  harness.controller.onFinalTranscript('ادامه بدیم')
  await waitForFollowup(harness)

  assert.deepEqual(harness.agent.histories, [
    [{ role: 'assistant', content: 'قبل‌تر اینجا بودیم' }]
  ])
  assert.equal(appended.length, 2)
  assert.deepEqual(
    appended.map(({ role, content }) => ({ role, content })),
    [
      { role: 'user', content: 'ادامه بدیم' },
      { role: 'assistant', content: 'جواب میکی' }
    ]
  )
})

test('resumes a stored chat and restores its recent context', () => {
  const chats = {
    resumeChat: () => ({ id: 'chat-1' }),
    getContext: () => [{ role: 'user', content: 'موضوع قبلی' }]
  }
  const harness = createHarness(
    async () => 'completed',
    () => true,
    chats
  )
  assert.equal(harness.controller.resumeChat('chat-1'), true)
  assert.deepEqual(harness.agent.histories, [[{ role: 'user', content: 'موضوع قبلی' }]])
  assert.equal(harness.speech.cancelled, 1)
  assert.equal(harness.wake.resumed, 1)
})

test('does not open a followup listen window when the agent ends the conversation', async () => {
  const harness = createHarness(async () => 'ended')
  harness.controller.onFinalTranscript('خداحافظ')

  for (let i = 0; i < 20; i++) {
    if (harness.wake.resumed > 0) break
    await new Promise((resolve) => setImmediate(resolve))
  }

  assert.equal(harness.controller.getStatus().mode, 'idle')
  assert.equal(harness.speech.started, 0)
  assert.deepEqual(harness.tts.spoken, ['جواب میکی'])
  assert.equal(harness.wake.resumed, 1)
})

test('waits for spoken playback before opening followup listening', async () => {
  const harness = createHarness()
  let finishPlayback: () => void = () => {}
  harness.tts.speak = async (text: string) => {
    harness.tts.spoken.push(text)
    await new Promise<void>((resolve) => {
      finishPlayback = resolve
    })
    return 'completed'
  }

  harness.controller.onFinalTranscript('سلام')
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(harness.controller.getStatus().mode, 'agent')
  assert.equal(harness.speech.started, 0)

  finishPlayback()
  await waitForFollowup(harness)
  assert.equal(harness.speech.started, 1)
})

test('skips spoken playback for a visual-only shortcut session', async () => {
  const harness = createHarness(
    async () => 'completed',
    () => false
  )
  harness.controller.onFinalTranscript('سلام')
  await waitForFollowup(harness)

  assert.deepEqual(harness.tts.spoken, [])
  assert.equal(harness.speech.started, 1)
})

test('interrupting a turn stops TTS playback', async () => {
  const harness = createHarness()
  let finishPlayback: () => void = () => {}
  harness.tts.speak = async () => {
    await new Promise<void>((resolve) => {
      finishPlayback = resolve
    })
    return 'aborted'
  }
  harness.controller.onFinalTranscript('سلام')
  await new Promise((resolve) => setImmediate(resolve))

  harness.controller.onWakeActivated()
  finishPlayback()
  assert.equal(harness.tts.stopped, 1)
  assert.equal(harness.controller.getStatus().mode, 'idle')
})

async function waitForMode(
  harness: Harness,
  mode: 'confirm' | 'followup' | 'agent' | 'idle',
  started?: number
): Promise<void> {
  for (let i = 0; i < 20; i++) {
    if (
      harness.controller.getStatus().mode === mode &&
      (started == null || harness.speech.started >= started)
    ) {
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setImmediate(resolve))
      return
    }
    await new Promise((resolve) => setImmediate(resolve))
  }
  assert.equal(harness.controller.getStatus().mode, mode)
}

function armConfirmRespond(harness: Harness, purpose = 'می‌خوام این دستور رو اجرا کنم.'): void {
  harness.agent.respond = async () => {
    let resolveApproval: (approved: boolean) => void = () => {}
    const wait = new Promise<boolean>((resolve) => {
      resolveApproval = resolve
    })
    harness.agent.resolveApproval = (approved: boolean) => {
      harness.agent.resolved.push(approved)
      resolveApproval(approved)
    }
    harness.agent.confirmText = purpose
    harness.controller.onApprovalNeeded()
    await wait
    return 'completed'
  }
}

test('speaks the approval question before opening the microphone', async () => {
  const harness = createHarness()
  let finishPrompt: () => void = () => {}
  let callCount = 0
  harness.tts.speak = async (text: string) => {
    harness.tts.spoken.push(text)
    callCount += 1
    if (callCount === 1) {
      await new Promise<void>((resolve) => {
        finishPrompt = resolve
      })
    }
    return 'completed'
  }
  armConfirmRespond(harness, 'می‌خوام پوشه دانلودها رو پاک کنم.')

  harness.controller.onFinalTranscript('پوشه دانلودها رو پاک کن')
  await waitForMode(harness, 'confirm')

  assert.deepEqual(harness.tts.spoken, ['می‌خوام پوشه دانلودها رو پاک کنم؛ انجامش بدم؟'])
  assert.equal(harness.speech.started, 0)
  assert.equal(harness.controller.getStatus().followupUntil, null)

  finishPrompt()
  await waitForMode(harness, 'confirm', 1)
  assert.ok(harness.controller.getStatus().followupUntil)
  harness.controller.resolveApproval(false)
  await waitForFollowup(harness, 2)
})

test('shows approval without speaking it in a visual-only shortcut session', async () => {
  const harness = createHarness(
    async () => 'completed',
    () => false
  )
  armConfirmRespond(harness)

  harness.controller.onFinalTranscript('این دستور رو اجرا کن')
  await waitForMode(harness, 'confirm', 1)

  assert.deepEqual(harness.tts.spoken, [])
  assert.ok(harness.controller.getStatus().followupUntil)
  harness.controller.resolveApproval(false)
  await waitForFollowup(harness, 2)
})

test('opens a confirm listen window and treats آره as approval', async () => {
  const harness = createHarness()
  armConfirmRespond(harness)
  harness.controller.onFinalTranscript('سافاری رو باز کن')
  await waitForMode(harness, 'confirm', 1)

  harness.controller.onFinalTranscript('آره')
  assert.deepEqual(harness.agent.resolved, [true])
  await waitForFollowup(harness, 2)
  assert.equal(harness.controller.getStatus().mode, 'followup')
})

test('treats نه as a denial and still returns to followup', async () => {
  const harness = createHarness()
  armConfirmRespond(harness)
  harness.controller.onFinalTranscript('حذف کن')
  await waitForMode(harness, 'confirm', 1)

  harness.controller.onFinalTranscript('نه')
  assert.deepEqual(harness.agent.resolved, [false])
  await waitForFollowup(harness, 2)
})

test('keeps listening when the approval answer is unclear', async () => {
  const harness = createHarness()
  armConfirmRespond(harness)
  harness.controller.onFinalTranscript('یه دستور اجرا کن')
  await waitForMode(harness, 'confirm', 1)

  harness.controller.onFinalTranscript('چی گفتی')
  await waitForMode(harness, 'confirm', 2)

  assert.deepEqual(harness.agent.resolved, [])
  harness.controller.onFinalTranscript('نه')
  assert.deepEqual(harness.agent.resolved, [false])
  await waitForFollowup(harness, 3)
})

test('denies a confirm request when the window times out', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const harness = createHarness()
  armConfirmRespond(harness)
  harness.controller.onFinalTranscript('نصب کن')
  await waitForMode(harness, 'confirm', 1)

  t.mock.timers.tick(CONFIRM_WINDOW_MS)
  assert.deepEqual(harness.agent.resolved, [false])
  await waitForFollowup(harness)
})

test('denies a confirm request when the conversation is interrupted', async () => {
  const harness = createHarness()
  armConfirmRespond(harness)
  harness.controller.onFinalTranscript('نصب کن')
  await waitForMode(harness, 'confirm', 1)

  harness.controller.onWakeActivated()
  assert.deepEqual(harness.agent.resolved, [false])
  assert.equal(harness.controller.getStatus().mode, 'idle')
  assert.equal(harness.agent.aborted, 1)
})
