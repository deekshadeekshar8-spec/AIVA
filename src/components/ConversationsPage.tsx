import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Lead, Agent } from '../types';

interface ConversationsPageProps {
  leads: Lead[];
  agents: Agent[];
  onOpenLead: (id: string) => void;
}

const PER_PAGE = 50;

// Real conversation history — every row is an actual lead contact event, sorted by
// most recent, sourced directly from the leads array (same data as everywhere else).
export default function ConversationsPage({ leads, agents, onOpenLead }: ConversationsPageProps) {
  const [page, setPage] = useState(1);
  const agentNameById = useMemo(() => new Map(agents.map(a => [a.id, a.name])), [agents]);

  const contacted = useMemo(() => {
    return [...leads]
      .filter(l => l.lastContactTime && l.lastContactTime !== 'Never')
      .sort((a, b) => (Date.parse(b.lastContactTime) || 0) - (Date.parse(a.lastContactTime) || 0));
  }, [leads]);

  const totalPages = Math.max(1, Math.ceil(contacted.length / PER_PAGE));
  const paged = contacted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Conversations</h2>
          <p className="text-sm text-slate-500">Real call history from every lead contact</p>
        </div>
        <div className="relative hidden md:flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3" />
          <input readOnly placeholder="Search conversations..." className="pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500 w-56 cursor-default" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
              <th className="py-3 pr-4 font-semibold">Customer</th>
              <th className="py-3 pr-4 font-semibold">Agent</th>
              <th className="py-3 pr-4 font-semibold">Status</th>
              <th className="py-3 pr-4 font-semibold">Interest</th>
              <th className="py-3 pr-4 font-semibold text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {paged.map(lead => (
              <tr key={lead.id} className="hover:bg-slate-50/70 cursor-pointer transition-colors" onClick={() => onOpenLead(lead.id)}>
                <td className="py-3 pr-4">
                  <p className="font-bold text-slate-900 text-sm">{lead.name}</p>
                  <p className="text-[11px] text-slate-400">{lead.phone}</p>
                </td>
                <td className="py-3 pr-4 text-sm text-slate-600">{agentNameById.get(lead.agentId) || 'Unassigned'}</td>
                <td className="py-3 pr-4">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    lead.status === 'Contacted' || lead.status === 'Completed' || lead.status === 'Handed Over'
                      ? 'bg-emerald-50 text-emerald-600'
                      : lead.status === 'Outgoing Retry' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                  }`}>{lead.status}</span>
                </td>
                <td className="py-3 pr-4 text-xs text-slate-500">{lead.interestLevel}</td>
                <td className="py-3 pr-4 text-right text-xs text-slate-400 font-mono">{lead.lastContactTime}</td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-sm text-slate-400">No conversations synced yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {contacted.length > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, contacted.length)} of {contacted.length}</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:border-indigo-300 transition-colors">‹ Prev</button>
            <span className="px-2">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:border-indigo-300 transition-colors">Next ›</button>
          </div>
        </div>
      )}
    </div>
  );
}
