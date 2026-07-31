import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Phone, PhoneCall, PhoneOff, MessageSquare, Plus, Search, User, Sliders, Calendar,
  TrendingUp, Send, CheckCircle, Clock, ArrowUpRight, Lock, Unlock, Settings,
  Activity, MapPin, Mic, MicOff, Volume2, VolumeX, Database, Filter, Globe,
  Building, Check, CheckCheck, RefreshCw, Briefcase, ShieldAlert, Sparkles, FileText, ArrowRight, Award, ChevronRight, Share2, HelpCircle, Zap,
  Users, IndianRupee, Bell, Sun, Bot, AudioWaveform
} from 'lucide-react';
import { Lead, Agent, ActivityLog } from '../types';
import { AivaLogo } from './AivaLogo';
import NeuralVoiceCore from './NeuralVoiceCore';
import AgentVoiceChat from './AgentVoiceChat';

interface CyberDashboardProps {
  leads: Lead[];
  agents: Agent[];
  activityLogs: ActivityLog[];
  selectedLeadId: string;
  setSelectedLeadId: (id: string) => void;
  selectedAgentId: string;
  setSelectedAgentId: (id: string) => void;
  playBeep: (freq: number, duration: number, type?: 'sine' | 'square' | 'triangle') => void;
  triggerToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  updateLeadInList: (id: string, updates: Partial<Lead>) => void;
  initiateCall: (leadId?: string) => void;
  setCurrentTab: (tab: 'admin' | 'caller' | 'agents') => void;
  logCrmActivity: (leadName: string, message: string) => void;
}

