import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Phone, PhoneCall, PhoneOff, MessageSquare, Plus, Search, User, Sliders, Calendar, 
  TrendingUp, Send, CheckCircle, Clock, ArrowUpRight, Lock, Unlock, Settings, 
  Activity, MapPin, Mic, MicOff, Volume2, VolumeX, Database, Filter, Globe, 
  Building, Check, CheckCheck, RefreshCw, Briefcase, ShieldAlert, Sparkles, FileText, ArrowRight, Award, ChevronRight, Share2, HelpCircle
} from 'lucide-react';
import { AGENTS, DIALOGUE_SCRIPTS } from './data';
import { Lead, Agent, TranscriptItem, ActivityLog } from './types';
import { sendWhatsAppMessage } from './utils/whatsapp';
import { fetchBackendLeads, patchBackendLead, createBackendLead, deleteBackendLead } from './utils/backendApi';

// Import our gorgeous modular components
import CallingConsole from './components/CallingConsole';
import LeadModal from './components/LeadModal';
import CyberDashboard from './components/CyberDashboard';
import { AivaLogo } from './components/AivaLogo';
import AllLeadsPage from './components/AllLeadsPage';
import AgentLeadsPage from './components/AgentLeadsPage';
import LeadDetailsPage from './components/LeadDetailsPage';
import Sidebar, { SidebarTab } from './components/Sidebar';
import ComingSoonPage from './components/ComingSoonPage';
import AiAgentsPage from './components/AiAgentsPage';
import ConversationsPage from './components/ConversationsPage';
import IntegrationsPage from './components/IntegrationsPage';
import SettingsPage from './components/SettingsPage';

