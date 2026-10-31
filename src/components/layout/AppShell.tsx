import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { CommandBar } from './CommandBar';
import { AgentStage } from '../agent/AgentStage';
import { IntelligencePanel } from '../agent/IntelligencePanel';
import { useAiva } from '../../contexts/AivaContext';

export function AppShell() {
  const { activeAgent } = useAiva();

  return (
    <div
      className="flex h-full w-full overflow-hidden bg-void"
      style={{ ['--accent' as string]: activeAgent?.accent ?? '#22d3ee' }}>

      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <CommandBar />
        <main className="thin-scroll flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          <Outlet />
        </main>
      </div>
      <AgentStage />
      <IntelligencePanel />
    </div>);

}
