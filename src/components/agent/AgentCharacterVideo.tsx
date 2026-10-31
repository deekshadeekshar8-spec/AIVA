import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '../../utils/cn';
import { clipFallbackChain, clipUrl } from '../../motion/clipMap';
import { ChromaKeyVideo } from './ChromaKeyVideo';
import type { Agent, AgentState } from '../../types/agent';

/** Agents confirmed (this session) to have zero usable clips — skip re-probing them. */
const knownUnavailable = new Set<string>();

interface AgentCharacterVideoProps {
  agent: Agent;
  state: AgentState;
  className?: string;
  /** Called once if this agent has no playable clips at all — caller should render the photo AgentAvatar instead. */
  onUnavailable: () => void;
}

/**
 * Video-clip rendering of AgentCharacter. Resolves `state` to a clip through
 * clipMap's fallback chain (e.g. missing "walking" plays "entering" or
 * "idle" instead of nothing), and reports total unavailability once so the
 * caller can drop back to the static-photo AgentAvatar for that agent.
 */
export function AgentCharacterVideo({ agent, state, className, onUnavailable }: AgentCharacterVideoProps) {
  const chain = useMemo(() => clipFallbackChain(state), [state]);
  const [attempt, setAttempt] = useState(0);
  const [bailed, setBailed] = useState(knownUnavailable.has(agent.id));

  useEffect(() => setAttempt(0), [chain]);

  useEffect(() => {
    if (bailed) return;
    if (attempt >= chain.length) {
      knownUnavailable.add(agent.id);
      setBailed(true);
      onUnavailable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, chain.length, bailed]);

  if (bailed || attempt >= chain.length) return null;

  const src = clipUrl(agent.id, chain[attempt]);

  return (
    <ChromaKeyVideo
      key={src}
      src={src}
      className={cn('pointer-events-none select-none', className)}
      onError={() => setAttempt((a) => a + 1)} />);

}
