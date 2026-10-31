import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';
import { AgentAvatar } from './AgentAvatar';
import { AgentCharacterVideo } from './AgentCharacterVideo';
import { AgentVideoPanel } from './AgentVideoPanel';
import type { Agent, AgentState } from '../../types/agent';

interface AgentCharacterProps {
  agent: Agent;
  state: AgentState;
  atPanel?: boolean;
  className?: string;
}

/**
 * Entry point for rendering an agent on stage. Falls through three render
 * modes, each degrading gracefully if its assets aren't there yet:
 *  1. Green-screen states — per-AgentState clips (src/motion/clipMap.ts),
 *     chroma-keyed live and composited as a floating transparent character.
 *     This is the target format for every agent — checked first so dropping
 *     in green-screen clips automatically supersedes the panel video below
 *     with no code changes.
 *  2. Panel video — a full cinematic clip with its own baked-in background
 *     (public/agents/<id>/presence.mp4), shown as a self-contained "video
 *     call" window, used only while an agent has no green-screen clips yet.
 *  3. The 2.5D photo AgentAvatar, if an agent has no video assets at all.
 */
export function AgentCharacter({ agent, state, atPanel = false, className }: AgentCharacterProps) {
  const [greenScreenAvailable, setGreenScreenAvailable] = useState(true);
  const [panelAvailable, setPanelAvailable] = useState(true);
  const handleGreenScreenUnavailable = useCallback(() => setGreenScreenAvailable(false), []);
  const handlePanelUnavailable = useCallback(() => setPanelAvailable(false), []);

  if (!greenScreenAvailable) {
    if (panelAvailable) {
      return (
        <AgentVideoPanel
          agent={agent}
          state={state}
          atPanel={atPanel}
          className={className}
          onUnavailable={handlePanelUnavailable} />);


    }
    return <AgentAvatar agent={agent} state={state} atPanel={atPanel} className={className} />;
  }

  const exiting = state === 'exiting';
  const entering = state === 'entering';
  const isWalking = state === 'walking';

  return (
    <motion.div
      className={cn('pointer-events-none relative select-none', className)}
      initial={{ opacity: 0, x: -120, scale: 0.94 }}
      animate={{
        opacity: exiting ? 0 : 1,
        x: exiting ? -70 : atPanel || isWalking ? 68 : 0,
        scale: entering ? 0.97 : atPanel || isWalking ? 1.02 : 1
      }}
      transition={{ duration: isWalking ? 0.9 : 0.62, ease: [0.23, 1, 0.32, 1] }}
      style={{ ['--accent' as string]: agent.accent }}>

      {/* ambient key light, same treatment as the photo avatar */}
      <div
        aria-hidden
        className="absolute inset-x-[-30%] bottom-[6%] top-[4%] rounded-full opacity-20 blur-3xl"
        style={{ background: `radial-gradient(50% 55% at 50% 45%, ${agent.accent}, transparent 70%)` }} />


      <AgentCharacterVideo
        agent={agent}
        state={state}
        className="relative h-full w-full"
        onUnavailable={handleGreenScreenUnavailable} />
    </motion.div>);

}
