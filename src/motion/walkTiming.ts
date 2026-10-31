import type { AgentId } from '../types/agent';

/**
 * Seconds into public/agents/<id>/presence.mp4 where the walk-in settles and
 * the character stands still, ready to talk. Sampled by eye from each clip
 * (walking ends ~2.5-3s, mouth movement starts ~3.5-4s in the current set).
 * Tune per agent here if a clip's walk-in runs long/short.
 */
export const WALK_IN_SECONDS: Record<AgentId, number> = {
  ava: 3.2,
  aria: 3.2,
  mira: 3.2,
  zara: 3.2,
  nia: 3.2,
  nova: 3.2
};

export const walkInSeconds = (id: AgentId) => WALK_IN_SECONDS[id] ?? 3.2;
