import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { getOmnidimHealth } from '../utils/backendApi';

// Real connection status — no fake "connected" badges. Pulled from the backend's
// actual /api/omnidim/health check, which reports whether real API keys are set.
export default function IntegrationsPage() {
  const [status, setStatus] = useState<{ configured: boolean; geminiAnalysisConfigured: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOmnidimHealth().then(res => { setStatus(res); setLoading(false); });
  }, []);

  const rows = [
    { name: 'Omnidimension (voice calling)', ok: status?.configured, desc: 'Places and syncs real outbound calls' },
    { name: 'Gemini (call transcript analysis)', ok: status?.geminiAnalysisConfigured, desc: 'Analyzes call transcripts to update lead status' },
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col gap-5 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Integrations</h2>
        <p className="text-sm text-slate-500">Real connection status for external services</p>
      </div>
      {loading ? (
        <p className="text-sm text-slate-400">Checking connection status…</p>
      ) : (
        <div className="flex flex-col divide-y divide-slate-100">
          {rows.map(row => (
            <div key={row.name} className="flex items-center justify-between py-3.5">
              <div>
                <p className="text-sm font-bold text-slate-800">{row.name}</p>
                <p className="text-xs text-slate-400">{row.desc}</p>
              </div>
              {row.ok ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
                  <XCircle className="w-3.5 h-3.5" /> Not configured
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-slate-400">WhatsApp Business API connection status isn't exposed by a health-check endpoint yet — check functions/.env directly to confirm WHATSAPP_TOKEN is set.</p>
    </div>
  );
}