export default function CyberDashboard({
  leads,
  agents,
  activityLogs,
  selectedLeadId,
  setSelectedLeadId,
  selectedAgentId,
  setSelectedAgentId,
  playBeep,
  triggerToast,
  updateLeadInList,
  initiateCall,
  setCurrentTab,
  logCrmActivity
}: CyberDashboardProps) {

  const activeLead = useMemo(() => leads.find(l => l.id === selectedLeadId) || leads[0], [leads, selectedLeadId]);
  const activeAgent = useMemo(() => agents.find(a => a.id === activeLead?.agentId) || agents[0], [agents, activeLead]);

  const LEADS_PER_PAGE = 50;
  const [leadsPage, setLeadsPage] = useState(1);
  const totalLeadPages = Math.max(1, Math.ceil(leads.length / LEADS_PER_PAGE));
  useEffect(() => {
    if (leadsPage > totalLeadPages) setLeadsPage(totalLeadPages);
  }, [totalLeadPages, leadsPage]);
  const pagedLeads = useMemo(
    () => leads.slice((leadsPage - 1) * LEADS_PER_PAGE, leadsPage * LEADS_PER_PAGE),
    [leads, leadsPage]
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

  // Sort agents to match requested order exactly: Ananya, Arjun, Kavya, Rohan, Priya
  const orderedAgentIds = ['agent_3', 'agent_2', 'agent_1', 'agent_4', 'agent_5'];
  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      const idxA = orderedAgentIds.indexOf(a.id);
      const idxB = orderedAgentIds.indexOf(b.id);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });
  }, [agents]);

  // Command Center header stats — every number here is derived from the real leads/
  // agents data (no placeholders), matching the rest of the app's "no fake numbers" rule.
  const commandCenterStats = useMemo(() => {
    const conversations = agents.reduce((sum, a) => sum + (a.stats?.todayCalls ?? 0), 0);
    const successfulCalls = agents.reduce((sum, a) => sum + (a.stats?.completedCalls ?? 0), 0);
    const leadsGenerated = leads.length;
    const revenueImpact = leads
      .filter(l => l.interestLevel === 'Hot Lead' || l.interestLevel === 'Interested')
      .reduce((sum, l) => sum + (l.budget || 0), 0);
    const statusCounts = leads.reduce((acc: Record<string, number>, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    }, {});
    return { conversations, successfulCalls, leadsGenerated, revenueImpact, statusCounts };
  }, [agents, leads]);

  // Per-agent accent gradient for the robot avatar chips — cosmetic only, not data.
  const AGENT_GRADIENTS: Record<string, string> = {
    agent_3: 'from-violet-500 to-purple-400',   // Ananya
    agent_2: 'from-blue-500 to-cyan-400',        // Arjun
    agent_1: 'from-teal-400 to-emerald-400',     // Kavya
    agent_4: 'from-orange-400 to-amber-400',     // Rohan
    agent_5: 'from-fuchsia-500 to-pink-400',     // Priya
  };

  // Which agent's real Work Report modal is open, if any.
  const [reportAgentId, setReportAgentId] = useState<string | null>(null);
  // Which agent's live voice chat is open, if any.
  const [talkAgentId, setTalkAgentId] = useState<string | null>(null);
  const talkAgent = useMemo(() => agents.find(a => a.id === talkAgentId) || null, [agents, talkAgentId]);
  const reportAgent = useMemo(() => agents.find(a => a.id === reportAgentId) || null, [agents, reportAgentId]);
  const reportAgentLeads = useMemo(() => leads.filter(l => l.agentId === reportAgentId), [leads, reportAgentId]);
  const reportAgentActivity = useMemo(
    () => (activityLogs || []).filter(log => log.agent === reportAgent?.name).slice(0, 8),
    [activityLogs, reportAgent]
  );
  const reportAgentInterestBreakdown = useMemo(() => {
    const acc: Record<string, number> = {};
    reportAgentLeads.forEach(l => { acc[l.interestLevel] = (acc[l.interestLevel] || 0) + 1; });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]);
  }, [reportAgentLeads]);

  const [globeRotation, setGlobeRotation] = useState(0);
  const globeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeGlobeRef = useRef<number | null>(null);

  // AIVA Supervisor Dialogue State inside Cyber Dashboard
  const [aivaText, setAivaText] = useState<string>("Greetings, Commander. I am AIVA, your sovereign AI operations director. I oversee our autonomous sales force. Ask me anything about our pipeline or tell me to perform an analysis.");
  const [aivaTranscript, setAivaTranscript] = useState<Array<{ sender: 'user' | 'agent' | 'aiva'; text: string }>>([
    { sender: 'user', text: "Assess current pipeline performance" },
    { sender: 'agent', text: "AIVA operational. Currently supervising 5 active agent instances. Hot leads stand at 38%." }
  ]);
  const [isAivaListening, setIsAivaListening] = useState(false);
  const [isAivaSpeaking, setIsAivaSpeaking] = useState(false);
  const [aivaInput, setAivaInput] = useState("");
  const [aivaVoiceEnabled, setAivaVoiceEnabled] = useState(true);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveformAnimRef = useRef<number | null>(null);
  const aivaRecognitionRef = useRef<any>(null);

  // Animated path trigger state
  const [airplaneFlying, setAirplaneFlying] = useState(false);

  // Calculated Stats
  const dashboardStats = useMemo(() => {
    const total = leads.length;
    const hotLeads = leads.filter(l => l.interestLevel === 'Hot Lead' || l.interestLevel === 'Interested').length;
    const completed = leads.filter(l => l.status === 'Completed' || l.status === 'Handed Over').length;
    const visits = leads.filter(l => l.siteVisitScheduled !== '').length;
    
    // Percentages
    const qualifyRate = Math.round((completed / total) * 100) || 59;
    const engagementRate = Math.round((hotLeads / total) * 100) || 38;
    const visitRate = Math.round((visits / total) * 100) || 22;

    return { total, hotLeads, completed, visits, qualifyRate, engagementRate, visitRate };
  }, [leads]);

  // Handle WhatsApp trigger action with slide animation
  const handleSendWhatsAppBrochure = () => {
    if (!activeLead) return;
    if (activeLead.whatsappSent) {
      triggerToast("WhatsApp brochure has already been dispatched to this prospect.", "info");
      return;
    }
    
    playBeep(800, 0.15, 'sine');
    setAirplaneFlying(true);
    
    setTimeout(() => {
      updateLeadInList(activeLead.id, { whatsappSent: true, brochureSent: true, priceSheetSent: true });
      setAirplaneFlying(false);
      triggerToast(`Collateral brochure pushed to ${activeLead.name} via WhatsApp.`, 'success');
      logCrmActivity(activeLead.name, `Automated digital brochures dispatched via WhatsApp.`);
    }, 1800);
  };

  // Holographic 3D Earth Globe Canvas Render loop
  useEffect(() => {
    const canvas = globeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rotation = 0;

    const render = () => {
      rotation += 0.006;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = Math.min(canvas.width, canvas.height) * 0.38;

      // Outer holographic halo glow
      const outerGlow = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.25);
      outerGlow.addColorStop(0, 'rgba(6, 182, 212, 0)');
      outerGlow.addColorStop(0.5, 'rgba(6, 182, 212, 0.08)');
      outerGlow.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Draw planet sphere border
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Latitudes (Horizontal Rings)
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.lineWidth = 1;
      for (let lat = -4; lat <= 4; lat++) {
        const yOffset = (lat / 5) * radius;
        const rLat = Math.sqrt(radius * radius - yOffset * yOffset);
        ctx.beginPath();
        ctx.ellipse(cx, cy + yOffset, rLat, rLat * 0.18, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Longitudes (Rotating Vertical Rings)
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.28)';
      for (let lon = 0; lon < 6; lon++) {
        const angle = rotation + (lon * Math.PI) / 3;
        const xOffset = Math.sin(angle) * radius;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.abs(xOffset), radius, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw custom visual continents wireframe lines
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx - radius * 0.3, cy - radius * 0.2, radius * 0.25, 0.5, Math.PI * 1.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + radius * 0.4, cy + radius * 0.3, radius * 0.3, Math.PI * 0.8, Math.PI * 1.9);
      ctx.stroke();

      // Pulsing location pin beacon on the globe
      const pulse = 1 + Math.sin(Date.now() * 0.006) * 0.15;
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(cx, cy, 5 * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 14 * pulse, 0, Math.PI * 2);
      ctx.stroke();

      // Draw custom target coordinates lines
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(canvas.width, cy);
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Overlay text label for the pin
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 4;
      ctx.fillText("OPERATIONAL HOTSPOTS", cx, cy - 24);
      ctx.shadowBlur = 0; // reset

      activeGlobeRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (activeGlobeRef.current) cancelAnimationFrame(activeGlobeRef.current);
    };
  }, []);

  // AIVA Voice Synthesizer / AI Assistant Setup
  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onstart = () => {
      setIsAivaListening(true);
      playBeep(650, 0.15, 'sine');
    };
    rec.onend = () => {
      setIsAivaListening(false);
    };
    rec.onerror = (e: any) => {
      console.error('Aiva Assistant Error', e);
      setIsAivaListening(false);
    };
    rec.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      handleAivaDialogueQuery(text);
    };

    aivaRecognitionRef.current = rec;
  }, [leads, agents, selectedLeadId]);

  // Speak Response function
  const speakAiva = (text: string) => {
    if (!window.speechSynthesis || !aivaVoiceEnabled) {
      setAivaText(text);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    const voices = window.speechSynthesis.getVoices();
    const premiumVoice = voices.find(v => v.lang.startsWith('en-GB') || v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Elegant'));
    if (premiumVoice) {
      utterance.voice = premiumVoice;
    }
    
    utterance.rate = 1.05;
    utterance.pitch = 1.1;

    utterance.onstart = () => {
      setIsAivaSpeaking(true);
      setAivaText(text);
    };
    utterance.onend = () => {
      setIsAivaSpeaking(false);
    };
    utterance.onerror = () => {
      setIsAivaSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Process manual or vocal inputs to AIVA
  const handleAivaDialogueQuery = (queryText: string) => {
    if (!queryText.trim()) return;
    setAivaInput("");

    const text = queryText.toLowerCase();
    let response = "";

    if (text.includes('performance') || text.includes('how are') || text.includes('how is') || text.includes('status') || text.includes('going on') || text.includes('work')) {
      response = `Greetings Commander. AIVA is online and compiling telemetry. Our sales pipeline is running at peak capacity. We have ${leads.length} leads in the system, and ${dashboardStats.hotLeads} marked as highly active hot prospects. Kavya and Arjun have logged multiple customer site schedules. Work progress is exemplary.`;
    } 
    else if (text.includes('lead') || text.includes('prospect') || text.includes('current')) {
      response = activeLead
        ? `Currently inspecting lead dossier of ${activeLead.name}. They are seeking assets in ${activeLead.project} with a designated budget of ${activeLead.budget.toLocaleString()} dollars. Their channel source is ${activeLead.source}.`
        : `There are no leads in the pipeline yet, Commander. Add a lead to begin tracking.`;
    }
    else if (text.includes('agent') || text.includes('team')) {
      response = `Our squad of 5 virtual AI agents is fully operational. Kavya is leading conversions this week with a rate of 42 percent. No manual human agent oversight has been required.`;
    }
    else if (text.includes('whatsapp') || text.includes('brochure')) {
      response = `WhatsApp automations are locked. If you click the WhatsApp envelope on the right column of your screen, I will trigger a simulated flying paper-airplane collateral dispatch directly to the prospect.`;
    }
    else {
      response = `Understood, Commander. AIVA supreme AI core has received your request: "${queryText}". Our outbound voice nodes are ready, and all pipeline telemetry is synchronized in the glass HUD. Ask me more about our conversion rate or prospect parameters.`;
    }

    speakAiva(response);
    setAivaTranscript(prev => [
      ...prev,
      { sender: 'user', text: queryText },
      { sender: 'agent', text: response }
    ].slice(-10)); // Keep last 10 entries for memory
    triggerToast(`AIVA processed voice: "${queryText.substring(0, 24)}..."`, 'success');
  };

  const toggleAivaListening = () => {
    if (isAivaListening) {
      if (aivaRecognitionRef.current) aivaRecognitionRef.current.stop();
      setIsAivaListening(false);
    } else {
      if (!aivaRecognitionRef.current) {
        triggerToast("Vocal recognition is blocked on your frame. Please type your console command.", "error");
        return;
      }
      try {
        aivaRecognitionRef.current.start();
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Continuous bouncing wave for AIVA waveform
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2.5;

      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, 'rgba(6, 182, 212, 0.02)');
      gradient.addColorStop(0.5, isAivaSpeaking ? 'rgba(6, 182, 212, 0.95)' : isAivaListening ? 'rgba(99, 102, 241, 0.95)' : 'rgba(6, 182, 212, 0.35)');
      gradient.addColorStop(1, 'rgba(6, 182, 212, 0.02)');
      ctx.strokeStyle = gradient;

      ctx.beginPath();
      const points = 60;
      const sliceWidth = canvas.width / points;
      let x = 0;

      for (let i = 0; i < points; i++) {
        const speed = Date.now() * 0.01;
        const freq = i * 0.16;
        const wave1 = Math.sin(freq - speed) * (isAivaSpeaking ? 16 : isAivaListening ? 12 : 2.5);
        const wave2 = Math.cos(freq * 0.4 + speed * 1.3) * (isAivaSpeaking ? 8 : isAivaListening ? 6 : 1.2);
        const y = wave1 + wave2 + canvas.height / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.stroke();

      waveformAnimRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (waveformAnimRef.current) cancelAnimationFrame(waveformAnimRef.current);
    };
  }, [isAivaSpeaking, isAivaListening]);

  return (
    <div className="flex flex-col gap-6 w-full select-none">

      {/* AIVA AI VOICE AGENT NEURAL VOICE CORE — now at the top per request; still the manager/admin of all 5 agents */}
      <NeuralVoiceCore
        isSpeaking={isAivaSpeaking}
        isListening={isAivaListening}
        transcript={aivaTranscript}
        playBeep={playBeep}
        agents={agents}
        leads={leads}
        activityLogs={activityLogs}
      />

      {/* ============================================================ */}
      {/*  COMMAND CENTER — light-theme overview header, real data only */}
      {/* ============================================================ */}
      <div className="glass-panel rounded-3xl p-6 flex flex-col gap-6 relative overflow-hidden">

        {/* Greeting row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Good Morning, <span className="text-indigo-600">Manager</span> 👋</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {leads.length > 0 ? `Your ${agents.length} AI voice agents are tracking ${leads.length} real leads today.` : 'Waiting for lead data to sync…'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden md:flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3" />
              <input
                readOnly
                placeholder="Search anything..."
                className="pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600 placeholder-slate-400 w-56 cursor-default"
              />
            </div>
            <button className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer">
              <Sun className="w-4 h-4" />
            </button>
            <button className="relative p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer">
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {commandCenterStats.statusCounts['Outgoing Retry'] > 9 ? '9+' : (commandCenterStats.statusCounts['Outgoing Retry'] || 0)}
              </span>
            </button>
          </div>
        </div>

        {/* Stat cards row — real numbers only */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Conversations', value: commandCenterStats.conversations.toLocaleString(), icon: MessageSquare, color: 'text-indigo-600 bg-indigo-50' },
            { label: 'Successful Calls', value: commandCenterStats.successfulCalls.toLocaleString(), icon: PhoneCall, color: 'text-cyan-600 bg-cyan-50' },
            { label: 'Leads Generated', value: commandCenterStats.leadsGenerated.toLocaleString(), icon: Users, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Pipeline Value', value: `₹${commandCenterStats.revenueImpact.toLocaleString()}`, icon: IndianRupee, color: 'text-amber-600 bg-amber-50' },
            { label: 'Active Agents', value: `${agents.length}/${agents.length}`, icon: Activity, color: 'text-fuchsia-600 bg-fuchsia-50' },
          ].map((stat) => (
            <div key={stat.label} className="glass-card rounded-2xl p-4 flex flex-col gap-2">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-4.5 h-4.5" />
              </div>
              <span className="text-xl font-bold text-slate-900">{stat.value}</span>
              <span className="text-[11px] font-medium text-slate-500">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* AI Agents Squad — real per-agent stats, robot-avatar cards + a real Work Report per agent */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-9 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-800">AI Agents Squad</h2>
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {agents.length} Active Agents
                </span>
              </div>
              <button
                onClick={() => setCurrentTab('agents')}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
              >
                Agent Control Center <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {sortedAgents.map((agent) => {
                const isSelected = selectedAgentId === agent.id;
                const isLive = leads.some(l => l.agentId === agent.id && l.status === 'In Call');
                const gradient = AGENT_GRADIENTS[agent.id] || 'from-indigo-500 to-cyan-400';
                return (
                  <div
                    key={agent.id}
                    className={`rounded-2xl border p-4 flex flex-col gap-3 transition-all ${
                      isSelected ? 'border-indigo-300 bg-gradient-to-br from-indigo-50 to-cyan-50 shadow-md' : 'border-white/60 glass-card hover:border-indigo-200'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        playBeep(560, 0.08, 'sine');
                        const agentLeads = leads.filter(l => l.agentId === agent.id);
                        if (agentLeads.length > 0) setSelectedLeadId(agentLeads[0].id);
                      }}
                      className="flex items-center gap-2.5 text-left cursor-pointer"
                    >
                      <div className={`relative w-11 h-11 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-md`}>
                        <Bot className="w-6 h-6 text-white" />
                        {isLive && <span className="absolute -inset-0.5 rounded-2xl ring-2 ring-emerald-400 pulse-ring" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{agent.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{agent.role.replace('Astra ', '')}</p>
                      </div>
                    </button>

                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
                      </span>
                      <div className="flex items-end gap-0.5 h-3.5">
                        {[0, 1, 2, 3, 4].map(b => (
                          <span
                            key={b}
                            className={`w-0.5 rounded-full voice-bar bg-gradient-to-t ${gradient} ${isLive ? 'opacity-100' : 'opacity-25'}`}
                            style={{ height: '100%', animationDelay: `${b * 0.12}s`, animationPlayState: isLive ? 'running' : 'paused' }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center border-t border-slate-200 pt-2.5">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{agent.stats.todayCalls}</p>
                        <p className="text-[9px] text-slate-500">Calls</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{agent.stats.conversionRate}%</p>
                        <p className="text-[9px] text-slate-500">Success</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{agent.stats.pendingCalls}</p>
                        <p className="text-[9px] text-slate-500">Pending</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => { setReportAgentId(agent.id); playBeep(600, 0.08, 'sine'); }}
                        className={`text-[11px] font-bold rounded-xl py-2 flex items-center justify-center gap-1.5 cursor-pointer transition-colors bg-gradient-to-r ${gradient} text-white shadow-sm hover:opacity-90`}
                      >
                        <FileText className="w-3.5 h-3.5" /> Monitor
                      </button>
                      <button
                        onClick={() => { setTalkAgentId(agent.id); playBeep(650, 0.08, 'sine'); }}
                        className="text-[11px] font-bold rounded-xl py-2 flex items-center justify-center gap-1.5 cursor-pointer transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200"
                      >
                        <Mic className="w-3.5 h-3.5" /> Talk
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AiVA hologram + real Brain Status panel */}
          <div className="xl:col-span-3 flex flex-col gap-3">
            <div className="relative rounded-2xl glass-card p-5 flex-1 flex flex-col items-center justify-center gap-3 overflow-hidden min-h-[160px]">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-200/30 via-transparent to-cyan-200/30 blob-float pointer-events-none" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 flex items-center justify-center shadow-xl shadow-indigo-500/30 pulse-ring">
                <AudioWaveform className="w-7 h-7 text-white" />
              </div>
              <span className="relative text-sm font-black text-gradient-aiva">AiVA</span>
            </div>
            <div className="glass-card rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">AI Brain Status</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[10px] text-slate-500">Neural sweep active — polling calls every 5 min</p>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                <span>Leads tracked</span>
                <span className="font-bold text-slate-800">{leads.length}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>Calls today</span>
                <span className="font-bold text-slate-800">{commandCenterStats.conversations}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Per-agent real Work Report modal */}
        {reportAgent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm" onClick={() => setReportAgentId(null)}>
            <div className="glass-panel rounded-3xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${AGENT_GRADIENTS[reportAgent.id] || 'from-indigo-500 to-cyan-400'} flex items-center justify-center shadow-md`}>
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{reportAgent.name} — Work Report</h3>
                    <p className="text-[11px] text-slate-500">Real data, live from the pipeline</p>
                  </div>
                </div>
                <button onClick={() => setReportAgentId(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer text-xl leading-none">×</button>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { label: 'Assigned', value: reportAgent.stats.assignedLeads },
                  { label: 'Calls Today', value: reportAgent.stats.todayCalls },
                  { label: 'Completed', value: reportAgent.stats.completedCalls },
                  { label: 'Pending', value: reportAgent.stats.pendingCalls },
                ].map(s => (
                  <div key={s.label} className="glass-card rounded-xl p-2.5 text-center">
                    <p className="text-base font-bold text-slate-900">{s.value}</p>
                    <p className="text-[9px] text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="mb-4">
                <p className="text-xs font-bold text-slate-700 mb-2">Interest level breakdown</p>
                <div className="flex flex-col gap-1.5">
                  {reportAgentInterestBreakdown.length === 0 && <p className="text-xs text-slate-400">No leads assigned yet.</p>}
                  {reportAgentInterestBreakdown.map(([level, count]) => (
                    <div key={level} className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-600 w-28 shrink-0">{level}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full rounded-full bg-gradient-to-r ${AGENT_GRADIENTS[reportAgent.id] || 'from-indigo-500 to-cyan-400'}`} style={{ width: `${(count / reportAgentLeads.length) * 100}%` }} />
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 w-6 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-700 mb-2">Recent activity</p>
                <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto">
                  {reportAgentActivity.length === 0 && <p className="text-xs text-slate-400">No recent activity logged for this agent.</p>}
                  {reportAgentActivity.map((log, idx) => (
                    <div key={log.id || idx} className="text-xs text-slate-600 border-l-2 border-indigo-200 pl-2.5">
                      <span className="font-semibold text-slate-800">{log.lead}</span> — {log.message}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live one-on-one voice chat with a specific agent */}
        {talkAgent && (
          <AgentVoiceChat
            agent={talkAgent}
            leads={leads}
            playBeep={playBeep}
            onClose={() => setTalkAgentId(null)}
          />
        )}

        {/* Live Operations + Real lead-status funnel — both from real data */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Live Operations</h3>
              <span className="text-[10px] text-indigo-600 font-semibold">Real activity</span>
            </div>
            <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1">
              {activityLogs && activityLogs.length > 0 ? (
                activityLogs.slice(0, 6).map((log, idx) => (
                  <div key={log.id || idx} className="flex items-start gap-2.5 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-slate-700 truncate"><span className="font-semibold text-slate-900">{log.agent}</span> — {log.lead}</p>
                      <p className="text-slate-400 text-[10px] truncate">{log.message}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">No call activity synced yet.</p>
              )}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
            <h3 className="text-sm font-bold text-slate-800">Lead Pipeline Status</h3>
            <div className="flex flex-col gap-2.5">
              {['Pending', 'Outgoing Retry', 'In Call', 'Contacted', 'Completed', 'Handed Over'].map(status => {
                const count = commandCenterStats.statusCounts[status] || 0;
                const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
                if (count === 0) return null;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-600 w-28 shrink-0">{status}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800 w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  ANALYTICS ROW — light glass charts, all real data           */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Agent Call Volume — real todayCalls per agent */}
        <div className="glass-panel rounded-3xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Agent Call Volume</h3>
            <span className="text-[11px] text-slate-400">Today</span>
          </div>
          <div className="flex flex-col gap-3 pt-1">
            {(() => {
              const maxCalls = Math.max(1, ...sortedAgents.map(a => a.stats.todayCalls));
              return sortedAgents.map(a => {
                const gradient = AGENT_GRADIENTS[a.id] || 'from-indigo-500 to-cyan-400';
                const pct = Math.round((a.stats.todayCalls / maxCalls) * 100);
                return (
                  <div key={a.id} className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold text-slate-600 w-14 shrink-0">{a.name}</span>
                    <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-800 w-8 text-right">{a.stats.todayCalls}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Lead Interest Distribution — real donut */}
        <div className="glass-panel rounded-3xl p-5 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-slate-800">Lead Interest Distribution</h3>
          {(() => {
            const buckets: Record<string, number> = {};
            leads.forEach(l => { buckets[l.interestLevel] = (buckets[l.interestLevel] || 0) + 1; });
            const entries = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
            const total = leads.length || 1;
            const palette = ['#6366f1', '#06b6d4', '#a855f7', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#64748b'];
            let cumulative = 0;
            const R = 52, C = 2 * Math.PI * R;
            return (
              <div className="flex items-center gap-5">
                <svg viewBox="0 0 140 140" className="w-32 h-32 shrink-0 -rotate-90">
                  {entries.map(([level, count], i) => {
                    const frac = count / total;
                    const dash = frac * C;
                    const el = (
                      <circle key={level} cx="70" cy="70" r={R} fill="none" stroke={palette[i % palette.length]}
                        strokeWidth="16" strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-cumulative} />
                    );
                    cumulative += dash;
                    return el;
                  })}
                  <circle cx="70" cy="70" r="36" fill="white" />
                </svg>
                <div className="flex flex-col gap-1.5 min-w-0">
                  {entries.slice(0, 6).map(([level, count], i) => (
                    <div key={level} className="flex items-center gap-2 text-[11px]">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: palette[i % palette.length] }} />
                      <span className="text-slate-600 truncate">{level}</span>
                      <span className="text-slate-800 font-bold ml-auto">{Math.round((count / total) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* AI Performance Matrix — real per-agent success radar */}
        <div className="glass-panel rounded-3xl p-5 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-slate-800">AI Performance Matrix</h3>
          {(() => {
            const cx = 90, cy = 85, maxR = 62;
            const pts = sortedAgents.map((a, i) => {
              const angle = (i / sortedAgents.length) * 2 * Math.PI - Math.PI / 2;
              const val = Math.min(1, (a.stats.conversionRate || 0) / 100 + 0.12); // small floor so 0% is still visible
              return {
                name: a.name,
                x: cx + Math.cos(angle) * maxR * val,
                y: cy + Math.sin(angle) * maxR * val,
                lx: cx + Math.cos(angle) * (maxR + 14),
                ly: cy + Math.sin(angle) * (maxR + 14),
              };
            });
            const poly = pts.map(p => `${p.x},${p.y}`).join(' ');
            const rings = [0.33, 0.66, 1];
            return (
              <div className="flex justify-center">
                <svg viewBox="0 0 180 170" className="w-full max-w-[220px]">
                  {rings.map((r, i) => (
                    <polygon key={i}
                      points={sortedAgents.map((_, j) => {
                        const angle = (j / sortedAgents.length) * 2 * Math.PI - Math.PI / 2;
                        return `${cx + Math.cos(angle) * maxR * r},${cy + Math.sin(angle) * maxR * r}`;
                      }).join(' ')}
                      fill="none" stroke="#e2e8f0" strokeWidth="1" />
                  ))}
                  {pts.map((p, i) => (
                    <line key={i} x1={cx} y1={cy} x2={p.lx - (p.lx - cx) * 0.22} y2={p.ly - (p.ly - cy) * 0.22} stroke="#e2e8f0" strokeWidth="1" />
                  ))}
                  <polygon points={poly} fill="rgba(99,102,241,0.18)" stroke="#6366f1" strokeWidth="2" />
                  {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#6366f1" />)}
                  {pts.map((p, i) => (
                    <text key={i} x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle" className="fill-slate-500" style={{ fontSize: '7px', fontWeight: 600 }}>{p.name}</text>
                  ))}
                </svg>
              </div>
            );
          })()}
          <p className="text-[10px] text-slate-400 text-center -mt-2">Success rate by agent</p>
        </div>
      </div>

    </div>
  );
}
