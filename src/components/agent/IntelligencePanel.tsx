import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDownIcon } from 'lucide-react';
import { agents } from '../../data/agents';
import { useAiva } from '../../contexts/AivaContext';
import { StatusDot } from '../ui/Panel';
import { cn } from '../../utils/cn';

/** Floating real-time roster: what all six agents are doing, right now. */
export function IntelligencePanel() {
  const { agentStates, summon, activeAgent } = useAiva();
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 3600);
    return () => window.clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="fixed bottom-4 right-4 z-40 hidden w-[248px] overflow-hidden rounded-2xl border border-line bg-[#070b16]/90 backdrop-blur-xl xl:block"
      style={{ boxShadow: '0 30px 70px -30px rgba(0,0,0,.95)' }}>
      
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3">
        
        <span className="text-[10px] uppercase tracking-widest text-ink-faint">AIVA Intelligence</span>
        <ChevronDownIcon
          className={cn('h-3.5 w-3.5 text-ink-faint transition-transform duration-200 ease-cinema', !open && 'rotate-180')} />
        
      </button>

      {open &&
      <ul className="space-y-0.5 px-2 pb-2">
          {agents.map((agent, idx) => {
          const state = agentStates[agent.id];
          const status =
          state === 'idle' ?
          agent.liveStatus[(tick + idx) % agent.liveStatus.length] :
          state.charAt(0).toUpperCase() + state.slice(1);
          const active = activeAgent?.id === agent.id;
          return (
            <li key={agent.id}>
                <button
                type="button"
                onClick={() => summon(agent.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 ease-cinema hover:bg-white/[0.05]',
                  active && 'bg-white/[0.06]'
                )}>
                
                  <StatusDot color={agent.accent} pulse={state !== 'idle'} />
                  <span className="w-[42px] shrink-0 text-[12px] text-ink">{agent.name}</span>
                  <span className="truncate text-[11px] text-ink-faint">{status}</span>
                </button>
              </li>);

        })}
        </ul>
      }
    </motion.div>);

}