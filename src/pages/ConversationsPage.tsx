import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon } from 'lucide-react';
import { Panel } from '../components/ui/Panel';
import { searchTranscripts } from '../api/insights';
import { getCallEvents, getLeads, type CallEvent } from '../api/leads';
import type { Lead } from '../api/types';

const AGENT_NAMES: Record<string, string> = {
  agent_1: 'Kavya',
  agent_2: 'Arjun',
  agent_3: 'Ananya',
  agent_4: 'Rohan',
  agent_5: 'Priya',
  agent_6: 'Vistara'
};

export function ConversationsPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchTranscripts>>>([]);
  const [searched, setSearched] = useState(false);
  const [recent, setRecent] = useState<CallEvent[]>([]);
  const [agentByLeadId, setAgentByLeadId] = useState<Record<string, string>>({});
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    Promise.all([getCallEvents(), getLeads()]).
    then(([events, leads]: [CallEvent[], Lead[]]) => {
      setRecent(events.slice(0, 20));
      setAgentByLeadId(Object.fromEntries(leads.map((l) => [l.id, l.agentId])));
    }).
    catch(() => setRecent([])).
    finally(() => setLoadingRecent(false));
  }, []);

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearched(true);
    try {
      const res = await searchTranscripts(query.trim());
      setResults(res);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-3">
      <Panel title="Conversations" subtitle="Every real transcript AIVA has captured, searchable — indexed by Priya, scored by Arjun.">
        <form onSubmit={runSearch} className="flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-4 py-2">
          <SearchIcon className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search real transcripts — a name, an objection, a project…"
            className="w-full bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none" />

          <button type="submit" disabled={searching} className="rounded-full bg-agent-intent px-3 py-1 text-[11.5px] font-medium text-void disabled:opacity-50">
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {searched &&
        <div className="mt-4 space-y-2.5">
            {results.length === 0 && !searching &&
          <p className="text-[12.5px] text-ink-faint">No transcripts match "{query}".</p>
          }
            {results.map((r) =>
          <button
            key={`${r.leadId}-${r.recordingId}`}
            type="button"
            onClick={() => navigate(`/leads/${r.leadId}`)}
            className="block w-full rounded-xl border border-line px-4 py-3 text-left transition-colors duration-150 ease-cinema hover:bg-white/[0.03]">

                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-ink">{r.leadName}</span>
                  <span className="text-ink-faint">{r.date ? new Date(r.date).toLocaleDateString() : ''}</span>
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">…{r.snippet}…</p>
              </button>
          )}
          </div>
        }
      </Panel>

      <Panel title="Recent Calls" subtitle="Real Omnidimension call log">
        {loadingRecent && <p className="text-[12.5px] text-ink-faint">Loading…</p>}
        <div className="divide-y divide-line">
          {recent.map((c) =>
          <button
            key={c.id}
            type="button"
            onClick={() => c.leadId && navigate(`/leads/${c.leadId}`)}
            className="flex w-full items-center justify-between py-2.5 text-left text-[12.5px] transition-colors duration-150 ease-cinema hover:bg-white/[0.02]">

              <div>
                <p className="text-ink">{c.leadName || c.leadId}</p>
                <p className="text-[11px] text-ink-faint">{AGENT_NAMES[agentByLeadId[c.leadId || '']] || 'Unassigned'}</p>
              </div>
              <div className="text-right">
                <p className="text-ink-muted">{c.callStatus}</p>
                <p className="text-[11px] text-ink-faint">{c.receivedAt ? new Date(c.receivedAt).toLocaleString() : ''}</p>
              </div>
            </button>
          )}
          {!loadingRecent && recent.length === 0 &&
          <p className="py-4 text-center text-[12.5px] text-ink-faint">No calls recorded yet.</p>
          }
        </div>
      </Panel>
    </div>);

}
