import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneIcon } from 'lucide-react';
import { Panel, StatusDot } from '../ui/Panel';
import { useRealCrmStatsContext } from '../../contexts/RealCrmStatsContext';

export function LiveCallPanel() {
  const navigate = useNavigate();
  const { inCallLeads, loading } = useRealCrmStatsContext();

  return (
    <Panel
      id="liveCall"
      title="Live Calls"
      action={
      <span className="flex items-center gap-1.5 rounded-full border border-line px-2 py-1 text-[10px] text-ink-muted">
          <StatusDot color={inCallLeads.length > 0 ? '#f87171' : '#6b7280'} pulse={inCallLeads.length > 0} />
          {inCallLeads.length > 0 ? 'Live' : 'Idle'}
        </span>
      }>

      {loading ?
      <p className="text-[12px] text-ink-faint">Loading…</p> :
      inCallLeads.length === 0 ?
      <p className="py-6 text-center text-[12.5px] text-ink-faint">No call is live right now.</p> :

      <ul className="space-y-2.5">
          {inCallLeads.map((lead) =>
        <li key={lead.id}>
              <button
            type="button"
            onClick={() => navigate(`/leads/${lead.id}`)}
            className="flex w-full items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5 text-left transition-colors duration-200 ease-cinema hover:bg-white/[0.05]">

                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-agent-voice/[0.14]">
                  <PhoneIcon className="h-4 w-4 text-agent-voice" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] text-ink">{lead.name}</p>
                  <p className="truncate text-[11px] text-ink-faint">{lead.phone}</p>
                </div>
              </button>
            </li>
        )}
        </ul>
      }
    </Panel>);

}
