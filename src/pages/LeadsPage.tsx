import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneIcon, MessageCircleIcon, PlusIcon, Trash2Icon, RefreshCwIcon } from 'lucide-react';
import { Panel } from '../components/ui/Panel';
import { cn } from '../utils/cn';
import { getLeads, callLead, sendWhatsAppDetails, deleteLead } from '../api/leads';
import { QuickAddLeadsModal } from '../components/leads/QuickAddLeadsModal';
import type { Lead } from '../api/types';

const filters = ['All', 'Hot / Interested', 'Not Reachable'] as const;

const AGENT_NAMES: Record<string, string> = {
  agent_1: 'Kavya',
  agent_2: 'Arjun',
  agent_3: 'Ananya',
  agent_4: 'Rohan',
  agent_5: 'Priya',
  agent_6: 'Vistara',
};

function formatFollowUp(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function interestTone(level: string) {
  if (level === 'Hot Lead' || level === 'Interested') return 'text-agent-sentiment';
  if (level === 'Not Interested' || level === 'Wrong Number') return 'text-ink-faint';
  if (level === 'Not Reachable') return 'text-agent-objection';
  return 'text-ink-muted';
}

export function LeadsPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof filters)[number]>('All');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLeads();
      setLeads(data);
    } catch (err: any) {
      setError(err?.message || 'Could not load leads from the backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const visible = useMemo(() => {
    return leads.filter((l) => {
      if (filter === 'Hot / Interested') return l.interestLevel === 'Hot Lead' || l.interestLevel === 'Interested' || l.interestLevel === 'Warm Lead';
      if (filter === 'Not Reachable') return l.interestLevel === 'Not Reachable';
      return true;
    });
  }, [leads, filter]);

  const handleCall = async (lead: Lead) => {
    setBusyId(lead.id);
    const res = await callLead(lead.id);
    setBusyId(null);
    setNotice(res.ok ? `Call dispatched to ${lead.name}.` : `Call failed: ${res.error}`);
    if (res.ok) load();
  };

  const handleWhatsApp = async (lead: Lead) => {
    setBusyId(lead.id);
    const res = await sendWhatsAppDetails(lead.id, lead.project);
    setBusyId(null);
    setNotice(res.ok ? `WhatsApp details sent to ${lead.name}.` : `WhatsApp send failed: ${res.error}`);
    if (res.ok) load();
  };

  const handleDelete = async (lead: Lead) => {
    if (!window.confirm(`Delete ${lead.name}? This cannot be undone.`)) return;
    setBusyId(lead.id);
    const ok = await deleteLead(lead.id);
    setBusyId(null);
    if (ok) {
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      setNotice(`${lead.name} deleted.`);
    } else {
      setNotice('Delete failed.');
    }
  };

  return (
    <div className="space-y-3">
      {notice &&
      <div className="glass-soft rounded-xl px-4 py-2.5 text-[12.5px] text-ink">{notice}</div>
      }

      <Panel
        title="Leads"
        subtitle={loading ? 'Loading real leads…' : `${visible.length} of ${leads.length} leads`}
        action={
        <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              {filters.map((f) =>
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-[11.5px] transition-colors duration-150 ease-cinema',
                  filter === f ?
                  'border-agent-intent/50 bg-agent-intent/10 text-ink' :
                  'border-line text-ink-muted hover:text-ink'
                )}>

                  {f}
                </button>
              )}
            </div>
            <button
            type="button"
            onClick={load}
            title="Refresh"
            className="rounded-lg border border-line p-1.5 text-ink-muted transition-colors duration-150 ease-cinema hover:text-ink">

              <RefreshCwIcon className="h-3.5 w-3.5" />
            </button>
            <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-lg border border-agent-intent/50 bg-agent-intent/10 px-2.5 py-1.5 text-[11.5px] text-ink transition-colors duration-150 ease-cinema hover:bg-agent-intent/20">

              <PlusIcon className="h-3.5 w-3.5" /> Add Lead
            </button>
          </div>
        }>

        {error &&
        <p className="mb-3 text-[12.5px] text-red-400">{error}</p>
        }
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-ink-faint">
                <th className="pb-3 font-medium">Customer</th>
                <th className="pb-3 font-medium">Project</th>
                <th className="pb-3 font-medium">Agent</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Interest</th>
                <th className="pb-3 font-medium">Next Follow-up</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((lead) =>
              <tr key={lead.id} className="cursor-pointer text-[12.5px] transition-colors hover:bg-white/[0.02]" onClick={() => navigate(`/leads/${lead.id}`)}>
                  <td className="py-3">
                    <p className="text-ink">{lead.name}</p>
                    <p className="text-[11px] text-ink-faint">{lead.phone}</p>
                  </td>
                  <td className="py-3 text-ink-muted">{lead.project || '—'}</td>
                  <td className="py-3 text-ink-muted">{AGENT_NAMES[lead.agentId] || lead.agentId || '—'}</td>
                  <td className="py-3 text-ink-muted">{lead.status}</td>
                  <td className={cn('py-3', interestTone(lead.interestLevel))}>{lead.interestLevel}</td>
                  <td className="py-3 text-ink-muted">{formatFollowUp(lead.nextFollowUpDate)}</td>
                  <td className="py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1.5">
                      <button
                      type="button"
                      disabled={busyId === lead.id}
                      onClick={() => handleCall(lead)}
                      title="Call"
                      className="rounded-lg border border-line p-1.5 text-ink-muted transition-colors duration-200 ease-cinema hover:text-ink disabled:opacity-40">

                        <PhoneIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                      type="button"
                      disabled={busyId === lead.id}
                      onClick={() => handleWhatsApp(lead)}
                      title="Send WhatsApp property details"
                      className="rounded-lg border border-line p-1.5 text-ink-muted transition-colors duration-200 ease-cinema hover:text-ink disabled:opacity-40">

                        <MessageCircleIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                      type="button"
                      disabled={busyId === lead.id}
                      onClick={() => handleDelete(lead)}
                      title="Delete"
                      className="rounded-lg border border-line p-1.5 text-ink-muted transition-colors duration-200 ease-cinema hover:text-red-400 disabled:opacity-40">

                        <Trash2Icon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && visible.length === 0 &&
              <tr>
                  <td colSpan={7} className="py-8 text-center text-[12.5px] text-ink-faint">No leads match this filter.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </Panel>

      {showAdd &&
      <QuickAddLeadsModal
        onClose={() => setShowAdd(false)}
        onSaved={(count) => {
          setNotice(`${count} lead${count === 1 ? '' : 's'} added.`);
          load();
        }} />

      }
    </div>);

}