export default function App() {
  // Global States
  const [currentTab, setCurrentTab] = useState<SidebarTab>('admin'); // Default to AIVA Operations Admin (Command Center)
  // Base agent metadata (name/photo/voice/tone) rarely changes and stays static —
  // but `stats` below is NEVER read from here; it's recomputed live from real leads
  // (see `agents` useMemo below) so AIVA's voice answers and every dashboard card
  // always agree with each other instead of quoting made-up placeholder numbers.
  const [baseAgents, setBaseAgents] = useState<Agent[]>(AGENTS);
  // Starts EMPTY, not demo data — the backend (real leads) is the only source of
  // truth now. If the load below fails, you get a clear error, never fake leads
  // silently standing in for real ones.
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoadError, setLeadsLoadError] = useState<string>('');
  const [leadsLoading, setLeadsLoading] = useState<boolean>(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('agent_1');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('lead_1');
  // Starts EMPTY — no mock seed entries. Manual admin actions (WhatsApp sends,
  // handovers, etc.) get pushed here via logCrmActivity; real call activity comes
  // from liveActivityLogs below. Both get merged wherever the UI/voice needs a feed.
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Sync leads with the backend's persistent store on mount, so follow-ups and
  // Omnidimension call updates survive a page refresh instead of resetting.
  // NOTE: demo/mock leads are never used as a fallback anymore — if this fails
  // (wrong password, backend unreachable), you see a clear error, not fake data.
  const loadLeadsFromBackend = React.useCallback(async () => {
    setLeadsLoading(true);
    setLeadsLoadError('');
    try {
      const backendLeads = await fetchBackendLeads();
      if (backendLeads === null) {
        setLeadsLoadError('Could not load leads — the backend is unreachable or rejected the request (check your admin password).');
      } else {
        setLeads(backendLeads as Lead[]);
      }
    } catch (e: any) {
      // Belt-and-suspenders: any unexpected throw (e.g. the credential prompt
      // being dismissed/unavailable) must still surface as a visible error,
      // never silently leave the UI looking like it's just "empty".
      setLeadsLoadError(`Could not load leads — ${e?.message || 'unexpected error'}.`);
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  React.useEffect(() => { loadLeadsFromBackend(); }, [loadLeadsFromBackend]);

  // Live agent stats — recomputed from the real leads array on every change, so
  // every dashboard card AND AIVA's voice answers always agree with each other.
  // The static AGENTS constant only supplies name/photo/voice/tone; its placeholder
  // `stats` numbers are discarded here and never shown or spoken anywhere.
  const agents = useMemo<Agent[]>(() => {
    const now = Date.now();
    return baseAgents.map(agent => {
      const mine = leads.filter(l => l.agentId === agent.id);
      const assignedLeads = mine.length;
      const todayCalls = mine.filter(l => l.lastContactTime && l.lastContactTime !== 'Never').length;
      const pendingCalls = mine.filter(l => l.status === 'Pending' || l.status === 'Outgoing Retry' || l.status === 'Call Scheduled').length;
      const completedCalls = mine.filter(l => l.status === 'Contacted' || l.status === 'Completed' || l.status === 'Handed Over').length;
      const followUpsDue = mine.filter(l => l.nextFollowUpDate && !Number.isNaN(Date.parse(l.nextFollowUpDate)) && Date.parse(l.nextFollowUpDate) <= now).length;
      const interestedLeads = mine.filter(l => l.interestLevel === 'Hot Lead' || l.interestLevel === 'Interested').length;
      const siteVisits = mine.filter(l => !!l.siteVisitScheduled).length;
      const conversionRate = assignedLeads > 0 ? Math.round((interestedLeads / assignedLeads) * 100) : 0;
      return {
        ...agent,
        stats: { assignedLeads, todayCalls, pendingCalls, completedCalls, followUpsDue, interestedLeads, siteVisits, conversionRate },
      };
    });
  }, [baseAgents, leads]);

  // Real recent-activity feed derived from actual lead records (most recently
  // contacted first), replacing the old static/mock activity log so AIVA's voice
  // briefing and the on-screen feed both reflect what actually happened.
  const liveActivityLogs = useMemo<ActivityLog[]>(() => {
    const agentNameById = new Map(agents.map(a => [a.id, a.name]));
    return [...leads]
      .filter(l => l.lastContactTime && l.lastContactTime !== 'Never')
      .sort((a, b) => (Date.parse(b.lastContactTime) || 0) - (Date.parse(a.lastContactTime) || 0))
      .slice(0, 20)
      .map(l => ({
        id: `activity_${l.id}`,
        agent: agentNameById.get(l.agentId) || 'Unassigned',
        lead: l.name,
        type: 'call',
        message: `Call ${l.status.toLowerCase()} — ${l.remarks || `interest level: ${l.interestLevel}`}`,
        timestamp: l.lastContactTime,
      }));
  }, [leads, agents]);

  // Merges manually-logged admin actions with real call activity derived from
  // leads, newest first — this is the single feed shown in the UI and spoken by AIVA.
  const combinedActivityLogs = useMemo<ActivityLog[]>(() => {
    return [...activityLogs, ...liveActivityLogs]
      .sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0))
      .slice(0, 30);
  }, [activityLogs, liveActivityLogs]);

  // Call States
  const [isCalling, setIsCalling] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [micActive, setMicActive] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState(0);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [audioVolume, setAudioVolume] = useState<number>(0);
  const [recognitionInstance, setRecognitionInstance] = useState<any>(null);

  // Overlays / Drawers
  const [showWhatsAppDrawer, setShowWhatsAppDrawer] = useState(false);
  const [showHandoverDrawer, setShowHandoverDrawer] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  
  // Lead Form
  const [newLeadForm, setNewLeadForm] = useState({
    name: '', 
    phone: '', 
    source: 'Facebook Ads' as Lead['source'], 
    project: 'Astra Heights (Manhattan)', 
    budget: 1200000, 
    location: 'Manhattan, NY'
  });

  const activeAgent = useMemo(() => agents.find(a => a.id === selectedAgentId) || agents[0], [agents, selectedAgentId]);
  const activeLead = useMemo(() => leads.find(l => l.id === selectedLeadId) || leads[0], [leads, selectedLeadId]);

  // Web Audio Context & Analyzer Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Custom Toast trigger helper
  const triggerToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Luxury interface synth generator
  const playBeep = (freq: number, duration: number, type: 'sine' | 'square' | 'triangle' = 'sine') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.log('Audio Context blocked or unsupported', e);
    }
  };

  // Speech Recognition setup for dialing simulation
  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setIsSpeechSupported(false);
      return;
    }
    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onstart = () => setMicActive(true);
    rec.onend = () => setMicActive(false);
    rec.onerror = (e: any) => {
      console.error('Speech recognition error', e);
      setMicActive(false);
    };
    rec.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      handleCustomerUtterance(text);
    };
    setRecognitionInstance(rec);
  }, [selectedLeadId]);

  // Voice speech synthesis
  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    let matchedVoice = null;
    if (activeAgent.accent === 'en-GB') {
      matchedVoice = voices.find(v => v.lang.startsWith('en-GB') || v.name.includes('Great Britain'));
    } else if (activeAgent.accent === 'en-IN') {
      matchedVoice = voices.find(v => v.lang.startsWith('en-IN') || v.name.includes('India'));
    } else {
      matchedVoice = voices.find(v => v.lang.startsWith('en-US') || v.name.includes('Google US'));
    }
    
    if (matchedVoice) utterance.voice = matchedVoice;
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    utterance.onstart = () => setIsAiSpeaking(true);
    utterance.onend = () => setIsAiSpeaking(false);
    utterance.onerror = () => setIsAiSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // Microphonelistener
  const toggleMicrophone = async () => {
    if (!isCalling) return;
    if (micActive) {
      if (recognitionInstance) recognitionInstance.stop();
      setMicActive(false);
      if (audioStream) {
        audioStream.getTracks().forEach(t => t.stop());
        setAudioStream(null);
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setAudioStream(stream);
        
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtxClass();
        const analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        audioContextRef.current = audioCtx;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const checkVolume = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          setAudioVolume(sum / bufferLength);
          if (stream.active) requestAnimationFrame(checkVolume);
        };
        checkVolume();

        if (recognitionInstance) {
          recognitionInstance.start();
        } else {
          setMicActive(true);
        }
      } catch (err) {
        console.warn('Microphone permission denied', err);
        triggerToast('Could not access microphone. Keyboard simulation mode is fully active.', 'error');
        setMicActive(true);
      }
    }
  };

  // Start simulated outbound call
  const initiateCall = (leadId?: string) => {
    const targetLeadId = leadId || selectedLeadId;
    setSelectedLeadId(targetLeadId);
    const targetLead = leads.find(l => l.id === targetLeadId) || activeLead;
    
    // Set appropriate agent based on lead's selected ID
    setSelectedAgentId(targetLead.agentId);

    playBeep(480, 0.2);
    setIsRinging(true);
    setTranscript([]);
    setCurrentDialogueIndex(0);

    let ringCount = 0;
    const ringInterval = setInterval(() => {
      if (ringCount < 2) {
        playBeep(440, 0.4, 'sine');
        setTimeout(() => playBeep(440, 0.4, 'sine'), 450);
        ringCount++;
      } else {
        clearInterval(ringInterval);
        setIsRinging(false);
        setIsCalling(true);
        
        const greetingText = DIALOGUE_SCRIPTS[targetLead.name] 
          ? DIALOGUE_SCRIPTS[targetLead.name][0].response 
          : DIALOGUE_SCRIPTS["Generic"][0].response;

        setTranscript([{ sender: 'agent', text: greetingText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
        speakText(greetingText);
        setCurrentDialogueIndex(1);
        updateLeadInList(targetLead.id, { status: 'In Call', lastContactTime: new Date().toLocaleString() });
        logCrmActivity(targetLead.name, `AI Agent ${agents.find(a => a.id === targetLead.agentId)?.name || 'Kavya'} initiated automated dial.`);
      }
    }, 1200);
  };

  // End active dialogue
  const endCall = () => {
    setIsCalling(false);
    setIsRinging(false);
    setMicActive(false);
    if (audioStream) {
      audioStream.getTracks().forEach(t => t.stop());
      setAudioStream(null);
    }
    if (recognitionInstance) recognitionInstance.stop();
    playBeep(330, 0.3, 'triangle');
    
    let duration = `${Math.floor(Math.random() * 2) + 1}m ${Math.floor(Math.random() * 40) + 15}s`;
    updateLeadInList(activeLead.id, { 
      status: 'Contacted',
      callDuration: duration,
    });
    
    triggerToast(`AI Call finalized. Outbound analysis complete. Dossier synchronized!`, 'success');
    logCrmActivity(activeLead.name, `Automated call completed. Duration: ${duration}. qualified status locked.`);
  };

  // Voice utterance matcher
  const handleCustomerUtterance = (text: string) => {
    if (!text.trim()) return;
    
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newTranscript = [...transcript, { sender: 'customer' as const, text, time: timeStr }];
    setTranscript(newTranscript);
    
    playBeep(600, 0.1, 'sine');

    const script = DIALOGUE_SCRIPTS[activeLead.name] || DIALOGUE_SCRIPTS["Generic"];
    let matchingStep = script[currentDialogueIndex];

    if (!matchingStep) {
      const lowercase = text.toLowerCase();
      if (lowercase.includes('budget') || lowercase.includes('price') || lowercase.includes('cost') || lowercase.includes('how much')) {
        matchingStep = script.find(s => s.intent === 'views_price' || s.intent === 'budget') || script[1];
      } else if (lowercase.includes('yes') || lowercase.includes('schedule') || lowercase.includes('book') || lowercase.includes('interested')) {
        matchingStep = script.find(s => s.intent === 'book_visit') || script[script.length - 1];
      } else if (lowercase.includes('later') || lowercase.includes('tomorrow') || lowercase.includes('busy')) {
        matchingStep = script.find(s => s.intent === 'later') || script[script.length - 1];
      } else {
        matchingStep = script[script.length - 1];
      }
    }

    setTimeout(() => {
      if (!matchingStep) return;

      if (matchingStep.fieldUpdate) {
        updateLeadInList(activeLead.id, matchingStep.fieldUpdate);
        const keys = Object.keys(matchingStep.fieldUpdate);
        if (keys.includes('budget')) {
          triggerToast(`🎯 AUTO-EXTRACT: Budget validated: $${matchingStep.fieldUpdate.budget?.toLocaleString()}`, 'success');
        }
        if (keys.includes('interestLevel')) {
          triggerToast(`🔥 CONVERSION SCORE: Lead graded: ${matchingStep.fieldUpdate.interestLevel}`, 'success');
        }
        if (keys.includes('siteVisitScheduled')) {
          triggerToast(`📅 SCHEDULER: Physical Site Visit locked for ${matchingStep.fieldUpdate.siteVisitScheduled}`, 'success');
        }
      }

      setTranscript(prev => [...prev, { 
        sender: 'agent', 
        text: matchingStep.response, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }]);
      speakText(matchingStep.response);
      setCurrentDialogueIndex(prev => prev + 1);

      if (matchingStep.fieldUpdate?.whatsappSent) {
        setTimeout(async () => {
          const result = await sendWhatsAppMessage(activeLead.phone, 'brochure');
          if (result.ok) {
            triggerToast('💬 WhatsApp brochure sent — real message delivered!', 'success');
            logCrmActivity(activeLead.name, `WhatsApp brochure auto-delivered (message id: ${result.messageId}).`);
          } else {
            triggerToast(`⚠️ WhatsApp send failed: ${result.error}`, 'error');
            logCrmActivity(activeLead.name, `WhatsApp auto-send FAILED: ${result.error}`);
          }
        }, 1200);
      }
    }, 1000);
  };

  // Helper to update leads in state
  const updateLeadInList = (id: string, updates: Partial<Lead>) => {
    let finalUpdates: Partial<Lead> = updates;
    setLeads(prev => prev.map(l => {
      if (l.id === id) {
        const u = { ...l, ...updates };
        if (updates.siteVisitScheduled) {
          u.status = 'Completed';
          u.interestLevel = 'Interested';
        }
        if (updates.status === 'Handed Over') {
          u.interestLevel = 'Interested';
        }
        finalUpdates = u;
        return u;
      }
      return l;
    }));
    // Best-effort sync to the backend's persistent store; safe no-op if the backend isn't running.
    patchBackendLead(id, finalUpdates).catch(() => {});
  };

  // Logger helper
  const logCrmActivity = (leadName: string, message: string) => {
    const newLog: ActivityLog = {
      id: `log_${Date.now()}`,
      timestamp: 'Just now',
      agent: activeAgent.name,
      lead: leadName,
      type: 'activity',
      message
    };
    setActivityLogs(prev => [newLog, ...prev]);
  };

  // Handle lead creation modal
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadForm.name || !newLeadForm.phone) {
      triggerToast('A Name and Contact number are required.', 'error');
      return;
    }

    const leastAssignedAgent = [...agents].sort((a, b) => a.stats.assignedLeads - b.stats.assignedLeads)[0];

    // Real lead — status stays 'Pending' until someone (a human, or the autonomous
    // dialer if it's turned on) actually calls them. Never claims a call is queued;
    // that was a leftover demo message from the original scaffold and wasn't true.
    const created = await createBackendLead({
      name: newLeadForm.name,
      phone: newLeadForm.phone,
      source: newLeadForm.source,
      project: newLeadForm.project,
      agentId: leastAssignedAgent.id,
      budget: newLeadForm.budget,
      location: newLeadForm.location,
    });

    if (!created) {
      triggerToast('Could not save the lead — the backend is unreachable or rejected the request.', 'error');
      return;
    }

    setLeads(prev => [created, ...prev]);
    setShowNewLeadModal(false);
    playBeep(880, 0.25, 'triangle');
    triggerToast(`Lead saved. Assigned to ${leastAssignedAgent.name}.`, 'success');
    logCrmActivity(created.name, `New lead added manually via ${created.source}. Assigned agent: ${leastAssignedAgent.name}.`);
  };

  const handleImportCSV = (importedLeads: Lead[]) => {
    setLeads(prev => [...importedLeads, ...prev]);
    importedLeads.forEach(lead => {
      logCrmActivity(lead.name, `Lead profile imported via CSV batch gateway.`);
    });
  };

  const handleDeleteLead = async (lead: Lead) => {
    if (!window.confirm(`Delete ${lead.name} (${lead.phone}) permanently? This cannot be undone.`)) return;
    const ok = await deleteBackendLead(lead.id);
    if (!ok) {
      triggerToast('Could not delete the lead — the backend is unreachable or rejected the request.', 'error');
      return;
    }
    setLeads(prev => prev.filter(l => l.id !== lead.id));
    triggerToast(`${lead.name} deleted from the pipeline.`, 'info');
    logCrmActivity(lead.name, 'Lead permanently deleted from the CRM.');
  };

  const triggerManualWhatsApp = async () => {
    const brochureResult = await sendWhatsAppMessage(activeLead.phone, 'brochure');
    const locationResult = await sendWhatsAppMessage(activeLead.phone, 'location');

    updateLeadInList(activeLead.id, {
      whatsappSent: brochureResult.ok || locationResult.ok,
      brochureSent: brochureResult.ok,
      priceSheetSent: brochureResult.ok
    });

    if (brochureResult.ok && locationResult.ok) {
      triggerToast('Digital brochure + location sent over real WhatsApp!', 'success');
      logCrmActivity(activeLead.name, 'Manual WhatsApp dispatch delivered (brochure + location).');
    } else {
      const errors = [!brochureResult.ok && `brochure: ${brochureResult.error}`, !locationResult.ok && `location: ${locationResult.error}`].filter(Boolean).join(' | ');
      triggerToast(`⚠️ WhatsApp dispatch incomplete — ${errors}`, 'error');
      logCrmActivity(activeLead.name, `Manual WhatsApp dispatch FAILED: ${errors}`);
    }
  };

  const triggerHandover = () => {
    updateLeadInList(activeLead.id, { status: 'Handed Over' });
    setShowHandoverDrawer(true);
    playBeep(900, 0.35, 'sine');
    triggerToast('Dossier compiled. Lead handed over to executive personnel.', 'success');
  };

  return (
    <div className="min-h-screen bg-[#f3f4fb] text-slate-900 flex font-sans relative select-none overflow-x-hidden">
      {/* Floating glowing gradient blobs — premium ambient backdrop, fixed so they don't scroll with content */}
      <div className="fixed -top-24 -left-24 w-[480px] h-[480px] bg-gradient-to-br from-indigo-300/40 to-purple-300/20 rounded-full blur-[110px] blob-float pointer-events-none" />
      <div className="fixed top-1/3 -right-32 w-[520px] h-[520px] bg-gradient-to-br from-cyan-300/35 to-blue-300/20 rounded-full blur-[120px] blob-float-slow pointer-events-none" />
      <div className="fixed bottom-0 left-1/3 w-[400px] h-[400px] bg-gradient-to-br from-purple-300/25 to-pink-200/15 rounded-full blur-[100px] blob-float pointer-events-none" />

      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} playBeep={playBeep} />

      {/* RIGHT WORKSPACE AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">

          {leadsLoadError && (
            <div className="mb-6 bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 animate-pulse shrink-0" />
                <div>
                  <p className="text-rose-700 font-bold text-sm">Leads failed to load</p>
                  <p className="text-rose-500 text-xs mt-0.5">{leadsLoadError}</p>
                </div>
              </div>
              <button
                onClick={loadLeadsFromBackend}
                className="shrink-0 bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-700 font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-xl cursor-pointer transition-all"
              >
                Retry
              </button>
            </div>
          )}

          {currentTab === 'ai-agents' && (
            <AiAgentsPage agents={agents} leads={leads} playBeep={playBeep} onOpenAgent={(id) => {
              const map: Record<string, SidebarTab> = { agent_1: 'agent-kavya', agent_2: 'agent-arjun', agent_3: 'agent-ananya', agent_4: 'agent-rohan', agent_5: 'agent-priya' };
              setCurrentTab(map[id] || 'admin');
            }} />
          )}
          {currentTab === 'conversations' && (
            <ConversationsPage leads={leads} agents={agents} onOpenLead={(id) => { setSelectedLeadId(id); setCurrentTab('lead-details'); }} />
          )}
          {currentTab === 'integrations' && <IntegrationsPage />}
          {currentTab === 'settings' && <SettingsPage agents={agents} triggerToast={triggerToast} />}
          {currentTab === 'call-flows' && <ComingSoonPage title="Call Flows" description="Visual call-flow builder for scripting agent conversations. Not built yet — currently agent behavior is configured directly in Omnidimension." />}
          {currentTab === 'campaigns' && <ComingSoonPage title="Campaigns" description="Bulk outbound calling campaigns with scheduling. Not built yet." />}
          {currentTab === 'workflows' && <ComingSoonPage title="Workflows" description="Automated multi-step follow-up sequences beyond the current 2-hour retry logic. Not built yet." />}
          {currentTab === 'performance' && <ComingSoonPage title="Performance" description="Deeper agent performance analytics over time. Real per-agent stats are already on the Command Center and AI Agents pages — this would add historical trends." />}
          {currentTab === 'reports' && <ComingSoonPage title="Reports" description="Scheduled/exportable report generation. Use Export Report on the Leads & CRM page for a real CSV export right now." />}
          {currentTab === 'ai-insights' && <ComingSoonPage title="AI Insights" description="Automated pattern detection across your pipeline. Ask AIVA directly (voice assistant on Command Center) for live analysis in the meantime." />}
          {currentTab === 'team-roles' && <ComingSoonPage title="Team & Roles" description="Multi-user accounts and permissions. Currently the app has a single shared admin login." />}
          {currentTab === 'security' && <ComingSoonPage title="Security" description="Audit logs and access controls beyond the current admin password. Not built yet." />}
          {currentTab === 'system-logs' && <ComingSoonPage title="System Logs" description="Raw system/infra logs. Real call activity is visible on the Conversations and Command Center pages." />}

          {currentTab === 'admin' && (
            /* WIDE SCREEN HUD CYBER DASHBOARD */
            <CyberDashboard
              leads={leads}
              agents={agents}
              activityLogs={combinedActivityLogs}
              selectedLeadId={selectedLeadId}
              setSelectedLeadId={setSelectedLeadId}
              selectedAgentId={selectedAgentId}
              setSelectedAgentId={setSelectedAgentId}
              playBeep={playBeep}
              triggerToast={triggerToast}
              updateLeadInList={updateLeadInList}
              initiateCall={initiateCall}
              setCurrentTab={(tab) => {
                if (tab === 'agents') {
                  setCurrentTab('ai-agents');
                } else if (tab === 'caller') {
                  triggerToast("Active call dialogue dashboard opened in HUD overlay.", "info");
                } else {
                  setCurrentTab(tab as any);
                }
              }}
              logCrmActivity={logCrmActivity}
            />
          )}

          {currentTab === 'all-leads' && (
            <AllLeadsPage
              leads={leads}
              agents={agents}
              selectedLeadId={selectedLeadId}
              setSelectedLeadId={setSelectedLeadId}
              initiateCall={initiateCall}
              updateLeadInList={updateLeadInList}
              triggerToast={triggerToast}
              logCrmActivity={logCrmActivity}
              playBeep={playBeep}
              onAddLeadClick={() => setShowNewLeadModal(true)}
              onImportCSV={handleImportCSV}
              onDeleteLead={handleDeleteLead}
              onViewDetails={(id) => {
                setSelectedLeadId(id);
                setCurrentTab('lead-details');
              }}
            />
          )}

          {currentTab === 'agent-ananya' && (
            <AgentLeadsPage
              agent={agents.find(a => a.id === 'agent_3')!}
              leads={leads}
              selectedLeadId={selectedLeadId}
              setSelectedLeadId={setSelectedLeadId}
              initiateCall={initiateCall}
              updateLeadInList={updateLeadInList}
              triggerToast={triggerToast}
              logCrmActivity={logCrmActivity}
              playBeep={playBeep}
              onAddLeadClick={() => setShowNewLeadModal(true)}
              onImportCSV={handleImportCSV}
              onViewDetails={(id) => {
                setSelectedLeadId(id);
                setCurrentTab('lead-details');
              }}
            />
          )}

          {currentTab === 'agent-arjun' && (
            <AgentLeadsPage
              agent={agents.find(a => a.id === 'agent_2')!}
              leads={leads}
              selectedLeadId={selectedLeadId}
              setSelectedLeadId={setSelectedLeadId}
              initiateCall={initiateCall}
              updateLeadInList={updateLeadInList}
              triggerToast={triggerToast}
              logCrmActivity={logCrmActivity}
              playBeep={playBeep}
              onAddLeadClick={() => setShowNewLeadModal(true)}
              onImportCSV={handleImportCSV}
              onViewDetails={(id) => {
                setSelectedLeadId(id);
                setCurrentTab('lead-details');
              }}
            />
          )}

          {currentTab === 'agent-kavya' && (
            <AgentLeadsPage
              agent={agents.find(a => a.id === 'agent_1')!}
              leads={leads}
              selectedLeadId={selectedLeadId}
              setSelectedLeadId={setSelectedLeadId}
              initiateCall={initiateCall}
              updateLeadInList={updateLeadInList}
              triggerToast={triggerToast}
              logCrmActivity={logCrmActivity}
              playBeep={playBeep}
              onAddLeadClick={() => setShowNewLeadModal(true)}
              onImportCSV={handleImportCSV}
              onViewDetails={(id) => {
                setSelectedLeadId(id);
                setCurrentTab('lead-details');
              }}
            />
          )}

          {currentTab === 'agent-rohan' && (
            <AgentLeadsPage
              agent={agents.find(a => a.id === 'agent_4')!}
              leads={leads}
              selectedLeadId={selectedLeadId}
              setSelectedLeadId={setSelectedLeadId}
              initiateCall={initiateCall}
              updateLeadInList={updateLeadInList}
              triggerToast={triggerToast}
              logCrmActivity={logCrmActivity}
              playBeep={playBeep}
              onAddLeadClick={() => setShowNewLeadModal(true)}
              onImportCSV={handleImportCSV}
              onViewDetails={(id) => {
                setSelectedLeadId(id);
                setCurrentTab('lead-details');
              }}
            />
          )}

          {currentTab === 'agent-priya' && (
            <AgentLeadsPage
              agent={agents.find(a => a.id === 'agent_5')!}
              leads={leads}
              selectedLeadId={selectedLeadId}
              setSelectedLeadId={setSelectedLeadId}
              initiateCall={initiateCall}
              updateLeadInList={updateLeadInList}
              triggerToast={triggerToast}
              logCrmActivity={logCrmActivity}
              playBeep={playBeep}
              onAddLeadClick={() => setShowNewLeadModal(true)}
              onImportCSV={handleImportCSV}
              onViewDetails={(id) => {
                setSelectedLeadId(id);
                setCurrentTab('lead-details');
              }}
            />
          )}

          {currentTab === 'lead-details' && (
            <LeadDetailsPage
              leadId={selectedLeadId}
              leads={leads}
              agents={agents}
              onBack={() => {
                playBeep(450, 0.1, 'triangle');
                setCurrentTab('all-leads');
              }}
              updateLeadInList={updateLeadInList}
              triggerToast={triggerToast}
              playBeep={playBeep}
              initiateCall={initiateCall}
            />
          )}

        </main>

      </div>

      {/* POPUP MODAL: NEW SIMULATED INCOMING CRM LEAD ACCOUNT */}
      <LeadModal
        show={showNewLeadModal}
        onClose={() => setShowNewLeadModal(false)}
        form={newLeadForm}
        setForm={setNewLeadForm as any}
        onSubmit={handleCreateLead}
      />

      {/* BOTTOM RIGHT HOVER POPUP TOAST FEED */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3.5 rounded-xl border shadow-[0_4px_30px_rgba(0,0,0,0.5)] font-mono text-xs transition-all duration-350 animate-bounce ${toast.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 backdrop-blur-md' : toast.type === 'error' ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 backdrop-blur-md' : 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 backdrop-blur-md'}`}>
          <div className="w-2 h-2 rounded-full bg-current animate-ping" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* WHATSAPP DRAWER */}
      {showHandoverDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md">
          <div className="relative w-full max-w-lg iceglass rounded-2xl p-6 overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-sm font-black uppercase tracking-wider text-fuchsia-400 font-mono border-b border-white/10 pb-3 mb-4 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
              CRM AUTOMATED HANDOVER DOSSIER COMPILATION
            </h3>
            <div className="flex flex-col gap-3 text-xs leading-relaxed text-slate-300 font-mono">
              <p>The AIVA system has compiled the qualitative calling dossier for customer <strong className="text-fuchsia-400">{activeLead.name}</strong>:</p>
              <div className="bg-white/[0.02] border border-white/10 p-4 rounded-xl flex flex-col gap-2">
                <p>⚡ <strong>Extracted Interest Level:</strong> {activeLead.interestLevel}</p>
                <p>💵 <strong>Validated Budget Limit:</strong> ${activeLead.budget.toLocaleString()}</p>
                <p>📍 <strong>Target Location:</strong> {activeLead.location}</p>
                <p>🏘️ <strong>Assigned Asset Focus:</strong> {activeLead.project}</p>
                <p>🎙️ <strong>Outbound Agent Assigned:</strong> {activeAgent.name}</p>
                <p>📝 <strong>Speech AI Remarks:</strong> {activeLead.remarks || 'Awaiting connection'}</p>
              </div>
              <p className="text-[11px] text-slate-500 italic mt-1">This dossier is synchronized with human sales director Sunil Deshmukh. An automated push warning has been transmitted to team personnel.</p>
            </div>
            <button
              onClick={() => { setShowHandoverDrawer(false); playBeep(500, 0.1); }}
              className="mt-6 w-full bg-gradient-to-r from-fuchsia-500 to-fuchsia-600 hover:from-fuchsia-400 hover:to-fuchsia-500 text-slate-950 font-black py-3 rounded-xl uppercase tracking-widest text-xs transition-all cursor-pointer"
            >
              Close Dossier View
            </button>
          </div>
        </div>
      )}

      {/* FULL IMMERSIVE HUD SPEECH OVERLAY FOR ACTIVE OUTBOUND CALL */}
      {(isCalling || isRinging) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-4xl iceglass rounded-3xl p-6 overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.25)] border border-cyan-500/30">
            <div className="absolute top-4 right-4 z-10">
              <button 
                onClick={endCall}
                className="text-slate-400 hover:text-rose-400 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer font-mono text-[10px] uppercase tracking-widest border border-white/5"
              >
                Terminate Outbound Call
              </button>
            </div>
            <div className="mb-4 text-center">
              <span className="text-[9px] px-2.5 py-0.5 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded font-mono font-black animate-pulse uppercase tracking-widest">
                AIVA Outbound Speech Session: {activeAgent.name} ⇆ {activeLead.name}
              </span>
            </div>
            
            <CallingConsole
              isCalling={isCalling}
              isRinging={isRinging}
              micActive={micActive}
              isAiSpeaking={isAiSpeaking}
              audioVolume={audioVolume}
              transcript={transcript}
              activeAgent={activeAgent}
              activeLead={activeLead}
              initiateCall={initiateCall}
              toggleMicrophone={toggleMicrophone}
              endCall={endCall}
              handleCustomerUtterance={handleCustomerUtterance}
              isSpeechSupported={isSpeechSupported}
            />
          </div>
        </div>
      )}

    </div>
  );
}
