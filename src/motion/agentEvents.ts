import type { AgentId } from '../types/agent';

/**
 * Cross-agent event bus. The dashboard, analytics, or a future orchestration
 * layer can subscribe without coupling to AivaContext internals.
 */
export type AgentEventType =
'AGENT_ACTIVATED' |
'SPEECH_STARTED' |
'SPEECH_ENDED' |
'ANALYSIS_STARTED' |
'ANALYSIS_COMPLETE' |
'HANDOFF_STARTED' |
'HANDOFF_COMPLETE' |
'ACTION_STARTED' |
'ACTION_COMPLETE';

export interface AgentEvent {
  type: AgentEventType;
  agentId: AgentId;
  /** Present on HANDOFF_* events. */
  to?: AgentId;
  detail?: string;
  time: number;
}

type Listener = (event: AgentEvent) => void;

class AgentEventBus {
  private listeners = new Set<Listener>();

  on(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: Omit<AgentEvent, 'time'>) {
    const full: AgentEvent = { ...event, time: Date.now() };
    this.listeners.forEach((l) => l(full));
  }
}

export const agentEvents = new AgentEventBus();
