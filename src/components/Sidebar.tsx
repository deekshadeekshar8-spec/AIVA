import React from 'react';
import {
  LayoutGrid, Bot, MessageSquare, Users, GitBranch, Megaphone, Workflow, Plug,
  BarChart2, FileBarChart, Sparkles, UserCog, Settings as SettingsIcon, Shield, ScrollText, AudioWaveform
} from 'lucide-react';

export type SidebarTab =
  | 'admin' | 'all-leads' | 'agent-ananya' | 'agent-arjun' | 'agent-kavya' | 'agent-rohan' | 'agent-priya' | 'lead-details'
  | 'ai-agents' | 'conversations' | 'call-flows' | 'campaigns' | 'workflows' | 'integrations'
  | 'performance' | 'reports' | 'ai-insights' | 'team-roles' | 'settings' | 'security' | 'system-logs';

interface SidebarProps {
  currentTab: SidebarTab;
  setCurrentTab: (tab: SidebarTab) => void;
  playBeep: (freq: number, duration: number, type?: 'sine' | 'square' | 'triangle') => void;
}

const MANAGE_ITEMS: Array<{ id: SidebarTab; icon: any; label: string }> = [
  { id: 'ai-agents', icon: Bot, label: 'AI Agents' },
  { id: 'conversations', icon: MessageSquare, label: 'Conversations' },
  { id: 'all-leads', icon: Users, label: 'Leads & CRM' },
  { id: 'call-flows', icon: GitBranch, label: 'Call Flows' },
  { id: 'campaigns', icon: Megaphone, label: 'Campaigns' },
  { id: 'workflows', icon: Workflow, label: 'Workflows' },
  { id: 'integrations', icon: Plug, label: 'Integrations' },
];

const ANALYTICS_ITEMS: Array<{ id: SidebarTab; icon: any; label: string }> = [
  { id: 'performance', icon: BarChart2, label: 'Performance' },
  { id: 'reports', icon: FileBarChart, label: 'Reports' },
  { id: 'ai-insights', icon: Sparkles, label: 'AI Insights' },
];

const SYSTEM_ITEMS: Array<{ id: SidebarTab; icon: any; label: string }> = [
  { id: 'team-roles', icon: UserCog, label: 'Team & Roles' },
  { id: 'settings', icon: SettingsIcon, label: 'Settings' },
  { id: 'security', icon: Shield, label: 'Security' },
  { id: 'system-logs', icon: ScrollText, label: 'System Logs' },
];

export default function Sidebar({ currentTab, setCurrentTab, playBeep }: SidebarProps) {
  const go = (tab: SidebarTab) => { setCurrentTab(tab); playBeep(600, 0.08); };

  const NavButton: React.FC<{ id: SidebarTab; icon: any; label: string }> = ({ id, icon: Icon, label }) => {
    const isActive = currentTab === id;
    return (
      <button
        onClick={() => go(id)}
        className={`relative w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300 cursor-pointer ${
          isActive
            ? 'text-indigo-700 bg-gradient-to-r from-indigo-50 to-cyan-50/60 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.15)]'
            : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
        }`}
      >
        {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-gradient-to-b from-indigo-500 to-cyan-400" />}
        <Icon className="w-4 h-4 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
    );
  };

  return (
    <aside className="w-64 shrink-0 m-3 mr-0 rounded-3xl glass-panel flex flex-col h-[calc(100vh-24px)] sticky top-3 overflow-hidden">
      <div className="px-4 pt-5 pb-3 flex items-center gap-2.5">
        <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30">
          <AudioWaveform className="w-5 h-5 text-white" />
          <span className="absolute -inset-0.5 rounded-xl bg-gradient-to-br from-indigo-400 to-cyan-400 opacity-40 blur-md -z-10 pulse-ring" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-black text-gradient-aiva leading-none">AiVA</p>
          <p className="text-[8px] text-slate-400 font-semibold tracking-wide uppercase mt-0.5 truncate">Your AI Voice, Always Listening</p>
        </div>
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={() => go('admin')}
          className={`relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer overflow-hidden ${
            currentTab === 'admin' ? 'text-white shadow-lg shadow-indigo-500/30' : 'bg-white/60 text-slate-700 hover:bg-white/90'
          }`}
        >
          {currentTab === 'admin' && <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-500 to-cyan-500 bg-[length:200%_auto] animate-[gradient-pan_4s_ease_infinite]" />}
          <LayoutGrid className="w-4 h-4 shrink-0 relative" />
          <span className="relative">Command Center</span>
        </button>
      </div>

      <nav className="flex-1 px-3 flex flex-col gap-5 pb-4 overflow-y-auto scrollbar-thin">
        <div className="flex flex-col gap-1">
          <span className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">Manage</span>
          {MANAGE_ITEMS.map(item => <NavButton key={item.id} id={item.id} icon={item.icon} label={item.label} />)}
        </div>
        <div className="flex flex-col gap-1">
          <span className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">Analytics</span>
          {ANALYTICS_ITEMS.map(item => <NavButton key={item.id} id={item.id} icon={item.icon} label={item.label} />)}
        </div>
        <div className="flex flex-col gap-1">
          <span className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">System</span>
          {SYSTEM_ITEMS.map(item => <NavButton key={item.id} id={item.id} icon={item.icon} label={item.label} />)}
        </div>
      </nav>

      <div className="px-4 py-4 border-t border-white/60 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 text-white flex items-center justify-center font-bold text-xs shadow-md">M</div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-800 truncate">Manager</p>
          <p className="text-[10px] text-slate-400 truncate">Super Admin</p>
        </div>
      </div>
    </aside>
  );
}
