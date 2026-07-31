import React, { useMemo } from 'react';
import { 
  Database, CheckCircle, Clock, Sparkles, Calendar, TrendingUp, Globe, Volume2, FileText 
} from 'lucide-react';
import { Lead, Agent, ActivityLog } from '../types';
import RoyalAivaAssistant from './RoyalAivaAssistant';

interface AdminPanelProps {
  leads: Lead[];
  agents: Agent[];
  activityLogs: ActivityLog[];
  playBeep: (freq: number, duration: number, type?: 'sine' | 'square' | 'triangle') => void;
  triggerToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export default function AdminPanel({
  leads,
  agents,
  activityLogs,
  playBeep,
  triggerToast
}: AdminPanelProps) {
  
  // Calculate aggregated stats
  const adminStats = useMemo(() => {
    const total = leads.length;
    const completed = leads.filter(l => l.status === 'Completed' || l.status === 'Handed Over').length;
    const pending = leads.filter(l => l.status === 'Pending' || l.status === 'Outgoing Retry').length;
    const hotLeads = leads.filter(l => l.interestLevel === 'Hot Lead' || l.interestLevel === 'Interested').length;
    const siteVisits = leads.filter(l => l.siteVisitScheduled !== '').length;
    return { total, completed, pending, hotLeads, siteVisits };
  }, [leads]);

  return (
    <div className="flex flex-col gap-6">
      
      {/* ROYAL AIVA ASSISTANT COMMAND MODULE */}
      <RoyalAivaAssistant 
        leads={leads} 
        agents={agents} 
        playBeep={playBeep} 
        triggerToast={triggerToast} 
      />

      {/* Aggregate Dashboard Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Total CRM Leads', value: adminStats.total, icon: Database, color: 'text-cyan-400' },
          { label: 'AI Calls Completed', value: adminStats.completed, icon: CheckCircle, color: 'text-emerald-400' },
          { label: 'Outgoing Queue', value: adminStats.pending, icon: Clock, color: 'text-indigo-400' },
          { label: 'High Intent Leads', value: adminStats.hotLeads, icon: Sparkles, color: 'text-rose-400' },
          { label: 'Site Visits Booked', value: adminStats.siteVisits, icon: Calendar, color: 'text-fuchsia-400' }
        ].map((stat, idx) => (
          <div key={idx} className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-lg backdrop-blur-md">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{stat.label}</p>
              <h4 className="text-3xl font-black text-slate-100 font-mono mt-1">{stat.value}</h4>
            </div>
            <div className={`p-3 bg-white/5 border border-white/10 rounded-xl ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts & Conversion Pipeline Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SVG Leads Funnel */}
        <div className="lg:col-span-7 iceglass rounded-2xl p-5 flex flex-col gap-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Automated Sales Conversion Funnel
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Physical breakdown of automated workflow conversion pipeline.</p>
          </div>

          <div className="flex flex-col gap-3 mt-2 font-mono">
            {[
              { stage: 'Ads & Web Traffic (Lead Gen)', count: 125, percentage: 100, color: 'bg-indigo-600' },
              { stage: 'AI Outbound Auto-Dial (Contacted)', count: 88, percentage: 70, color: 'bg-cyan-500' },
              { stage: 'Document Auto-Send (Pushed Brochure)', count: 64, percentage: 51, color: 'bg-emerald-500' },
              { stage: 'Site Visit Booked (Automated Scheduling)', count: 28, percentage: 22, color: 'bg-fuchsia-500' },
              { stage: 'Handed Over to Humans (Deal Closed)', count: 14, percentage: 11, color: 'bg-cyan-500' }
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>{item.stage}</span>
                  <span className="font-bold text-slate-200">{item.count} leads ({item.percentage}%)</span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full border border-white/10 overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CRM Channel Distribution */}
        <div className="lg:col-span-5 iceglass rounded-2xl p-5 flex flex-col gap-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono flex items-center gap-2">
              <Globe className="w-4 h-4" />
              CRM Source Distribution
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Live incoming channel breakdown.</p>
          </div>

          <div className="flex items-center justify-around gap-4 mt-2">
            <svg className="w-32 h-32" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(30, 41, 59, 0.5)" strokeWidth="10" />
              {/* Segment 1: FB (35%) */}
              <circle cx="50" cy="50" r="38" fill="none" stroke="#06b6d4" strokeWidth="10" strokeDasharray="238.7" strokeDashoffset="0" transform="rotate(-90 50 50)" />
              {/* Segment 2: Google (25%) */}
              <circle cx="50" cy="50" r="38" fill="none" stroke="#6366f1" strokeWidth="10" strokeDasharray="59.7 238.7" strokeDashoffset="-83.5" transform="rotate(-90 50 50)" />
              {/* Segment 3: Web & API (40%) */}
              <circle cx="50" cy="50" r="38" fill="none" stroke="#10b981" strokeWidth="10" strokeDasharray="95.5 238.7" strokeDashoffset="-143.2" transform="rotate(-90 50 50)" />
            </svg>

            <div className="flex flex-col gap-2 text-[10px] font-mono text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-cyan-500 rounded-sm" />
                <span>Facebook Ads (35%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm" />
                <span>Google Ads (25%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
                <span>Web & Webhooks (40%)</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Call Recording Library Summary */}
      <div className="iceglass rounded-2xl p-6 flex flex-col gap-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono flex items-center gap-2">
          <Volume2 className="w-4 h-4" />
          AI Outbound Recording Audit Trail
        </h3>
        <p className="text-xs text-slate-400">Review automated agent recordings, physical call lengths, and semantic transcripts.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {leads.flatMap(l => l.recordings.map(r => ({ ...r, leadName: l.name, project: l.project }))).map((rec, idx) => (
            <div key={idx} className="bg-white/[0.02] border border-white/10 rounded-xl p-4 flex flex-col gap-2 shadow-inner">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">{rec.leadName}</h4>
                  <p className="text-[10px] text-slate-500 font-mono">{rec.project}</p>
                </div>
                <span className="text-[10px] bg-white/5 text-cyan-300 border border-white/10 px-2 py-0.5 rounded font-mono backdrop-blur-md">
                  {rec.duration}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed italic bg-white/[0.01] p-2.5 rounded-lg border border-white/5">
                "{rec.summary}"
              </p>
              <div className="text-[9px] text-slate-500 font-mono text-right">
                Logged on {rec.date}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
