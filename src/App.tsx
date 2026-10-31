import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AivaProvider } from './contexts/AivaContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RealCrmStatsProvider } from './contexts/RealCrmStatsContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { AppShell } from './components/layout/AppShell';
import { CommandCenter } from './pages/CommandCenter';
import { AgentsPage } from './pages/AgentsPage';
import { AgentProfile } from './pages/AgentProfile';
import { LiveCallsPage } from './pages/LiveCallsPage';
import { LeadsPage } from './pages/LeadsPage';
import { LeadDetailsPage } from './pages/LeadDetailsPage';
import { ConversationsPage } from './pages/ConversationsPage';
import { MemoryVaultPage } from './pages/MemoryVaultPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AutomationPage } from './pages/AutomationPage';
import { SettingsPage } from './pages/SettingsPage';

function ModuleRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<CommandCenter />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/agents/:agentId" element={<AgentProfile />} />
        <Route path="/live-calls" element={<LiveCallsPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/leads/:leadId" element={<LeadDetailsPage />} />
        <Route path="/conversations" element={<ConversationsPage />} />
        <Route path="/memory" element={<MemoryVaultPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/automation" element={<AutomationPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>);

}

function Gate() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="grid h-full w-full place-items-center bg-void text-[12px] text-ink-faint">Connecting to AIVA…</div>;
  }
  if (!user) return <LoginScreen />;

  return (
    <RealCrmStatsProvider>
      <AivaProvider>
        <BrowserRouter>
          <ModuleRoutes />
        </BrowserRouter>
      </AivaProvider>
    </RealCrmStatsProvider>);

}

export function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>);

}
