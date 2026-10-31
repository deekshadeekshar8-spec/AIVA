import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon } from 'lucide-react';
import { Panel } from '../components/ui/Panel';
import { getLeads } from '../api/leads';
import type { Lead } from '../api/types';

function timeAgo(iso: string | null | undefined) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export function MemoryVaultPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    getLeads().
    then(setLeads).
    finally(() => setLoading(false));
  }, []);

  const withMemory = useMemo(
    () =>
    leads.
    filter((l) => (l.salesBrain?.callCount ?? 0) > 0 || l.remarks || (l.objections && l.objections.length > 0)).
    sort((a, b) => (b.salesBrain?.callCount ?? 0) - (a.salesBrain?.callCount ?? 0)),
    [leads]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return withMemory;
    const q = query.trim().toLowerCase();
    return withMemory.filter((l) => l.name.toLowerCase().includes(q) || l.phone.includes(q));
  }, [withMemory, query]);

  const totalCalls = leads.reduce((sum, l) => sum + (l.salesBrain?.callCount ?? 0), 0);
  const openObjections = leads.filter((l) => (l.objections?.length ?? 0) > 0 || (l.salesBrain?.objectionHistory?.length ?? 0) > 0).length;

  return (
    <div className="space-y-3">
      <Panel
        title="Memory Vault"
        subtitle={`${leads.length.toLocaleString()} real leads remembered — preferences, promises and objections, permanently.`}>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="font-serif text-3xl leading-none text-ink">{leads.length}</p>
            <p className="mt-1.5 text-[11px] text-ink-muted">Customers Remembered</p>
          </div>
          <div>
            <p className="font-serif text-3xl leading-none text-ink">{totalCalls}</p>
            <p className="mt-1.5 text-[11px] text-ink-muted">Calls in Memory</p>
          </div>
          <div>
            <p className="font-serif text-3xl leading-none text-ink">{openObjections}</p>
            <p className="mt-1.5 text-[11px] text-ink-muted">Open Objections</p>
          </div>
        </div>
      </Panel>

      <Panel title="Search Memory">
        <div className="flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-4 py-2">
          <SearchIcon className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a customer by name or phone…"
            className="w-full bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none" />

        </div>

        {loading && <p className="mt-4 text-[12.5px] text-ink-faint">Loading real memory…</p>}

        <div className="mt-4 divide-y divide-line">
          {filtered.map((l) => {
            const objections = new Set([...(l.objections || []), ...(l.salesBrain?.objectionHistory || [])]);
            const ago = timeAgo(l.lastContactTime);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => navigate(`/leads/${l.id}`)}
                className="block w-full py-3 text-left transition-colors duration-150 ease-cinema hover:bg-white/[0.02]">

                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-ink">{l.name}</span>
                  <span className="text-[11px] text-ink-faint">
                    {l.salesBrain?.callCount ?? 0} call{(l.salesBrain?.callCount ?? 0) === 1 ? '' : 's'} of memory
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-muted">
                  {l.projectInterest && <span>Wants {l.projectInterest}</span>}
                  {ago && <span>Last contact {ago}</span>}
                  {objections.size > 0 && <span className="text-agent-objection">{[...objections][0]}</span>}
                  {l.remarks && <span className="truncate">{l.remarks}</span>}
                </div>
              </button>);

          })}
          {!loading && filtered.length === 0 &&
          <p className="py-6 text-center text-[12.5px] text-ink-faint">No remembered customers match this search.</p>
          }
        </div>
      </Panel>
    </div>);

}
