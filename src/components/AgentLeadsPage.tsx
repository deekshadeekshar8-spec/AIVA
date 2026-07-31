import React, { useState, useMemo } from 'react';
import { 
  PhoneCall, User, ShieldAlert, Award, Cpu, 
  Search, MessageSquare, CheckCircle, Clock, 
  MapPin, Send, HelpCircle, Sparkles, Filter, ChevronRight,
  Plus, UploadCloud, Download, RefreshCw, Grid, Phone, Check, ChevronDown, FileSpreadsheet, FileDown, Calendar
} from 'lucide-react';
import { Lead, Agent } from '../types';

interface AgentLeadsPageProps {
  agent: Agent;
  leads: Lead[];
  selectedLeadId: string;
  setSelectedLeadId: (id: string) => void;
  initiateCall: (leadId?: string) => void;
  updateLeadInList: (id: string, updates: Partial<Lead>) => void;
  triggerToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  logCrmActivity: (leadName: string, message: string) => void;
  playBeep: (freq: number, duration: number, type?: 'sine' | 'square' | 'triangle') => void;
  onAddLeadClick: () => void;
  onImportCSV: (importedLeads: Lead[]) => void;
  onViewDetails?: (id: string) => void;
}

export default function AgentLeadsPage({
  agent,
  leads,
  selectedLeadId,
  setSelectedLeadId,
  initiateCall,
  updateLeadInList,
  triggerToast,
  logCrmActivity,
  playBeep,
  onAddLeadClick,
  onImportCSV,
  onViewDetails
}: AgentLeadsPageProps) {
  // Collapsible Filters Panel State
  const [showFilters, setShowFilters] = useState(true);

  // Active Filter States (applied to the leads memo)
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeDateRange, setActiveDateRange] = useState('All');
  const [activeSource, setActiveSource] = useState('All');
  const [activeStatus, setActiveStatus] = useState('All');
  const [activeProject, setActiveProject] = useState('All');
  const [activePendingFollowUp, setActivePendingFollowUp] = useState(false);

  // Temporary Selector States (controlled by elements before clicking "Apply Filters")
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempDateRange, setTempDateRange] = useState('All');
  const [tempSource, setTempSource] = useState('All');
  const [tempStatus, setTempStatus] = useState('All');
  const [tempProject, setTempProject] = useState('All');
  const [tempPendingFollowUp, setTempPendingFollowUp] = useState(false);

  // Filter leads strictly assigned to this agent
  const agentLeads = useMemo(() => {
    return leads.filter(l => l.agentId === agent.id);
  }, [leads, agent.id]);

  const filteredLeads = useMemo(() => {
    return agentLeads.filter(lead => {
      // Search term match
      const matchesSearch = !activeSearchTerm || 
                            lead.name.toLowerCase().includes(activeSearchTerm.toLowerCase()) || 
                            lead.phone.includes(activeSearchTerm) || 
                            lead.project.toLowerCase().includes(activeSearchTerm.toLowerCase());
      
      // Status filter match
      const matchesStatus = activeStatus === 'All' || lead.status === activeStatus;
      
      // Source filter match
      const matchesSource = activeSource === 'All' || lead.source === activeSource;
      
      // Project filter match
      const matchesProject = activeProject === 'All' || lead.project.toLowerCase().includes(activeProject.toLowerCase());

      // Date range filter match
      let matchesDate = true;
      if (activeDateRange === 'Today') {
        matchesDate = lead.dateTime.includes('Just now') || lead.dateTime.includes('Today') || lead.dateTime.includes('16/07') || lead.dateTime.includes('2026');
      } else if (activeDateRange === 'Yesterday') {
        matchesDate = lead.dateTime.includes('Yesterday') || lead.dateTime.includes('15/07');
      } else if (activeDateRange === 'Last 7 Days') {
        matchesDate = !lead.dateTime.includes('Month') && !lead.dateTime.includes('Year');
      }

      // Pending follow-up match
      const matchesPendingFollowUp = !activePendingFollowUp || lead.status === 'Pending';

      return matchesSearch && matchesStatus && matchesSource && matchesProject && matchesDate && matchesPendingFollowUp;
    });
  }, [agentLeads, activeSearchTerm, activeDateRange, activeSource, activeStatus, activeProject, activePendingFollowUp]);

  const activeLead = useMemo(() => {
    return filteredLeads.find(l => l.id === selectedLeadId) || filteredLeads[0] || agentLeads[0] || null;
  }, [filteredLeads, selectedLeadId, agentLeads]);

  const handleSendWhatsApp = (lead: Lead) => {
    if (lead.whatsappSent) {
      triggerToast("WhatsApp documents already delivered to " + lead.name, "info");
      return;
    }
    playBeep(800, 0.15, 'sine');
    updateLeadInList(lead.id, { whatsappSent: true, brochureSent: true, priceSheetSent: true });
    triggerToast(`Brochure pack successfully sent to ${lead.name} via ${agent.name}'s pipeline`, 'success');
    logCrmActivity(lead.name, `${agent.name} delivered brochures and sales materials.`);
  };

  const handleHandover = (lead: Lead) => {
    playBeep(900, 0.2, 'triangle');
    updateLeadInList(lead.id, { status: 'Handed Over' });
    triggerToast(`Lead handed over to corporate executive Sunil Deshmukh.`, 'success');
    logCrmActivity(lead.name, `${agent.name} completed high-interest lead handover.`);
  };

  // Agent Specific CSV Import
  const handleCsvImportSimulate = () => {
    playBeep(880, 0.2, 'triangle');
    
    const sampleNames = ["Vikram Malhotra", "Rachel Green", "Amrita Joshi", "Stephen Cole", "Pooja Hegde"];
    const samplePhones = ["+91 97766 55443", "+1 (212) 555-0144", "+91 94430 88990", "+1 (312) 555-0188", "+91 98200 44556"];
    const sampleBudgets = [1400000, 2400000, 850000, 1950000, 3250000];
    const sampleLocations = ["Delhi, NCR", "New York, NY", "Bangalore, KA", "Chicago, IL", "Mumbai, MH"];
    const sampleProjects = [
      "Astra Heights (Manhattan)", 
      "Astra Meadows (Bangalore)", 
      "Astra Smart duplexes (Chicago)", 
      "Astra Grande (Mumbai)", 
      "Astra Vista (Delhi NCR)"
    ];
    const sampleSources = ["Facebook Ads", "Google Ads", "Website", "Manual Entry"] as const;

    const importedLeads: Lead[] = [];
    for (let i = 0; i < 2; i++) {
      const idx = Math.floor(Math.random() * sampleNames.length);
      importedLeads.push({
        id: `lead_${Date.now()}_csv_${i}`,
        name: sampleNames[idx],
        phone: samplePhones[idx],
        source: sampleSources[Math.floor(Math.random() * sampleSources.length)],
        project: sampleProjects[Math.floor(Math.random() * sampleProjects.length)],
        dateTime: new Date().toLocaleString(),
        agentId: agent.id, // Strictly assigned to THIS agent!
        status: 'Pending',
        interestLevel: 'Warm Lead',
        budget: sampleBudgets[idx],
        location: sampleLocations[idx],
        remarks: `Batch imported via standard CSV ledger for Agent ${agent.name}.`,
        nextFollowUpDate: new Date().toISOString().split('T')[0],
        timeline: 'Immediate',
        whatsappSent: false,
        brochureSent: false,
        priceSheetSent: false,
        siteVisitScheduled: '',
        callDuration: '0s',
        lastContactTime: 'Never',
        recordings: []
      });
    }

    onImportCSV(importedLeads);
    triggerToast(`${importedLeads.length} leads assigned to ${agent.name}'s registry from CSV spreadsheet.`, 'success');
  };

  // Simulated Report Exports / Downloads
  const handleExportReportSimulate = () => {
    playBeep(650, 0.15, 'sine');
    triggerToast(`Exporting ${agent.name}'s performance report...`, "info");
    setTimeout(() => {
      triggerToast(`${agent.name}'s leads log excel exported successfully.`, "success");
    }, 1200);
  };

  const handleDownloadReportSimulate = () => {
    playBeep(700, 0.15, 'triangle');
    triggerToast(`Generating PDF analysis booklet for ${agent.name}...`, "info");
    setTimeout(() => {
      triggerToast(`Performance appraisal PDF downloaded.`, "success");
    }, 1500);
  };

  // Filter apply & resets
  const handleApplyFilters = () => {
    playBeep(580, 0.1, 'sine');
    setActiveSearchTerm(tempSearchTerm);
    setActiveDateRange(tempDateRange);
    setActiveSource(tempSource);
    setActiveStatus(tempStatus);
    setActiveProject(tempProject);
    setActivePendingFollowUp(tempPendingFollowUp);
    triggerToast(`Filters updated: ${filteredLeads.length} leads matching.`, 'info');
  };

  const handleResetFilters = () => {
    playBeep(450, 0.1, 'triangle');
    setTempSearchTerm('');
    setTempDateRange('All');
    setTempSource('All');
    setTempStatus('All');
    setTempProject('All');
    setTempPendingFollowUp(false);

    setActiveSearchTerm('');
    setActiveDateRange('All');
    setActiveSource('All');
    setActiveStatus('All');
    setActiveProject('All');
    setActivePendingFollowUp(false);
    triggerToast("Filters cleared.", "info");
  };

  const handleRefreshCore = () => {
    playBeep(920, 0.1, 'sine');
    triggerToast(`${agent.name}'s workspace database synced.`, "success");
  };

  // Agent Performance Colors & Accent styling
  const colorMap: Record<string, { glow: string; text: string; bg: string; border: string }> = {
    cyan: { glow: 'shadow-[0_0_20px_rgba(6,182,212,0.25)]', text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
    blue: { glow: 'shadow-[0_0_20px_rgba(59,130,246,0.25)]', text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    emerald: { glow: 'shadow-[0_0_20px_rgba(16,185,129,0.25)]', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    amber: { glow: 'shadow-[0_0_20px_rgba(245,158,11,0.25)]', text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    fuchsia: { glow: 'shadow-[0_0_20px_rgba(217,70,239,0.25)]', text: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30' },
  };

  const style = colorMap[agent.color] || colorMap.cyan;

  return (
    <div className="flex flex-col gap-6 bg-gradient-to-br from-[#060e22] via-[#09152b] to-[#040914] text-slate-100 p-6 rounded-3xl shadow-xl" id={`agent-leads-page-${agent.name.toLowerCase()}`}>
      {/* This page still uses the original dark glass theme — needs its own dark
          backdrop now that the app shell around it is light (see LeadDetailsPage.tsx
          for the same fix and why it's needed). */}

      {/* 1. TOP PREMIUM HEADER WITH ACTION CONTROLS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white/[0.01] border-b border-white/5 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
            <h2 className="text-xl font-black text-slate-100 font-mono tracking-wide">{agent.name}'s Leads</h2>
            <ChevronDown className="w-5 h-5 text-slate-400 mt-1" />
          </div>
          <span className="text-xs text-slate-400 font-mono bg-white/5 px-2.5 py-1 border border-white/10 rounded-lg">
            {filteredLeads.length} / {agentLeads.length} matched
          </span>
          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
            Sorted by Lead received on
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 hidden sm:inline -ml-1 mt-0.5" />
        </div>

        {/* Buttons / Icon utilities row */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            onClick={onAddLeadClick}
            className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-[11px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Lead
          </button>
          
          <button
            onClick={handleCsvImportSimulate}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold text-[11px] uppercase tracking-wider px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-cyan-400" />
            Import CSV
          </button>

          <button
            onClick={handleExportReportSimulate}
            className="flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-[11px] uppercase tracking-wider px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Report
          </button>

          {/* Separator line */}
          <div className="w-[1px] h-6 bg-white/10 mx-1 hidden sm:block" />

          {/* Micro functional tools */}
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => { playBeep(520, 0.1); triggerToast(`${agent.name}'s active calling queue loaded.`, "info"); }}
              className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
              title="Call Ledger Dialing"
            >
              <Phone className="w-4 h-4" />
            </button>
            <button 
              onClick={() => { playBeep(520, 0.1); triggerToast("Grid dashboard visualization refreshed.", "info"); }}
              className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
              title="Layout Grid toggle"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => { playBeep(520, 0.1); setShowFilters(!showFilters); }}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${showFilters ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-100'}`}
              title="Toggle Filter Control Box"
            >
              <Filter className="w-4 h-4" />
            </button>
            <button 
              onClick={handleRefreshCore}
              className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
              title="Sync Database"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Premium Agent Voice & Identity Profile Card */}
      <div className={`iceglass rounded-2xl p-6 relative overflow-hidden transition-all duration-300 ${style.glow}`} id="agent-profile-banner">
        {/* Neon Corners */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white/20" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white/20" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white/20" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white/20" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <img 
                src={agent.photoUrl} 
                alt={agent.name} 
                className="w-16 h-16 rounded-full border-2 border-white/20 object-cover shadow-xl" 
              />
              <span className="absolute bottom-0 right-0 w-4.5 h-4.5 bg-emerald-500 border-2 border-[#09152b] rounded-full flex items-center justify-center">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
              </span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-slate-100 font-mono tracking-wide">{agent.name}</h2>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase border ${style.bg} ${style.text} ${style.border}`}>
                  {agent.tone}
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 font-mono text-slate-400">
                  {agent.accent.toUpperCase()} Node
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-sans">{agent.role}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto border-t md:border-t-0 border-white/10 pt-4 md:pt-0">
            <div className="bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl font-mono text-xs flex flex-col justify-center min-w-[180px]">
              <span className="text-[9px] text-slate-500 uppercase font-bold">Vocal Synthesis Engine</span>
              <span className={`font-bold mt-0.5 ${style.text}`}>{agent.voiceName.split('/')[0]}</span>
            </div>
            <div className="bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl font-mono text-xs flex flex-col justify-center text-center">
              <span className="text-[9px] text-slate-500 uppercase font-bold">Conversion Score</span>
              <span className="font-bold text-slate-200 mt-0.5 text-lg">{agent.stats.conversionRate}%</span>
            </div>
          </div>
        </div>

        {/* 4 Performance KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            { label: 'Assigned Pipeline', value: agentLeads.length, desc: 'Dedicated client profiles' },
            { label: 'Visits Locked', value: agent.stats.siteVisits, desc: 'Qualified visual tours' },
            { label: 'Today Outbound Logs', value: agent.stats.todayCalls, desc: 'Autonomous voicings done' },
            { label: 'Interested Ratio', value: `${Math.round((agentLeads.filter(l => l.interestLevel === 'Hot Lead' || l.interestLevel === 'Interested').length / (agentLeads.length || 1)) * 100)}%`, desc: 'Active conversation score' }
          ].map((stat, idx) => (
            <div key={idx} className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 backdrop-blur-md">
              <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500">{stat.label}</span>
              <h4 className="text-xl font-black text-slate-100 mt-0.5 font-mono">{stat.value}</h4>
              <p className="text-[8px] font-mono text-slate-400 mt-0.5">{stat.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 2. RICH SEARCH AND FILTER PANEL (Screenshot layout match!) */}
      {showFilters && (
        <div className="iceglass rounded-2xl p-6 flex flex-col gap-5 relative overflow-hidden transition-all duration-300" id="leads-filter-card">
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400/40" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400/40" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400/40" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400/40" />

          {/* Row A: Big Search input bar */}
          <div className="relative">
            <Search className="w-4.5 h-4.5 text-slate-500 absolute left-4 top-3.5" />
            <input 
              type="text"
              value={tempSearchTerm}
              onChange={(e) => setTempSearchTerm(e.target.value)}
              placeholder="Search by name, phone, lead ID, email..."
              className="w-full text-xs iceglass-input rounded-xl pl-11 pr-4 py-3.5 placeholder-slate-500 text-slate-200 border border-white/5 hover:border-white/10 focus:border-cyan-500/30 transition-all font-mono"
            />
          </div>

          {/* Row B: Date range and Additional filters */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            
            {/* Left box: Date range */}
            <div className="md:col-span-3 flex flex-col gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                Date Range
              </span>
              <select
                value={tempDateRange}
                onChange={(e) => setTempDateRange(e.target.value)}
                className="w-full text-xs iceglass-input rounded-xl px-4 py-3 text-slate-300 cursor-pointer appearance-none border border-white/5 font-mono"
              >
                <option value="All" className="bg-slate-950">All Time</option>
                <option value="Today" className="bg-slate-950">Today</option>
                <option value="Yesterday" className="bg-slate-950">Yesterday</option>
                <option value="Last 7 Days" className="bg-slate-950">Last 7 Days</option>
              </select>
            </div>

            {/* Right box: dropdown arrays */}
            <div className="md:col-span-9 flex flex-col gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-cyan-400" />
                Additional Filters
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {/* Employee filter - locked/disabled visually to this agent */}
                <select
                  disabled
                  className="text-xs iceglass-input rounded-xl px-3 py-3 text-slate-400 border border-white/5 font-mono cursor-not-allowed bg-slate-950/20"
                >
                  <option className="bg-slate-950">{agent.name} (Assigned Agent)</option>
                </select>

                {/* Source filter */}
                <select
                  value={tempSource}
                  onChange={(e) => setTempSource(e.target.value)}
                  className="text-xs iceglass-input rounded-xl px-3 py-3 text-slate-300 cursor-pointer appearance-none border border-white/5 font-mono"
                >
                  <option value="All" className="bg-slate-950">All Sources</option>
                  <option value="Facebook Ads" className="bg-slate-950">Facebook Ads</option>
                  <option value="Google Ads" className="bg-slate-950">Google Ads</option>
                  <option value="Website" className="bg-slate-950">Website</option>
                  <option value="Manual Entry" className="bg-slate-950">Manual Entry</option>
                  <option value="API" className="bg-slate-950">API Webhook</option>
                </select>

                {/* Status filter */}
                <select
                  value={tempStatus}
                  onChange={(e) => setTempStatus(e.target.value)}
                  className="text-xs iceglass-input rounded-xl px-3 py-3 text-slate-300 cursor-pointer appearance-none border border-white/5 font-mono"
                >
                  <option value="All" className="bg-slate-950">All Stages</option>
                  <option value="Pending" className="bg-slate-950">Pending</option>
                  <option value="In Call" className="bg-slate-950">In Call</option>
                  <option value="Completed" className="bg-slate-950">Completed</option>
                  <option value="Handed Over" className="bg-slate-950">Handed Over</option>
                  <option value="Contacted" className="bg-slate-950">Contacted</option>
                </select>

                {/* Project filter */}
                <select
                  value={tempProject}
                  onChange={(e) => setTempProject(e.target.value)}
                  className="text-xs iceglass-input rounded-xl px-3 py-3 text-slate-300 cursor-pointer appearance-none border border-white/5 font-mono"
                >
                  <option value="All" className="bg-slate-950">All Projects</option>
                  <option value="Manhattan" className="bg-slate-950">Astra Manhattan</option>
                  <option value="Bangalore" className="bg-slate-950">Astra Bangalore</option>
                  <option value="Chicago" className="bg-slate-950">Astra Chicago</option>
                  <option value="Mumbai" className="bg-slate-950">Astra Mumbai</option>
                  <option value="Delhi" className="bg-slate-950">Astra Delhi</option>
                </select>
              </div>

              {/* Toggle Pending follow-ups */}
              <div className="flex mt-2">
                <button
                  type="button"
                  onClick={() => { playBeep(500, 0.05); setTempPendingFollowUp(!tempPendingFollowUp); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all ${tempPendingFollowUp ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'}`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Pending Follow-up Leads
                </button>
              </div>
            </div>
          </div>

          {/* Row C: Action button footer */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 border-t border-white/10 pt-4 mt-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleApplyFilters}
                className="flex items-center justify-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all shadow-[0_0_10px_rgba(6,182,212,0.15)] cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Apply Filters
              </button>

              <button
                onClick={handleResetFilters}
                className="flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reset Filters
              </button>

              <button
                onClick={handleExportReportSimulate}
                className="flex items-center justify-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-300 font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export Report
              </button>

              <button
                onClick={handleDownloadReportSimulate}
                className="flex items-center justify-center gap-1.5 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/20 text-purple-300 font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                Download Report
              </button>
            </div>

            <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5 self-center">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              {filteredLeads.length} matching leads
            </span>
          </div>

        </div>
      )}

      {/* Split grid layout of Leads ledger and detail dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="agent-leads-split">
        {/* Table column */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="iceglass rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden transition-all duration-300">
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400/40" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400/40" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400/40" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400/40" />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300 font-mono">{agent.name}'s Client ledger</h3>
                <p className="text-[10px] text-slate-400">Total pipeline: {agentLeads.length} leads</p>
              </div>
            </div>

            {/* Table wrapper */}
            <div className="border border-white/10 rounded-xl overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/10 font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3">Lead name</th>
                    <th className="px-4 py-3">Asset project</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Interest Level</th>
                    <th className="px-4 py-3">Qualified Status</th>
                    <th className="px-4 py-3 text-right">Voice dial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                  {filteredLeads.length > 0 ? (
                    filteredLeads.map((lead) => {
                      const isSelected = selectedLeadId === lead.id;

                      return (
                        <tr 
                          key={lead.id}
                          onClick={() => { 
                            setSelectedLeadId(lead.id); 
                            playBeep(520, 0.05); 
                            if (onViewDetails) onViewDetails(lead.id);
                          }}
                          className={`hover:bg-white/5 cursor-pointer transition-colors ${isSelected ? 'bg-cyan-500/10' : ''}`}
                        >
                          <td className="px-4 py-3.5">
                            <div>
                              <p className="font-bold text-slate-100">{lead.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono">{lead.phone}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-300">
                            <div>
                              <p>{lead.project.replace('Astra ', '')}</p>
                              <p className="text-[9px] text-cyan-400">${lead.budget.toLocaleString()}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-400 text-[11px]">{lead.source}</td>
                          <td className="px-4 py-3.5">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                              lead.interestLevel === 'Hot Lead' || lead.interestLevel === 'Interested' 
                                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/25' 
                                : 'bg-white/5 text-slate-400 border border-white/10'
                            }`}>
                              {lead.interestLevel}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-[11px] flex items-center gap-1.5 font-mono">
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                lead.status === 'Handed Over' 
                                  ? 'bg-fuchsia-500' 
                                  : lead.status === 'Completed' 
                                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
                                    : lead.status === 'In Call' 
                                      ? 'bg-cyan-400 animate-ping' 
                                      : 'bg-slate-400'
                              }`} />
                              {lead.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLeadId(lead.id);
                                initiateCall(lead.id);
                              }}
                              className="inline-flex items-center gap-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all shadow-[0_0_10px_rgba(6,182,212,0.15)] cursor-pointer"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              Dial
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-mono">
                        No client profiles match search filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Selected lead detail dossier column */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {activeLead ? (
            <div className="iceglass rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400/40" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400/40" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400/40" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400/40" />

              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <div className={`w-10 h-10 rounded-full ${style.bg} border ${style.border} flex items-center justify-center font-bold ${style.text}`}>
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300 font-mono">Client File</h3>
                  <p className="text-[10px] text-slate-400">Pipeline classification file</p>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 font-mono text-xs">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-500">NAME:</span>
                  <span className="font-bold text-slate-200">{activeLead.name}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-500">PHONE:</span>
                  <span className="font-bold text-slate-200">{activeLead.phone}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-500">ASSET TARGET:</span>
                  <span className="font-bold text-slate-300 text-right max-w-[180px] truncate">{activeLead.project}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-500">EST BUDGET:</span>
                  <span className="font-bold text-cyan-300">${activeLead.budget.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-500">PREF LOCATION:</span>
                  <span className="font-bold text-slate-200">{activeLead.location}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-500">ACQUIRED VIA:</span>
                  <span className="font-bold text-slate-300">{activeLead.source}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-500">QUAL STATUS:</span>
                  <span className="font-bold text-cyan-400">{activeLead.status}</span>
                </div>

                <div className="flex flex-col gap-1 mt-1 font-sans">
                  <span className="font-mono text-[9px] text-slate-500 uppercase">Automated Remarks:</span>
                  <p className="bg-white/[0.01] p-3 rounded-xl border border-white/5 text-slate-400 italic text-[11px] leading-relaxed">
                    "{activeLead.remarks || 'No dialogue remark transcripts recorded yet.'}"
                  </p>
                </div>
              </div>

              {/* Action grid */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => handleSendWhatsApp(activeLead)}
                  className={`iceglass-button hover:bg-white/[0.08] text-slate-200 font-bold py-2.5 rounded-xl text-[10px] uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 ${activeLead.whatsappSent ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/5' : ''}`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  {activeLead.whatsappSent ? 'Resend' : 'Send Pack'}
                </button>
                <button
                  onClick={() => handleHandover(activeLead)}
                  className={`iceglass-button hover:bg-white/[0.08] text-slate-200 font-bold py-2.5 rounded-xl text-[10px] uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 ${activeLead.status === 'Handed Over' ? 'border-fuchsia-500/30 text-fuchsia-300 bg-fuchsia-500/5' : ''}`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Handover
                </button>
              </div>

              <button
                onClick={() => {
                  setSelectedLeadId(activeLead.id);
                  initiateCall(activeLead.id);
                }}
                className={`w-full bg-gradient-to-r ${agent.color === 'cyan' ? 'from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500' : agent.color === 'blue' ? 'from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500' : agent.color === 'emerald' ? 'from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500' : agent.color === 'amber' ? 'from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500' : 'from-fuchsia-500 to-fuchsia-600 hover:from-fuchsia-400 hover:to-fuchsia-500'} text-slate-950 font-black py-3 rounded-xl uppercase tracking-widest text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-1`}
              >
                <PhoneCall className="w-4 h-4" />
                Trigger {agent.name} Voice Node
              </button>
            </div>
          ) : (
            <div className="iceglass rounded-2xl p-6 text-center text-slate-500 font-mono">
              Select a client profile from the left list to display full detailed reports.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
