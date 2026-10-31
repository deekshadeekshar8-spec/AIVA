import React from 'react';
import { motion } from 'framer-motion';
import { Panel } from '../ui/Panel';
import { LiveActivity } from './LiveActivity';
import { LeadPipeline } from './LeadPipeline';
import { useRealCrmStatsContext } from '../../contexts/RealCrmStatsContext';

export function MissionControl() {
  const { loading, totalLeads, hotLeads, contactedLeads, siteVisitsScheduled, completedLeads } = useRealCrmStatsContext();

  const metrics = [
  { label: 'Total Leads', value: totalLeads.toLocaleString(), tone: '#22d3ee' },
  { label: 'Contacted', value: contactedLeads.toLocaleString(), tone: '#a78bfa' },
  { label: 'Hot Leads', value: hotLeads.toLocaleString(), tone: '#34d399' },
  { label: 'Site Visits Scheduled', value: siteVisitsScheduled.toLocaleString(), tone: '#fbbf24' },
  { label: 'Completed', value: completedLeads.toLocaleString(), tone: '#60a5fa' }];


  return (
    <Panel id="mission" title="Mission Control" subtitle={loading ? 'Loading real CRM data…' : 'Real leads, real calls'}>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
        {metrics.map((m, idx) =>
        <motion.div
          key={m.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.04, duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
          className="rounded-xl border border-line bg-white/[0.02] px-3.5 py-3">

            <span className="mb-2 block h-1 w-6 rounded-full" style={{ background: m.tone }} aria-hidden />
            <p className="font-serif text-[26px] leading-none text-ink">{m.value}</p>
            <p className="mt-1.5 text-[11px] text-ink-muted">{m.label}</p>
          </motion.div>
        )}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <LiveActivity />
        <LeadPipeline />
      </div>
    </Panel>);

}
