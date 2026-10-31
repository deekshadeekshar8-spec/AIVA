import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeftIcon, PhoneIcon, MessageCircleIcon, Trash2Icon, RefreshCwIcon, Loader2Icon,
  BotIcon, HomeIcon, FlagIcon, BrainIcon, UsersIcon, AlertCircleIcon, MicIcon } from
'lucide-react';
import { Panel } from '../components/ui/Panel';
import { WhatsAppComposerModal } from '../components/leads/WhatsAppComposerModal';
import { cn } from '../utils/cn';
import { getLead, patchLead, callLead, deleteLead, researchLead, retryWhatsAppSend, getRecordingProxyUrl } from '../api/leads';
import type { Lead } from '../api/types';

const AGENT_NAMES: Record<string, string> = {
  agent_1: 'Kavya',
  agent_2: 'Arjun',
  agent_3: 'Ananya',
  agent_4: 'Rohan',
  agent_5: 'Priya',
  agent_6: 'Vistara',
};

const STATUS_OPTIONS = ['Pending', 'Call Scheduled', 'In Call', 'Contacted', 'Outgoing Retry', 'Completed', 'Handed Over'];

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function leadAge(dateTime: string) {
  const t = Date.parse(dateTime);
  if (Number.isNaN(t)) return '—';
  const diffMs = Date.now() - t;
  if (diffMs < 0) return '—';
  const hrs = Math.floor(diffMs / 3.6e6);
  if (hrs < 1) return `${Math.floor(diffMs / 60000)}m`;
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const ACTIVITY_ICON: Record<string, string> = {
  brochure: '📄', location: '📍', images: '📸', followup: '📅', reply: '💬', config: '⚙️', text: '💬', maps_link: '🗺️',
};

export function LeadDetailsPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<'Timeline' | 'Recordings' | 'History'>('Timeline');
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [researching, setResearching] = useState(false);
  const [calling, setCalling] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  const [expandedRecording, setExpandedRecording] = useState<string | null>(null);

  const load = async () => {
    if (!leadId) return;
    setLoading(true);
    setError(null);
    const l = await getLead(leadId);
    if (l) {
      setLead(l);
      setRemarks(l.remarks || '');
    } else {
      setError('Lead not found.');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const score = useMemo(() => {
    if (!lead) return 0;
    const map: Record<string, number> = {
      'Hot Lead': 88, Interested: 65, 'Warm Lead': 45, 'Call Later': 32,
      'Cold Lead': 18, 'Not Interested': 8, 'Wrong Number': 0, 'Not Reachable': 5,
    };
    return map[lead.interestLevel] ?? 32;
  }, [lead]);

  if (loading) return <Panel><p className="text-[12.5px] text-ink-faint">Loading lead…</p></Panel>;
  if (error || !lead) {
    return (
      <Panel>
        <p className="text-[12.5px] text-red-400">{error || 'Lead not found.'}</p>
        <button type="button" onClick={() => navigate('/leads')} className="mt-3 rounded-lg border border-line px-3 py-1.5 text-[12px] text-ink-muted hover:text-ink">
          Back to Leads
        </button>
      </Panel>);

  }

  const handleStatusChange = async (status: string) => {
    setLead({ ...lead, status });
    await patchLead(lead.id, { status });
  };

  const saveRemarks = async () => {
    if (remarks === lead.remarks) return;
    await patchLead(lead.id, { remarks });
    setLead({ ...lead, remarks });
    setNotice('Remarks saved.');
  };

  const handleCall = async () => {
    setCalling(true);
    const res = await callLead(lead.id);
    setCalling(false);
    setNotice(res.ok ? `Call dispatched to ${lead.name}.` : `Call failed: ${res.error}`);
    if (res.ok) load();
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${lead.name}? This cannot be undone.`)) return;
    const ok = await deleteLead(lead.id);
    if (ok) navigate('/leads');
    else setNotice('Delete failed.');
  };

  const handleResearch = async () => {
    setResearching(true);
    const updated = await researchLead(lead.id);
    setResearching(false);
    if (updated) {
      setLead(updated);
      setNotice('AI research refreshed.');
    } else {
      setNotice('AI research failed — check GEMINI_API_KEY is configured on the server.');
    }
  };

  const handleRetry = async (activityId: string) => {
    setRetryingId(activityId);
    const res = await retryWhatsAppSend(lead.id, activityId);
    setRetryingId(null);
    if (res.ok && res.lead) {
      setLead(res.lead);
      setNotice('Retry sent.');
    } else {
      setNotice(`Retry failed: ${res.error}`);
    }
  };

  const detailRows = [
    { label: 'Phone', value: lead.phone || '—' },
    { label: 'Email', value: lead.email || '—' },
    { label: 'Location', value: lead.location || '—' },
    { label: 'Source', value: lead.source || '—' },
    { label: 'Assigned Agent', value: AGENT_NAMES[lead.agentId] || lead.agentId || '—' },
    { label: 'Received On', value: lead.dateTime || '—' },
    { label: 'Lead Age', value: leadAge(lead.dateTime) },
    { label: 'Next Follow-up', value: formatDate(lead.nextFollowUpDate) },
    { label: 'Last Contact', value: lead.lastContactTime || '—' },
    { label: 'Project', value: lead.project || '—' },
  ];

  return (
    <div className="space-y-3">
      {notice && <div className="glass-soft rounded-xl px-4 py-2.5 text-[12.5px] text-ink">{notice}</div>}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/leads')}
          className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-[11.5px] text-ink-muted hover:text-ink">

          <ChevronLeftIcon className="h-3.5 w-3.5" /> Back to Leads
        </button>
      </div>

      <Panel>
        <div className="flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-ink">{lead.name}</h1>
            <div className="mt-1 flex items-center gap-2 text-[12px] text-ink-muted">
              <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-agent-voice hover:underline">
                <PhoneIcon className="h-3 w-3" /> {lead.phone}
              </a>
              <span className="text-ink-faint">·</span>
              <span className="font-mono text-[11px] text-ink-faint">{lead.id}</span>
            </div>
          </div>
          <select
            value={lead.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="rounded-lg border border-line bg-white/[0.04] px-3 py-2 text-[12.5px] font-semibold text-ink focus:border-agent-intent/50 focus:outline-none">

            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            type="button"
            disabled={calling}
            onClick={handleCall}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-agent-voice/40 bg-agent-voice/10 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-agent-voice disabled:opacity-50">

            {calling ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <PhoneIcon className="h-3.5 w-3.5" />} Call
          </button>
          <button
            type="button"
            onClick={() => setShowWhatsApp(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-agent-sentiment/40 bg-agent-sentiment/10 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-agent-sentiment">

            <MessageCircleIcon className="h-3.5 w-3.5" /> WhatsApp
          </button>
          <button
            type="button"
            onClick={load}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted hover:text-ink">

            <RefreshCwIcon className="h-3.5 w-3.5" /> Refresh
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted hover:text-red-400">

            <Trash2Icon className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </Panel>

      {/* AI Sales Employee */}
      <Panel
        title="AI Sales Employee — Lead Intelligence"
        action={
        <div className="flex items-center gap-2">
            {lead.leadScore &&
          <span className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-muted">
                {lead.leadScore.temperature} · {lead.leadScore.value}/100
              </span>
          }
            <button
            type="button"
            disabled={researching}
            onClick={handleResearch}
            className="flex items-center gap-1.5 rounded-lg border border-agent-intent/40 bg-agent-intent/10 px-2.5 py-1.5 text-[11px] font-semibold text-ink disabled:opacity-50">

              {researching ? <Loader2Icon className="h-3 w-3 animate-spin" /> : <BotIcon className="h-3 w-3" />}
              {lead.leadIntelligence ? 'Regenerate' : 'Research This Lead'}
            </button>
          </div>
        }>

        {lead.recommendation &&
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-agent-voice/30 bg-agent-voice/10 px-3.5 py-2.5">
            <HomeIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-agent-voice" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-agent-voice">Recommended: {lead.recommendation.recommendedProject}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">{lead.recommendation.reason}</p>
            </div>
          </div>
        }

        {!lead.leadIntelligence ?
        <p className="text-[12px] italic text-ink-faint">No AI research generated yet for this lead.</p> :

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-widest text-ink-faint">Lead Profile</span>
              {[
              ['Likely Interest', lead.leadIntelligence.interestSummary || '—'],
              ['Site Preference', lead.leadIntelligence.sitePreference || '—'],
              ['Likely Decision Maker', lead.leadIntelligence.likelyDecisionMaker],
              ['Best Call Time', lead.leadIntelligence.bestCallTime]].
              map(([k, v]) =>
              <div key={k} className="flex items-center justify-between border-b border-line pb-1.5 text-[11.5px]">
                  <span className="text-ink-faint">{k}</span>
                  <span className="font-semibold text-ink">{v}</span>
                </div>
              )}
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[10px] uppercase text-ink-faint">Confidence</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                  className={cn('h-full rounded-full', lead.leadIntelligence.confidence >= 70 ? 'bg-agent-sentiment' : lead.leadIntelligence.confidence >= 40 ? 'bg-agent-objection' : 'bg-red-400')}
                  style={{ width: `${lead.leadIntelligence.confidence}%` }} />

                </div>
                <span className="text-[11px] font-semibold text-ink">{lead.leadIntelligence.confidence}%</span>
              </div>
              {lead.leadIntelligence.likelyObjections && lead.leadIntelligence.likelyObjections.length > 0 &&
            <div className="mt-1 flex flex-col gap-1">
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-ink-faint">
                    <AlertCircleIcon className="h-2.5 w-2.5 text-agent-objection" /> Likely Objections
                  </span>
                  {lead.leadIntelligence.likelyObjections.map((o, i) =>
              <span key={i} className="text-[11px] text-ink-muted">· {o}</span>
              )}
                </div>
            }
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-widest text-ink-faint">Call Strategy</span>
              {lead.callStrategy ?
            [
            ['Opening Style', lead.callStrategy.openingStyle],
            ['Main Focus', lead.callStrategy.mainFocus],
            ['Avoid', lead.callStrategy.avoid],
            ['Goal', lead.callStrategy.goal],
            ...lead.callStrategy.negotiationApproach ? [['If They Object', lead.callStrategy.negotiationApproach]] : []].
            map(([k, v]) =>
            <div key={k} className="flex items-center justify-between border-b border-line pb-1.5 text-[11.5px]">
                  <span className="text-ink-faint">{k}</span>
                  <span className="text-right font-semibold text-ink">{v}</span>
                </div>
            ) :
            <p className="text-[11px] italic text-ink-faint">—</p>}
            </div>
          </div>
        }

        {(lead.callSummary || lead.qualified !== undefined) &&
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-agent-voice">Call Analysis</span>
              {lead.qualified !== undefined &&
            <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase', lead.qualified ? 'border-agent-sentiment/40 text-agent-sentiment' : 'border-red-400/40 text-red-400')}>
                  {lead.qualified ? 'Qualified' : 'Not Qualified'}
                </span>
            }
            </div>
            {lead.callSummary && <p className="text-[12px] leading-relaxed text-ink-muted">{lead.callSummary}</p>}
          </div>
        }

        {lead.nextBestAction &&
        <div className="mt-4 flex items-start gap-2.5 border-t border-line pt-4">
            <FlagIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-agent-sentiment" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-agent-sentiment">Next Best Action: {lead.nextBestAction.action}</p>
              {lead.nextBestAction.reason && <p className="mt-0.5 text-[11px] text-ink-muted">{lead.nextBestAction.reason}</p>}
            </div>
          </div>
        }

        {lead.salesBrain?.callCount ?
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-agent-memory">
              <BrainIcon className="h-3.5 w-3.5" /> AI Sales Brain — {lead.salesBrain.callCount} call{lead.salesBrain.callCount === 1 ? '' : 's'} of memory
            </span>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                {[
              ['Personality', lead.salesBrain.personality],
              ['Buying Style', lead.salesBrain.buyingStyle],
              ['Urgency', lead.salesBrain.urgencyLevel],
              ['Preferred Call Time', lead.salesBrain.preferredCallTime]].
              filter(([, v]) => !!v).map(([k, v]) =>
              <div key={k} className="flex items-center justify-between border-b border-line pb-1.5 text-[11px]">
                    <span className="text-ink-faint">{k}</span>
                    <span className="text-right font-semibold text-ink">{v}</span>
                  </div>
              )}
              </div>
              {lead.salesBrain.familyDetails && lead.salesBrain.familyDetails.length > 0 &&
            <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-ink-faint">
                    <UsersIcon className="h-2.5 w-2.5 text-agent-memory" /> Family / Personal Context
                  </span>
                  {lead.salesBrain.familyDetails.map((f, i) => <span key={i} className="text-[11px] text-ink-muted">· {f}</span>)}
                </div>
            }
            </div>
          </div> :
        null}
      </Panel>

      {/* Detail rows */}
      <Panel title="Details">
        <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0">
          {detailRows.map((row) =>
          <div key={row.label} className="flex items-center justify-between py-2 text-[12px] sm:border-b sm:border-line">
              <span className="text-ink-faint">{row.label}</span>
              <span className="max-w-[60%] truncate text-right font-semibold text-ink" title={row.value}>{row.value}</span>
            </div>
          )}
        </div>
      </Panel>

      {/* Remarks */}
      <Panel title="Remarks">
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          onBlur={saveRemarks}
          rows={3}
          placeholder="Notes logged by AIVA or the sales team…"
          className="w-full resize-none rounded-xl border border-line bg-white/[0.04] p-3.5 text-[12.5px] leading-relaxed text-ink focus:border-agent-intent/50 focus:outline-none" />

      </Panel>

      {/* Feed tabs */}
      <Panel
        action={
        <div className="flex gap-1.5">
            {(['Timeline', 'Recordings', 'History'] as const).map((t) =>
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-[11px] transition-colors',
              tab === t ? 'border-agent-intent/50 bg-agent-intent/10 text-ink' : 'border-line text-ink-muted hover:text-ink'
            )}>

              {t}
            </button>
          )}
          </div>
        }>

        {tab === 'Timeline' &&
        <div className="flex flex-col gap-2.5">
            {(!lead.whatsappActivity || lead.whatsappActivity.length === 0) ?
          <p className="py-6 text-center text-[12px] text-ink-faint">No WhatsApp activity recorded for this lead yet.</p> :

          [...lead.whatsappActivity].reverse().map((entry) =>
          <div key={entry.id} className={cn('flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5', entry.success ? 'border-line bg-white/[0.02]' : 'border-red-400/30 bg-red-400/5')}>
                <span className="shrink-0 text-sm">{entry.success ? ACTIVITY_ICON[entry.type] || '🟢' : '⚠️'}</span>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-[12px] leading-snug', entry.success ? 'text-ink' : 'text-red-400')}>{entry.detail}</p>
                  <p className="mt-0.5 text-[10.5px] text-ink-faint">{new Date(entry.timestamp).toLocaleString()}</p>
                </div>
                {!entry.success &&
            <button
              type="button"
              disabled={retryingId === entry.id}
              onClick={() => handleRetry(entry.id)}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-red-400/40 px-2 py-1 text-[10px] font-bold uppercase text-red-400 disabled:opacity-50">

                    {retryingId === entry.id ? <Loader2Icon className="h-3 w-3 animate-spin" /> : <RefreshCwIcon className="h-3 w-3" />} Retry
                  </button>
            }
              </div>
          )}
            {lead.whatsappFollowUpDueAt &&
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-agent-objection/30 bg-agent-objection/10 px-3 py-2 text-[11px] text-agent-objection">
                Next automated check-in due {new Date(lead.whatsappFollowUpDueAt).toLocaleString()}
              </div>
          }
          </div>
        }

        {tab === 'Recordings' &&
        <div className="flex flex-col gap-3">
            {(!lead.recordings || lead.recordings.length === 0) ?
          <p className="py-6 text-center text-[12px] text-ink-faint">No call recordings for this lead yet.</p> :

          lead.recordings.map((rec) =>
          <div key={rec.id} className="flex flex-col gap-2.5 rounded-xl border border-line bg-white/[0.02] p-3.5">
                <div className="flex items-center justify-between text-[10.5px] text-ink-faint">
                  <span className="flex items-center gap-1.5 font-semibold text-agent-memory"><MicIcon className="h-3 w-3" /> {rec.date}</span>
                  <span>{rec.duration}</span>
                </div>
                {rec.url ?
            <audio controls preload="none" src={getRecordingProxyUrl(rec.url)} className="h-9 w-full" /> :

            <span className="text-[11px] italic text-ink-faint">No audio available for this call.</span>
            }
                {rec.summary && <p className="text-[11.5px] leading-relaxed text-ink-muted">{rec.summary}</p>}
                {rec.transcript &&
            <button
              type="button"
              onClick={() => setExpandedRecording((prev) => prev === rec.id ? null : rec.id)}
              className="self-start text-[10.5px] text-agent-voice hover:underline">

                    {expandedRecording === rec.id ? 'Hide transcript' : 'View transcript'}
                  </button>
            }
                {expandedRecording === rec.id && rec.transcript &&
            <div className="max-h-[180px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-white/[0.02] p-3 text-[10.5px] leading-relaxed text-ink-faint">
                    {rec.transcript}
                  </div>
            }
              </div>
          )}
          </div>
        }

        {tab === 'History' &&
        <div className="flex flex-col gap-2 text-[12px] text-ink-muted">
            <div className="flex justify-between border-b border-line pb-1.5"><span>Call duration</span><span className="font-semibold text-ink">{lead.callDuration}</span></div>
            <div className="flex justify-between border-b border-line pb-1.5"><span>Last contact</span><span className="font-semibold text-ink">{lead.lastContactTime}</span></div>
            <div className="flex justify-between"><span>Current status</span><span className="font-semibold text-ink">{lead.status}</span></div>
          </div>
        }
      </Panel>

      <WhatsAppComposerModal
        show={showWhatsApp}
        onClose={() => setShowWhatsApp(false)}
        lead={lead}
        onSent={(updated) => {
          setLead(updated);
          setNotice(`WhatsApp sent to ${updated.name}.`);
        }} />

    </div>);

}
