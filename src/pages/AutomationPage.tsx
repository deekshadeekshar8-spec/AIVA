import React, { useEffect, useState } from 'react';
import { LockIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Panel, Eyebrow } from '../components/ui/Panel';
import { cn } from '../utils/cn';
import {
  getDailyBriefing,
  getEscalations,
  resolveEscalation,
  getScriptVariants,
  setScriptVariantStatus,
  getCampaigns,
  createCampaign,
  deleteCampaign,
  type DailyBriefing,
  type Escalation,
  type ScriptVariant,
  type Campaign } from
'../api/insights';

const AGENT_NAMES: Record<string, string> = {
  agent_1: 'Kavya',
  agent_2: 'Arjun',
  agent_3: 'Ananya',
  agent_4: 'Rohan',
  agent_5: 'Priya',
  agent_6: 'Vistara'
};

const STATUS_TONE: Record<string, string> = {
  draft: 'text-ink-faint border-line',
  active: 'text-emerald-400 border-emerald-400/40',
  archived: 'text-ink-faint border-line'
};

export function AutomationPage() {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [variants, setVariants] = useState<ScriptVariant[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [campaignInterest, setCampaignInterest] = useState('');

  const load = async () => {
    setLoading(true);
    const [b, e, v, c] = await Promise.all([
    getDailyBriefing().catch(() => null),
    getEscalations().catch(() => []),
    getScriptVariants().catch(() => []),
    getCampaigns().catch(() => [])]
    );
    setBriefing(b);
    setEscalations(e);
    setVariants(v);
    setCampaigns(c);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const handleResolveEscalation = async (leadId: string) => {
    setBusyId(leadId);
    const ok = await resolveEscalation(leadId);
    setBusyId(null);
    setNotice(ok ? 'Escalation resolved.' : 'Could not resolve escalation.');
    if (ok) setEscalations((prev) => prev.filter((e) => e.id !== leadId));
  };

  const handleVariantStatus = async (variant: ScriptVariant, status: 'draft' | 'active' | 'archived') => {
    setBusyId(variant.id);
    const ok = await setScriptVariantStatus(variant.id, status);
    setBusyId(null);
    if (ok) {
      setVariants((prev) => prev.map((v) => v.id === variant.id ? { ...v, status } : v));
      setNotice(`"${variant.name}" is now ${status}.`);
    } else {
      setNotice('Could not update variant status.');
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim()) return;
    const filters: Record<string, string> = {};
    if (campaignInterest) filters.interestLevel = campaignInterest;
    const res = await createCampaign(campaignName.trim(), filters);
    if (res.ok && res.campaign) {
      setCampaigns((prev) => [res.campaign!, ...prev]);
      setShowNewCampaign(false);
      setCampaignName('');
      setCampaignInterest('');
      setNotice(`Campaign "${res.campaign.name}" created with ${res.campaign.leadIds.length} matching leads — review before launching.`);
    } else {
      setNotice(res.error || 'Could not create campaign.');
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    setBusyId(id);
    const ok = await deleteCampaign(id);
    setBusyId(null);
    if (ok) setCampaigns((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-3">
      {notice && <div className="glass-soft rounded-xl px-4 py-2.5 text-[12.5px] text-ink">{notice}</div>}

      <Panel title="Automation" subtitle="The real workflows Vistara executes once the team reaches a decision.">
        <div className="flex items-start gap-3 rounded-xl border border-agent-objection/30 bg-agent-objection/[0.06] px-4 py-3">
          <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-agent-objection" />
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            Calling is currently paused. Campaigns, sweeps and script-variant testing can be set up and reviewed
            below, but nothing here will dial a real number until calling is explicitly re-enabled.
          </p>
        </div>
      </Panel>

      <Panel title="Today's Top Actions" subtitle="Deterministic priority list — computed from real leads, never invented">
        {loading && <p className="text-[12.5px] text-ink-faint">Loading…</p>}
        {!loading && (!briefing || briefing.topActions.length === 0) &&
        <p className="text-[12.5px] text-ink-faint">Nothing needs attention right now.</p>
        }
        <ol className="space-y-2">
          {briefing?.topActions.map((a, i) =>
          <li key={a.id || i} className="rounded-xl border border-line bg-white/[0.02] px-4 py-2.5 text-[12.5px]">
              <p className="text-ink">{a.title || JSON.stringify(a)}</p>
              {a.detail != null && <p className="mt-0.5 text-ink-muted">{String(a.detail)}</p>}
            </li>
          )}
        </ol>
        {briefing &&
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-[12px] sm:grid-cols-4">
            <div><p className="text-ink-faint">Hot Leads</p><p className="text-ink">{briefing.hotLeadsCount}</p></div>
            <div><p className="text-ink-faint">Needs Follow-up</p><p className="text-ink">{briefing.needsFollowUpCount}</p></div>
            <div><p className="text-ink-faint">Callbacks</p><p className="text-ink">{briefing.callbackRequestsCount}</p></div>
            <div><p className="text-ink-faint">AI Calls Today</p><p className="text-ink">{briefing.aiCallsToday}</p></div>
          </div>
        }
      </Panel>

      <Panel title="Escalations" subtitle="Real leads flagged for a human — never auto-resolved">
        <div className="divide-y divide-line">
          {escalations.map((e) =>
          <div key={e.id} className="flex items-center justify-between gap-4 py-2.5 text-[12.5px]">
              <div className="min-w-0">
                <p className="text-ink">{e.name} <span className="text-ink-faint">· {e.phone}</span></p>
                <p className="truncate text-[11.5px] text-ink-muted">{e.escalationReason || e.escalationCategory || 'Escalated'}</p>
              </div>
              <button
              type="button"
              disabled={busyId === e.id}
              onClick={() => handleResolveEscalation(e.id)}
              className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[11.5px] text-ink-muted transition-colors hover:text-ink disabled:opacity-40">

                Resolve
              </button>
            </div>
          )}
          {!loading && escalations.length === 0 &&
          <p className="py-4 text-center text-[12.5px] text-ink-faint">No leads currently escalated.</p>
          }
        </div>
      </Panel>

      <Panel
        title="Script Variants"
        subtitle="A/B tested call strategies — a manager must promote a draft to active before it's used on a real call">

        <div className="space-y-2">
          {variants.map((v) =>
          <div key={v.id} className="rounded-xl border border-line bg-white/[0.02] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] text-ink">{v.name}</p>
                  <p className="text-[11.5px] text-ink-faint">{AGENT_NAMES[v.agentId || ''] || 'All agents'} · {v.mainFocus || 'No focus set'}</p>
                </div>
                <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] uppercase tracking-wide', STATUS_TONE[v.status])}>
                  {v.status}
                </span>
              </div>
              <div className="mt-2 flex gap-1.5">
                {v.status !== 'active' &&
              <button
                type="button"
                disabled={busyId === v.id}
                onClick={() => handleVariantStatus(v, 'active')}
                className="rounded-lg border border-line px-2 py-1 text-[11px] text-ink-muted hover:text-ink disabled:opacity-40">

                    Activate
                  </button>
              }
                {v.status !== 'archived' &&
              <button
                type="button"
                disabled={busyId === v.id}
                onClick={() => handleVariantStatus(v, 'archived')}
                className="rounded-lg border border-line px-2 py-1 text-[11px] text-ink-muted hover:text-ink disabled:opacity-40">

                    Archive
                  </button>
              }
              </div>
            </div>
          )}
          {!loading && variants.length === 0 &&
          <p className="py-4 text-center text-[12.5px] text-ink-faint">No script variants created yet.</p>
          }
        </div>
      </Panel>

      <Panel
        title="Campaigns"
        subtitle="Bulk outbound calling — snapshot a lead list now, review, launch only when you're ready"
        action={
        <button
          type="button"
          onClick={() => setShowNewCampaign(true)}
          className="flex items-center gap-1.5 rounded-lg border border-agent-intent/50 bg-agent-intent/10 px-2.5 py-1.5 text-[11.5px] text-ink hover:bg-agent-intent/20">

            <PlusIcon className="h-3.5 w-3.5" /> New Campaign
          </button>
        }>

        <div className="space-y-2">
          {campaigns.map((c) =>
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white/[0.02] px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13px] text-ink">{c.name}</p>
                <p className="text-[11.5px] text-ink-faint">{c.leadIds.length} leads · {c.status}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                type="button"
                disabled
                title="Calling is paused until explicitly enabled"
                className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[11px] text-ink-faint opacity-50">

                  <LockIcon className="h-3 w-3" /> Launch
                </button>
                <button
                type="button"
                disabled={busyId === c.id}
                onClick={() => handleDeleteCampaign(c.id)}
                className="rounded-lg border border-line p-1.5 text-ink-muted hover:text-red-400 disabled:opacity-40">

                  <Trash2Icon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
          {!loading && campaigns.length === 0 &&
          <p className="py-4 text-center text-[12.5px] text-ink-faint">No campaigns created yet.</p>
          }
        </div>
      </Panel>

      {showNewCampaign &&
      <div className="fixed inset-0 z-[200] grid place-items-center bg-black/60 px-4" onClick={() => setShowNewCampaign(false)}>
          <form onSubmit={handleCreateCampaign} onClick={(e) => e.stopPropagation()} className="glass w-full max-w-sm rounded-2xl p-6">
            <h2 className="text-[16px] font-semibold text-ink">New Campaign</h2>
            <p className="mt-1 text-[12px] text-ink-muted">Snapshots matching real leads now — launching is a separate, gated step.</p>

            <Eyebrow className="mt-4 block">Name</Eyebrow>
            <input
            required
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-white/[0.04] px-3 py-2 text-[13px] text-ink focus:border-agent-intent/50 focus:outline-none" />


            <Eyebrow className="mt-3 block">Interest level filter (optional)</Eyebrow>
            <select
            value={campaignInterest}
            onChange={(e) => setCampaignInterest(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-white/[0.04] px-3 py-2 text-[13px] text-ink focus:border-agent-intent/50 focus:outline-none">

              <option value="">Any</option>
              <option value="Hot Lead">Hot Lead</option>
              <option value="Warm Lead">Warm Lead</option>
              <option value="Interested">Interested</option>
              <option value="Not Reachable">Not Reachable</option>
            </select>

            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setShowNewCampaign(false)} className="flex-1 rounded-lg border border-line py-2 text-[12.5px] text-ink-muted hover:text-ink">
                Cancel
              </button>
              <button type="submit" className="flex-1 rounded-lg bg-agent-intent py-2 text-[12.5px] font-medium text-void">
                Create
              </button>
            </div>
          </form>
        </div>
      }
    </div>);

}
