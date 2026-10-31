import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRightIcon, PlayIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { agentMap, agents } from '../../data/agents';
import { Eyebrow, Panel } from '../ui/Panel';
import { agentIcons } from '../agent/agentIcons';
import { useAiva } from '../../contexts/AivaContext';
import { useRealCrmStatsContext } from '../../contexts/RealCrmStatsContext';
import { cn } from '../../utils/cn';
import type { AgentId } from '../../types/agent';

export function TeamFlow() {
  const { summon } = useAiva();
  const navigate = useNavigate();
  const { leads } = useRealCrmStatsContext();
  const [step, setStep] = useState(-1);

  const focusLead = useMemo(() => {
    const hot = leads.find((l) => l.interestLevel === 'Hot Lead' || l.interestLevel === 'Interested');
    return hot || leads[0] || null;
  }, [leads]);

  const chatter: { agent: AgentId; line: string }[] = focusLead ?
  [
  { agent: 'ava', line: `I've spoken with ${focusLead.name}. Status: ${focusLead.status}.` },
  { agent: 'aria', line: `Interest level reads as ${focusLead.interestLevel}.` },
  { agent: 'mira', line: focusLead.remarks ? `Their notes: "${focusLead.remarks.slice(0, 60)}${focusLead.remarks.length > 60 ? '…' : ''}"` : 'No remarks logged for this lead yet.' },
  { agent: 'zara', line: focusLead.budget ? `Budget on file: ₹${(focusLead.budget / 100000).toFixed(1)}L.` : 'No budget on file yet.' },
  { agent: 'nia', line: focusLead.project ? `They're interested in ${focusLead.project}.` : 'No project preference recorded yet.' },
  { agent: 'nova', line: focusLead.nextFollowUpDate ? `Next follow-up is due ${new Date(focusLead.nextFollowUpDate).toLocaleDateString()}.` : 'No follow-up date scheduled yet.' }] :

  [];

  const running = step > -1 && step < chatter.length;
  const done = chatter.length > 0 && step >= chatter.length;

  useEffect(() => {
    if (step < 0 || step >= chatter.length) return;
    const id = window.setTimeout(() => setStep((s) => s + 1), 1700);
    return () => window.clearTimeout(id);
  }, [step, chatter.length]);

  return (
    <Panel id="team" className="overflow-hidden">
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div>
          <h2 className="font-serif text-[30px] leading-[1.05] text-ink">
            AI Agents Working Together.
            <br />
            Like a Real Team.
          </h2>
          <p className="mt-3 max-w-[280px] text-[12.5px] leading-relaxed text-ink-muted">
            Every call has a voice. Every lead has an intent. Every emotion has a signal. Every objection has an
            answer. Every customer has a memory. Every opportunity has an action.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep(0)}
              disabled={running || !focusLead}
              className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.04] px-3.5 py-2 text-[12.5px] text-ink transition-colors duration-200 ease-cinema hover:bg-white/[0.08] disabled:opacity-50">

              <PlayIcon className="h-3.5 w-3.5" /> {running ? 'Handoff running…' : focusLead ? `Walk through ${focusLead.name}` : 'No lead available yet'}
            </button>
            <Link
              to="/agents"
              className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-[12.5px] text-ink-muted transition-colors duration-200 ease-cinema hover:text-ink">

              Explore AI Agents <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
          <p className="mt-6 font-serif text-[15px] italic text-ink-faint">
            Six agents. One autonomous sales team.
          </p>
        </div>

        <div>
          <div className="relative flex items-end justify-between gap-2">
            <span
              aria-hidden
              className="absolute left-4 right-4 top-[22px] h-px"
              style={{ background: 'linear-gradient(90deg,#22d3ee44,#a78bfa44,#34d39944,#fbbf2444,#60a5fa44,#2dd4bf44)' }} />

            {agents.map((agent, idx) => {
              const Icon = agentIcons[agent.id];
              const reached = step >= idx;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => summon(agent.id)}
                  className="group relative z-10 flex flex-1 flex-col items-center gap-2"
                  aria-label={`Summon ${agent.name}`}>

                  <span
                    className={cn(
                      'grid h-11 w-11 place-items-center rounded-full border transition-[transform,box-shadow] duration-300 ease-cinema group-hover:-translate-y-0.5',
                      reached ? 'scale-105' : ''
                    )}
                    style={{
                      background: reached ? `${agent.accent}26` : 'rgba(255,255,255,0.03)',
                      borderColor: reached ? `${agent.accent}88` : 'rgba(122,154,208,0.16)',
                      boxShadow: reached ? `0 0 26px -6px ${agent.accent}` : 'none'
                    }}>

                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-center text-[11px] text-ink">{agent.name}</span>
                  <span className="hidden text-center text-[10px] leading-tight text-ink-faint sm:block">
                    {agent.shortRole.replace(' Agent', '')}
                  </span>
                </button>);

            })}
          </div>

          <div className="mt-5 min-h-[132px] space-y-2">
            <AnimatePresence initial={false}>
              {chatter.slice(0, Math.max(0, step + 1)).map((c) =>
              <motion.p
                key={c.agent}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                className="text-[12.5px]">

                  <span className="mr-2 font-medium uppercase tracking-wide" style={{ color: agentMap[c.agent].accent }}>
                    {agentMap[c.agent].name}
                  </span>
                  <span className="text-ink-muted">{c.line}</span>
                </motion.p>
              )}
            </AnimatePresence>

            {step < 0 && focusLead &&
            <p className="text-[12.5px] text-ink-faint">
                Press the button to walk through what the team knows about {focusLead.name}, using their real record.
              </p>
            }
          </div>

          <AnimatePresence>
            {done && focusLead &&
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="mt-2 rounded-xl border border-line bg-white/[0.02] p-4">

                <Eyebrow>Real lead record</Eyebrow>
                <div className="mt-2 grid gap-x-6 gap-y-2 text-[12px] sm:grid-cols-3">
                  {[
                ['Lead', focusLead.name],
                ['Status', focusLead.status],
                ['Interest', focusLead.interestLevel],
                ['Project', focusLead.project || '—'],
                ['Next Follow-up', focusLead.nextFollowUpDate ? new Date(focusLead.nextFollowUpDate).toLocaleDateString() : '—']].
                map(([k, v]) =>
                <div key={k}>
                      <p className="text-ink-faint">{k}</p>
                      <p className="text-ink">{v}</p>
                    </div>
                )}
                </div>
                <button
                type="button"
                onClick={() => navigate(`/leads/${focusLead.id}`)}
                className="mt-4 flex items-center gap-2 rounded-xl bg-agent-action/15 px-3.5 py-2 text-[12.5px] text-agent-action transition-colors duration-200 ease-cinema hover:bg-agent-action/25">

                  Open full lead profile <ArrowRightIcon className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            }
          </AnimatePresence>
        </div>
      </div>
    </Panel>);

}
