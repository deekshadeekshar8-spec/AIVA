import React, { useEffect, useState } from 'react';
import { Panel, Eyebrow } from '../components/ui/Panel';
import { cn } from '../utils/cn';
import {
  getInsightsSummary,
  getFunnel,
  getSalesDashboard,
  getCompetitorRadar,
  getCeoBrief,
  type InsightsSummary,
  type Funnel,
  type SalesDashboard,
  type CompetitorRadarEntry,
  type CeoBrief } from
'../api/insights';

const AGENT_NAMES: Record<string, string> = {
  agent_1: 'Kavya',
  agent_2: 'Arjun',
  agent_3: 'Ananya',
  agent_4: 'Rohan',
  agent_5: 'Priya',
  agent_6: 'Vistara'
};

function Stat({ label, value }: {label: string;value: React.ReactNode;}) {
  return (
    <div>
      <p className="font-serif text-3xl leading-none text-ink">{value}</p>
      <p className="mt-1.5 text-[11px] text-ink-muted">{label}</p>
    </div>);

}

function Bar({ label, value, max, accent }: {label: string;value: number;max: number;accent: string;}) {
  const pct = max > 0 ? Math.round(value / max * 100) : 0;
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between text-[12px]">
        <span className="text-ink-muted">{label}</span>
        <span className="font-medium text-ink">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
      </div>
    </div>);

}

