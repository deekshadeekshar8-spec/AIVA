import React from 'react';
import { HeroTeam } from '../components/command/HeroTeam';
import { MissionControl } from '../components/command/MissionControl';
import { LeadDNA } from '../components/command/LeadDNA';
import { TeamFlow } from '../components/command/TeamFlow';
import { PerformancePanel } from '../components/command/PerformancePanel';
import { LiveCallPanel } from '../components/command/LiveCallPanel';
import { RecentActivityPanel } from '../components/command/RecentActivityPanel';

export function CommandCenter() {
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_336px]">
      <div className="min-w-0 space-y-3">
        <HeroTeam />
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <MissionControl />
          <LeadDNA />
        </div>
        <TeamFlow />
      </div>

      <aside className="space-y-3" aria-label="Live operations">
        <PerformancePanel />
        <LiveCallPanel />
        <RecentActivityPanel />
      </aside>
    </div>);

}
