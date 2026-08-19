import { OnlineRecognizer, type OnlineStream } from 'sherpa-onnx-node'
import {
  ASR_FEATURE_DIM,
  ASR_SAMPLE_RATE,
  type AsrProcessRequest,
  type AsrProcessResponse
} from '../../shared/asr'

const parentPort = process.parentPort
if (!parentPort) throw new Error('ASR process requires utilityProcess parentPort.')

let recognizer: OnlineRecognizer | null = null
let stream: OnlineStream | null = null
let lastText = ''
let ended = false

function post(message: AsrProcessResponse): void {
  parentPort.postMessage(message)
}

function currentText(): string {
  if (!recognizer || !stream) return lastText
  const text = recognizer.getResult(stream).text.trim()
  return text
}

function decodeAvailable(): void {
  if (!recognizer || !stream) return
  while (recognizer.isReady(stream)) recognizer.decode(stream)
}

function handleInitialize(message: Extract<AsrProcessRequest, { type: 'initialize' }>): void {
  stream = null
  lastText = ''
  ended = false
  recognizer = new OnlineRecognizer({
    featConfig: { sampleRate: ASR_SAMPLE_RATE, featureDim: ASR_FEATURE_DIM },
    modelConfig: {
      nemoCtc: { model: message.modelPath },
      tokens: message.tokensPath,
      numThreads: message.numThreads,
      provider: 'cpu',
      debug: 0
    },
    decodingMethod: 'greedy_search',
    enableEndpoint: 1,
    rule1MinTrailingSilence: message.endpoint.rule1MinTrailingSilence,
    rule2MinTrailingSilence: message.endpoint.rule2MinTrailingSilence,
    rule3MinUtteranceLength: message.endpoint.rule3MinUtteranceLength
  })
  post({ type: 'ready' })
}

function handleStart(): void {
  if (!recognizer) throw new Error('ASR model is not initialized.')
  stream = recognizer.createStream()
  lastText = ''
  ended = false
}

function handleAudio(samples: ArrayBuffer): void {
  if (!recognizer || !stream || ended) return
  stream.acceptWaveform({
    sampleRate: ASR_SAMPLE_RATE,
    samples: new Float32Array(samples)
  })
  decodeAvailable()
  const text = currentText()
  if (text && text !== lastText) {
    lastText = text
    post({ type: 'partial', text })
  }
  if (recognizer.isEndpoint(stream)) {
    ended = true
    lastText = currentText()
    post({ type: 'endpoint', text: lastText })
  }
}

function handleStop(): void {
  if (!recognizer || !stream) {
    post({ type: 'final', text: lastText })
    return
  }
  if (!ended) {
    stream.inputFinished()
    decodeAvailable()
    lastText = currentText()
  }
  post({ type: 'final', text: lastText })
  recognizer.reset(stream)
  stream = null
  ended = false
}

parentPort.on('message', (event) => {
  const message = event.data as AsrProcessRequest
  try {
    if (message.type === 'initialize') {
      handleInitialize(message)
      return
    }
    if (message.type === 'start') {
      handleStart()
      return
    }
    if (message.type === 'audio') {
      handleAudio(message.samples)
      return
    }
    if (message.type === 'stop') {
      handleStop()
      return
    }
    if (message.type === 'dispose') {
      stream = null
      recognizer = null
      process.exit(0)
    }
  } catch (error) {
    post({
      type: 'error',
      error: error instanceof Error ? error.message : 'ASR process failed.'
    })
  }
})
