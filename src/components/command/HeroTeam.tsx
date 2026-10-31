import React from 'react';
import { motion } from 'framer-motion';
import { agents } from '../../data/agents';
import { useAiva } from '../../contexts/AivaContext';
import { agentIcons } from '../agent/agentIcons';
import { StatusDot } from '../ui/Panel';
import { cn } from '../../utils/cn';

const ROOM = "/fc167d77-154f-42cc-bf9d-1fca0f5f57a1.jpg";

/**
 * The command center itself: the six agents standing in the room, each one a
 * live entry point into their immersive presentation.
 */
export function HeroTeam() {
  const { summon, agentStates, stageOpen } = useAiva();

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border border-line transition-opacity duration-300 ease-cinema',
        stageOpen && 'opacity-40'
      )}
      aria-label="AIVA command center">
      
      <img
        src={ROOM}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: 'saturate(0.85) brightness(0.72)' }} />
      
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
          'linear-gradient(90deg, rgba(4,6,13,0.96) 0%, rgba(4,6,13,0.62) 38%, rgba(4,6,13,0.5) 62%, rgba(4,6,13,0.94) 100%)'
        }} />
      
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-40"
        style={{ background: 'linear-gradient(180deg, transparent, #04060d)' }} />
      

      <div className="relative flex min-h-[420px] flex-col justify-between px-6 pb-4 pt-7 md:min-h-[520px] md:px-9 md:pt-10">
        <div className="relative z-10 max-w-[520px]">
          <p className="text-[10px] uppercase tracking-widest text-ink-faint">The AI Sales Command Center</p>
          <h1 className="mt-3 font-serif text-[46px] leading-[0.92] text-ink md:text-[62px]">
            AI Agents.
            <br />
            Real Results.
          </h1>
          <p className="mt-4 max-w-[340px] text-[13px] leading-relaxed text-ink-muted">
            Autonomous calls. Intelligent conversations. More revenue.
          </p>
          <p className="mt-5 text-[12px] uppercase tracking-widest" style={{ color: '#22d3ee' }}>
            Meet your AI sales team ↓
          </p>
        </div>

        {/* The team, standing in the room */}
        <div className="relative z-10 mt-6 grid grid-cols-3 gap-2 md:mt-0 md:grid-cols-6 md:gap-3">
          {agents.map((agent, idx) => {
            const Icon = agentIcons[agent.id];
            const state = agentStates[agent.id];
            return (
              <motion.button
                key={agent.id}
                type="button"
                onClick={() => summon(agent.id)}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 * idx, duration: 0.42, ease: [0.23, 1, 0.32, 1] }}
                className="group relative flex flex-col items-center rounded-xl border border-line bg-[#070b16]/55 pb-3 pt-0 text-center backdrop-blur-md transition-[transform,border-color,background-color] duration-200 ease-cinema hover:-translate-y-1 hover:bg-[#0b1120]/80"
                style={{ ['--accent' as string]: agent.accent }}
                aria-label={`Summon ${agent.name}, ${agent.role}`}>
                
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 -top-[86px] hidden h-[86px] justify-center overflow-hidden md:flex">
                  
                  <img
                    src={agent.avatar}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-[230px] w-auto max-w-none object-contain opacity-90 transition-transform duration-300 ease-cinema group-hover:-translate-y-1"
                    style={{
                      mixBlendMode: 'screen',
                      objectPosition: agent.focus,
                      maskImage: 'radial-gradient(65% 62% at 50% 42%, #000 55%, transparent 78%)',
                      WebkitMaskImage: 'radial-gradient(65% 62% at 50% 42%, #000 55%, transparent 78%)'
                    }} />
                  
                </span>

                <span
                  className="mt-3 grid h-9 w-9 place-items-center rounded-full"
                  style={{ background: `${agent.accent}1f`, boxShadow: `0 0 0 1px ${agent.accent}44` }}>
                  
                  <Icon className="h-4 w-4" />
                </span>
                <span className="mt-2 block text-[12px] font-medium tracking-wide text-ink">{agent.name}</span>
                <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-ink-faint">
                  {agent.shortRole}
                </span>
                <span className="mt-2 flex items-center gap-1.5 text-[10px] text-ink-muted">
                  <StatusDot color={agent.accent} pulse={state !== 'idle'} />
                  {state === 'idle' ? agent.liveStatus[0] : state}
                </span>
              </motion.button>);

          })}
        </div>
      </div>
    </section>);

}