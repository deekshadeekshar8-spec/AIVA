import React from 'react';
import { PhoneCall, User, Award, ShieldAlert, Cpu } from 'lucide-react';
import { Lead, Agent } from '../types';

interface AgentDashboardProps {
  agents: Agent[];
  leads: Lead[];
  selectedAgentId: string;
  setSelectedAgentId: (id: string) => void;
  selectedLeadId: string;
  setSelectedLeadId: (id: string) => void;
  initiateCall: (leadId?: string) => void;
  setCurrentTab: (tab: 'caller' | 'agents' | 'admin') => void;
  playBeep: (freq: number, duration: number, type?: 'sine' | 'square' | 'triangle') => void;
}

export default function AgentDashboard({
  agents,
  leads,
  selectedAgentId,
  setSelectedAgentId,
  selectedLeadId,
  setSelectedLeadId,
  initiateCall,
  setCurrentTab,
  playBeep
}: AgentDashboardProps) {
  const activeAgent = agents.find(a => a.id === selectedAgentId) || agents[0];

  return (
    <div className="flex flex-col gap-6">
      {/* Agent Selection Header Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => { setSelectedAgentId(agent.id); playBeep(500 + (agents.indexOf(agent) * 40), 0.08); }}
            className={`relative p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all duration-300 ${selectedAgentId === agent.id ? 'bg-cyan-500/15 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)] text-cyan-400' : 'bg-white/[0.02] border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-200'} cursor-pointer`}
          >
            <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden relative">
              <img src={agent.photoUrl} alt={agent.name} className="w-full h-full object-cover" />
            </div>
            <div>
              <h4 className="text-xs font-bold font-mono">{agent.name}</h4>
              <p className="text-[9px] uppercase tracking-wider text-slate-500 font-mono">Conversion: {agent.stats.conversionRate}%</p>
            </div>
          </button>
        ))}
      </div>

      {/* Selected Agent Metrics Dashboard */}
      <div className="iceglass rounded-2xl p-6 flex flex-col gap-6 relative overflow-hidden transition-all duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-4">
            <img src={activeAgent.photoUrl} alt={activeAgent.name} className="w-14 h-14 rounded-full border-2 border-cyan-500/50 object-cover shadow-[0_0_15px_rgba(6,182,212,0.2)]" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">{activeAgent.name}'s Dashboard</h3>
                <span className="text-[10px] px-2 py-0.5 bg-white/5 text-cyan-300 border border-white/10 rounded font-mono uppercase tracking-wider backdrop-blur-md">{activeAgent.tone}</span>
              </div>
              <p className="text-xs text-slate-400">{activeAgent.role}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="text-[11px] bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl font-mono text-slate-200 backdrop-blur-md">
              Voice Engine: <strong className="text-cyan-300">{activeAgent.voiceName}</strong>
            </span>
          </div>
        </div>

        {/* 4 Core KPI Stats Card Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Assigned Leads', value: activeAgent.stats.assignedLeads, desc: 'CRM Pipeline' },
            { label: "Today's Calls", value: activeAgent.stats.todayCalls, desc: 'Completed / Active' },
            { label: 'Pending Retries', value: activeAgent.stats.pendingCalls, desc: 'Follow-up Scheduler' },
            { label: 'Conversion Rate', value: `${activeAgent.stats.conversionRate}%`, desc: 'Average Target Score' }
          ].map((stat, idx) => (
            <div key={idx} className="bg-white/[0.02] border border-white/10 rounded-xl p-4 shadow-sm backdrop-blur-md">
              <p className="text-[10px] uppercase font-mono tracking-wider text-slate-500">{stat.label}</p>
              <h4 className="text-2xl font-black text-slate-100 mt-1 font-mono tracking-tight">{stat.value}</h4>
              <p className="text-[9px] font-mono text-slate-400 mt-0.5">{stat.desc}</p>
            </div>
          ))}
        </div>

        {/* List of assigned lead accounts table */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">Assigned Lead Accounts</h4>
          <div className="border border-white/10 rounded-xl overflow-x-auto backdrop-blur-md">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/10 font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Lead Account</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Target Project</th>
                  <th className="px-4 py-3">Budget</th>
                  <th className="px-4 py-3">Interest Level</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                {leads.filter(l => l.agentId === activeAgent.id).map((lead) => (
                  <tr 
                    key={lead.id}
                    className={`hover:bg-white/5 transition-colors ${selectedLeadId === lead.id ? 'bg-white/10' : ''}`}
                  >
                    <td className="px-4 py-3.5">
                      <div>
                        <p className="font-bold text-slate-100">{lead.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{lead.phone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">{lead.source}</td>
                    <td className="px-4 py-3.5 text-slate-300 font-mono">{lead.project}</td>
                    <td className="px-4 py-3.5 font-bold font-mono text-slate-100">${lead.budget.toLocaleString()}</td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${lead.interestLevel === 'Hot Lead' || lead.interestLevel === 'Interested' ? 'bg-rose-500/15 text-rose-300 border border-rose-500/25' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
                        {lead.interestLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-[11px] flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${lead.status === 'Handed Over' ? 'bg-fuchsia-500' : lead.status === 'Completed' ? 'bg-emerald-500' : lead.status === 'In Call' ? 'bg-cyan-400 animate-ping' : 'bg-slate-400'}`} />
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => { setSelectedLeadId(lead.id); initiateCall(lead.id); setCurrentTab('caller'); }}
                        className="inline-flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        Call
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
