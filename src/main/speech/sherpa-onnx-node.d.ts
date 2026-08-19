declare module 'sherpa-onnx-node' {
  export class OnlineStream {
    acceptWaveform(waveform: { sampleRate: number; samples: Float32Array }): void
    inputFinished(): void
  }

  export class OnlineRecognizer {
    constructor(config: {
      featConfig: { sampleRate: number; featureDim: number }
      modelConfig: {
        nemoCtc: { model: string }
        tokens: string
        numThreads: number
        provider: string
        debug: number
      }
      decodingMethod: string
      enableEndpoint: number
      rule1MinTrailingSilence: number
      rule2MinTrailingSilence: number
      rule3MinUtteranceLength: number
    })
    createStream(): OnlineStream
    isReady(stream: OnlineStream): boolean
    decode(stream: OnlineStream): void
    isEndpoint(stream: OnlineStream): boolean
    reset(stream: OnlineStream): void
    getResult(stream: OnlineStream): { text: string }
  }
}
