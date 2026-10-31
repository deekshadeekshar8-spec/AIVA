import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, ShieldAlertIcon, SparklesIcon } from 'lucide-react';
import { agentMap, agents } from '../data/agents';
import { useAiva } from '../contexts/AivaContext';
import { agentIcons } from '../components/agent/agentIcons';
import { AgentPortrait } from '../components/agent/AgentAvatar';
import { Eyebrow, Panel, StatusDot } from '../components/ui/Panel';
import { useRealCrmStats, PERSONA_TO_REAL_AGENT } from '../hooks/useRealCrmStats';
import type { AgentId } from '../types/agent';

export function AgentProfile() {
  const { agentId } = useParams<{agentId: string;}>();
  const { summon, runAction, actionLog } = useAiva();
  const { byPersona, leads, loading } = useRealCrmStats();

  if (!agentId || !(agentId in agentMap)) return <Navigate to="/agents" replace />;
  const agent = agentMap[agentId as AgentId];
  const Icon = agentIcons[agent.id];
  const log = actionLog.filter((a) => a.agentId === agent.id);
  const stat = byPersona[agent.id];
  const myLeads = leads.
  filter((l) => l.agentId === PERSONA_TO_REAL_AGENT[agent.id]).
  sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()).
  slice(0, 8);

  return (
    <div className="space-y-3" style={{ ['--accent' as string]: agent.accent }}>
      <Link
        to="/agents"
        className="inline-flex items-center gap-1.5 text-[12px] text-ink-faint transition-colors duration-150 ease-cinema hover:text-ink">
        
        <ArrowLeftIcon className="h-3.5 w-3.5" /> All agents
      </Link>

      <header className="glass relative overflow-hidden rounded-2xl">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: `radial-gradient(60% 90% at 12% 30%, ${agent.accent}26, transparent 65%)` }} />
        
        <div className="relative grid gap-6 px-6 py-7 md:grid-cols-[220px_1fr] md:px-9">
          <div className="relative hidden h-[260px] md:block">
            <img
              src={agent.avatar}
              alt={`${agent.name}, ${agent.role}`}
              className="absolute bottom-0 left-0 h-[300px] w-auto max-w-none object-contain"
              style={{
                maskImage: 'linear-gradient(180deg, #000 78%, transparent 98%)',
                WebkitMaskImage: 'linear-gradient(180deg, #000 78%, transparent 98%)',
                filter: 'drop-shadow(0 22px 40px rgba(0,0,0,.6))'
              }} />
            
          </div>

          <div className="min-w-0">
            <Eyebrow>
              {agent.index} · {agent.shortRole}
            </Eyebrow>
            <h1 className="mt-2 font-serif text-[52px] leading-[0.95] text-ink">{agent.name}</h1>
            <p className="mt-1 text-[14px] text-ink-muted">{agent.role}</p>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px]">
              <span className="flex items-center gap-2 text-ink">
                <StatusDot color={agent.accent} /> {agent.status}
              </span>
              <span className="text-ink-faint">{agent.speakingStyle}</span>
            </div>

            <p className="mt-5 max-w-[520px] font-serif text-[22px] leading-snug text-ink">{agent.mission}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => summon(agent.id)}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium text-void transition-transform duration-150 ease-cinema active:scale-[0.99]"
                style={{ background: agent.accent }}>
                
                <SparklesIcon className="h-4 w-4" /> Bring {agent.name} on stage
              </button>
              <span
                className="grid place-items-center rounded-xl border px-3"
                style={{ borderColor: `${agent.accent}44` }}>
                
                <Icon className="h-4 w-4" />
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <Panel title="Real workload" subtitle={loading ? 'Loading…' : undefined}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
              ['Assigned Leads', stat?.assigned ?? 0],
              ['Contacted', stat?.contacted ?? 0],
              ['Hot Leads', stat?.hot ?? 0],
              ['Completed', stat?.completed ?? 0]].
              map(([label, value]) =>
              <div key={label as string}>
                  <p className="font-serif text-[32px] leading-none text-ink">{loading ? '—' : value}</p>
                  <p className="mt-1.5 text-[11.5px] text-ink-muted">{label}</p>
                </div>
              )}
            </div>
          </Panel>

          <div className="grid gap-3 md:grid-cols-2">
            <Panel title="What I analyse">
              <ul className="space-y-2 text-[13px] text-ink-muted">
                {agent.analyzes.map((a) =>
                <li key={a} className="flex items-center gap-2.5">
                    <span className="h-1 w-1 rounded-full" style={{ background: agent.accent }} />
                    {a}
                  </li>
                )}
              </ul>
            </Panel>

            <Panel title="What I'm responsible for">
              <ul className="space-y-2 text-[13px] text-ink-muted">
                {agent.responsibilities.map((r) =>
                <li key={r} className="flex items-start gap-2.5">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full" style={{ background: agent.accent }} />
                    {r}
                  </li>
                )}
              </ul>
            </Panel>
          </div>

          <Panel title="Recent leads">
            {myLeads.length === 0 ?
            <p className="py-4 text-[12.5px] text-ink-faint">{loading ? 'Loading…' : 'No leads assigned yet.'}</p> :

            <ul className="divide-y divide-line">
                {myLeads.map((l) =>
              <li key={l.id}>
                    <Link to={`/leads/${l.id}`} className="flex items-baseline gap-4 py-2.5 text-left first:pt-0 last:pb-0 hover:opacity-80">
                      <span className="w-32 shrink-0 truncate text-[12.5px] text-ink">{l.name}</span>
                      <span className="w-28 shrink-0 text-[12px] text-ink-muted">{l.status}</span>
                      <span className="text-[12px] text-ink-faint">{l.interestLevel}</span>
                    </Link>
                  </li>
              )}
              </ul>
            }
          </Panel>
        </div>

        <aside className="space-y-3">
          <Panel title="What I can do" subtitle="Sensitive actions always ask first">
            <div className="grid gap-2">
              {agent.actions.map((action) =>
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  summon(agent.id);
                  window.setTimeout(() => runAction(agent.id, action.id), 1400);
                }}
                className="flex items-center justify-between rounded-xl border border-line bg-white/[0.02] px-3 py-2.5 text-left text-[12.5px] text-ink-muted transition-colors duration-200 ease-cinema hover:bg-white/[0.05] hover:text-ink">
                
                  {action.label}
                  {action.kind === 'confirm' && <ShieldAlertIcon className="h-3.5 w-3.5 text-agent-objection" />}
                  {action.kind === 'handoff' && action.target &&
                <span className="text-[11px]" style={{ color: agentMap[action.target].accent }}>
                      → {agentMap[action.target].name}
                    </span>
                }
                </button>
              )}
            </div>
          </Panel>

          <Panel title="I work with">
            <ul className="space-y-2">
              {agents.map((other) =>
              <li key={other.id}>
                  <Link
                  to={`/agents/${other.id}`}
                  className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors duration-150 ease-cinema hover:bg-white/[0.05]">
                  
                    <AgentPortrait agent={other} size={26} active={other.id === agent.id} />
                    <span className="text-[12.5px] text-ink">{other.name}</span>
                    <span className="ml-auto text-[11px] text-ink-faint">{other.shortRole}</span>
                  </Link>
                </li>
              )}
            </ul>
          </Panel>

          {log.length > 0 &&
          <Panel title="Executed this session">
              <ul className="space-y-2 text-[12px]">
                {log.map((a) =>
              <li key={a.id}>
                    <p className="text-ink">{a.label}</p>
                    <p className="text-ink-faint">
                      {a.time} · {a.result}
                    </p>
                  </li>
              )}
              </ul>
            </Panel>
          }
        </aside>
      </div>
    </div>);

}