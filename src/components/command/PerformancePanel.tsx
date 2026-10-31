import React from 'react';
import { Panel } from '../ui/Panel';
import { useRealCrmStatsContext } from '../../contexts/RealCrmStatsContext';

export function PerformancePanel() {
  const { loading, totalLeads, contactedLeads, hotLeads, completedLeads } = useRealCrmStatsContext();
  const contactRate = totalLeads ? Math.round(contactedLeads / totalLeads * 100) : 0;

  const stats = [
  { label: 'Total Leads', value: totalLeads.toLocaleString() },
  { label: 'Contacted', value: contactedLeads.toLocaleString() },
  { label: 'Hot Leads', value: hotLeads.toLocaleString() },
  { label: 'Completed', value: completedLeads.toLocaleString() }];


  return (
    <Panel id="performance" title="Total Performance" subtitle={loading ? 'Loading…' : `${contactRate}% of leads contacted`}>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) =>
        <div key={s.label}>
            <p className="text-[10px] text-ink-faint">{s.label}</p>
            <p className="mt-1 font-serif text-[22px] leading-none text-ink">{s.value}</p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-ink-faint">
          <span>Contact rate</span>
          <span className="text-ink">{contactRate}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-agent-voice" style={{ width: `${contactRate}%` }} />
        </div>
      </div>
    </Panel>);

}
