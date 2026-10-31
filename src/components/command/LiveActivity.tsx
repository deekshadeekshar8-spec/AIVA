import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneIcon } from 'lucide-react';
import { Panel, StatusDot } from '../ui/Panel';
import { useRealCrmStatsContext } from '../../contexts/RealCrmStatsContext';

export function LiveActivity() {
  const navigate = useNavigate();
  const { callEvents, loading } = useRealCrmStatsContext();
  const recent = [...callEvents].
  sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()).
  slice(0, 8);

  return (
    <Panel
      id="activity"
      title="Live Activity"
      className="rounded-xl"
      action={
      <span className="flex items-center gap-1.5 rounded-full border border-line px-2 py-1 text-[10px] text-ink-muted">
          <StatusDot color="#34d399" /> Live
        </span>
      }>

      {loading ?
      <p className="text-[12px] text-ink-faint">Loading…</p> :
      recent.length === 0 ?
      <p className="text-[12px] text-ink-faint">No call events recorded yet.</p> :

      <ul className="space-y-3">
          {recent.map((item) =>
        <li key={item.id}>
              <button
            type="button"
            onClick={() => item.leadId && navigate(`/leads/${item.leadId}`)}
            className="flex w-full items-start gap-3 text-left transition-opacity duration-150 ease-cinema hover:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30">

                <span className="w-14 shrink-0 pt-0.5 text-[10.5px] tabular-nums text-ink-faint">
                  {new Date(item.receivedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </span>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-agent-voice/[0.12]">
                  <PhoneIcon className="h-3.5 w-3.5 text-agent-voice" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-ink">{item.leadName || 'Unknown lead'}</span>
                  <span className="block truncate text-[11px] text-ink-faint">
                    {item.callStatus}{item.durationSeconds ? ` · ${item.durationSeconds}s` : ''}
                  </span>
                </span>
              </button>
            </li>
        )}
        </ul>
      }
    </Panel>);

}
