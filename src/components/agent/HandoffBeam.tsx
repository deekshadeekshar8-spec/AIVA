import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { agentMap } from '../../data/agents';
import type { AgentId } from '../../types/agent';

interface HandoffBeamProps {
  handoff: {from: AgentId;to: AgentId;} | null;
}

/** Visualises intelligence physically travelling from one agent to another. */
export function HandoffBeam({ handoff }: HandoffBeamProps) {
  return (
    <AnimatePresence>
      {handoff &&
      <motion.div
        key={`${handoff.from}-${handoff.to}`}
        className="pointer-events-none absolute inset-0 z-[90]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}>
        
          <div className="absolute left-[12%] right-[14%] top-1/2 h-px -translate-y-1/2 overflow-visible">
            <div
            className="h-px w-full"
            style={{
              background: `linear-gradient(90deg, ${agentMap[handoff.from].accent}, ${agentMap[handoff.to].accent})`,
              opacity: 0.35
            }} />
          
            <motion.span
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full"
            style={{
              background: agentMap[handoff.to].accent,
              boxShadow: `0 0 24px 6px ${agentMap[handoff.to].accent}`
            }}
            initial={{ left: '0%', scale: 0.7 }}
            animate={{ left: '100%', scale: 1 }}
            transition={{ duration: 1.5, ease: [0.23, 1, 0.32, 1] }} />
          
          </div>

          <motion.div
          className="glass absolute right-[8%] top-[calc(50%+28px)] rounded-xl px-4 py-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
          style={{ boxShadow: `0 0 0 1px ${agentMap[handoff.to].accent}66` }}>
          
            <p className="text-[10px] uppercase tracking-widest text-ink-faint">
              {agentMap[handoff.from].name} → {agentMap[handoff.to].name}
            </p>
            <p className="mt-1 text-[13px] text-ink">New conversation intelligence received.</p>
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

}