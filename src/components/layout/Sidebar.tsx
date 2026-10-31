import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  ActivityIcon,
  BarChart3Icon,
  BrainIcon,
  HomeIcon,
  MessageSquareIcon,
  PhoneCallIcon,
  SettingsIcon,
  SparklesIcon,
  UsersIcon,
  WorkflowIcon } from
'lucide-react';
import { cn } from '../../utils/cn';
import { StatusDot } from '../ui/Panel';
import { useRealCrmStatsContext } from '../../contexts/RealCrmStatsContext';

interface NavItem {
  to: string;
  label: string;
  icon: typeof HomeIcon;
  end?: boolean;
  badge?: string;
}

const baseNav: NavItem[] = [
{ to: '/', label: 'Command Center', icon: HomeIcon, end: true },
{ to: '/live-calls', label: 'Live Calls', icon: PhoneCallIcon },
{ to: '/leads', label: 'Leads', icon: UsersIcon },
{ to: '/agents', label: 'AI Agents', icon: SparklesIcon },
{ to: '/conversations', label: 'Conversations', icon: MessageSquareIcon },
{ to: '/memory', label: 'Memory Vault', icon: BrainIcon },
{ to: '/analytics', label: 'Analytics', icon: BarChart3Icon },
{ to: '/automation', label: 'Automation', icon: WorkflowIcon },
{ to: '/settings', label: 'Settings', icon: SettingsIcon }];


export function Sidebar() {
  const { inCallLeads } = useRealCrmStatsContext();
  const nav = baseNav.map((item) =>
  item.to === '/live-calls' && inCallLeads.length > 0 ?
  { ...item, badge: String(inCallLeads.length) } :
  item
  );

  return (
    <aside className="hidden h-full w-[228px] shrink-0 flex-col border-r border-line bg-[#05080f]/90 lg:flex">
      <div className="flex items-center gap-2.5 px-6 pb-6 pt-6">
        <img src="/brand/aiva-emblem.png" alt="" className="h-9 w-9 shrink-0 object-contain" />
        <div>
          <h1 className="font-serif text-[26px] leading-none tracking-tight text-ink">AIVA</h1>
          <p className="mt-1 text-[8.5px] uppercase leading-[1.4] tracking-widest text-ink-faint">
            AI Sales Workforce
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Primary">
        {nav.map(({ to, label, icon: Icon, badge, end }) =>
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
          cn(
            'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors duration-200 ease-cinema',
            isActive ?
            'bg-[rgba(34,211,238,0.1)] text-ink shadow-[inset_0_0_0_1px_rgba(34,211,238,0.24)]' :
            'text-ink-muted hover:bg-white/[0.03] hover:text-ink'
          )
          }>
          
            {({ isActive }) =>
          <>
                <Icon className={cn('h-[17px] w-[17px]', isActive ? 'text-agent-voice' : 'text-ink-faint')} />
                <span className="flex-1 truncate">{label}</span>
                {badge &&
            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-ink-muted">{badge}</span>
            }
              </>
          }
          </NavLink>
        )}
      </nav>

      <div className="px-4 pb-5">
        <div className="glass-soft flex items-center gap-3 rounded-xl px-3 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[rgba(45,212,191,0.12)]">
            <ActivityIcon className="h-4 w-4 text-agent-action" />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-ink">
              <StatusDot color="#2dd4bf" /> AIVA ONLINE
            </p>
            <p className="text-[10px] text-ink-faint">6 Agents Active</p>
          </div>
        </div>
        <p className="mt-5 font-serif text-[15px] italic leading-snug text-ink-faint">
          “Not just calls.
          <br />
          Conversations
          <br />
          that convert.”
        </p>
      </div>
    </aside>);

}