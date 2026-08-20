export const FLYOVER_SNAPSHOT_CHANNEL = 'flyover:snapshot'

export type FlyoverMode = 'assistant' | 'dictation' | 'screen'
export type FlyoverPhase =
  | 'hidden'
  | 'listening'
  | 'thinking'
  | 'tool'
  | 'confirm'
  | 'cleaning'
  | 'capturing'
  | 'looking'
  | 'disclosure'
  | 'reply'
  | 'done'
  | 'unavailable'
  | 'error'

export type FlyoverSnapshot = {
  visible: boolean
  mode: FlyoverMode
  phase: FlyoverPhase
  title: string
  text: string
  hint: string | null
  detail: string | null
  interactive: boolean
  canFinish: boolean
  canApprove: boolean
  canRespondToDisclosure: boolean
  canOpenModels: boolean
}

export const INITIAL_FLYOVER_SNAPSHOT: FlyoverSnapshot = {
  visible: false,
  mode: 'assistant',
  phase: 'hidden',
  title: '',
  text: '',
  hint: null,
  detail: null,
  interactive: false,
  canFinish: false,
  canApprove: false,
  canRespondToDisclosure: false,
  canOpenModels: false
}

export type FlyoverAPI = {
  getSnapshot: () => Promise<FlyoverSnapshot>
  cancel: () => void
  finishDictation: () => void
  resolveApproval: (approved: boolean) => void
  resolveDisclosure: (accepted: boolean) => void
  openMain: () => void
  openModels: () => void
  onSnapshotChange: (listener: (snapshot: FlyoverSnapshot) => void) => () => void
}
