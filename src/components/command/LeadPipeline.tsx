import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Panel } from '../ui/Panel';
import { useRealCrmStatsContext } from '../../contexts/RealCrmStatsContext';

const COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#60a5fa', '#2dd4bf', '#e0454f'];

export function LeadPipeline() {
  const { statusBreakdown, totalLeads, loading } = useRealCrmStatsContext();

  return (
    <Panel
      id="pipeline"
      title="Lead Pipeline"
      className="rounded-xl"
      action={
      <Link
        to="/leads"
        className="flex items-center gap-1 text-[11px] text-ink-muted transition-colors duration-150 ease-cinema hover:text-ink">

          View All <ArrowRightIcon className="h-3 w-3" />
        </Link>
      }>

      {loading ?
      <p className="text-[12px] text-ink-faint">Loading…</p> :

      <ul className="space-y-3.5">
          {statusBreakdown.map((stage, idx) => {
          const pct = totalLeads ? Math.round(stage.count / totalLeads * 100) : 0;
          const color = COLORS[idx % COLORS.length];
          return (
            <li key={stage.label}>
                <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
                  <span className="text-ink-muted">{stage.label}</span>
                  <span className="font-medium text-ink">{stage.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                  className="h-full rounded-full"
                  style={{ background: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: idx * 0.06, ease: [0.23, 1, 0.32, 1] }} />

                </div>
              </li>);

        })}
        </ul>
      }
    </Panel>);

}
