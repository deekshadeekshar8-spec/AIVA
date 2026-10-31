import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRightIcon, SparklesIcon } from 'lucide-react';
import { agents } from '../data/agents';
import { useAiva } from '../contexts/AivaContext';
import { agentIcons } from '../components/agent/agentIcons';
import { Eyebrow, StatusDot } from '../components/ui/Panel';
import { useRealCrmStats } from '../hooks/useRealCrmStats';

const manifesto = [
'Every call has a voice.',
'Every lead has an intent.',
'Every emotion has a signal.',
'Every objection has an answer.',
'Every customer has a memory.',
'Every opportunity has an action.'];


export function AgentsPage() {
  const { summon, agentStates } = useAiva();
  const { byPersona, loading } = useRealCrmStats();

  return (
    <div className="space-y-4">
      <header className="glass rounded-2xl px-6 py-8 md:px-9 md:py-10">
        <Eyebrow>Meet your AI sales team</Eyebrow>
        <h1 className="mt-3 max-w-[620px] font-serif text-[42px] leading-[1] text-ink md:text-[54px]">
          Six specialists. One autonomous sales team.
        </h1>
        <ul className="mt-6 grid gap-1.5 text-[13px] text-ink-muted sm:grid-cols-2 lg:grid-cols-3">
          {manifesto.map((line) =>
          <li key={line}>{line}</li>
          )}
        </ul>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent, idx) => {
          const Icon = agentIcons[agent.id];
          const state = agentStates[agent.id];
          return (
            <motion.article
              key={agent.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.36, ease: [0.23, 1, 0.32, 1] }}
              className="glass group relative overflow-hidden rounded-2xl"
              style={{ ['--accent' as string]: agent.accent }}>
              
              <div className="relative h-[220px] overflow-hidden">
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: `radial-gradient(70% 60% at 50% 20%, ${agent.accent}2e, transparent 70%)` }} />
                
                <img
                  src={agent.avatar}
                  alt={`${agent.name}, ${agent.role}`}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-x-0 top-0 mx-auto h-[330px] w-auto max-w-none object-contain transition-transform duration-500 ease-cinema group-hover:scale-[1.03]"
                  style={{
                    maskImage: 'linear-gradient(180deg, #000 62%, transparent 96%)',
                    WebkitMaskImage: 'linear-gradient(180deg, #000 62%, transparent 96%)'
                  }} />
                
                <span className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-line bg-[#04060d]/70 px-2.5 py-1 text-[10px] uppercase tracking-widest text-ink-muted backdrop-blur">
                  <StatusDot color={agent.accent} pulse={state !== 'idle'} /> {agent.index}
                </span>
              </div>

              <div className="relative -mt-6 px-5 pb-5">
                <div className="flex items-center gap-2.5">
                  <span
                    className="grid h-8 w-8 place-items-center rounded-full"
                    style={{ background: `${agent.accent}1f`, boxShadow: `0 0 0 1px ${agent.accent}44` }}>
                    
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="font-serif text-[26px] leading-none text-ink">{agent.name}</h2>
                    <p className="text-[11px] uppercase tracking-wide text-ink-faint">{agent.role}</p>
                  </div>
                </div>

                <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">{agent.mission}</p>
                <p className="mt-2 text-[12px] italic text-ink-faint">{agent.personality}</p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="font-serif text-xl leading-none text-ink">{loading ? '—' : byPersona[agent.id]?.assigned ?? 0}</p>
                    <p className="text-[10.5px] text-ink-faint">Assigned Leads</p>
                  </div>
                  <div>
                    <p className="font-serif text-xl leading-none text-ink">{loading ? '—' : byPersona[agent.id]?.contacted ?? 0}</p>
                    <p className="text-[10.5px] text-ink-faint">Contacted</p>
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => summon(agent.id)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[12.5px] font-medium text-void transition-transform duration-150 ease-cinema active:scale-[0.99]"
                    style={{ background: agent.accent }}>
                    
                    <SparklesIcon className="h-3.5 w-3.5" /> Meet {agent.name}
                  </button>
                  <Link
                    to={`/agents/${agent.id}`}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-line px-3.5 text-[12.5px] text-ink-muted transition-colors duration-200 ease-cinema hover:text-ink">
                    
                    Profile <ArrowRightIcon className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </motion.article>);

        })}
      </div>
    </div>);

}