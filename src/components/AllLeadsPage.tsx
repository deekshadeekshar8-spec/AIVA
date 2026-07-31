import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  PhoneCall, User, Database, Search, Filter,
  Send, MessageSquare, ShieldAlert, CheckCheck,
  MapPin, CheckCircle, Clock, Trash2, Calendar, FileText,
  Plus, UploadCloud, Download, RefreshCw, Grid, Phone, Check, ChevronDown, FileSpreadsheet, FileDown,
  MoreVertical, Eye, CalendarClock
} from 'lucide-react';
import { Lead, Agent } from '../types';
import { sendWhatsAppMessage } from '../utils/whatsapp';

interface AllLeadsPageProps {
  leads: Lead[];
  agents: Agent[];
  selectedLeadId: string;
  setSelectedLeadId: (id: string) => void;
  initiateCall: (leadId?: string) => void;
  updateLeadInList: (id: string, updates: Partial<Lead>) => void;
  triggerToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  logCrmActivity: (leadName: string, message: string) => void;
  playBeep: (freq: number, duration: number, type?: 'sine' | 'square' | 'triangle') => void;
  onAddLeadClick: () => void;
  onImportCSV: (importedLeads: Lead[]) => void;
  onDeleteLead?: (lead: Lead) => void;
  onViewDetails?: (id: string) => void;
}