export function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<InsightsSummary | null>(null);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [dashboard, setDashboard] = useState<SalesDashboard | null>(null);
  const [radar, setRadar] = useState<CompetitorRadarEntry[]>([]);
  const [ceoBrief, setCeoBrief] = useState<CeoBrief | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [s, f, d, r, c] = await Promise.all([
        getInsightsSummary(),
        getFunnel(),
        getSalesDashboard(),
        getCompetitorRadar(),
        getCeoBrief().catch(() => null)]
        );
        if (cancelled) return;
        setSummary(s);
        setFunnel(f);
        setDashboard(d);
        setRadar(r.radar);
        setCeoBrief(c);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load analytics from the backend.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <Panel><p className="text-[12.5px] text-ink-faint">Loading real analytics…</p></Panel>;
  }
  if (error) {
    return <Panel><p className="text-[12.5px] text-red-400">{error}</p></Panel>;
  }

  const maxFunnel = Math.max(1, ...(funnel?.stages.map((s) => s.count) ?? [1]));
  const maxObjection = Math.max(1, ...(dashboard?.topObjections.map((o) => o.count) ?? [1]));
  const maxTemp = Math.max(1, ...Object.values(dashboard?.byTemperature ?? {}));

  return (
    <div className="space-y-3">
      <Panel title="Analytics" subtitle="Intent accuracy, sentiment trends and objection win rates across the pipeline — computed live, nothing simulated.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Today's Calls" value={summary?.todaysCalls ?? 0} />
          <Stat label="Connected Today" value={summary?.connected ?? 0} />
          <Stat label="Qualified Leads" value={summary?.qualified ?? 0} />
          <Stat label="Site Visits" value={summary?.siteVisits ?? 0} />
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Sales Funnel" subtitle={funnel?.bottleneck ? `Bottleneck: ${funnel.bottleneck.label}` : 'No bottleneck detected'}>
          {funnel?.stages.map((s) =>
          <Bar
            key={s.id}
            label={s.label}
            value={s.count}
            max={maxFunnel}
            accent={funnel.bottleneck?.id === s.id ? '#f97316' : '#22d3ee'} />

          )}
        </Panel>

        <Panel title="Lead Temperature" subtitle="From real computed lead scores">
          {Object.entries(dashboard?.byTemperature ?? {}).map(([label, count]) =>
          <Bar
            key={label}
            label={label}
            value={count}
            max={maxTemp}
            accent={label === 'Hot' ? '#f43f5e' : label === 'Warm' ? '#f59e0b' : label === 'Nurture' ? '#22d3ee' : '#64748b'} />

          )}
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-[12px]">
            <div>
              <p className="text-ink-faint">Average Lead Score</p>
              <p className="text-ink">{dashboard?.averageLeadScore ?? 0}</p>
            </div>
            <div>
              <p className="text-ink-faint">Follow-ups Due</p>
              <p className="text-ink">{dashboard?.followUpsDue ?? 0}</p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Top Objections" subtitle="Pulled from real call transcripts + AI sales brain history">
          {dashboard && dashboard.topObjections.length > 0 ?
          dashboard.topObjections.map((o) =>
          <Bar key={o.objection} label={o.objection} value={o.count} max={maxObjection} accent="#ef4444" />
          ) :

          <p className="text-[12.5px] text-ink-faint">No objections recorded yet.</p>
          }
        </Panel>

        <Panel title="Competitor Radar" subtitle="Real competitor mentions extracted from call transcripts">
          {radar.length > 0 ?
          <div className="space-y-2.5">
              {radar.map((r) =>
            <div key={r.competitor} className="flex items-center justify-between text-[12.5px]">
                  <div>
                    <p className="text-ink">{r.competitor}</p>
                    {r.locations.length > 0 && <p className="text-[11px] text-ink-faint">{r.locations.join(', ')}</p>}
                  </div>
                  <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted">{r.mentions} mentions</span>
                </div>
            )}
            </div> :

          <p className="text-[12.5px] text-ink-faint">No competitor mentions detected in calls yet.</p>
          }
        </Panel>
      </div>

      <Panel title="Top Performing Projects" subtitle="Qualified rate by project, real counts">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-[12.5px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-ink-faint">
                <th className="pb-2 font-medium">Project</th>
                <th className="pb-2 font-medium">Total</th>
                <th className="pb-2 font-medium">Qualified</th>
                <th className="pb-2 font-medium">Hot</th>
                <th className="pb-2 font-medium">Site Visits</th>
                <th className="pb-2 font-medium">Qualified Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(dashboard?.topPerformingProjects ?? []).map((p) =>
              <tr key={p.project}>
                  <td className="py-2 text-ink">{p.project}</td>
                  <td className="py-2 text-ink-muted">{p.total}</td>
                  <td className="py-2 text-ink-muted">{p.qualified}</td>
                  <td className="py-2 text-ink-muted">{p.hot}</td>
                  <td className="py-2 text-ink-muted">{p.siteVisits}</td>
                  <td className="py-2 text-ink-muted">{p.qualifiedRate != null ? `${p.qualifiedRate}%` : '—'}</td>
                </tr>
              )}
              {(!dashboard || dashboard.topPerformingProjects.length === 0) &&
              <tr><td colSpan={6} className="py-4 text-center text-ink-faint">No project data yet.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </Panel>

      {ceoBrief &&
      <Panel title="Executive Brief" subtitle="Real breakdowns by source, agent and time-of-day">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Eyebrow className="mb-2 block">By Source</Eyebrow>
              {ceoBrief.stats.sourceStats.map((s) =>
            <div key={s.source} className="mb-1.5 flex justify-between text-[12px]">
                  <span className="text-ink-muted">{s.source}</span>
                  <span className="text-ink">{s.total} · {s.qualifiedRate ?? 0}%</span>
                </div>
            )}
            </div>
            <div>
              <Eyebrow className="mb-2 block">By Agent</Eyebrow>
              {ceoBrief.stats.agentStats.map((a) =>
            <div key={a.agentId} className="mb-1.5 flex justify-between text-[12px]">
                  <span className="text-ink-muted">{AGENT_NAMES[a.agentId] || a.agentId}</span>
                  <span className="text-ink">{a.total} · {a.qualifiedRate ?? 0}%</span>
                </div>
            )}
            </div>
            <div>
              <Eyebrow className="mb-2 block">By Time of Day</Eyebrow>
              {ceoBrief.stats.timeOfDayStats.map((t) =>
            <div key={t.bucket} className="mb-1.5 flex justify-between text-[12px]">
                  <span className="text-ink-muted">{t.bucket}</span>
                  <span className="text-ink">{t.total} · {t.qualifiedRate ?? 0}%</span>
                </div>
            )}
            </div>
          </div>
          <div className="mt-4 border-t border-line pt-3">
            {ceoBrief.narrative ?
            <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-ink-muted">{ceoBrief.narrative}</p> :

            <p className="text-[12px] text-ink-faint">
                {ceoBrief.narrativeSkippedReason || 'AI narration unavailable right now.'}
              </p>
            }
          </div>
        </Panel>
      }

      {summary && summary.silentMomentum.length > 0 &&
      <Panel title="Silent Momentum" subtitle="Interested leads going cold faster than their own stated timeline">
          <div className="space-y-2">
            {summary.silentMomentum.map((l) =>
            <div key={l.id} className="flex items-center justify-between text-[12.5px]">
                <span className="text-ink">{l.name}</span>
                <span className={cn('text-ink-muted')}>{l.interestLevel} · {l.daysSinceContact}d silent</span>
              </div>
            )}
          </div>
        </Panel>
      }
    </div>);

}
