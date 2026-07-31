import React from 'react';
import { Construction } from 'lucide-react';

// Honest placeholder for sidebar sections that don't have a real backend yet
// (Call Flows, Campaigns, Workflows, Team & Roles, Security, System Logs...).
// Deliberately shows NO fabricated data — just says plainly it isn't built yet.
export default function ComingSoonPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="glass-panel rounded-3xl p-12 flex flex-col items-center text-center gap-3 max-w-2xl mx-auto mt-10">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 pulse-ring">
        <Construction className="w-7 h-7" />
      </div>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500 max-w-md">{description}</p>
      <p className="text-xs text-slate-400 mt-2">This section isn't built yet — no backend exists for it. Ask to have it built when you're ready.</p>
    </div>
  );
}
