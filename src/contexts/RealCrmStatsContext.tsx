import React, { createContext, useContext } from 'react';
import { useRealCrmStats, type RealCrmStats } from '../hooks/useRealCrmStats';

const Ctx = createContext<RealCrmStats | null>(null);

export function RealCrmStatsProvider({ children }: { children: React.ReactNode }) {
  const stats = useRealCrmStats();
  return <Ctx.Provider value={stats}>{children}</Ctx.Provider>;
}

export function useRealCrmStatsContext(): RealCrmStats {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRealCrmStatsContext must be used inside <RealCrmStatsProvider>');
  return ctx;
}
