import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  PhoneCall, User, ShieldAlert, Cpu, Search, MessageSquare,
  CheckCircle, Clock, MapPin, Send, HelpCircle, Sparkles,
  ChevronLeft, Calendar, FileText, Check, Phone, DollarSign,
  Briefcase, CheckSquare, RefreshCw, Layers, TrendingUp, Bell, ChevronDown, Award, Globe, Info,
  Flag, Star, Eye, EyeOff, Wand2, Bot, RotateCcw, RotateCw, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Link2, Type as TypeIcon,
  Trash2, ArrowRightLeft, History as HistoryIcon, MessageCircle, CalendarCheck,
  CalendarClock, Loader2, UserCheck, ClipboardList, Home as HomeIcon, Mic
} from 'lucide-react';
import { Lead, Agent } from '../types';
import { callLeadViaOmnidim, getRecordingProxyUrl } from '../utils/backendApi';

interface LeadDetailsPageProps {
  leadId: string;
  leads: Lead[];
  agents: Agent[];
  onBack: () => void;
  updateLeadInList: (id: string, updates: Partial<Lead>) => void;
  triggerToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  playBeep: (freq: number, duration: number, type?: 'sine' | 'square' | 'triangle') => void;
  initiateCall: (leadId: string) => void;
}

export default function LeadDetailsPage({
  leadId,
  leads,
  agents,
  onBack,
  updateLeadInList,
  triggerToast,
  playBeep,
  initiateCall
}: LeadDetailsPageProps) {
  // Find lead and agent
  const lead = useMemo(() => {
    return leads.find(l => l.id === leadId) || leads[0];
  }, [leads, leadId]);

  const agent = useMemo(() => {
    if (!lead) return agents[0];
    return agents.find(a => a.id === lead.agentId) || agents[0];
  }, [agents, lead]);

  // Tab navigation inside CRM Reve Details
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'contact' | 'workflow' | 'contracts' | 'help'>('overview');

  // Interactive local states synced with lead properties
  const [editName, setEditName] = useState(lead?.name || '');
  const [editProject, setEditProject] = useState(lead?.project || '');
  const [editBudget, setEditBudget] = useState(lead?.budget || 1200000);
  const [editLocation, setEditLocation] = useState(lead?.location || 'Manhattan, NY');
  const [editRemarks, setEditRemarks] = useState(
    lead?.remarks || "Looking for a luxury loft with skyline views. I'm ncur smple to bufde"
  );
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<number>(15);
  const [contactedStatus, setContactedStatus] = useState<boolean>(true);
  const [workflowStatus, setWorkflowStatus] = useState<string>('Interested');
  const [selectedAction, setSelectedAction] = useState<string>('Call Follow-up');

  // Sync edits if lead changed
  React.useEffect(() => {
    if (lead) {
      setEditName(lead.name);
      setEditProject(lead.project);
      setEditBudget(lead.budget || 1200000);
      setEditLocation(lead.location || 'Manhattan, NY');
      setEditRemarks(lead.remarks || "Looking for a luxury loft with skyline views. I'm ncur smple to bufde");
    }
  }, [lead]);

  if (!lead) {
    return (
      <div className="iceglass rounded-2xl p-8 text-center text-slate-400 font-mono">
        <p>No active lead profile loaded. System standby.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-cyan-500 text-slate-950 font-bold rounded-xl">
          Return to Registry
        </button>
      </div>
    );
  }

  // Handle saving modifications
  const handleSaveField = (fieldName: string, value: any) => {
    updateLeadInList(lead.id, { [fieldName]: value });
    playBeep(640, 0.08, 'sine');
    triggerToast(`Auto-synced: Field [${fieldName.toUpperCase()}] committed to CRM cloud.`, 'success');
  };

  const handleToggleBoolean = (fieldName: 'whatsappSent' | 'brochureSent' | 'priceSheetSent') => {
    const nextVal = !lead[fieldName];
    updateLeadInList(lead.id, { [fieldName]: nextVal });
    playBeep(nextVal ? 780 : 420, 0.08, 'triangle');
    triggerToast(`${fieldName.replace('Sent', '').toUpperCase()} deliverable state: ${nextVal ? 'SENT' : 'REVOKED'}`, 'info');
  };

  // Circular progress gauges simulated metrics
  const gauges = [
    { label: 'ENGAGEMENT SCORE', value: '59%', sub: 'High retention priority', color: 'text-cyan-400', progress: 59 },
    { label: 'BUDGET FEASIBILITY', value: '38%', sub: 'Core profile match', color: 'text-emerald-400', progress: 38 },
    { label: 'RESPONSE COEFFICIENT', value: '37%', sub: 'Outbound trigger rate', color: 'text-amber-400', progress: 37 }
  ];

  // ============================================================
  //   FULL CRM LEAD PROFILE PANEL (score, stage, contact history,
  //   requirement, AI Assist, rich note editor, activity feed tabs)
  // ============================================================
  const [feedTab, setFeedTab] = useState<'Activity' | 'Starred' | 'Notes' | 'Site visit' | 'Feed' | 'Followups' | 'Whatsapp' | 'Recordings' | 'History'>('Activity');
  const [expandedRecordingId, setExpandedRecordingId] = useState<string | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [stage, setStage] = useState(lead.status);
  useEffect(() => { setStage(lead.status); }, [lead.id, lead.status]);

  // Lead score derived from interest level (0-100 ring)
  const score = useMemo(() => {
    const map: Record<string, number> = {
      'Hot Lead': 88, Interested: 65, 'Warm Lead': 45, 'Call Later': 32,
      'Cold Lead': 18, 'Not Interested': 8, 'Wrong Number': 0, 'Not Reachable': 5
    };
    return map[lead.interestLevel] ?? 32;
  }, [lead.interestLevel]);
  const scoreColor = score >= 70 ? '#22d3ee' : score >= 40 ? '#f59e0b' : '#f43f5e';

  // Lead age computed from dateTime (tolerant of any locale string format)
  const leadAge = useMemo(() => {
    const t = Date.parse(lead.dateTime);
    if (Number.isNaN(t)) return '—';
    const diffMs = Date.now() - t;
    if (diffMs < 0) return '—';
    const hrs = Math.floor(diffMs / 3.6e6);
    if (hrs < 1) return `${Math.floor(diffMs / 60000)}m`;
    if (hrs < 24) return `${hrs}h ${Math.floor((diffMs % 3.6e6) / 60000)}m`;
    return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
  }, [lead.dateTime]);

  // Lead's live local time, derived from their location (best-effort timezone match)
  const [tick, setTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 30000); return () => clearInterval(iv); }, []);
  const leadTimeZone = useMemo(() => {
    const loc = (lead.location || '').toLowerCase();
    if (/india|mumbai|bangalore|delhi|bengaluru/.test(loc)) return 'Asia/Kolkata';
    if (/chicago|illinois|\bil\b/.test(loc)) return 'America/Chicago';
    if (/manhattan|new york|\bny\b/.test(loc)) return 'America/New_York';
    return undefined;
  }, [lead.location]);
  const leadLocalTime = useMemo(() => {
    try {
      const now = new Date();
      const time = new Intl.DateTimeFormat('en-US', { timeZone: leadTimeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(now);
      const date = new Intl.DateTimeFormat('en-US', { timeZone: leadTimeZone, day: 'numeric', month: 'short' }).format(now);
      return `${time.toLowerCase()} · ${date}`;
    } catch { return '—'; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadTimeZone, tick]);

  // Lead's country derived from phone dial code
  const leadCountry = useMemo(() => {
    const p = (lead.phone || '').replace(/\s|-/g, '');
    if (p.startsWith('+91')) return 'India';
    if (p.startsWith('+1')) return 'USA';
    if (p.startsWith('+44')) return 'UK';
    return lead.location?.split(',').pop()?.trim() || '—';
  }, [lead.phone, lead.location]);

  const stageColorMap: Record<string, string> = {
    Pending: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    'Call Scheduled': 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    'In Call': 'text-cyan-300 bg-cyan-500/15 border-cyan-400/40',
    Contacted: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
    'Outgoing Retry': 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    Completed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    'Handed Over': 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/30',
  };

  // --- AI Assist: reuses the same Gemini key the user saves in the Voice Agent settings ---
  const [aiLoading, setAiLoading] = useState<'summary' | 'draft' | 'action' | null>(null);
  const [aiOutput, setAiOutput] = useState<string>('');
  const [aiError, setAiError] = useState<string>('');
  const [draftAs, setDraftAs] = useState<'WhatsApp' | 'Email' | 'SMS' | 'Call Script'>('WhatsApp');
  const [draftTone, setDraftTone] = useState<'Warm' | 'Formal' | 'Urgent' | 'Friendly'>('Warm');

  const leadBrief = () =>
    `Lead: ${lead.name}, phone ${lead.phone}, source ${lead.source}, project ${lead.project}, ` +
    `location ${lead.location}, budget $${lead.budget?.toLocaleString?.() ?? lead.budget}, ` +
    `stage ${stage}, interest level ${lead.interestLevel}, timeline ${lead.timeline}, ` +
    `remarks: "${lead.remarks || 'none'}", assigned agent ${agent.name}, ` +
    `next follow-up ${lead.nextFollowUpDate}, site visit ${lead.siteVisitScheduled || 'not scheduled'}.`;

  const callGemini = async (prompt: string, systemInstruction: string): Promise<string> => {
    let key = '';
    try { key = localStorage.getItem('aiva_gemini_key') || ''; } catch { /* no-op */ }
    if (!key) {
      throw new Error('NO_KEY');
    }
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: key });
    const res: any = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
      config: { systemInstruction },
    });
    const text = (res?.text || '').trim();
    if (!text) throw new Error('EMPTY_RESPONSE');
    return text;
  };

  const runAiAssist = async (action: 'summary' | 'draft' | 'action') => {
    setAiLoading(action);
    setAiError('');
    setAiOutput('');
    try {
      let result = '';
      if (action === 'summary') {
        result = await callGemini(
          leadBrief(),
          'You are a real-estate CRM assistant. Summarize this lead in 2-3 tight sentences for a busy sales manager: their intent, budget fit, and what to do next. Plain text only, no markdown.'
        );
      } else if (action === 'draft') {
        result = await callGemini(
          leadBrief(),
          `You are a real-estate sales rep. Write a short ${draftTone.toLowerCase()}, ${draftAs.toLowerCase()} follow-up message to this lead based on their profile. Keep it natural and under 80 words. Plain text only, no markdown, no subject line.`
        );
        // Draft goes straight into the note editor, ready to send/save
        if (noteEditorRef.current) {
          noteEditorRef.current.innerText = result;
          handleNoteInput();
        }
      } else {
        result = await callGemini(
          leadBrief(),
          'You are a real-estate CRM assistant. In one short sentence, recommend the single best next action the sales agent should take with this lead right now. Plain text only.'
        );
      }
      setAiOutput(result);
      playBeep(720, 0.08, 'sine');
    } catch (e: any) {
      if (e?.message === 'NO_KEY') {
        setAiError('No Gemini API key set. Add one from the AI Voice Agent panel (⚙ settings) on the Admin Dashboard to enable real AI Assist.');
      } else {
        setAiError(`AI request failed: ${e?.message || 'unknown error'}`);
      }
    } finally {
      setAiLoading(null);
    }
  };

  // --- Rich note editor (contentEditable, formatting via execCommand) ---
  const noteEditorRef = useRef<HTMLDivElement>(null);
  const [noteCharCount, setNoteCharCount] = useState(0);
  const [noteSaved, setNoteSaved] = useState(false);

  // Real outbound call via Omnidimension (backend-held API key, actually dials the lead's phone)
  const [omniCallLoading, setOmniCallLoading] = useState(false);
  const [omniCallResult, setOmniCallResult] = useState('');
  const handleOmniCall = async () => {
    setOmniCallLoading(true);
    setOmniCallResult('');
    try {
      const result = await callLeadViaOmnidim(lead.id);
      if (result.ok) {
        setOmniCallResult(`✓ Real call dispatched (request #${result.requestId})`);
        playBeep(760, 0.1, 'sine');
        triggerToast(`Omnidimension is now calling ${lead.name} for real.`, 'success');
      } else {
        setOmniCallResult(`✗ ${result.error}`);
        triggerToast(`Omni call failed: ${result.error}`, 'error');
      }
    } finally {
      setOmniCallLoading(false);
    }
  };

  useEffect(() => {
    if (noteEditorRef.current) {
      noteEditorRef.current.innerHTML = lead.note || '';
      setNoteCharCount(noteEditorRef.current.innerText.length);
      setNoteSaved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  const handleNoteInput = () => {
    if (!noteEditorRef.current) return;
    setNoteCharCount(noteEditorRef.current.innerText.length);
    setNoteSaved(false);
  };

  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    noteEditorRef.current?.focus();
    handleNoteInput();
  };

  const saveNote = () => {
    const html = noteEditorRef.current?.innerHTML || '';
    updateLeadInList(lead.id, { note: html });
    setNoteSaved(true);
    playBeep(700, 0.08, 'sine');
    triggerToast('Note saved to lead profile.', 'success');
  };

  return (
    <div className="flex flex-col gap-6 w-full select-none bg-gradient-to-br from-[#060e22] via-[#09152b] to-[#040914] text-slate-100 p-6 rounded-3xl shadow-xl" id="crm-reve-leads-details">
      {/* This page still uses the original dark glass theme — its translucent panels
          need a dark backdrop of their own now that the app shell around it is light,
          otherwise they render as washed-out low-contrast gray instead of proper glass. */}

      {/* ============ SELF-CONTAINED 3D / HOLOGRAM ANIMATION ENGINE ============ */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes aiva3dSpinY { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }
        @keyframes aivaFloatLabel { 0%,100% { transform: translateY(0); opacity: .8; } 50% { transform: translateY(-5px); opacity: 1; } }
        @keyframes aivaWavePulse { 0%,100% { transform: scaleY(0.22); } 50% { transform: scaleY(1); } }
        @keyframes aivaHexGlow { 0%,100% { box-shadow: 0 0 6px rgba(34,211,238,.25); } 50% { box-shadow: 0 0 20px rgba(34,211,238,.65); } }
        @keyframes aivaTerrainScroll { from { background-position: 0 0; } to { background-position: 0 26px; } }
        @keyframes aivaCubeSpin { from { transform: rotateX(-24deg) rotateY(0deg); } to { transform: rotateX(-24deg) rotateY(360deg); } }
        @keyframes aivaScan { 0% { transform: translateY(0); opacity: 0; } 12% { opacity: .55; } 88% { opacity: .55; } 100% { transform: translateY(220px); opacity: 0; } }
        @keyframes aivaSpark { 0%,100% { opacity:.4; transform: scale(1); } 50% { opacity:1; transform: scale(1.5); } }

        /* --- 3D wireframe globe --- */
        .aiva-globe-scene { perspective: 720px; }
        .aiva-globe { transform-style: preserve-3d; animation: aiva3dSpinY 18s linear infinite; }
        .aiva-meridian { position:absolute; inset:0; border-radius:50%; border:1px solid rgba(34,211,238,.32); }
        .aiva-equator { position:absolute; inset:0; border-radius:50%; border:1px solid rgba(34,211,238,.22); }
        .aiva-globe-core { position:absolute; inset:14%; border-radius:50%; background:radial-gradient(circle at 38% 32%, rgba(34,211,238,.30), rgba(59,130,246,.10) 55%, transparent 72%); filter:blur(3px); }
        .aiva-float-label { animation: aivaFloatLabel 4s ease-in-out infinite; }

        /* --- waveform --- */
        .aiva-wave-bar { width:2px; border-radius:2px; background:linear-gradient(to top,#06b6d4,#22d3ee,#818cf8); transform-origin:center bottom; animation: aivaWavePulse 1.1s ease-in-out infinite; }

        /* --- hexagon date pods --- */
        .aiva-hex { clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%); animation: aivaHexGlow 2.4s ease-in-out infinite; }

        /* --- 3D terrain mesh --- */
        .aiva-terrain-scene { perspective: 320px; }
        .aiva-terrain-grid {
          position:absolute; left:-20%; right:-20%; bottom:-10%; height:180%;
          background-image:
            linear-gradient(rgba(34,211,238,.40) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,211,238,.28) 1px, transparent 1px);
          background-size:26px 26px;
          transform: rotateX(64deg); transform-origin:center bottom;
          animation: aivaTerrainScroll 1.5s linear infinite;
          -webkit-mask-image: linear-gradient(to top, #000 35%, transparent 92%);
          mask-image: linear-gradient(to top, #000 35%, transparent 92%);
        }

        /* --- 3D RGB risk cube --- */
        .aiva-cube-scene { perspective: 460px; }
        .aiva-cube { position:relative; width:60px; height:60px; transform-style:preserve-3d; animation: aivaCubeSpin 9s linear infinite; }
        .aiva-cube-face { position:absolute; width:60px; height:60px; border:1px solid rgba(255,255,255,.45);
          background:linear-gradient(135deg, rgba(239,68,68,.32), rgba(234,179,8,.30) 45%, rgba(34,197,94,.30) 70%, rgba(59,130,246,.34));
          box-shadow: inset 0 0 18px rgba(255,255,255,.12); }

        /* --- scanline overlay --- */
        .aiva-scan { position:absolute; left:0; right:0; height:40px; top:0; pointer-events:none;
          background:linear-gradient(to bottom, transparent, rgba(34,211,238,.14), transparent); animation: aivaScan 4.5s ease-in-out infinite; }
      `}} />


      {/* HEADER CONTROLS AND BREADCRUMB */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.01] border-b border-white/5 pb-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 text-cyan-400" />
          Back to Registry
        </button>

        <div className="text-right font-mono text-[10px] text-slate-500 hidden sm:block">
          <span>SECURE HUD LINK // CRM REVE EXPANDED DOSSIER ACTIVE</span>
        </div>
      </div>

      {/* DETAILED CRM REVE HUD CONTAINER PANEL */}
      <div className="iceglass rounded-3xl p-6 relative overflow-hidden transition-all duration-300 border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        
        {/* Holographic background laser glows */}
        <div className="absolute top-0 right-1/4 w-[350px] h-[350px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute bottom-0 left-1/4 w-[250px] h-[250px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Decorative corner indicators */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400/60" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400/60" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400/60" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400/60" />

        {/* 1. TOP TITLE HEADER: CRM REVE */}
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 border-b border-white/10 pb-5 mb-6">
          
          {/* Title & Navigation tabs */}
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <h1 className="text-xl font-black text-slate-100 font-mono tracking-widest uppercase">CRM Reve</h1>
            </div>
            
            {/* Custom high-tech sub tabs matching 2nd picture */}
            <div className="flex bg-white/5 border border-white/10 p-0.5 rounded-lg gap-0.5 font-mono text-[9px] font-bold uppercase tracking-wider overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'contact', label: 'Contact' },
                { id: 'workflow', label: 'Workflow' },
                { id: 'contracts', label: 'Contracts' },
                { id: 'help', label: 'Help' }
              ].map(subTab => (
                <button
                  key={subTab.id}
                  onClick={() => { setActiveSubTab(subTab.id as any); playBeep(560, 0.05); }}
                  className={`px-3.5 py-1.5 rounded transition-all cursor-pointer ${activeSubTab === subTab.id ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-extrabold' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'}`}
                >
                  {subTab.label}
                </button>
              ))}
            </div>
          </div>

          {/* User Profile display in top right */}
          <div className="flex items-center justify-between lg:justify-end gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-2xl">
            <div className="text-right font-mono">
              <p className="text-[10px] font-black text-slate-200">Yolohntidor</p>
              <p className="text-[8px] text-cyan-400/80 uppercase">Todd so Gaft Reb</p>
            </div>
            <div className="relative">
              <img 
                src={agent.photoUrl} 
                alt="Profile avatar" 
                className="w-8 h-8 rounded-full object-cover border border-cyan-400/40"
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-950 animate-pulse" />
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </div>

        </div>

        {/* 2. DYNAMIC CONTENT SUB-TAB ROUTER & BENTO GRID LAYOUT */}
        {activeSubTab === 'overview' ? (
          <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* ================= COLUMN A (LEFT 5 COLS): GEOGRAPHY GLOBE & REMARKS ================= */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Preferred Location with Holographic Globe HUD */}
              <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-5 relative overflow-hidden group flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-cyan-300/80 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    Preferred Location
                  </span>
                  <div className="flex items-center gap-1 text-[9px] font-mono text-slate-500">
                    <MapPin className="w-3 h-3 text-cyan-400" />
                    <span>Hologram Grid</span>
                  </div>
                </div>

                {/* Location Input Dropdown */}
                <div className="relative">
                  <select
                    value={editLocation}
                    onChange={(e) => { setEditLocation(e.target.value); handleSaveField('location', e.target.value); }}
                    className="w-full text-xs font-mono font-bold bg-slate-950/80 text-cyan-300 border border-cyan-500/30 px-3.5 py-3 rounded-xl cursor-pointer focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] outline-none appearance-none"
                  >
                    <option value="Manhattan, NY">Manhattan, NY</option>
                    <option value="Bangalore, India">Bangalore, India</option>
                    <option value="Chicago, IL">Chicago, IL</option>
                    <option value="Mumbai, India">Mumbai, India</option>
                    <option value="Delhi NCR, India">Delhi NCR, India</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>

                {/* Breathtaking 3D Holographic Rotating Globe HUD */}
                <div className="h-56 relative bg-slate-950/40 border border-white/5 rounded-2xl flex items-center justify-center overflow-hidden">

                  {/* moving scanline */}
                  <div className="aiva-scan" />

                  {/* Outer spinning orbit ring (flat, decorative) */}
                  <div className="absolute w-48 h-48 rounded-full border border-dashed border-cyan-500/15 animate-reverse-spin" />

                  {/* True 3D rotating wireframe globe */}
                  <div className="aiva-globe-scene w-40 h-40 relative flex items-center justify-center drop-shadow-[0_0_18px_rgba(34,211,238,0.35)]">
                    <div className="aiva-globe absolute w-40 h-40">
                      {[0, 30, 60, 90, 120, 150].map((deg) => (
                        <div key={deg} className="aiva-meridian" style={{ transform: `rotateY(${deg}deg)` }} />
                      ))}
                      <div className="aiva-equator" style={{ transform: 'rotateX(80deg)' }} />
                      <div className="aiva-equator" style={{ transform: 'rotateX(80deg) translateZ(22px) scale(0.7)', opacity: 0.5 }} />
                      <div className="aiva-equator" style={{ transform: 'rotateX(80deg) translateZ(-22px) scale(0.7)', opacity: 0.5 }} />
                    </div>
                    <div className="aiva-globe-core" />
                    {/* glowing target node on globe surface */}
                    <div className="absolute w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_3px_rgba(34,211,238,0.8)] animate-ping" style={{ top: '38%', left: '54%' }} />
                  </div>

                  {/* Floating holographic city labels (like screenshot 2) */}
                  {[
                    { t: 'Lincoln Park', top: '14%', left: '6%', d: '0s' },
                    { t: 'The Loop', top: '30%', right: '6%', d: '.8s' },
                    { t: editLocation, top: '68%', left: '8%', d: '1.4s' },
                  ].map((l, i) => (
                    <div
                      key={i}
                      className="aiva-float-label absolute bg-slate-950/70 border border-cyan-400/40 px-2 py-1 rounded text-[7px] font-mono text-cyan-200 font-bold whitespace-nowrap backdrop-blur-sm"
                      style={{ top: l.top, left: (l as any).left, right: (l as any).right, animationDelay: l.d }}
                    >
                      <span className="inline-block w-1 h-1 rounded-full bg-cyan-400 mr-1 align-middle" />
                      {l.t}
                    </div>
                  ))}

                  {/* Active pin card */}
                  <div className="absolute right-3 bottom-3 bg-slate-950/90 border border-cyan-400/80 px-2.5 py-1.5 rounded-lg text-[9px] font-mono text-cyan-300 font-bold shadow-[0_0_12px_rgba(34,211,238,0.35)] flex flex-col items-center z-10">
                    <span className="text-[7px] text-slate-400 uppercase tracking-wider">Active Pin</span>
                    <span>{editLocation}</span>
                  </div>

                </div>
              </div>

              {/* Remarks Box matching Image 1 perfectly */}
              <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-5 relative overflow-hidden">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-slate-300">
                    Remarks
                  </span>
                  <span className="text-[7px] font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-slate-500 uppercase">
                    Speech Node Logger
                  </span>
                </div>

                <textarea
                  value={editRemarks}
                  onChange={(e) => { setEditRemarks(e.target.value); updateLeadInList(lead.id, { remarks: e.target.value }); }}
                  rows={3}
                  className="w-full bg-slate-950/50 text-slate-200 text-xs font-mono p-4 rounded-xl border border-white/5 focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 italic resize-none leading-relaxed shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]"
                  placeholder="Insert remarks logged by Aiva Voice agent..."
                />

                {/* Live animated voice waveform (Speech Node Logger) */}
                <div className="flex items-center justify-center gap-[3px] h-9 mt-3 px-3 bg-slate-950/40 rounded-lg border border-white/5 overflow-hidden">
                  {Array.from({ length: 48 }).map((_, i) => (
                    <div
                      key={i}
                      className="aiva-wave-bar"
                      style={{
                        height: `${18 + (Math.sin(i * 0.9) + 1) * 9}px`,
                        animationDelay: `${(i % 12) * 0.08}s`,
                        animationDuration: `${0.8 + (i % 5) * 0.12}s`,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Sentiment Analysis + 3D Risk Assessment cube row (screenshot 2) */}
              <div className="grid grid-cols-2 gap-6">

                {/* Sentiment Analysis mini sparkline */}
                <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-4 relative overflow-hidden">
                  <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-cyan-300/80 flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-cyan-400" />
                    Sentiment Analysis
                  </span>
                  <div className="h-20 mt-2 relative">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 100 44" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d="M 0 34 Q 14 30, 24 32 T 44 20 T 64 26 T 84 8 T 100 14" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
                      <path d="M 0 34 Q 14 30, 24 32 T 44 20 T 64 26 T 84 8 T 100 14 L 100 44 L 0 44 Z" fill="url(#sentGrad)" />
                      <circle cx="84" cy="8" r="2.6" fill="#22d3ee" className="animate-ping" />
                      <circle cx="84" cy="8" r="1.5" fill="#fff" />
                    </svg>
                  </div>
                  <div className="flex justify-between text-[7px] font-mono text-slate-500">
                    <span>MAR</span><span>MAY</span><span>JUL</span>
                  </div>
                </div>

                {/* 3D Rotating RGB Risk Assessment cube */}
                <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-4 relative overflow-hidden flex flex-col">
                  <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-cyan-300/80 flex items-center gap-1.5">
                    <ShieldAlert className="w-3 h-3 text-amber-400" />
                    Risk Assessment
                  </span>
                  <div className="aiva-cube-scene flex-1 flex items-center justify-center min-h-[80px]">
                    <div className="aiva-cube">
                      <div className="aiva-cube-face" style={{ transform: 'translateZ(30px)' }} />
                      <div className="aiva-cube-face" style={{ transform: 'rotateY(180deg) translateZ(30px)' }} />
                      <div className="aiva-cube-face" style={{ transform: 'rotateY(90deg) translateZ(30px)' }} />
                      <div className="aiva-cube-face" style={{ transform: 'rotateY(-90deg) translateZ(30px)' }} />
                      <div className="aiva-cube-face" style={{ transform: 'rotateX(90deg) translateZ(30px)' }} />
                      <div className="aiva-cube-face" style={{ transform: 'rotateX(-90deg) translateZ(30px)' }} />
                    </div>
                  </div>
                  <span className="text-[7px] font-mono text-emerald-400/80 uppercase text-center">Moderate · Stable</span>
                </div>

              </div>

            </div>


            {/* ================= COLUMN B (RIGHT 7 COLS): CUSTOMER NAME & CRM DETAILED CONTROLS ================= */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              {/* CUSTOMER NAME, STATUS, BUDGET HUD GRID (From Screenshot 1) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Customer Name block with sub-label 'Normamlest' */}
                <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-5 flex flex-col gap-3 relative">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider">Customer Name</span>
                    <span className="text-[10px] font-mono text-cyan-300 font-bold uppercase mt-0.5">Normamlest</span>
                  </div>

                  <div className="relative">
                    <input 
                      type="text"
                      value={editName}
                      onChange={(e) => { setEditName(e.target.value); handleSaveField('name', e.target.value); }}
                      className="w-full text-xs font-mono font-bold bg-slate-950/60 text-slate-100 border border-white/10 hover:border-cyan-500/30 focus:border-cyan-400 px-3.5 py-2.5 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] outline-none"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-400 cursor-pointer">
                      <Search className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                {/* Budget visual card */}
                <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-5 flex flex-col justify-between relative">
                  <div>
                    <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      Budget 
                      <Info className="w-2.5 h-2.5 text-slate-600" />
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-4">
                    <span className="text-sm font-mono text-cyan-400 font-black">$</span>
                    <input 
                      type="number"
                      value={editBudget}
                      onChange={(e) => { setEditBudget(Number(e.target.value)); handleSaveField('budget', Number(e.target.value)); }}
                      className="text-lg font-mono text-slate-100 bg-transparent border-none focus:outline-none focus:ring-0 w-full p-0 font-extrabold"
                    />
                  </div>
                  <span className="text-[7px] font-mono text-emerald-400/80 mt-1 uppercase block">High Net-Worth Tier</span>
                </div>

              </div>

              {/* INTERACTIVE CONTROLS ROW (Contacted and Status capsules) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Contacted Toggle Capsule with green active slot */}
                <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono text-slate-200 font-bold uppercase tracking-wider flex items-center gap-1">
                      Contacted
                      <Info className="w-3 h-3 text-slate-500" />
                    </span>
                    <span className="text-[8px] font-mono text-slate-500 uppercase mt-0.5">Voice handover complete</span>
                  </div>

                  {/* Capsule Slide Switch in Green */}
                  <div 
                    onClick={() => {
                      const nextVal = !contactedStatus;
                      setContactedStatus(nextVal);
                      playBeep(nextVal ? 700 : 380, 0.08, 'sine');
                      updateLeadInList(lead.id, { status: nextVal ? 'Contacted' : 'Pending' });
                      triggerToast(`Handover State: ${nextVal ? 'CONTACTED' : 'STANDBY'}`, 'info');
                    }}
                    className={`w-16 h-8 rounded-full p-1 cursor-pointer transition-all duration-300 ${contactedStatus ? 'bg-emerald-500/20 border border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-slate-800 border border-white/5'}`}
                  >
                    <div className={`h-full w-6 rounded-full transition-all duration-300 ${contactedStatus ? 'bg-emerald-400 translate-x-8 shadow-[0_0_8px_#34d399]' : 'bg-slate-500 translate-x-0'}`} />
                  </div>
                </div>

                {/* Status Interested toggle Capsule */}
                <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono text-slate-200 font-bold uppercase tracking-wider flex items-center gap-1">
                      Status
                      <Info className="w-3 h-3 text-slate-500" />
                    </span>
                    <span className="text-[8px] font-mono text-slate-500 uppercase mt-0.5">Callback Intent Grade</span>
                  </div>

                  {/* Interested Neon Green Switch */}
                  <div 
                    onClick={() => {
                      const stages = ['Interested', 'Hot Lead', 'Call Later', 'Warm Lead'];
                      const currentIdx = stages.indexOf(workflowStatus);
                      const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % stages.length;
                      const nextStatus = stages[nextIdx];
                      setWorkflowStatus(nextStatus);
                      playBeep(600 + nextIdx * 50, 0.08, 'sine');
                      updateLeadInList(lead.id, { interestLevel: nextStatus as any });
                      triggerToast(`Status grade configured to: ${nextStatus.toUpperCase()}`, 'success');
                    }}
                    className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 px-4 py-2 rounded-full cursor-pointer transition-all"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-mono text-emerald-300 font-black uppercase tracking-wider">
                      {workflowStatus}
                    </span>
                  </div>
                </div>

              </div>

              {/* IMAGE 2 BOTTOM INTERACTION COMPONENT: FOLLOW-UP DATE & WHATSAPP DELIVERABLES */}
              <div className="bg-slate-950/40 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

                {/* Top support tags */}
                <div className="flex justify-between items-center border-b border-white/5 pb-3.5 mb-5">
                  <span className="text-[10px] font-mono text-slate-400 font-extrabold tracking-wider uppercase">
                    Support Dime
                  </span>
                  <div className="flex items-center gap-2 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 text-[9px] font-mono text-cyan-300">
                    <span className="font-bold">+7.5%</span>
                    <span className="text-[7px] text-slate-500">3.02.3%</span>
                  </div>
                </div>

                {/* Interactive grids matching screenshot 2 */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  
                  {/* Left block: Digital flap displays */}
                  <div className="lg:col-span-7 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-200 font-bold uppercase tracking-wider flex items-center gap-1">
                        Follow-up Date
                        <Info className="w-3.5 h-3.5 text-slate-500" />
                      </span>
                    </div>

                    {/* Hexagonal glowing date pods (screenshot 2) */}
                    <div className="flex gap-3 items-center">
                      {[
                        { top: 'DATE', bot: 'OCT' },
                        { top: 'DATE', bot: '25', big: true },
                        { top: 'DATE', bot: '2023' },
                      ].map((seg, idx) => (
                        <div
                          key={idx}
                          className={`aiva-hex flex flex-col items-center justify-center bg-slate-900/90 border ${seg.big ? 'border-cyan-400 w-20 h-[76px]' : 'border-cyan-500/40 w-16 h-16'} font-mono uppercase`}
                          style={{ animationDelay: `${idx * 0.5}s` }}
                        >
                          <span className="text-[7px] text-cyan-400/70 tracking-widest">{seg.top}</span>
                          <span className={`${seg.big ? 'text-cyan-200 text-sm' : 'text-slate-200 text-xs'} font-extrabold`}>{seg.bot}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right block: WhatsApp + Brochure Delivery visual animation (Screenshot 2 Match!) */}
                  <div className="lg:col-span-5 flex items-center justify-start lg:justify-end gap-4">
                    
                    {/* Glowing neon WhatsApp Icon */}
                    <div className="relative group cursor-pointer" onClick={() => {
                      handleToggleBoolean('whatsappSent');
                      playBeep(850, 0.15, 'triangle');
                    }}>
                      <div className="absolute inset-0 bg-emerald-500/40 rounded-full blur-md opacity-75 group-hover:opacity-100 transition-opacity" />
                      <div className="relative w-12 h-12 rounded-full bg-slate-900 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                        <MessageSquare className="w-6 h-6 fill-emerald-400/20 text-emerald-400" />
                      </div>
                    </div>

                    {/* Dotted speed line connections */}
                    <div className="hidden sm:block">
                      <svg className="w-10 h-6 text-emerald-400/40" viewBox="0 0 40 24">
                        <path d="M 0 12 Q 20 2, 40 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
                        <circle cx="35" cy="10" r="2" fill="#34d399" className="animate-ping" />
                      </svg>
                    </div>

                    {/* Glowing Cyan Deliverable card with tick indicator */}
                    <div className="bg-slate-900 border border-cyan-500/30 px-3.5 py-3 rounded-xl relative flex flex-col items-center shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                      <div className="absolute -top-1 -right-1 bg-emerald-400 text-slate-950 rounded-full p-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>

                      <Send className="w-6 h-6 text-cyan-400 transform -rotate-12 animate-pulse" />
                      <span className="text-[9px] font-mono text-cyan-200 mt-2 font-black uppercase tracking-wider">
                        Brochure Sent
                      </span>
                    </div>

                  </div>

                </div>

                {/* Bottom section of image 2: Actions & Lock Dime button */}
                <div className="border-t border-white/5 mt-6 pt-5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
                  
                  {/* Action dropdown */}
                  <div className="flex flex-col gap-1 flex-1 max-w-xs">
                    <label className="text-[8px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      Actions 
                      <Info className="w-2.5 h-2.5" />
                    </label>
                    <select
                      value={selectedAction}
                      onChange={(e) => { setSelectedAction(e.target.value); playBeep(540, 0.05); }}
                      className="text-[10px] font-mono font-bold bg-slate-900/80 text-slate-300 border border-white/10 px-3 py-2 rounded-lg cursor-pointer outline-none"
                    >
                      <option value="Call Follow-up">Call Follow-up</option>
                      <option value="Dispatch Catalog">Dispatch Catalog</option>
                      <option value="Escalate to Kavya">Escalate to Kavya</option>
                    </select>
                  </div>

                  {/* Lock Dime action button matching screenshot 2 exactly */}
                  <button 
                    onClick={() => {
                      playBeep(980, 0.25, 'triangle');
                      triggerToast("CRM state registered successfully into memory sector.", "success");
                    }}
                    className="bg-cyan-500/10 hover:bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 font-mono font-black text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.25)] hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all animate-pulse"
                  >
                    Lock Dime
                  </button>

                </div>

              </div>

              {/* Conversion trend charts (Matches bottom right of Screenshot 1) */}
              <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-5 relative overflow-hidden">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[8px] font-mono font-bold tracking-widest uppercase text-cyan-300/80 block">
                    Refurrations & Redlact charts
                  </span>
                  <div className="flex gap-2 text-[7px] font-mono text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Sinome</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Areas</span>
                  </div>
                </div>

                <div className="aiva-terrain-scene h-36 relative flex items-end overflow-hidden rounded-xl bg-slate-950/40">

                  {/* Animated receding 3D grid floor */}
                  <div className="aiva-terrain-grid" />

                  {/* Neon terrain peak wave riding on the grid */}
                  <svg className="w-full h-full overflow-visible relative z-[1]" viewBox="0 0 100 50" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.45"/>
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    <path d="M 0 50 Q 20 45, 35 26 T 60 12 T 80 40 T 100 50" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" className="drop-shadow-[0_0_6px_rgba(34,211,238,0.7)]" />
                    <path d="M 0 50 Q 20 45, 35 26 T 60 12 T 80 40 T 100 50 L 100 50 L 0 50 Z" fill="url(#cyanGrad)" />
                    <circle cx="60" cy="12" r="3.5" fill="#22d3ee" className="animate-ping" />
                    <circle cx="60" cy="12" r="2" fill="#ffffff" />
                  </svg>

                  {/* Confirmed Floating Neon Tooltip */}
                  <div className="absolute left-[52%] top-[8%] bg-slate-950 border border-cyan-400/80 text-cyan-300 font-mono text-[7px] font-black px-2 py-1 rounded shadow-[0_0_10px_rgba(34,211,238,0.3)] flex flex-col items-center z-10">
                    <span className="uppercase text-[5px] tracking-wider text-slate-500">Confirmed</span>
                    <span>16.30%</span>
                  </div>

                </div>

                <div className="flex justify-between text-[8px] font-mono text-slate-500 mt-2">
                  <span>MAR</span><span>APR</span><span>MAY</span><span>JUN</span><span>JUL</span>
                </div>
              </div>

            </div>

          </div>

          {/* ================================================================
               FULL CRM LEAD PROFILE PANEL (score/stage/contact history/
               requirement + AI Assist + rich note editor + activity tabs)
             ================================================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* LEFT (5 cols): Score, Stage, Contact History, Requirement, Actions */}
            <div className="lg:col-span-5 flex flex-col gap-6">

              <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-5 flex flex-col gap-5">
                <div className="flex items-center gap-4">
                  {/* Score ring */}
                  <div className="relative w-16 h-16 shrink-0">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                      <circle
                        cx="32" cy="32" r="27" fill="none" stroke={scoreColor} strokeWidth="5" strokeLinecap="round"
                        strokeDasharray={`${(score / 100) * 169.6} 169.6`}
                        style={{ filter: `drop-shadow(0 0 4px ${scoreColor}88)`, transition: 'stroke-dasharray .5s ease' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-black text-slate-100 font-mono">{score}</span>
                      <span className="text-[6px] text-slate-500 uppercase font-mono">Score</span>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-2 min-w-0">
                    <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider">Stage &amp; Status</span>
                    <select
                      value={stage}
                      onChange={(e) => { setStage(e.target.value as Lead['status']); updateLeadInList(lead.id, { status: e.target.value as Lead['status'] }); playBeep(560, 0.06); triggerToast(`Stage updated to ${e.target.value}`, 'success'); }}
                      className={`text-xs font-mono font-extrabold px-3 py-2 rounded-lg border cursor-pointer outline-none w-full ${stageColorMap[stage] || 'text-slate-300 bg-white/5 border-white/10'}`}
                    >
                      {['Pending', 'Call Scheduled', 'In Call', 'Contacted', 'Outgoing Retry', 'Completed', 'Handed Over'].map(s => (
                        <option key={s} value={s} className="bg-slate-900 text-slate-200">{s}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => { setFeedTab('Followups'); playBeep(600, 0.06); triggerToast('Jump to Follow-ups tab below to schedule.', 'info'); }}
                      className="flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg py-1.5 cursor-pointer transition-all"
                    >
                      <CalendarClock className="w-3 h-3" /> Add Follow-up
                    </button>
                  </div>
                </div>

                {/* Detail rows list */}
                <div className="flex flex-col divide-y divide-white/5 border-t border-white/5">
                  {[
                    { label: 'Last Note', value: lead.note ? 'Saved' : '—' },
                    { label: 'Received On', value: lead.dateTime || '—' },
                    { label: 'Lead Age', value: leadAge },
                    { label: 'Tags', value: (lead.tags && lead.tags.length) ? lead.tags.join(', ') : '—' },
                    { label: 'Last Contact', value: lead.lastContactTime || '—' },
                    { label: 'Owner', value: lead.owner || 'Aman Kumar' },
                    { label: 'Phone Verified', value: lead.phoneVerified === false ? 'No' : 'Yes' },
                    { label: "Lead Country", value: leadCountry },
                    { label: "Lead's Current Time", value: leadLocalTime },
                    { label: 'Interested Projects', value: lead.project || '—' },
                    { label: 'Last Contact Attempted By Lead', value: lead.lastContactAttemptedByLead || '—' },
                    { label: 'Last Contact By Lead', value: lead.lastContactByLead || '—' },
                    { label: 'Last Contact Attempted By Sales', value: lead.lastContactAttemptedBySales || '—' },
                    { label: 'Last Contact By Sales', value: lead.lastContactBySales || '—' },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 text-[10px] font-mono">
                      <span className="text-slate-500 uppercase tracking-wider">{row.label}</span>
                      <span className="text-slate-200 font-bold text-right max-w-[55%] truncate" title={row.value}>{row.value}</span>
                    </div>
                  ))}
                  {/* Contact details reveal */}
                  <div className="flex items-center justify-between py-2.5 text-[10px] font-mono">
                    <span className="text-slate-500 uppercase tracking-wider">Contact Details</span>
                    <button
                      onClick={() => { setShowContact(v => !v); playBeep(520, 0.05); }}
                      className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {showContact ? <><EyeOff className="w-3 h-3" /> Hide</> : <><Eye className="w-3 h-3" /> View</>}
                    </button>
                  </div>
                  {showContact && (
                    <div className="py-2.5 text-[10px] font-mono text-cyan-300 bg-cyan-500/5 rounded-lg px-3 -mx-1">
                      {lead.phone}
                    </div>
                  )}
                </div>
              </div>

              {/* Requirement card */}
              <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-5 flex flex-col gap-1">
                <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-slate-300 mb-2 flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-cyan-400" /> Requirement
                </span>
                {[
                  { label: 'Configuration', value: lead.configuration || '—' },
                  { label: 'Property Type', value: lead.propertyType || '—' },
                  { label: 'Budget', value: `$${lead.budget?.toLocaleString?.() ?? lead.budget}` },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between py-2 text-[10px] font-mono border-t border-white/5 first:border-t-0">
                    <span className="text-slate-500 uppercase tracking-wider">{row.label}</span>
                    <span className="text-slate-200 font-bold">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Call / WA / Follow / Omni Call action buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => { initiateCall(lead.id); playBeep(700, 0.1, 'sine'); }}
                  className="flex items-center justify-center gap-1.5 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/40 text-orange-300 font-mono font-bold text-[10px] uppercase tracking-wider py-2.5 rounded-xl cursor-pointer transition-all"
                  title="Simulated in-browser demo call"
                >
                  <Phone className="w-3.5 h-3.5" /> Call
                </button>
                <button
                  onClick={() => { handleToggleBoolean('whatsappSent'); }}
                  className="flex items-center justify-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-[10px] uppercase tracking-wider py-2.5 rounded-xl cursor-pointer transition-all"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WA
                </button>
                <button
                  onClick={() => { setFeedTab('Followups'); playBeep(560, 0.06); }}
                  className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 font-mono font-bold text-[10px] uppercase tracking-wider py-2.5 rounded-xl cursor-pointer transition-all"
                >
                  <CalendarCheck className="w-3.5 h-3.5" /> Follow
                </button>
                <button
                  onClick={handleOmniCall}
                  disabled={omniCallLoading}
                  title="Places a REAL phone call via Omnidimension"
                  className="flex items-center justify-center gap-1.5 bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-50 border border-rose-500/40 text-rose-300 font-mono font-bold text-[10px] uppercase tracking-wider py-2.5 rounded-xl cursor-pointer transition-all"
                >
                  {omniCallLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />}
                  Omni Call
                </button>
              </div>
              {omniCallResult && (
                <span className={`text-[9px] font-mono ${omniCallResult.startsWith('✓') ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {omniCallResult}
                </span>
              )}

            </div>

            {/* RIGHT (7 cols): AI Assist, Rich Note Editor, Activities Overview, Feed Tabs */}
            <div className="lg:col-span-7 flex flex-col gap-6">

              {/* AI Assist panel — wired to the SAME Gemini key saved in the Voice Agent settings */}
              <div className="bg-gradient-to-br from-indigo-500/[0.06] to-transparent border border-indigo-500/20 rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-indigo-300" />
                  </div>
                  <span className="text-xs font-black text-slate-100 font-mono">AI Assist</span>
                  <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">Gemini Flash</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    onClick={() => runAiAssist('summary')}
                    disabled={!!aiLoading}
                    className="flex items-center justify-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-50 border border-indigo-500/30 text-indigo-200 font-mono font-bold text-[10px] py-2.5 rounded-xl cursor-pointer transition-all"
                  >
                    {aiLoading === 'summary' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                    Summarise lead
                  </button>
                  <button
                    onClick={() => runAiAssist('draft')}
                    disabled={!!aiLoading}
                    className="flex items-center justify-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-50 border border-indigo-500/30 text-indigo-200 font-mono font-bold text-[10px] py-2.5 rounded-xl cursor-pointer transition-all"
                  >
                    {aiLoading === 'draft' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    Draft follow-up
                  </button>
                  <button
                    onClick={() => runAiAssist('action')}
                    disabled={!!aiLoading}
                    className="flex items-center justify-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-50 border border-indigo-500/30 text-indigo-200 font-mono font-bold text-[10px] py-2.5 rounded-xl cursor-pointer transition-all"
                  >
                    {aiLoading === 'action' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                    Suggest next action
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-[8px] font-mono text-slate-500 uppercase">Draft as</label>
                  <select value={draftAs} onChange={(e) => setDraftAs(e.target.value as any)} className="text-[9px] font-mono font-bold bg-slate-900/80 text-slate-300 border border-white/10 px-2 py-1.5 rounded-lg cursor-pointer outline-none">
                    {['WhatsApp', 'Email', 'SMS', 'Call Script'].map(o => <option key={o}>{o}</option>)}
                  </select>
                  <select value={draftTone} onChange={(e) => setDraftTone(e.target.value as any)} className="text-[9px] font-mono font-bold bg-slate-900/80 text-slate-300 border border-white/10 px-2 py-1.5 rounded-lg cursor-pointer outline-none">
                    {['Warm', 'Formal', 'Urgent', 'Friendly'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>

                {aiOutput && (
                  <div className="bg-slate-950/60 border border-indigo-500/20 rounded-xl p-3.5 text-[11px] text-slate-200 font-sans leading-relaxed whitespace-pre-wrap">
                    {aiOutput}
                  </div>
                )}
                {aiError && (
                  <div className="bg-rose-500/[0.06] border border-rose-500/25 rounded-xl p-3 text-[10px] text-rose-300/90 font-mono leading-relaxed">
                    {aiError}
                  </div>
                )}
              </div>

              {/* Rich note editor */}
              <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-5 flex flex-col gap-2">
                {/* Formatting toolbar */}
                <div className="flex items-center gap-1 flex-wrap bg-white/[0.02] border border-white/5 rounded-lg p-1.5">
                  {[
                    { icon: Bold, cmd: 'bold' }, { icon: Italic, cmd: 'italic' }, { icon: Underline, cmd: 'underline' },
                  ].map(({ icon: Icon, cmd }) => (
                    <button key={cmd} onClick={() => exec(cmd)} className="w-7 h-7 rounded-md hover:bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"><Icon className="w-3.5 h-3.5" /></button>
                  ))}
                  <div className="w-px h-4 bg-white/10 mx-1" />
                  <button onClick={() => exec('insertUnorderedList')} className="w-7 h-7 rounded-md hover:bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"><List className="w-3.5 h-3.5" /></button>
                  <button onClick={() => exec('insertOrderedList')} className="w-7 h-7 rounded-md hover:bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"><ListOrdered className="w-3.5 h-3.5" /></button>
                  <div className="w-px h-4 bg-white/10 mx-1" />
                  <button onClick={() => exec('justifyLeft')} className="w-7 h-7 rounded-md hover:bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"><AlignLeft className="w-3.5 h-3.5" /></button>
                  <button onClick={() => exec('justifyCenter')} className="w-7 h-7 rounded-md hover:bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"><AlignCenter className="w-3.5 h-3.5" /></button>
                  <button onClick={() => exec('justifyRight')} className="w-7 h-7 rounded-md hover:bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"><AlignRight className="w-3.5 h-3.5" /></button>
                  <div className="w-px h-4 bg-white/10 mx-1" />
                  <button onClick={() => { const url = window.prompt('Link URL:'); if (url) exec('createLink', url); }} className="w-7 h-7 rounded-md hover:bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"><Link2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => exec('undo')} className="w-7 h-7 rounded-md hover:bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"><RotateCcw className="w-3.5 h-3.5" /></button>
                  <button onClick={() => exec('redo')} className="w-7 h-7 rounded-md hover:bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"><RotateCw className="w-3.5 h-3.5" /></button>
                </div>

                <div
                  ref={noteEditorRef}
                  contentEditable
                  onInput={handleNoteInput}
                  data-placeholder="Write a note about this lead…"
                  className="min-h-[110px] max-h-[220px] overflow-y-auto scrollbar-thin bg-slate-950/40 text-slate-200 text-xs font-sans p-4 rounded-xl border border-white/5 focus:border-cyan-500/30 focus:outline-none leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-slate-600"
                />

                <div className="flex items-center justify-between mt-1">
                  <span className={`text-[9px] font-mono ${noteCharCount > 2000 ? 'text-rose-400' : 'text-slate-500'}`}>
                    Maximum 2000 characters are allowed ({Math.min(noteCharCount, 9999)}/2000)
                  </span>
                  <button
                    onClick={saveNote}
                    disabled={noteCharCount > 2000}
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 disabled:opacity-40 text-white font-mono font-bold text-[10px] uppercase tracking-wider px-4 py-2 rounded-xl cursor-pointer transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                  >
                    {noteSaved ? 'Saved ✓' : 'Save Note'}
                  </button>
                </div>
              </div>

              {/* Lead Activities Overview */}
              <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-5">
                <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-slate-300 mb-3 block">Lead Activities Overview</span>
                <div className="flex flex-wrap gap-3">
                  <div className="bg-cyan-500/[0.06] border border-cyan-500/20 rounded-xl px-4 py-3 flex items-center gap-3 w-fit">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    <span className="text-lg font-black text-slate-100 font-mono">{lead.siteVisitScheduled ? 1 : 0}</span>
                    <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Site Visits Scheduled</span>
                  </div>
                  <div
                    onClick={() => (lead.recordings?.length || 0) > 0 && setFeedTab('Recordings')}
                    className={`bg-fuchsia-500/[0.06] border border-fuchsia-500/20 rounded-xl px-4 py-3 flex items-center gap-3 w-fit ${(lead.recordings?.length || 0) > 0 ? 'cursor-pointer hover:bg-fuchsia-500/[0.1]' : ''}`}
                  >
                    <Mic className="w-4 h-4 text-fuchsia-400" />
                    <span className="text-lg font-black text-slate-100 font-mono">{lead.recordings?.length || 0}</span>
                    <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Call Recordings</span>
                  </div>
                </div>
              </div>

              {/* Feed tabs + content */}
              <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center gap-4 border-b border-white/5 overflow-x-auto scrollbar-none">
                  {(['Activity', 'Starred', 'Notes', 'Site visit', 'Feed', 'Followups', 'Whatsapp', 'Recordings', 'History'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => { setFeedTab(t); playBeep(500, 0.04); }}
                      className={`pb-2.5 text-[10px] font-mono font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer border-b-2 transition-all ${feedTab === t ? 'text-cyan-300 border-cyan-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* --- Activity / Feed: real activity-log timeline for this lead --- */}
                {(feedTab === 'Activity' || feedTab === 'Feed') && (
                  <div className="flex flex-col gap-0 relative pl-1">
                    {[
                      { icon: Flag, color: 'text-orange-400 bg-orange-500/15', title: `Stage: ${lead.status}`, time: lead.dateTime, by: 'System' },
                      { icon: UserCheck, color: 'text-indigo-400 bg-indigo-500/15', title: `Lead ingested from ${lead.source}`, time: lead.dateTime, by: 'System' },
                      { icon: CalendarClock, color: 'text-cyan-400 bg-cyan-500/15', title: `Next follow-up scheduled for ${lead.nextFollowUpDate}`, time: lead.dateTime, by: lead.owner || 'Aman Kumar' },
                    ].map((item, i, arr) => (
                      <div key={i} className="flex gap-3 pb-5 relative">
                        {i < arr.length - 1 && <div className="absolute left-[13px] top-7 bottom-0 w-px bg-white/10" />}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 ${item.color}`}>
                          <item.icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-xl p-3">
                          <p className="text-[11px] text-slate-200 font-sans font-semibold">{item.title}</p>
                          <p className="text-[9px] text-slate-500 font-mono mt-0.5">{item.time} · {item.by}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {feedTab === 'Starred' && (
                  <div className="text-center py-8 text-[11px] text-slate-500 font-mono">No starred activities yet.</div>
                )}

                {feedTab === 'Notes' && (
                  <div className="text-[11px] text-slate-300 font-sans leading-relaxed" dangerouslySetInnerHTML={{ __html: lead.note || '<span class="text-slate-500 font-mono text-[10px]">No notes saved yet — use the editor above.</span>' }} />
                )}

                {feedTab === 'Site visit' && (
                  <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-[11px] text-slate-300 font-mono">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                      {lead.siteVisitScheduled || 'No site visit scheduled'}
                    </div>
                    <button
                      onClick={() => { const d = new Date(); d.setDate(d.getDate() + 3); const val = d.toISOString().split('T')[0]; updateLeadInList(lead.id, { siteVisitScheduled: val }); triggerToast(`Site visit scheduled for ${val}`, 'success'); playBeep(700, 0.08); }}
                      className="text-[9px] font-mono font-bold uppercase bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-3 py-1.5 rounded-lg cursor-pointer"
                    >
                      Schedule Visit
                    </button>
                  </div>
                )}

                {feedTab === 'Followups' && (
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-center gap-3">
                    <CalendarClock className="w-4 h-4 text-amber-400" />
                    <div>
                      <p className="text-[11px] text-slate-200 font-sans font-semibold">Next follow-up: {lead.nextFollowUpDate}</p>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5">Timeline: {lead.timeline}</p>
                    </div>
                  </div>
                )}

                {feedTab === 'Whatsapp' && (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Message', sent: lead.whatsappSent },
                      { label: 'Brochure', sent: lead.brochureSent },
                      { label: 'Price Sheet', sent: lead.priceSheetSent },
                    ].map((it, i) => (
                      <div key={i} className={`rounded-lg border p-3 text-center ${it.sent ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-white/[0.02] border-white/5 text-slate-500'}`}>
                        <p className="text-[9px] font-mono uppercase">{it.label}</p>
                        <p className="text-[10px] font-bold mt-1">{it.sent ? 'Sent' : 'Not sent'}</p>
                      </div>
                    ))}
                  </div>
                )}

                {feedTab === 'Recordings' && (
                  <div className="flex flex-col gap-3">
                    {(!lead.recordings || lead.recordings.length === 0) ? (
                      <div className="text-center py-8 text-[11px] text-slate-500 font-mono">
                        No call recordings for this lead yet.
                      </div>
                    ) : (
                      lead.recordings.map((rec) => (
                        <div key={rec.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 flex flex-col gap-2.5">
                          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                            <span className="flex items-center gap-1.5 text-fuchsia-300 font-bold">
                              <Mic className="w-3 h-3" /> {rec.date}
                            </span>
                            <span>{rec.duration}</span>
                          </div>

                          {rec.url ? (
                            <audio
                              controls
                              preload="none"
                              src={getRecordingProxyUrl(rec.url)}
                              className="w-full h-9"
                              style={{ colorScheme: 'dark' }}
                            />
                          ) : (
                            <span className="text-[9px] font-mono text-slate-600 italic">No audio available for this call.</span>
                          )}

                          {rec.summary && (
                            <p className="text-[10px] text-slate-300 font-sans leading-relaxed">{rec.summary}</p>
                          )}

                          {rec.transcript && (
                            <button
                              onClick={() => setExpandedRecordingId(prev => prev === rec.id ? null : rec.id)}
                              className="text-[9px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 self-start cursor-pointer"
                            >
                              {expandedRecordingId === rec.id ? <ChevronDown className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3 -rotate-90" />}
                              {expandedRecordingId === rec.id ? 'Hide transcript' : 'View transcript'}
                            </button>
                          )}
                          {expandedRecordingId === rec.id && rec.transcript && (
                            <div className="bg-slate-950/50 border border-white/5 rounded-lg p-3 text-[9px] font-mono text-slate-400 whitespace-pre-wrap max-h-[180px] overflow-y-auto leading-relaxed">
                              {rec.transcript}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {feedTab === 'History' && (
                  <div className="flex flex-col gap-2 text-[10px] font-mono text-slate-400">
                    <div className="flex justify-between border-b border-white/5 pb-1.5"><span>Call duration</span><span className="text-slate-200">{lead.callDuration}</span></div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5"><span>Last contact</span><span className="text-slate-200">{lead.lastContactTime}</span></div>
                    <div className="flex justify-between"><span>Current status</span><span className="text-slate-200">{lead.status}</span></div>
                  </div>
                )}
              </div>

            </div>

          </div>

          </div>
        ) : (
          /* SYSTEM SUB-TABS (FALLBACK STATES TO PREVENT VOID RENDER) */
          <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-8 text-center text-slate-400 font-mono">
            <Cpu className="w-10 h-10 text-cyan-400 mx-auto mb-3 animate-spin-slow" />
            <h3 className="text-xs uppercase font-black tracking-widest text-cyan-300 mb-1">Module Active under AI Control</h3>
            <p className="text-[10px] text-slate-500">Autonomous voice handovers active for {lead.name}</p>
            <button 
              onClick={() => setActiveSubTab('overview')} 
              className="mt-4 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-bold uppercase rounded-xl border border-cyan-500/30 cursor-pointer"
            >
              Return to overview Hub
            </button>
          </div>
        )}

      </div>

    </div>
  );
}
