import assert from 'node:assert/strict'
import test from 'node:test'
import type { Worker } from 'node:worker_threads'
import { WakeWordService } from './service'

type WorkerEvent = 'message' | 'error' | 'exit'
type Listener = (...args: unknown[]) => void

class FakeWorker {
  readonly messages: unknown[] = []
  readonly listeners = new Map<WorkerEvent, Listener[]>()
  terminated = false

  postMessage(message: unknown): void {
    this.messages.push(message)
  }

  on(event: WorkerEvent, listener: Listener): this {
    const listeners = this.listeners.get(event) ?? []
    listeners.push(listener)
    this.listeners.set(event, listeners)
    return this
  }

  emit(event: WorkerEvent, value: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) listener(value)
  }

  async terminate(): Promise<number> {
    this.terminated = true
    return 0
  }
}

function createHarness() {
  const worker = new FakeWorker()
  const existingPath = import.meta.filename
  const service = new WakeWordService({
    workerScript: existingPath,
    resources: {
      melModelPath: existingPath,
      embeddingModelPath: existingPath,
      classifierModelPath: existingPath
    },
    getWindow: () => null,
    createWorker: () => worker as unknown as Worker
  })
  return { service, worker }
}

function resetIds(worker: FakeWorker): number[] {
  return worker.messages.flatMap((message) => {
    if (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      message.type === 'reset' &&
      'id' in message &&
      typeof message.id === 'number'
    ) {
      return [message.id]
    }
    return []
  })
}

test('mutes without terminating native inference and resumes after a clean reset', () => {
  const { service, worker } = createHarness()
  service.initialize()
  worker.emit('message', { type: 'ready' })
  assert.equal(service.getStatus().phase, 'listening')

  service.setEnabled(false)
  assert.deepEqual(
    {
      enabled: service.getStatus().enabled,
      phase: service.getStatus().phase,
      captureRequested: service.getStatus().captureRequested
    },
    { enabled: false, phase: 'disabled', captureRequested: false }
  )
  assert.equal(worker.terminated, false)

  service.setEnabled(true)
  assert.equal(service.getStatus().phase, 'loading')
  const [muteResetId, resumeResetId] = resetIds(worker)
  assert.ok(muteResetId)
  assert.ok(resumeResetId)

  worker.emit('message', { type: 'detected', score: 0.99 })
  worker.emit('message', { type: 'reset', id: muteResetId })
  assert.equal(service.getStatus().phase, 'loading')

  worker.emit('message', { type: 'reset', id: resumeResetId })
  assert.equal(service.getStatus().phase, 'listening')
  assert.equal(service.getStatus().captureRequested, true)

  service.dispose()
  assert.equal(worker.terminated, true)
})

test('stays muted when worker initialization finishes and resets before enabling', () => {
  const { service, worker } = createHarness()
  service.initialize()
  service.setEnabled(false)
  worker.emit('message', { type: 'ready' })
  assert.equal(service.getStatus().phase, 'disabled')

  service.setEnabled(true)
  assert.equal(service.getStatus().phase, 'loading')
  const [resumeResetId] = resetIds(worker)
  assert.ok(resumeResetId)
  worker.emit('message', { type: 'reset', id: resumeResetId })
  assert.equal(service.getStatus().phase, 'listening')
})

test('manual activation while muted starts one session without enabling active listening', () => {
  const { service, worker } = createHarness()
  service.initialize()
  worker.emit('message', { type: 'ready' })
  service.setEnabled(false)

  service.activateManually()

  assert.deepEqual(
    {
      enabled: service.getStatus().enabled,
      phase: service.getStatus().phase,
      captureRequested: service.getStatus().captureRequested
    },
    { enabled: false, phase: 'activated', captureRequested: true }
  )

  service.endExternalSession()
  assert.deepEqual(
    {
      enabled: service.getStatus().enabled,
      phase: service.getStatus().phase,
      captureRequested: service.getStatus().captureRequested
    },
    { enabled: false, phase: 'disabled', captureRequested: false }
  )
})

test('pauses microphone capture without ending the external session', () => {
  const { service, worker } = createHarness()
  service.initialize()
  worker.emit('message', { type: 'ready' })
  service.beginExternalSession()

  service.pauseCapture()

  assert.deepEqual(
    {
      enabled: service.getStatus().enabled,
      phase: service.getStatus().phase,
      captureRequested: service.getStatus().captureRequested
    },
    { enabled: true, phase: 'activated', captureRequested: false }
  )

  service.setEnabled(false)
  service.setEnabled(true)
  assert.equal(service.getStatus().phase, 'activated')
  assert.equal(service.getStatus().captureRequested, false)

  for (const resetId of resetIds(worker)) {
    worker.emit('message', { type: 'reset', id: resetId })
  }
  assert.equal(service.getStatus().captureRequested, false)

  service.beginExternalSession()
  assert.equal(service.getStatus().captureRequested, true)
})

test('retries a runtime inference error without terminating the ready worker', () => {
  const { service, worker } = createHarness()
  service.initialize()
  worker.emit('message', { type: 'ready' })
  worker.emit('message', { type: 'error', error: 'inference failed' })
  assert.equal(service.getStatus().phase, 'error')

  service.retry()
  assert.equal(service.getStatus().phase, 'loading')
  assert.equal(worker.terminated, false)
  const [resumeResetId] = resetIds(worker)
  assert.ok(resumeResetId)
  worker.emit('message', { type: 'reset', id: resumeResetId })
  assert.equal(service.getStatus().phase, 'listening')
})
