import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../utils/cn';
import type { Agent, AgentState } from '../../types/agent';

/** Pseudo-amplitude driving the speaking glow + waveform (lip-sync surrogate). */
function useVoiceAmplitude(active: boolean) {
  const [amp, setAmp] = useState(0);
  const value = useRef(0);

  useEffect(() => {
    if (!active) {
      setAmp(0);
      value.current = 0;
      return;
    }
    const id = window.setInterval(() => {
      const target = 0.25 + Math.random() * 0.75;
      value.current = value.current * 0.45 + target * 0.55;
      setAmp(value.current);
    }, 90);
    return () => window.clearInterval(id);
  }, [active]);

  return amp;
}

const SPEAKING_STATES: AgentState[] = ['speaking', 'explaining', 'warning', 'success', 'executing'];

interface AgentAvatarProps {
  agent: Agent;
  state: AgentState;
  /** Whether a dashboard panel is currently illuminated — keeps the character
   *  holding position toward it instead of snapping back between lines. */
  atPanel?: boolean;
  className?: string;
}

export function AgentAvatar({ agent, state, atPanel = false, className }: AgentAvatarProps) {
  const reduce = useReducedMotion();
  const isSpeaking = SPEAKING_STATES.includes(state);
  const amp = useVoiceAmplitude(isSpeaking && !reduce);

  const entering = state === 'entering';
  const exiting = state === 'exiting';
  const isWalking = state === 'walking';

  return (
    <motion.div
      className={cn('pointer-events-none relative select-none', className)}
      initial={{ opacity: 0, x: -120, scale: 0.94 }}
      animate={{
        opacity: exiting ? 0 : 1,
        x: exiting ? -70 : atPanel || isWalking ? 68 : 0,
        scale: entering ? 0.97 : atPanel || isWalking ? 1.02 : 1,
        rotate: isWalking ? [0, -1.4, 0, 1.4, 0] : 0
      }}
      transition={
      isWalking ?
      { duration: 0.9, ease: [0.4, 0, 0.2, 1], rotate: { duration: 0.46, repeat: 1, ease: 'easeInOut' } } :
      { duration: 0.62, ease: [0.23, 1, 0.32, 1] }
      }
      style={{ ['--accent' as string]: agent.accent }}>
      
      {/* ambient key light */}
      <div
        aria-hidden
        className="absolute inset-x-[-30%] bottom-[6%] top-[4%] rounded-full blur-3xl transition-opacity duration-500 ease-cinema"
        style={{
          background: `radial-gradient(50% 55% at 50% 45%, ${agent.accent}, transparent 70%)`,
          opacity: 0.16 + amp * 0.14
        }} />
      

      {/* floor pool */}
      <motion.div
        aria-hidden
        className="absolute bottom-[2%] left-1/2 h-10 w-[62%] -translate-x-1/2 rounded-[100%] blur-2xl"
        animate={{ opacity: isWalking ? [0.24, 0.14, 0.24] : 0.24, scaleX: isWalking ? [1, 0.86, 1] : 1 }}
        transition={{ duration: 0.46, repeat: isWalking ? 1 : 0, ease: 'easeInOut' }}
        style={{ background: agent.accent }} />


      <motion.div
        className="relative h-full w-full"
        animate={
        reduce ?
        undefined :
        isWalking ?
        { y: [0, -9, 0, -9, 0] } :
        isSpeaking ?
        { y: [0, -5, 0, -3, 0], rotate: [0, 0.5, 0, -0.4, 0] } :
        { y: [0, -6, 0], rotate: [-0.3, 0.3, -0.3] }
        }
        transition={{
          duration: isWalking ? 0.46 : isSpeaking ? 3.2 : 6.4,
          repeat: isWalking ? 1 : Infinity,
          ease: 'easeInOut'
        }}>
        
        <img
          src={agent.avatar}
          alt={`${agent.name}, ${agent.role}`}
          className="h-full w-full object-contain object-bottom"
          style={{
            filter: `drop-shadow(0 26px 50px rgba(0,0,0,.65)) saturate(${1 + amp * 0.14})`
          }}
          decoding="async" />
        

        {/* speech light on the face */}
        <div
          aria-hidden
          className="absolute left-1/2 top-[12%] h-24 w-24 -translate-x-1/2 rounded-full blur-2xl transition-opacity duration-100"
          style={{ background: agent.accent, opacity: isSpeaking ? 0.1 + amp * 0.22 : 0 }} />
        

        {/* listening focus ring */}
        {state === 'listening' &&
        <div
          aria-hidden
          className="absolute left-1/2 top-[10%] h-28 w-28 -translate-x-1/2 rounded-full border animate-pulse-ring"
          style={{ borderColor: agent.accent }} />

        }

        {/* thinking scan */}
        {state === 'thinking' &&
        <div aria-hidden className="absolute inset-x-[18%] top-[8%] h-40 overflow-hidden">
            <div
            className="h-6 w-full animate-scan blur-md"
            style={{ background: `linear-gradient(90deg, transparent, ${agent.accent}, transparent)`, opacity: 0.5 }} />
          
          </div>
        }
      </motion.div>

      {/* voice waveform at the feet */}
      <div aria-hidden className="absolute bottom-[3%] left-1/2 flex h-8 -translate-x-1/2 items-end gap-[3px]">
        {Array.from({ length: 17 }).map((_, i) => {
          const centre = 1 - Math.abs(i - 8) / 9;
          const h = isSpeaking ? 3 + amp * 26 * centre * (0.6 + i * 37 % 10 / 14) : 2;
          return (
            <span
              key={i}
              className="w-[3px] rounded-full transition-[height] duration-100 ease-out"
              style={{ height: h, background: agent.accent, opacity: isSpeaking ? 0.75 : 0.22 }} />);


        })}
      </div>
    </motion.div>);

}

interface AgentPortraitProps {
  agent: Agent;
  size?: number;
  active?: boolean;
  className?: string;
}

/** Compact circular portrait for cards, chips and rosters. */
export function AgentPortrait({ agent, size = 44, active = false, className }: AgentPortraitProps) {
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}>
      
      {active &&
      <span
        aria-hidden
        className="absolute inset-0 rounded-full animate-pulse-ring"
        style={{ boxShadow: `0 0 0 1px ${agent.accent}` }} />

      }
      <span
        className="h-full w-full overflow-hidden rounded-full"
        style={{ boxShadow: `0 0 0 1px ${agent.accent}55, 0 8px 24px -12px ${agent.accent}` }}>
        
        <img
          src={agent.avatar}
          alt={agent.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full scale-[1.9] object-cover"
          style={{ objectPosition: agent.focus, transformOrigin: '50% 22%' }} />
        
      </span>
    </span>);

}