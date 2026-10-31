import React from 'react';
import { ArrowRightIcon, PhoneIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Panel } from '../ui/Panel';
import { useRealCrmStatsContext } from '../../contexts/RealCrmStatsContext';

export function RecentActivityPanel() {
  const navigate = useNavigate();
  const { callEvents, loading } = useRealCrmStatsContext();
  const recent = [...callEvents].
  sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()).
  slice(0, 6);

  return (
    <Panel
      id="recent"
      title="Recent Activity"
      action={
      <Link
        to="/live-calls"
        className="flex items-center gap-1 text-[11px] text-ink-muted transition-colors duration-150 ease-cinema hover:text-ink">

          View All <ArrowRightIcon className="h-3 w-3" />
        </Link>
      }>

      {loading ?
      <p className="text-[12px] text-ink-faint">Loading…</p> :
      recent.length === 0 ?
      <p className="text-[12px] text-ink-faint">No recent call activity.</p> :

      <ul className="space-y-3">
          {recent.map((item) =>
        <li key={item.id}>
              <button
            type="button"
            onClick={() => item.leadId && navigate(`/leads/${item.leadId}`)}
            className="flex w-full items-center gap-3 text-left">

                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-agent-voice/[0.12]">
                  <PhoneIcon className="h-3.5 w-3.5 text-agent-voice" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] text-ink">{item.leadName || 'Unknown lead'}</span>
                  <span className="block truncate text-[11px] text-ink-faint">{item.callStatus}</span>
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-ink-faint">
                  {new Date(item.receivedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </span>
              </button>
            </li>
        )}
        </ul>
      }
    </Panel>);

}