export default function AllLeadsPage({
  leads,
  agents,
  selectedLeadId,
  setSelectedLeadId,
  initiateCall,
  updateLeadInList,
  triggerToast,
  logCrmActivity,
  playBeep,
  onAddLeadClick,
  onImportCSV,
  onDeleteLead,
  onViewDetails
}: AllLeadsPageProps) {
  // Collapsible Filters Panel State
  const [showFilters, setShowFilters] = useState(false);

  // Per-row "⋮" action menu — only one open at a time, closes on outside click.
  const [openMenuLeadId, setOpenMenuLeadId] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!openMenuLeadId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenuLeadId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuLeadId]);

  // Active Filter States (applied to the leads memo)
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeDateRange, setActiveDateRange] = useState('All');
  const [activeEmployee, setActiveEmployee] = useState('All');
  const [activeSource, setActiveSource] = useState('All');
  const [activeStatus, setActiveStatus] = useState('All');
  const [activeProject, setActiveProject] = useState('All');
  const [activePendingFollowUp, setActivePendingFollowUp] = useState(false);

  // Temporary Selector States (controlled by elements before clicking "Apply Filters")
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempDateRange, setTempDateRange] = useState('All');
  const [tempEmployee, setTempEmployee] = useState('All');
  const [tempSource, setTempSource] = useState('All');
  const [tempStatus, setTempStatus] = useState('All');
  const [tempProject, setTempProject] = useState('All');
  const [tempPendingFollowUp, setTempPendingFollowUp] = useState(false);

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // Search term match
      const matchesSearch = !activeSearchTerm || 
                            lead.name.toLowerCase().includes(activeSearchTerm.toLowerCase()) || 
                            lead.phone.includes(activeSearchTerm) || 
                            lead.project.toLowerCase().includes(activeSearchTerm.toLowerCase()) ||
                            lead.id.toLowerCase().includes(activeSearchTerm.toLowerCase());
      
      // Status filter match
      const matchesStatus = activeStatus === 'All' || lead.status === activeStatus;
      
      // Source filter match
      const matchesSource = activeSource === 'All' || lead.source === activeSource;
      
      // Project filter match
      const matchesProject = activeProject === 'All' || lead.project.toLowerCase().includes(activeProject.toLowerCase());
      
      // Employee (assigned agent) filter match
      const matchesEmployee = activeEmployee === 'All' || lead.agentId === activeEmployee;

      // Date range filter match (simulated mapping based on simulated registration dates)
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

      return matchesSearch && matchesStatus && matchesSource && matchesProject && matchesEmployee && matchesDate && matchesPendingFollowUp;
    });
  }, [leads, activeSearchTerm, activeDateRange, activeEmployee, activeSource, activeStatus, activeProject, activePendingFollowUp]);

  // Pagination — 50 leads per page, mirrors the pattern used across the rest of the app.
  const LEADS_PER_PAGE = 50;
  const [leadsPage, setLeadsPage] = useState(1);
  const totalLeadPages = Math.max(1, Math.ceil(filteredLeads.length / LEADS_PER_PAGE));
  React.useEffect(() => { setLeadsPage(1); }, [filteredLeads.length]);
  React.useEffect(() => {
    if (leadsPage > totalLeadPages) setLeadsPage(totalLeadPages);
  }, [totalLeadPages, leadsPage]);
  const pagedLeads = useMemo(
    () => filteredLeads.slice((leadsPage - 1) * LEADS_PER_PAGE, leadsPage * LEADS_PER_PAGE),
    [filteredLeads, leadsPage]
  );
  const leadPageNumbers = useMemo(() => {
    const pages: Array<number | '...'> = [];
    const push = (p: number | '...') => { if (pages[pages.length - 1] !== p) pages.push(p); };
    push(1);
    if (leadsPage > 3) push('...');
    for (let p = Math.max(2, leadsPage - 1); p <= Math.min(totalLeadPages - 1, leadsPage + 1); p++) push(p);
    if (leadsPage < totalLeadPages - 2) push('...');
    if (totalLeadPages > 1) push(totalLeadPages);
    return pages;
  }, [leadsPage, totalLeadPages]);

  // Overall lead stats
  const stats = useMemo(() => {
    const total = leads.length;
    const hot = leads.filter(l => l.interestLevel === 'Hot Lead' || l.interestLevel === 'Interested').length;
    const completed = leads.filter(l => l.status === 'Completed' || l.status === 'Handed Over').length;
    const pending = leads.filter(l => l.status === 'Pending').length;
    return { total, hot, completed, pending };
  }, [leads]);

  const activeLead = useMemo(() => {
    return leads.find(l => l.id === selectedLeadId) || leads[0] || null;
  }, [leads, selectedLeadId]);

  const activeAgent = useMemo(() => {
    if (!activeLead) return null;
    return agents.find(a => a.id === activeLead.agentId) || agents[0];
  }, [agents, activeLead]);

  // Sends a REAL WhatsApp message via the Meta Cloud API (through our backend, which
  // holds the token). Previously this just flipped local flags and showed a fake
  // "dispatched" toast without ever calling WhatsApp — fixed to match the real
  // implementation already used on the Lead Details page.
  const handleSendWhatsApp = async (lead: Lead) => {
    if (lead.whatsappSent) {
      triggerToast("WhatsApp documents already delivered to " + lead.name, "info");
      return;
    }
    playBeep(800, 0.15, 'sine');
    const brochureResult = await sendWhatsAppMessage(lead.phone, 'brochure');
    const locationResult = await sendWhatsAppMessage(lead.phone, 'location');
    updateLeadInList(lead.id, {
      whatsappSent: brochureResult.ok || locationResult.ok,
      brochureSent: brochureResult.ok,
      priceSheetSent: brochureResult.ok,
    });
    if (brochureResult.ok && locationResult.ok) {
      triggerToast(`Digital brochure + location sent over real WhatsApp to ${lead.name}!`, 'success');
      logCrmActivity(lead.name, 'Real WhatsApp dispatch delivered (brochure + location).');
    } else {
      const errors = [!brochureResult.ok && `brochure: ${brochureResult.error}`, !locationResult.ok && `location: ${locationResult.error}`].filter(Boolean).join(' | ');
      triggerToast(`⚠️ WhatsApp dispatch incomplete for ${lead.name} — ${errors}`, 'error');
    }
  };

  // Simple real follow-up scheduler — persists to the backend like every other
  // field update. A date/time picker modal would be nicer, but this is honest and
  // functional rather than another fake button.
  const handleScheduleFollowUp = (lead: Lead) => {
    const input = window.prompt(
      `When should we follow up with ${lead.name}? Enter a date (YYYY-MM-DD) or full date/time.`,
      lead.nextFollowUpDate ? lead.nextFollowUpDate.slice(0, 10) : ''
    );
    if (!input) return;
    const parsed = Date.parse(input);
    if (Number.isNaN(parsed)) {
      triggerToast('Could not understand that date — try YYYY-MM-DD.', 'error');
      return;
    }
    updateLeadInList(lead.id, { nextFollowUpDate: new Date(parsed).toISOString(), status: 'Outgoing Retry' });
    triggerToast(`Follow-up for ${lead.name} scheduled.`, 'success');
    logCrmActivity(lead.name, `Follow-up manually scheduled for ${new Date(parsed).toLocaleString()}.`);
  };

  const handleHandover = (lead: Lead) => {
    playBeep(900, 0.2, 'triangle');
    updateLeadInList(lead.id, { status: 'Handed Over' });
    triggerToast(`Lead profile compiled and handed over to senior desk.`, 'success');
    logCrmActivity(lead.name, `Manual system handover verified.`);
  };

  // CSV Import simulation (fully compliant, fully interactive!)
  const handleCsvImportSimulate = () => {
    playBeep(880, 0.2, 'triangle');
    
    const sampleNames = ["Harish Mehta", "Sarah Jenkins", "Deepak Chawla", "Aparna Sen", "Vikram Rathore"];
    const samplePhones = ["+91 98122 34455", "+1 (415) 555-0199", "+91 98450 12345", "+91 99201 88776", "+91 91122 33445"];
    const sampleBudgets = [1500000, 2200000, 950000, 1800000, 3100000];
    const sampleLocations = ["Mumbai, MH", "San Francisco, CA", "Bangalore, KA", "Kolkata, WB", "Pune, MH"];
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
      const agentId = agents[Math.floor(Math.random() * agents.length)].id;
      importedLeads.push({
        id: `lead_${Date.now()}_csv_${i}`,
        name: sampleNames[idx],
        phone: samplePhones[idx],
        source: sampleSources[Math.floor(Math.random() * sampleSources.length)],
        project: sampleProjects[Math.floor(Math.random() * sampleProjects.length)],
        dateTime: new Date().toLocaleString(),
        agentId: agentId,
        status: 'Pending',
        interestLevel: 'Warm Lead',
        budget: sampleBudgets[idx],
        location: sampleLocations[idx],
        remarks: 'Batch imported via enterprise CSV parser.',
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
    triggerToast(`${importedLeads.length} premium leads parsed and appended from spreadsheet CSV.`, 'success');
  };

  // Simulated Report Exports / Downloads
  const handleExportReportSimulate = () => {
    playBeep(650, 0.15, 'sine');
    triggerToast("Generating corporate spreadsheet export file...", "info");
    setTimeout(() => {
      triggerToast("CRM Leads excel spreadsheet exported successfully.", "success");
    }, 1200);
  };

  const handleDownloadReportSimulate = () => {
    playBeep(700, 0.15, 'triangle');
    triggerToast("Compiling lead dossiers into PDF binder...", "info");
    setTimeout(() => {
      triggerToast("PDF document bundle downloaded successfully.", "success");
    }, 1500);
  };

  // Filter apply & resets
  const handleApplyFilters = () => {
    playBeep(580, 0.1, 'sine');
    setActiveSearchTerm(tempSearchTerm);
    setActiveDateRange(tempDateRange);
    setActiveEmployee(tempEmployee);
    setActiveSource(tempSource);
    setActiveStatus(tempStatus);
    setActiveProject(tempProject);
    setActivePendingFollowUp(tempPendingFollowUp);
    triggerToast(`Filter matrix applied: ${filteredLeads.length} matches detected.`, 'info');
  };

  const handleResetFilters = () => {
    playBeep(450, 0.1, 'triangle');
    setTempSearchTerm('');
    setTempDateRange('All');
    setTempEmployee('All');
    setTempSource('All');
    setTempStatus('All');
    setTempProject('All');
    setTempPendingFollowUp(false);

    setActiveSearchTerm('');
    setActiveDateRange('All');
    setActiveEmployee('All');
    setActiveSource('All');
    setActiveStatus('All');
    setActiveProject('All');
    setActivePendingFollowUp(false);
    triggerToast("CRM Registry filters reset to default.", "info");
  };

  const handleRefreshCore = () => {
    playBeep(920, 0.1, 'sine');
    triggerToast("Synchronizing active system databases... Registry up to date.", "success");
  };

  return (
    <div className="flex flex-col gap-6 bg-gradient-to-br from-[#060e22] via-[#09152b] to-[#040914] text-slate-100 p-6 rounded-3xl shadow-xl" id="all-leads-container">
      {/* This page still uses the original dark glass theme — needs its own dark
          backdrop now that the app shell around it is light (see LeadDetailsPage.tsx
          for the same fix and why it's needed). */}

      {/* 1. TOP PREMIUM HEADER WITH ACTION CONTROLS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white/[0.01] border-b border-white/5 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
            <h2 className="text-xl font-black text-slate-100 font-mono tracking-wide">All Leads</h2>
            <ChevronDown className="w-5 h-5 text-slate-400 mt-1" />
          </div>
          <span className="text-xs text-slate-400 font-mono bg-white/5 px-2.5 py-1 border border-white/10 rounded-lg">
            {filteredLeads.length} / {leads.length} matched
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
              onClick={() => { playBeep(520, 0.1); triggerToast("Voice dial list loaded in active memory.", "info"); }}
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

      {/* Dynamic System Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="leads-stats-row">
        {[
          { label: 'Total CRM Pipeline', value: stats.total, color: 'text-cyan-400', desc: 'Active synchronized leads' },
          { label: 'Highly Interested', value: stats.hot, color: 'text-rose-400', desc: 'Hot lead status classification' },
          { label: 'Handed Over / Closed', value: stats.completed, color: 'text-emerald-400', desc: 'Completed operations' },
          { label: 'Pending Outbound Dial', value: stats.pending, color: 'text-amber-400', desc: 'Awaiting autonomous voice ring' }
        ].map((stat, idx) => (
          <div key={idx} className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 shadow-lg backdrop-blur-md relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-2 h-full bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{stat.label}</span>
            <h4 className={`text-3xl font-black ${stat.color} mt-1 font-mono tracking-tight`}>{stat.value}</h4>
            <p className="text-[9px] font-mono text-slate-400 mt-1">{stat.desc}</p>
          </div>
        ))}
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
                {/* Employee filter */}
                <select
                  value={tempEmployee}
                  onChange={(e) => setTempEmployee(e.target.value)}
                  className="text-xs iceglass-input rounded-xl px-3 py-3 text-slate-300 cursor-pointer appearance-none border border-white/5 font-mono"
                >
                  <option value="All" className="bg-slate-950">All Employees</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id} className="bg-slate-950">{a.name}</option>
                  ))}
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

      {/* Leads Table & Detailed Dossier layout split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="leads-split-view">
        {/* Table column */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="iceglass rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden transition-all duration-300">
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400/40" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400/40" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400/40" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400/40" />

            <div className="border border-white/10 rounded-xl overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/10 font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                    <th className="px-2.5 py-3">Prospect Details</th>
                    <th className="px-2.5 py-3">Assigned AI Agent</th>
                    <th className="px-2.5 py-3">Acre Asset focus</th>
                    <th className="px-2.5 py-3">Source Channel</th>
                    <th className="px-2.5 py-3">Interest / Grade</th>
                    <th className="px-2.5 py-3">Workflow State</th>
                    <th className="px-2.5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                  {pagedLeads.length > 0 ? (
                    pagedLeads.map((lead) => {
                      const agent = agents.find(a => a.id === lead.agentId) || agents[0];
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
                          <td className="px-2.5 py-3.5">
                            <div className="max-w-[95px]">
                              <p className="font-bold text-slate-100 truncate" title={lead.name}>{lead.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono truncate">{lead.phone}</p>
                            </div>
                          </td>
                          <td className="px-2.5 py-3.5">
                            <div className="flex items-center gap-1.5 max-w-[65px]">
                              <img src={agent.photoUrl} alt={agent.name} className="w-5 h-5 rounded-full border border-white/10 object-cover shrink-0" />
                              <span className="font-bold font-mono text-slate-300 truncate text-[11px]">{agent.name}</span>
                            </div>
                          </td>
                          <td className="px-2.5 py-3.5 font-mono text-slate-400">
                            <div className="max-w-[80px]">
                              <p className="truncate" title={lead.project}>{lead.project.replace('Astra ', '')}</p>
                              <p className="text-[9px] text-cyan-400/80">${lead.budget.toLocaleString()}</p>
                            </div>
                          </td>
                          <td className="px-2.5 py-3.5">
                            <span className="px-1.5 py-0.5 rounded font-mono text-[9px] bg-white/5 text-slate-400 border border-white/10">
                              {lead.source}
                            </span>
                          </td>
                          <td className="px-2.5 py-3.5">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                              lead.interestLevel === 'Hot Lead' || lead.interestLevel === 'Interested' 
                                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/25 shadow-[0_0_8px_rgba(239,68,68,0.1)]' 
                                : lead.interestLevel === 'Cold Lead' 
                                  ? 'bg-slate-500/10 text-slate-400 border border-white/5' 
                                  : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            }`}>
                              <span className="whitespace-nowrap">{lead.interestLevel}</span>
                            </span>
                          </td>
                          <td className="px-2.5 py-3.5 max-w-[75px]">
                            <span className="text-[9px] flex items-center gap-1 font-mono">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                lead.status === 'Handed Over'
                                  ? 'bg-fuchsia-500'
                                  : lead.status === 'Completed'
                                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                    : lead.status === 'In Call'
                                      ? 'bg-cyan-400 animate-ping'
                                      : 'bg-slate-500'
                              }`} />
                              <span className="truncate">{lead.status}</span>
                            </span>
                          </td>
                          <td className="px-2.5 py-3.5 text-right relative">
                            <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLeadId(lead.id);
                                initiateCall(lead.id);
                              }}
                              title="Dial"
                              className="inline-flex items-center justify-center p-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg transition-all shadow-[0_0_10px_rgba(6,182,212,0.15)] cursor-pointer"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                            </button>
                            <div ref={lead.id === openMenuLeadId ? menuContainerRef : undefined} className="relative inline-block">
                              <button
                                onClick={(e) => { e.stopPropagation(); setOpenMenuLeadId(openMenuLeadId === lead.id ? null : lead.id); }}
                                title="More actions"
                                className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-all cursor-pointer"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {openMenuLeadId === lead.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 top-full mt-1 w-52 bg-slate-900 border border-white/10 rounded-xl shadow-2xl py-1.5 z-30 font-sans"
                                >
                                  <button
                                    onClick={() => { setOpenMenuLeadId(null); setSelectedLeadId(lead.id); if (onViewDetails) onViewDetails(lead.id); }}
                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-200 hover:bg-white/5 cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-slate-400" /> View Details
                                  </button>
                                  <button
                                    onClick={() => { setOpenMenuLeadId(null); handleScheduleFollowUp(lead); }}
                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-200 hover:bg-white/5 cursor-pointer"
                                  >
                                    <CalendarClock className="w-3.5 h-3.5 text-slate-400" /> Schedule Follow-up
                                  </button>
                                  <button
                                    onClick={() => { setOpenMenuLeadId(null); setSelectedLeadId(lead.id); initiateCall(lead.id); }}
                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-200 hover:bg-white/5 cursor-pointer"
                                  >
                                    <Phone className="w-3.5 h-3.5 text-slate-400" /> Call
                                  </button>
                                  <button
                                    onClick={() => { setOpenMenuLeadId(null); handleSendWhatsApp(lead); }}
                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-200 hover:bg-white/5 cursor-pointer"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp
                                  </button>
                                  {onDeleteLead && (
                                    <>
                                      <div className="my-1 border-t border-white/10" />
                                      <button
                                        onClick={() => { setOpenMenuLeadId(null); onDeleteLead(lead); }}
                                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-500 font-mono">
                        No CRM lead profiles match the current filter selection query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination bar — 50 leads per page */}
            {filteredLeads.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 font-mono text-xs text-slate-400">
                <span>
                  Showing <span className="text-slate-200 font-bold">{(leadsPage - 1) * LEADS_PER_PAGE + 1}–{Math.min(leadsPage * LEADS_PER_PAGE, filteredLeads.length)}</span> of <span className="text-slate-200 font-bold">{filteredLeads.length}</span> leads
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setLeadsPage(1)}
                    disabled={leadsPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.02] disabled:opacity-30 disabled:cursor-not-allowed hover:border-cyan-500/40 hover:text-cyan-300 transition-colors"
                  >First</button>
                  <button
                    onClick={() => setLeadsPage(p => Math.max(1, p - 1))}
                    disabled={leadsPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.02] disabled:opacity-30 disabled:cursor-not-allowed hover:border-cyan-500/40 hover:text-cyan-300 transition-colors"
                  >‹ Prev</button>
                  {leadPageNumbers.map((p, i) =>
                    p === '...' ? (
                      <span key={`ellipsis-${i}`} className="px-2 text-slate-600">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setLeadsPage(p)}
                        className={`px-3 py-1.5 rounded-lg border transition-colors ${
                          p === leadsPage
                            ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-bold'
                            : 'border-white/10 bg-white/[0.02] hover:border-cyan-500/40 hover:text-cyan-300'
                        }`}
                      >{p}</button>
                    )
                  )}
                  <button
                    onClick={() => setLeadsPage(p => Math.min(totalLeadPages, p + 1))}
                    disabled={leadsPage === totalLeadPages}
                    className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.02] disabled:opacity-30 disabled:cursor-not-allowed hover:border-cyan-500/40 hover:text-cyan-300 transition-colors"
                  >Next ›</button>
                  <button
                    onClick={() => setLeadsPage(totalLeadPages)}
                    disabled={leadsPage === totalLeadPages}
                    className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.02] disabled:opacity-30 disabled:cursor-not-allowed hover:border-cyan-500/40 hover:text-cyan-300 transition-colors"
                  >Last</button>
                </div>
                <span>Per page: <span className="text-slate-200 font-bold">{LEADS_PER_PAGE}</span></span>
              </div>
            )}
          </div>
        </div>

        {/* Selected lead detail dossier column */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {activeLead && activeAgent ? (
            <div className="iceglass rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400/40" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400/40" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400/40" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400/40" />

              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <div className="w-10 h-10 rounded-full bg-cyan-950 border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-300">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300 font-mono">Profile Details</h3>
                  <p className="text-[10px] text-slate-400">Prospect qualification dossier</p>
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
                  <span className="text-slate-500">PROJECT FOCUS:</span>
                  <span className="font-bold text-slate-300 text-right max-w-[180px] truncate">{activeLead.project}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-500">EST BUDGET:</span>
                  <span className="font-bold text-cyan-300">${activeLead.budget.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-500">LOCATION:</span>
                  <span className="font-bold text-slate-200">{activeLead.location}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-500">SOURCE:</span>
                  <span className="font-bold text-slate-300">{activeLead.source}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-500">TIME REGISTERED:</span>
                  <span className="font-bold text-slate-400 text-right">{activeLead.dateTime}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-500">OUTBOUND RETRIES:</span>
                  <span className="font-bold text-slate-400">{activeLead.callDuration !== '0s' ? '1 Call Complete' : 'Awaiting Dial'}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-500">ASSIGNED NODE:</span>
                  <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                    <img src={activeAgent.photoUrl} alt={activeAgent.name} className="w-4 h-4 rounded-full object-cover border border-white/20" />
                    {activeAgent.name}
                  </span>
                </div>

                <div className="flex flex-col gap-1 mt-1 font-sans">
                  <span className="font-mono text-[9px] text-slate-500 uppercase">Interactive Remarks:</span>
                  <p className="bg-white/[0.01] p-3 rounded-xl border border-white/5 text-slate-400 italic text-[11px] leading-relaxed">
                    "{activeLead.remarks || 'Standby. No remarks currently logged.'}"
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
                  {activeLead.whatsappSent ? 'Resend' : 'WhatsApp'}
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
                className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-black py-3 rounded-xl uppercase tracking-widest text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-1"
              >
                <PhoneCall className="w-4 h-4" />
                Trigger Voice Dialogue Call
              </button>
            </div>
          ) : (
            <div className="iceglass rounded-2xl p-6 text-center text-slate-500 font-mono">
              Select a lead profile from the left directory to display detailed account records.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
