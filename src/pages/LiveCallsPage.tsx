import React, { useEffect, useState } from 'react';
import { agents } from '../data/agents';
import { Eyebrow, Panel, StatusDot } from '../components/ui/Panel';
import { useAiva } from '../contexts/AivaContext';
import { agentIcons } from '../components/agent/agentIcons';
import { getCallEvents, type CallEvent } from '../api/leads';

function formatDuration(seconds: number) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function LiveCallsPage() {
  const { summon, agentStates } = useAiva();
  const [events, setEvents] = useState<CallEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCallEvents().
    then((data) => {
      if (!cancelled) setEvents(data);
    }).
    catch((err) => {
      if (!cancelled) setError(err?.message || 'Could not load call events.');
    }).
    finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_336px]">
      <div className="space-y-3">
        <Panel title="Recent calls" subtitle={loading ? 'Loading real call log…' : `${events.length} recent call events`}>
          {error && <p className="text-[12.5px] text-red-400">{error}</p>}
          <div className="space-y-2.5">
            {events.slice(0, 20).map((ev) =>
            <div key={ev.id} className="rounded-2xl border border-line bg-white/[0.03] px-4 py-3">
                <p className="mb-1 flex items-center justify-between gap-6 text-[10px] uppercase tracking-widest text-ink-faint">
                  <span>{ev.leadName || 'Unknown lead'}</span>
                  <span>{new Date(ev.receivedAt).toLocaleString()}</span>
                </p>
                <p className="text-[13.5px] leading-relaxed text-ink">
                  {ev.callStatus} · {formatDuration(ev.durationSeconds)} {ev.sentiment ? `· ${ev.sentiment}` : ''}
                </p>
                {ev.summary && <p className="mt-1 text-[12px] text-ink-muted">{ev.summary}</p>}
              </div>
            )}
            {!loading && events.length === 0 &&
            <p className="py-6 text-center text-[12.5px] text-ink-faint">No call events recorded yet.</p>
            }
          </div>
        </Panel>

        <Panel title="AI sales team">
          <ul className="grid gap-2 md:grid-cols-2">
            {agents.map((agent) => {
              const Icon = agentIcons[agent.id];
              const state = agentStates[agent.id];
              return (
                <li key={agent.id}>
                  <button
                    type="button"
                    onClick={() => summon(agent.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5 text-left transition-colors duration-200 ease-cinema hover:bg-white/[0.05]">

                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                      style={{ background: `${agent.accent}18` }}>

                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] text-ink">{agent.name}</span>
                      <span className="block truncate text-[11px] text-ink-faint">{agent.shortRole}</span>
                    </span>
                    <StatusDot color={agent.accent} pulse={state !== 'idle'} />
                  </button>
                </li>);

            })}
          </ul>
        </Panel>
      </div>

      <aside className="space-y-3">
        <Panel>
          <Eyebrow>Live status</Eyebrow>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
            Call events shown here come directly from the real Omnidimension call log, polled every 5 minutes.
            Click any agent above to open their stage and ask questions about today's calls.
          </p>
        </Panel>
      </aside>
    </div>);

}
