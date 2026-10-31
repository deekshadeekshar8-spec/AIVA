import type { AgentId, AgentState } from '../types/agent';

/**
 * Maps the existing AgentState machine onto video clip files, so the
 * Motion Engine's states drive real footage instead of a static photo.
 *
 * Expected asset layout (drop files in, no code changes needed):
 *   public/agents/<agentId>/<state>.webm
 *
 * Not every agent needs a clip for every state on day one — states without
 * a clip fall back through CLIP_FALLBACK until they find one that exists.
 * If an agent has no clips at all, AgentCharacterVideo reports "unavailable"
 * and AgentStage falls back to the photo-based AgentAvatar for that agent.
 */
export const CLIP_FALLBACK: Record<AgentState, AgentState[]> = {
  idle: ['idle'],
  entering: ['entering', 'idle'],
  walking: ['walking', 'entering', 'idle'],
  listening: ['listening', 'idle'],
  thinking: ['thinking', 'listening', 'idle'],
  speaking: ['speaking', 'explaining', 'idle'],
  explaining: ['explaining', 'speaking', 'idle'],
  analyzing: ['analyzing', 'thinking', 'speaking', 'idle'],
  executing: ['executing', 'speaking', 'idle'],
  success: ['success', 'speaking', 'idle'],
  warning: ['warning', 'speaking', 'idle'],
  error: ['error', 'warning', 'speaking', 'idle'],
  exiting: ['exiting', 'walking', 'idle']
};

export const clipUrl = (agentId: AgentId, state: AgentState) => `/agents/${agentId}/${state}.webm`;

export const clipFallbackChain = (state: AgentState): AgentState[] => CLIP_FALLBACK[state] ?? ['idle'];
