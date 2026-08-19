export const AGENT_STATUS_CHANNEL = 'agent:status'
export const AGENT_DELTA_CHANNEL = 'agent:delta'

export const AGENT_MAX_STEPS = 8
export const AGENT_HISTORY_LIMIT = 20

export type AgentPhase = 'idle' | 'thinking' | 'tool' | 'speaking' | 'error'

export type AgentTurn = {
  turnId: string
  userText: string
  replyText: string
  phase: AgentPhase
  toolName: string | null
  error: string | null
}

export type AgentStatus = {
  phase: AgentPhase
  turn: AgentTurn | null
  error: string | null
}

export type AgentDelta = {
  turnId: string
  delta: string
  text: string
}

export const INITIAL_AGENT_STATUS: AgentStatus = {
  phase: 'idle',
  turn: null,
  error: null
}
