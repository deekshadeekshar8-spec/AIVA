import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '../ui/Panel';
import { useRealCrmStatsContext } from '../../contexts/RealCrmStatsContext';

const SCORE_BY_INTEREST: Record<string, number> = {
  'Hot Lead': 90,
  Interested: 75,
  'Warm Lead': 55,
  'Call Later': 40,
  'Cold Lead': 20,
  'Not Reachable': 10,
  'Not Interested': 5,
  'Wrong Number': 0,
};

export function LeadDNA() {
  const navigate = useNavigate();
  const { leads, loading } = useRealCrmStatsContext();
  const circumference = 2 * Math.PI * 34;

  const topLead = useMemo(() => {
    const ranked = [...leads].
    filter((l) => l.interestLevel === 'Hot Lead' || l.interestLevel === 'Interested')
    .sort((a, b) => (SCORE_BY_INTEREST[b.interestLevel] || 0) - (SCORE_BY_INTEREST[a.interestLevel] || 0));
    return ranked[0] || null;
  }, [leads]);

  if (loading) {
    return <Panel id="leadDna" title="Lead DNA"><p className="text-[12px] text-ink-faint">Loading…</p></Panel>;
  }

  if (!topLead) {
    return (
      <Panel id="leadDna" title="Lead DNA">
        <p className="py-6 text-center text-[12.5px] text-ink-faint">No Hot or Interested leads right now.</p>
      </Panel>);

  }

  const score = SCORE_BY_INTEREST[topLead.interestLevel] || 0;
  const rows: [string, string][] = [
  ['Status', topLead.status],
  ['Location', topLead.location || '—'],
  ['Budget', topLead.budget ? `₹${(topLead.budget / 100000).toFixed(1)}L` : '—'],
  ['Project', topLead.project || '—'],
  ['Timeline', topLead.timeline || '—']];


  return (
    <Panel
      id="leadDna"
      title="Lead DNA"
      action={
      <span className="rounded-full border border-agent-sentiment/40 bg-agent-sentiment/10 px-2.5 py-1 text-[10px] text-agent-sentiment">
          {topLead.interestLevel}
        </span>
      }>

      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[15px] font-medium text-ink">
          {topLead.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-ink">{topLead.name}</p>
          <p className="truncate text-[12px] text-ink-faint">{topLead.phone}</p>
        </div>
        <div className="relative h-[86px] w-[86px] shrink-0">
          <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
            <motion.circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="#34d399"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
              transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }} />

          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="font-serif text-xl leading-none text-ink">{score}%</p>
              <p className="text-[9px] text-ink-faint">Interest Score</p>
            </div>
          </div>
        </div>
      </div>

      <dl className="mt-5 space-y-2.5">
        {rows.map(([label, value]) =>
        <div key={label} className="flex items-baseline justify-between text-[12.5px]">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        )}
      </dl>

      <button
        type="button"
        onClick={() => navigate(`/leads/${topLead.id}`)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white/[0.03] py-2.5 text-[12.5px] text-ink transition-colors duration-200 ease-cinema hover:bg-white/[0.06]">

        Open {topLead.name}'s profile <ArrowRightIcon className="h-3.5 w-3.5" />
      </button>
    </Panel>);

}
