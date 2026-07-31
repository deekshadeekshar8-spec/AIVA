import React, { useEffect, useState } from 'react';
import { ToggleLeft, ToggleRight } from 'lucide-react';
import { getOmnidimSettings, updateOmnidimSettings, OmnidimSettings } from '../utils/backendApi';
import { Agent } from '../types';

interface SettingsPageProps {
  agents: Agent[];
  triggerToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

// Real settings — reads/writes the same backend settings doc that drives the
// autonomous dialer (server/store.js DEFAULT_SETTINGS). No mock toggles here.
export default function SettingsPage({ agents, triggerToast }: SettingsPageProps) {
  const [settings, setSettings] = useState<OmnidimSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOmnidimSettings().then(s => { setSettings(s); setLoading(false); });
  }, []);

  const toggleAutoDial = async () => {
    if (!settings) return;
    const next = !settings.autoDialEnabled;
    if (next && !window.confirm('This will let AIVA place REAL outbound calls automatically to any lead whose follow-up is due, with no one clicking anything. Are you sure?')) {
      return;
    }
    const updated = await updateOmnidimSettings({ autoDialEnabled: next });
    if (updated) {
      setSettings(updated);
      triggerToast(`Autonomous dialing ${next ? 'ENABLED' : 'disabled'}.`, next ? 'success' : 'info');
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col gap-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-500">Real system controls — changes here affect production immediately</p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading settings…</p>
      ) : (
        <>
          <div className="flex items-center justify-between border border-slate-100 bg-slate-50 rounded-2xl p-4">
            <div>
              <p className="text-sm font-bold text-slate-800">Autonomous Dialing</p>
              <p className="text-xs text-slate-500 mt-0.5">When ON, AIVA automatically redials leads whose follow-up is due — including the 2-hour no-answer retry — every 5 minutes, with no manual trigger.</p>
            </div>
            <button onClick={toggleAutoDial} className="shrink-0 cursor-pointer">
              {settings?.autoDialEnabled
                ? <ToggleRight className="w-10 h-10 text-emerald-500" />
                : <ToggleLeft className="w-10 h-10 text-slate-300" />}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold text-slate-800">Omnidimension Agent Mapping</p>
            <p className="text-xs text-slate-500 -mt-1">Which real Omnidimension agent ID handles calls for each AIVA sales agent</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-1">
              {agents.map(agent => (
                <div key={agent.id} className="flex items-center justify-between border border-slate-100 rounded-xl px-3.5 py-2.5">
                  <span className="text-sm font-semibold text-slate-700">{agent.name}</span>
                  <span className="text-xs font-mono text-slate-500">
                    {settings?.agentIdMap?.[agent.id] || 'Not mapped'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
