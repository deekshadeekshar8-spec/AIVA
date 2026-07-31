import React, { useState } from 'react';
import { Search, ArrowUpRight, Mic } from 'lucide-react';
import { Agent, Lead } from '../types';
import AgentVoiceChat from './AgentVoiceChat';

interface AiAgentsPageProps {
  agents: Agent[];
  leads: Lead[];
  onOpenAgent: (agentId: string) => void;
  playBeep?: (freq: number, duration: number, type?: 'sine' | 'square' | 'triangle') => void;
}

// Real per-agent stats table — every number comes from the live agents array
// (computed in App.tsx from actual leads), nothing here is placeholder data.
export default function AiAgentsPage({ agents, leads, onOpenAgent, playBeep }: AiAgentsPageProps) {
  const [talkAgentId, setTalkAgentId] = useState<string | null>(null);
  const talkAgent = agents.find(a => a.id === talkAgentId) || null;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">AI Agents</h2>
          <p className="text-sm text-slate-500">Manage and monitor your AI voice agents</p>
        </div>
        <div className="relative hidden md:flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3" />
          <input readOnly placeholder="Search agents..." className="pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500 w-56 cursor-default" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
              <th className="py-3 pr-4 font-semibold">Agent</th>
              <th className="py-3 pr-4 font-semibold">Role</th>
              <th className="py-3 pr-4 font-semibold">Status</th>
              <th className="py-3 pr-4 font-semibold text-right">Calls Today</th>
              <th className="py-3 pr-4 font-semibold text-right">Assigned Leads</th>
              <th className="py-3 pr-4 font-semibold text-right">Success Rate</th>
              <th className="py-3 pr-4 font-semibold text-right">Talk</th>
              <th className="py-3 pr-4 font-semibold text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {agents.map(agent => (
              <tr key={agent.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 pr-4 cursor-pointer" onClick={() => onOpenAgent(agent.id)}>
                  <div className="flex items-center gap-2.5">
                    <img src={agent.photoUrl} alt={agent.name} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                    <span className="font-bold text-slate-900 text-sm">{agent.name}</span>
                  </div>
                </td>
                <td className="py-3 pr-4 text-sm text-slate-600 cursor-pointer" onClick={() => onOpenAgent(agent.id)}>{agent.role.replace('Astra ', '')}</td>
                <td className="py-3 pr-4 cursor-pointer" onClick={() => onOpenAgent(agent.id)}>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
                  </span>
                </td>
                <td className="py-3 pr-4 text-right text-sm font-bold text-slate-800 cursor-pointer" onClick={() => onOpenAgent(agent.id)}>{agent.stats.todayCalls}</td>
                <td className="py-3 pr-4 text-right text-sm text-slate-600 cursor-pointer" onClick={() => onOpenAgent(agent.id)}>{agent.stats.assignedLeads}</td>
                <td className="py-3 pr-4 text-right text-sm font-bold text-slate-800 cursor-pointer" onClick={() => onOpenAgent(agent.id)}>{agent.stats.conversionRate}%</td>
                <td className="py-3 pr-4 text-right">
                  <button
                    onClick={(e) => { e.stopPropagation(); setTalkAgentId(agent.id); }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5" /> Talk
                  </button>
                </td>
                <td className="py-3 pr-4 text-right cursor-pointer" onClick={() => onOpenAgent(agent.id)}>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 inline-block" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400">Showing {agents.length} of {agents.length} agents</p>

      {talkAgent && (
        <AgentVoiceChat agent={talkAgent} leads={leads} playBeep={playBeep} onClose={() => setTalkAgentId(null)} />
      )}
    </div>
  );
}
