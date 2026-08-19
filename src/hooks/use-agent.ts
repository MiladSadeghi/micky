import { useEffect, useState } from 'react'
import type { AgentStatus } from '@/lib/agent'

export function useAgent(): AgentStatus | null {
  const [status, setStatus] = useState<AgentStatus | null>(null)

  useEffect(() => {
    let active = true
    void window.api.agent.getStatus().then((next) => {
      if (active) setStatus(next)
    })
    const unsubscribe = window.api.agent.onStatusChange((next) => {
      if (active) setStatus(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return status
}
