import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Activity, Sparkles, Cpu, Mic, MicOff, Search, Settings,
  Home, Users, BarChart2, Layers, ChevronRight, MessageSquare,
  ArrowRight, Play, Volume2, User, HelpCircle, AlertCircle,
  Loader, KeyRound, Phone, PhoneOff, Sparkle, Send,
  Lock, Trash2, PlayCircle, PauseCircle, Disc, PhoneCall, ToggleLeft, ToggleRight, ExternalLink
} from 'lucide-react';
import { Agent, Lead, ActivityLog } from '../types';
import { RecordingEntry, saveRecording, getAllRecordings, deleteRecording } from '../utils/recordingsDb';
import { getOmnidimHealth, getOmnidimSettings, updateOmnidimSettings, getCallEvents, OmnidimSettings, CallEvent } from '../utils/backendApi';
import { base64ToUint8Array, pcm16ToWavArrayBuffer } from '../utils/audio';

interface NeuralVoiceCoreProps {
  isSpeaking: boolean;
  isListening: boolean;
  transcript: Array<{ sender: 'user' | 'agent' | 'aiva'; text: string; time?: string }>;
  playBeep?: (freq: number, duration: number, type?: any) => void;
  agents?: Agent[];
  leads?: Lead[];
  activityLogs?: ActivityLog[];
}

export default function NeuralVoiceCore({
  isSpeaking = false,
  isListening = false,
  transcript = [],
  playBeep = () => {},
  agents = [],
  leads = [],
  activityLogs = []
}: NeuralVoiceCoreProps) {

  // Interactive UI states
  const [selectedLang, setSelectedLang] = useState('EN');
  const [isMuted, setIsMuted] = useState(false);
  const [activeButton, setActiveButton] = useState<string>('wave');
  
  // 3D Mouse Parallax Tilt coordinates for interactive 3D effect
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const dashboardRef = useRef<HTMLDivElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);

  // Fluctuating real-time metrics
  const [latency, setLatency] = useState(12);
  const [tokens, setTokens] = useState(4096);
  const [confidence, setConfidence] = useState(98.5);
  const [intent, setIntent] = useState('Query');

  // Sparklines points (random initial values)
  const [latencyPoints, setLatencyPoints] = useState<number[]>([12, 14, 11, 15, 12, 13, 11, 12, 13, 12]);
  const [tokenPoints, setTokenPoints] = useState<number[]>([20, 35, 45, 30, 48, 60, 52, 40, 55, 62]);
  const [confidencePoints, setConfidencePoints] = useState<number[]>([98.5, 98.4, 98.6, 98.5, 98.7, 98.5, 98.8, 98.5]);
  const [intentPoints, setIntentPoints] = useState<number[]>([10, 20, 15, 25, 20, 30, 25, 35, 30, 40]);

  // ============================================================
  //   MANAGER KNOWLEDGE BASE — AIVA is the admin overseeing all
  //   5 sales agents. This builds a live, plain-text briefing of
  //   every agent's stats, workload and every lead's pipeline
  //   state, so the AI can answer questions about the whole team.
  // ============================================================
  const crmContext = useMemo(() => {
    if (agents.length === 0 && leads.length === 0) return '';

    const agentLines = agents.map(a => {
      const s = a.stats || ({} as Agent['stats']);
      return `- ${a.name} (${a.role}, ${a.tone} tone, ${a.accent} accent): ` +
        `${s.assignedLeads ?? 0} assigned leads, ${s.todayCalls ?? 0} calls today, ` +
        `${s.pendingCalls ?? 0} pending calls, ${s.completedCalls ?? 0} completed calls, ` +
        `${s.followUpsDue ?? 0} follow-ups due, ${s.interestedLeads ?? 0} interested leads, ` +
        `${s.siteVisits ?? 0} site visits booked, ${s.conversionRate ?? 0}% conversion rate.`;
    }).join('\n');

    const agentNameById = new Map(agents.map(a => [a.id, a.name]));
    const leadLines = leads.slice(0, 40).map(l =>
      `- ${l.name} (handled by ${agentNameById.get(l.agentId) || 'unassigned'}): status=${l.status}, ` +
      `interest=${l.interestLevel}, budget=$${l.budget?.toLocaleString?.() ?? l.budget}, ` +
      `project=${l.project}, location=${l.location}, source=${l.source}, ` +
      `next follow-up=${l.nextFollowUpDate}, site visit=${l.siteVisitScheduled || 'not scheduled'}.`
    ).join('\n');

    const recentActivity = activityLogs.slice(0, 15).map(log =>
      `- [${log.timestamp}] ${log.agent} re: ${log.lead} — ${log.message}`
    ).join('\n');

    return [
      `You are AIVA, the MANAGER and ADMIN overseeing a team of ${agents.length} autonomous AI sales agents in this real-estate CRM. You have full, live visibility into every agent's performance and every lead's pipeline. Use the data below to answer questions accurately — never say you lack access to the team, because this data IS your access.`,
      `\n=== YOUR TEAM (${agents.length} agents) ===\n${agentLines || 'No agents loaded yet.'}`,
      `\n=== ACTIVE LEADS PIPELINE (${leads.length} total, showing up to 40) ===\n${leadLines || 'No leads loaded yet.'}`,
      `\n=== RECENT TEAM ACTIVITY LOG ===\n${recentActivity || 'No recent activity.'}`,
    ].join('\n');
  }, [agents, leads, activityLogs]);

  const crmContextRef = useRef(crmContext);
  useEffect(() => { crmContextRef.current = crmContext; }, [crmContext]);

  // ============================================================
  //   REAL-TIME VOICE AI AGENT ENGINE (STT -> AI -> TTS loop)
  // ============================================================
  const [vaActive, setVaActive] = useState(false);       // conversation running
  const [vaListening, setVaListening] = useState(false);  // mic hot
  const [vaSpeaking, setVaSpeaking] = useState(false);    // TTS talking
  const [vaThinking, setVaThinking] = useState(false);    // awaiting reply text (LLM call)
  const [vaSynthesizing, setVaSynthesizing] = useState(false); // awaiting TTS audio generation (separate network call, separate delay)
  const [vaUnsupported, setVaUnsupported] = useState(false);
  const [vaMessages, setVaMessages] = useState<Array<{ sender: 'user' | 'aiva'; text: string; time: string }>>([]);
  const [apiKey, setApiKey] = useState<string>(() => {
    try { return localStorage.getItem('aiva_gemini_key') || ''; } catch { return ''; }
  });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [vaError, setVaError] = useState<string>('');   // last AI backend error (surfaced, not hidden)
  const [typedInput, setTypedInput] = useState('');     // typed-question fallback

  const recognitionRef = useRef<any>(null);
  const activeRef = useRef(false);
  const speakingRef = useRef(false);
  const thinkingRef = useRef(false);
  const synthesizingRef = useRef(false);
  const selectedLangRef = useRef(selectedLang);
  const apiKeyRef = useRef(apiKey);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const vaMessagesRef = useRef(vaMessages);

  useEffect(() => { selectedLangRef.current = selectedLang; }, [selectedLang]);
  useEffect(() => { apiKeyRef.current = apiKey; }, [apiKey]);
  useEffect(() => { speakingRef.current = vaSpeaking; }, [vaSpeaking]);
  useEffect(() => { thinkingRef.current = vaThinking; }, [vaThinking]);
  useEffect(() => { synthesizingRef.current = vaSynthesizing; }, [vaSynthesizing]);

  // @google/genai is a lazy-loaded chunk — fetching + parsing it takes real time on
  // FIRST use. If that first use is the moment the user clicks "Talk to AIVA", its
  // load time gets stacked onto the perceived greeting delay. Warm it up as soon as
  // a key exists (component mount / key saved), so it's already cached by click time.
  const genaiModuleRef = useRef<Promise<any> | null>(null);
  const getGenAIModule = () => {
    if (!genaiModuleRef.current) {
      const t0 = performance.now();
      genaiModuleRef.current = import('@google/genai').then(mod => {
        console.log(`[AIVA timing] @google/genai module load: ${Math.round(performance.now() - t0)}ms`);
        return mod;
      });
    }
    return genaiModuleRef.current;
  };
  useEffect(() => { if (apiKey) getGenAIModule(); }, [apiKey]);
  useEffect(() => { vaMessagesRef.current = vaMessages; }, [vaMessages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [vaMessages]);

  // ============================================================
  //   CALL RECORDING — disclosed to whoever talks to AIVA (a
  //   notice is shown before the mic goes live), stored locally
  //   in this browser only, and playable exclusively from the
  //   admin-only Settings panel (⚙). Nothing is ever uploaded.
  // ============================================================
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingStartRef = useRef<number>(0);
  const [recordings, setRecordings] = useState<RecordingEntry[]>([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [playingRecId, setPlayingRecId] = useState<string | null>(null);
  const [recAudioUrls, setRecAudioUrls] = useState<Record<string, string>>({});
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // One shared AudioContext used both to play AIVA's Gemini-generated voice AND to
  // mix it (together with the caller's mic) into a single recorded stream, so the
  // saved recording captures BOTH sides of the conversation, not just the caller.
  const sharedAudioCtxRef = useRef<AudioContext | null>(null);
  const mixDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Live mic level analysis — taps the SAME mic stream used for recording, so we
  // can show the caller real-time whether their voice is actually reaching AIVA
  // loud/clear enough, instead of just guessing. Driven via refs (no React state)
  // so it can update every animation frame without re-rendering the component.
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micDataArrayRef = useRef<Uint8Array | null>(null);
  const micLevelRef = useRef(0); // 0-100, read by the wave canvas loop
  const micLevelLabelRef = useRef<HTMLSpanElement | null>(null);
  const micWaveCanvasRef = useRef<HTMLCanvasElement | null>(null); // mini live frequency-bar equalizer
  const getAudioCtx = (): AudioContext => {
    if (!sharedAudioCtxRef.current) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      sharedAudioCtxRef.current = new AudioCtxClass();
    }
    return sharedAudioCtxRef.current;
  };

  const refreshRecordings = async () => {
    setRecordingsLoading(true);
    try {
      const list = await getAllRecordings();
      setRecordings(list);
    } catch (e) {
      console.warn('Failed to load recordings', e);
    } finally {
      setRecordingsLoading(false);
    }
  };

  // Load the recordings list whenever the admin opens Settings
  useEffect(() => { if (showKeyInput) refreshRecordings(); }, [showKeyInput]);

  // ============================================================
  //   OMNIDIMENSION — real outbound AI sales calls (admin only)
  // ============================================================
  const [omniHealth, setOmniHealth] = useState<{ configured: boolean; geminiAnalysisConfigured: boolean } | null>(null);
  const [omniSettings, setOmniSettings] = useState<OmnidimSettings | null>(null);
  const [omniAgentIdInputs, setOmniAgentIdInputs] = useState<Record<string, string>>({});
  const [callEvents, setCallEvents] = useState<CallEvent[]>([]);
  const [omniLoading, setOmniLoading] = useState(false);

  const refreshOmnidim = async () => {
    setOmniLoading(true);
    try {
      const [health, settings, events] = await Promise.all([getOmnidimHealth(), getOmnidimSettings(), getCallEvents()]);
      setOmniHealth(health);
      setOmniSettings(settings);
      const inputs: Record<string, string> = {};
      agents.forEach(a => { inputs[a.id] = settings?.agentIdMap?.[a.id] ? String(settings.agentIdMap[a.id]) : ''; });
      setOmniAgentIdInputs(inputs);
      setCallEvents(events);
    } catch (e) {
      console.warn('Failed to load Omnidimension status', e);
    } finally {
      setOmniLoading(false);
    }
  };

  useEffect(() => { if (showKeyInput) refreshOmnidim(); }, [showKeyInput]);

  const saveOmniAgentMapping = async () => {
    const agentIdMap: Record<string, number | null> = {};
    Object.entries(omniAgentIdInputs).forEach(([aivaAgentId, val]) => {
      const n = parseInt(val, 10);
      agentIdMap[aivaAgentId] = n || null;
    });
    const updated = await updateOmnidimSettings({ agentIdMap });
    if (updated) { setOmniSettings(updated); playBeep(720, 0.08); }
  };

  const toggleAutoDial = async () => {
    if (!omniSettings) return;
    const next = !omniSettings.autoDialEnabled;
    // Extra friction on enabling — this makes the app place REAL phone calls autonomously.
    if (next && !window.confirm(
      'Enable AUTONOMOUS follow-up calling?\n\nAIVA will automatically place real phone calls (via Omnidimension) to any lead whose follow-up date has arrived, with no manual approval per call. This costs money per call and dials real people.\n\nContinue?'
    )) return;
    const updated = await updateOmnidimSettings({ autoDialEnabled: next });
    if (updated) { setOmniSettings(updated); playBeep(next ? 780 : 380, 0.1, 'triangle'); }
  };

  const beginRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const ctx = getAudioCtx();
      if (ctx.state === 'suspended') { try { await ctx.resume(); } catch {} }
      const dest = ctx.createMediaStreamDestination();
      mixDestRef.current = dest;
      const micSource = ctx.createMediaStreamSource(stream);
      micSource.connect(dest);
      micSourceNodeRef.current = micSource;

      // Tap the same mic source (non-destructively) for real-time level analysis,
      // so we can show whether the caller's actual voice is loud enough for AIVA.
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      micSource.connect(analyser);
      micAnalyserRef.current = analyser;
      micDataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      const mr = new MediaRecorder(dest.stream);
      recordedChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mr.start();
      mediaRecorderRef.current = mr;
      recordingStartRef.current = Date.now();
    } catch (e) {
      console.warn('Recording unavailable (mic denied or unsupported):', e);
    }
  };

  const finishRecording = async () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    await new Promise<void>((resolve) => {
      if (mr.state === 'inactive') { resolve(); return; }
      mr.onstop = () => resolve();
      mr.stop();
    });
    recordingStreamRef.current?.getTracks().forEach(t => t.stop());
    try { micSourceNodeRef.current?.disconnect(); } catch {}
    recordingStreamRef.current = null;
    micSourceNodeRef.current = null;
    mixDestRef.current = null; // AudioContext itself stays alive for the next session
    micAnalyserRef.current = null;
    micDataArrayRef.current = null;
    micLevelRef.current = 0;
    const chunks = recordedChunksRef.current;
    recordedChunksRef.current = [];
    recordingStreamRef.current = null;
    mediaRecorderRef.current = null;

    const blob = new Blob(chunks, { type: 'audio/webm' });
    if (blob.size < 500) return; // nothing meaningful captured

    const durationSec = Math.max(1, Math.round((Date.now() - recordingStartRef.current) / 1000));
    const transcript = vaMessagesRef.current
      .map(m => `[${m.time}] ${m.sender === 'aiva' ? 'AIVA' : 'Caller'}: ${m.text}`)
      .join('\n');

    const entry: RecordingEntry = {
      id: `rec_${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      duration: durationSec,
      transcript,
      blob,
    };
    try {
      await saveRecording(entry);
      if (showKeyInput) refreshRecordings();
    } catch (e) {
      console.warn('Failed to save recording locally:', e);
    }
  };

  const langMap: Record<string, string> = { EN: 'en-US', ES: 'es-ES', JA: 'ja-JP', AR: 'ar-SA', HI: 'hi-IN' };
  const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const addMessage = (sender: 'user' | 'aiva', text: string) =>
    setVaMessages(prev => [...prev, { sender, text, time: nowTime() }].slice(-40));

  // Basic offline responder — only simple chit-chat. It is intentionally HONEST:
  // for anything requiring real knowledge it tells the user to enable the real AI,
  // instead of inventing a wrong scripted answer.
  const localReply = (input: string): string => {
    const t = input.toLowerCase().trim();
    if (/\b(hi|hello|hey|good morning|good evening|namaste|yo)\b/.test(t))
      return "Hey! I'm AIVA, manager of your 5-agent sales team. Ask me anything.";
    if (/how are you|how's it going|how are things|how do you do|what's up/.test(t))
      return "I'm doing great, thanks for asking! What would you like to know?";
    if (/your name|who are you|what are you/.test(t))
      return "I'm AIVA — I manage your team of 5 AI sales agents and track every lead in the pipeline.";
    if (/thank/.test(t))
      return "You're welcome!";
    if (/\b(bye|goodbye|see you|good night)\b/.test(t))
      return "Talk to you later!";

    // Team/agent status questions can be answered directly from live data,
    // even without an LLM key — this is deterministic, not guessed.
    const wantsTeam = /\b(team|agents?|avar)\b/.test(t) && /how|status|doing|working|performing|report/.test(t);
    if (wantsTeam && agents.length > 0) {
      const summary = agents.map(a =>
        `${a.name}: ${a.stats?.assignedLeads ?? 0} leads, ${a.stats?.completedCalls ?? 0} completed calls, ${a.stats?.conversionRate ?? 0}% conversion`
      ).join('. ');
      return `Here's your team status. ${summary}.`;
    }
    const wantsLead = /\blead\b/.test(t) && leads.length > 0;
    if (wantsLead) {
      const hot = leads.filter(l => l.interestLevel === 'Hot Lead' || l.interestLevel === 'Interested').length;
      return `You have ${leads.length} leads in the pipeline, ${hot} of them hot or interested right now.`;
    }

    // Anything that needs broader knowledge — be honest, don't fake it.
    return "I'm in basic mode, so I can only handle simple chit-chat and basic team stats right now. Add a free Gemini API key in settings and I'll be able to reason through anything, including deep team analysis.";
  };

  // Shared system prompt for every Gemini text-gen call (voice AND text-box paths).
  const buildSystemInstruction = () =>
    "You are AIVA, a friendly, highly knowledgeable real-time voice assistant, and you are also the MANAGER/ADMIN of a team of 5 autonomous AI sales agents inside a real-estate CRM (their live stats, leads, and activity are provided below — treat that as ground truth about your team). " +
    "For questions about the team, agents, leads, pipeline, or performance: answer ONLY using the numbers and facts given in the data below. Never invent, estimate, round for effect, or recall a number from earlier in the conversation if it isn't in the current data block — the data below is refreshed live and is always the current truth, so re-read it fresh for every answer instead of trusting your own memory of a prior reply. If something isn't in the data (e.g. a lead or stat that doesn't exist there), say plainly that you don't have that information — never guess or make one up to sound complete. " +
    "For everything else, directly and accurately answer the user's actual question on ANY topic — general knowledge, science, history, math, technology, coding, advice, everyday help, and more. Understand what they truly asked and respond to that. " +
    "Answer exactly what was asked and stop — no filler openers ('Great question!', 'Sure, I can help with that'), no restating the question, no unrequested extra advice or caveats tacked on the end. Keep replies SHORT — usually just 1 sentence, at most 2; only go longer when the question genuinely needs it, such as a full team status report. Shorter replies mean less time synthesizing voice before you're heard, so brevity matters here more than in a text chat. Since your reply is spoken aloud, never use markdown, bullet points, code blocks, or emojis — speak in plain natural sentences." +
    (crmContextRef.current ? `\n\n${crmContextRef.current}` : '');

  // Generate reply — Gemini when a key is present, else local engine
  const generateReply = async (input: string): Promise<string> => {
    const key = apiKeyRef.current;
    if (!key) return localReply(input);
    const t0 = performance.now();
    try {
      const { GoogleGenAI } = await getGenAIModule();
      const ai = new GoogleGenAI({ apiKey: key });
      const history = vaMessages.slice(-8).map(m => `${m.sender === 'user' ? 'User' : 'AIVA'}: ${m.text}`).join('\n');
      const res: any = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: `${history}\nUser: ${input}\nAIVA:`,
        config: { systemInstruction: buildSystemInstruction() },
      });
      console.log(`[AIVA timing] Gemini TEXT reply: ${Math.round(performance.now() - t0)}ms`);
      const text = (res?.text || '').trim();
      setVaError('');
      return text || localReply(input);
    } catch (e: any) {
      console.log(`[AIVA timing] Gemini TEXT reply FAILED after ${Math.round(performance.now() - t0)}ms`);
      const msg = e?.message ? String(e.message) : 'unknown error';
      console.warn('Gemini call failed:', e);
      setVaError(msg);
      return "I couldn't reach the AI service. Your Gemini API key looks invalid or expired — please check it in settings. It should start with A-I-Z-A.";
    }
  };

  // Known-female voice names across common platforms (Chrome/Edge/Windows/macOS/iOS/Android),
  // keyed by language prefix. Names higher in each list sound more natural/human, and are tried first —
  // Edge/Windows 11 ship "Online (Natural)" neural voices that sound dramatically less robotic than
  // legacy SAPI voices like Zira, so those are prioritized whenever they're installed.
  const femaleVoiceNames: Record<string, string[]> = {
    en: [
      // Modern neural/natural voices (best quality — Edge/Windows 11)
      'Microsoft Ava Online (Natural)', 'Microsoft Emma Online (Natural)', 'Microsoft Jenny Online (Natural)',
      'Microsoft Aria Online (Natural)', 'Microsoft Sonia Online (Natural)', 'Microsoft Libby Online (Natural)',
      'Microsoft Natasha Online (Natural)', 'Ava', 'Emma Online', 'Jenny Online', 'Aria Online', 'Sonia', 'Libby',
      // Chrome/Google neural voices
      'Google US English', 'Google UK English Female',
      // macOS/iOS
      'Samantha', 'Ava (Enhanced)', 'Allison', 'Susan', 'Karen', 'Moira', 'Tessa', 'Catherine', 'Zoe',
      // Legacy but acceptable fallbacks
      'Microsoft Zira', 'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Hazel', 'Victoria', 'Female', 'Zira', 'Aria', 'Jenny', 'Hazel',
    ],
    es: ['Microsoft Elena Online (Natural)', 'Google español', 'Microsoft Helena', 'Microsoft Elvira', 'Monica', 'Paulina', 'Female'],
    ja: ['Microsoft Nanami Online (Natural)', 'Google 日本語', 'Microsoft Nanami', 'Kyoko', 'Female'],
    ar: ['Microsoft Salma Online (Natural)', 'Microsoft Salma', 'Microsoft Hoda', 'Female'],
    hi: ['Microsoft Swara Online (Natural)', 'Google हिन्दी', 'Microsoft Swara', 'Lekha', 'Female'],
  };
  // Deliberately broad — false positives here just skip to the NEXT voice (harmless),
  // while a missed male voice would wrongly get picked (the actual complaint we're fixing).
  const maleHints = [
    'male', 'david', 'mark', 'daniel', 'george', 'james', 'guy', 'ryan', 'fred', 'alex', 'ravi', 'prabhat',
    'christopher', 'eric', 'brian', 'andrew', 'tom', 'oliver', 'arthur', 'thomas', 'lee', 'rishi', 'gordon',
    'justin', 'aaron', 'nathan', 'matthew', 'kevin', 'sean', 'colin', 'bruce', 'roger', 'paul', 'peter',
  ];

  const pickFemaleVoice = (voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined => {
    const lower = lang.toLowerCase();
    const prefix = lower.split('-')[0];
    const preferredNames = femaleVoiceNames[prefix] || femaleVoiceNames.en;

    // 1) Best case: a preferred-quality female voice matching the exact requested locale (e.g. en-US)
    const sameLang = voices.filter(v => v.lang.toLowerCase() === lower);
    for (const name of preferredNames) {
      const hit = sameLang.find(v => v.name.toLowerCase().includes(name.toLowerCase()));
      if (hit) return hit;
    }
    // 2) Any preferred-quality female voice in the same language family (e.g. any "en-*")
    const sameFamily = voices.filter(v => v.lang.toLowerCase().startsWith(prefix));
    const pool = sameFamily.length ? sameFamily : voices;
    for (const name of preferredNames) {
      const hit = pool.find(v => v.name.toLowerCase().includes(name.toLowerCase()));
      if (hit) return hit;
    }
    // 3) Any voice whose name signals "female" and doesn't signal "male"
    const heuristic = pool.find(v => {
      const n = v.name.toLowerCase();
      return (n.includes('female') || n.includes('woman')) && !maleHints.some(m => n.includes(m));
    });
    if (heuristic) return heuristic;
    // 4) Exclude anything that looks explicitly male, take the first remaining
    const notMale = pool.find(v => !maleHints.some(m => v.name.toLowerCase().includes(m)));
    return notMale || pool[0];
  };

  // Ask Gemini's native TTS model to synthesize real speech audio for this text.
  // Returns a decoded AudioBuffer (playable + mixable into the recording), or null if no key set.
  const synthesizeGeminiSpeech = async (text: string): Promise<AudioBuffer | null> => {
    const key = apiKeyRef.current;
    if (!key) return null;
    const tCallStart = performance.now();
    const { GoogleGenAI } = await getGenAIModule();
    const ai = new GoogleGenAI({ apiKey: key });
    const res: any = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: text,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    const tApiDone = performance.now();
    const part = res?.candidates?.[0]?.content?.parts?.[0];
    const inline = part?.inlineData;
    if (!inline?.data) throw new Error('Gemini TTS returned no audio data');
    const mime: string = inline.mimeType || 'audio/pcm;rate=24000';
    const rateMatch = /rate=(\d+)/.exec(mime);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
    const pcmBytes = base64ToUint8Array(inline.data);
    const wavBuffer = pcm16ToWavArrayBuffer(pcmBytes, sampleRate, 1);
    const ctx = getAudioCtx();
    const buffer = await ctx.decodeAudioData(wavBuffer);
    const tDecodeDone = performance.now();
    console.log(
      `[AIVA timing] Gemini TTS for "${text.slice(0, 40)}${text.length > 40 ? '…' : ''}" ` +
      `(${text.length} chars): API call ${Math.round(tApiDone - tCallStart)}ms, decode ${Math.round(tDecodeDone - tApiDone)}ms, ` +
      `TOTAL ${Math.round(tDecodeDone - tCallStart)}ms`
    );
    return buffer;
  };

  // Fallback browser voice (used when no Gemini key, or the Gemini TTS call fails).
  // NOTE: this path cannot be captured into the recording — browser speechSynthesis
  // renders straight to the OS audio output with no accessible audio stream. Real
  // recorded AIVA audio only happens via the Gemini TTS path above.
  const speakWithBrowserVoice = (text: string) => new Promise<void>((resolve) => {
    if (!('speechSynthesis' in window)) { resolve(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const lang = langMap[selectedLangRef.current] || 'en-US';
    u.lang = lang;
    const voices = window.speechSynthesis.getVoices();
    const v = pickFemaleVoice(voices, lang);
    if (v) { u.voice = v; u.lang = v.lang; }
    const isNatural = !!v && /online|natural|enhanced|premium/i.test(v.name);
    u.rate = isNatural ? 1.0 : 0.95;
    u.pitch = isNatural ? 1.02 : 1.12;
    u.onstart = () => setVaSpeaking(true);
    u.onend = () => { setVaSpeaking(false); resolve(); };
    u.onerror = () => { setVaSpeaking(false); resolve(); };
    window.speechSynthesis.speak(u);
  });

  // Splits a reply into short speakable chunks (roughly one sentence each) so we can
  // start playing the FIRST chunk as soon as it's synthesized, instead of waiting for
  // the entire (possibly multi-sentence) reply to finish generating audio. Very short
  // fragments get merged into the next one so we don't make a network call per word.
  const splitIntoSpeechChunks = (text: string): string[] => {
    const parts = text.match(/[^.!?]+[.!?]*/g) || [text];
    const chunks: string[] = [];
    let buffer = '';
    for (const part of parts) {
      buffer += part;
      if (buffer.trim().length >= 24) {
        chunks.push(buffer.trim());
        buffer = '';
      }
    }
    if (buffer.trim()) chunks.push(buffer.trim());
    return chunks.length ? chunks : [text];
  };

  const playAudioBuffer = (ctx: AudioContext, buffer: AudioBuffer): Promise<void> => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination); // audible to whoever is listening
    if (mixDestRef.current) src.connect(mixDestRef.current); // captured into the recording
    setVaSpeaking(true);
    return new Promise<void>((resolve) => {
      src.onended = () => { setVaSpeaking(false); resolve(); };
      src.start();
    });
  };

  // Speak text as AIVA. Tries Gemini's real voice first — this is the ONLY path whose
  // audio is actually captured in the saved recording (mixed with the caller's mic via
  // mixDestRef). Synthesizes chunk-by-chunk in a pipeline: chunk N+1 starts generating
  // while chunk N is still playing, so there's no gap between them, and the wait before
  // AIVA starts talking is only as long as the FIRST short chunk takes, not the whole reply.
  // Falls back to the browser voice if no key is set or the very first chunk fails.
  const speak = async (text: string): Promise<void> => {
    if (apiKeyRef.current) {
      const chunks = splitIntoSpeechChunks(text);
      try {
        const ctx = getAudioCtx();
        if (ctx.state === 'suspended') { try { await ctx.resume(); } catch {} }

        setVaSynthesizing(true);
        let pending = synthesizeGeminiSpeech(chunks[0]);
        for (let i = 0; i < chunks.length; i++) {
          const buffer = await pending;
          if (i === 0) setVaSynthesizing(false);
          // Kick off the NEXT chunk's synthesis immediately, before playing this one,
          // so it's ready (or close to it) by the time this chunk finishes playing.
          if (i + 1 < chunks.length) pending = synthesizeGeminiSpeech(chunks[i + 1]);
          if (buffer) {
            await playAudioBuffer(ctx, buffer);
          } else if (i === 0) {
            // First chunk genuinely produced nothing — fall through to browser voice below.
            throw new Error('Gemini TTS returned no audio for the first chunk');
          }
        }
        return;
      } catch (e) {
        setVaSynthesizing(false);
        console.warn('Gemini TTS failed, falling back to browser voice (this reply will not be in the recording):', e);
      }
    }
    await speakWithBrowserVoice(text);
  };

  // Pulls any sentence-sized chunks that are now complete out of a growing text
  // buffer (same "≥24 chars, ends in . ! ?" rule as splitIntoSpeechChunks), leaving
  // the trailing incomplete fragment in place for the next call. Pass flushAll=true
  // once streaming has ended to force out whatever's left, punctuation or not.
  const extractReadyChunks = (buffer: string, flushAll: boolean): { ready: string[]; rest: string } => {
    const parts = buffer.match(/[^.!?]+[.!?]*/g) || (buffer ? [buffer] : []);
    const ready: string[] = [];
    let acc = '';
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      acc += parts[i];
      const endsWithPunct = /[.!?]\s*$/.test(parts[i]);
      if (acc.trim().length >= 24 && endsWithPunct) {
        ready.push(acc.trim());
        acc = '';
      } else if (isLast && flushAll && acc.trim()) {
        ready.push(acc.trim());
        acc = '';
      }
    }
    return { ready, rest: acc };
  };

  // Answers a spoken question with the text-gen and voice steps OVERLAPPED instead of
  // sequential: Gemini's text reply streams in token-by-token, and as soon as the first
  // sentence-sized piece is complete, its TTS synthesis starts immediately — while the
  // rest of the reply is still being generated. This is what actually cuts the old
  // "wait for the full reply, THEN start synthesizing audio" delay down to roughly just
  // the time to generate + synthesize the FIRST short sentence. Falls back to the
  // non-streaming path (generateReply + speak) for basic mode or if streaming fails.
  const speakStreamingReply = async (input: string): Promise<string> => {
    const key = apiKeyRef.current;
    if (!key) {
      const reply = await generateReply(input);
      await speak(reply);
      return reply;
    }

    const t0 = performance.now();
    let fullText = '';
    let buffer = '';
    const queue: string[] = [];
    let streamEnded = false;
    let streamFailed = false;
    let wake: (() => void) | null = null;
    const notify = () => { if (wake) { const w = wake; wake = null; w(); } };

    const producer = (async () => {
      try {
        const { GoogleGenAI } = await getGenAIModule();
        const ai = new GoogleGenAI({ apiKey: key });
        const history = vaMessages.slice(-8).map(m => `${m.sender === 'user' ? 'User' : 'AIVA'}: ${m.text}`).join('\n');
        const stream: any = await ai.models.generateContentStream({
          model: 'gemini-flash-latest',
          contents: `${history}\nUser: ${input}\nAIVA:`,
          config: { systemInstruction: buildSystemInstruction() },
        });
        let firstTokenAt = 0;
        for await (const part of stream) {
          const t = part?.text || '';
          if (!t) continue;
          if (!firstTokenAt) {
            firstTokenAt = performance.now();
            console.log(`[AIVA timing] Gemini TEXT stream first token: ${Math.round(firstTokenAt - t0)}ms`);
          }
          fullText += t;
          buffer += t;
          setVaThinking(false); thinkingRef.current = false; // text is arriving — no longer just "thinking"
          const { ready, rest } = extractReadyChunks(buffer, false);
          buffer = rest;
          if (ready.length) { queue.push(...ready); notify(); }
        }
        const { ready } = extractReadyChunks(buffer, true);
        if (ready.length) { queue.push(...ready); }
      } catch (e) {
        console.warn('Streaming text-gen failed, will fall back once queue drains:', e);
        streamFailed = true;
      } finally {
        streamEnded = true;
        notify();
      }
    })();

    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch {} }
    setVaSynthesizing(true);
    let spokeAny = false;
    try {
      while (true) {
        if (queue.length === 0) {
          if (streamEnded) break;
          await new Promise<void>(resolve => { wake = resolve; });
          continue;
        }
        const chunkText = queue.shift()!;
        const audioBuf = await synthesizeGeminiSpeech(chunkText);
        if (!spokeAny) { setVaSynthesizing(false); spokeAny = true; }
        if (audioBuf) await playAudioBuffer(ctx, audioBuf);
      }
    } catch (e) {
      console.warn('Streaming TTS playback failed:', e);
    } finally {
      setVaSynthesizing(false);
    }

    await producer;
    const finalText = fullText.trim();
    if (!finalText || streamFailed) {
      const fallback = finalText || localReply(input);
      if (!spokeAny) await speakWithBrowserVoice(fallback);
      return fallback;
    }
    return finalText;
  };

  const ensureRecognition = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setVaUnsupported(true); return null; }
    if (recognitionRef.current) {
      recognitionRef.current.lang = langMap[selectedLangRef.current] || 'en-US';
      return recognitionRef.current;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = langMap[selectedLangRef.current] || 'en-US';
    rec.onresult = (e: any) => {
      const text = e.results[e.results.length - 1][0].transcript;
      handleUserSpeech(text);
    };
    rec.onend = () => {
      setVaListening(false);
      // auto-restart the mic between turns while conversation is active
      if (activeRef.current && !speakingRef.current && !thinkingRef.current && !synthesizingRef.current) {
        try { rec.start(); setVaListening(true); } catch { /* already started */ }
      }
    };
    rec.onerror = (e: any) => {
      setVaListening(false);
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        setVaUnsupported(true); activeRef.current = false; setVaActive(false);
      }
    };
    recognitionRef.current = rec;
    return rec;
  };

  const startListening = () => {
    const rec = ensureRecognition();
    if (!rec) return;
    try { rec.start(); setVaListening(true); } catch { /* already listening */ }
  };

  const handleUserSpeech = async (text: string) => {
    if (!text || !text.trim()) return;
    try { recognitionRef.current?.stop(); } catch {}
    addMessage('user', text.trim());
    setVaThinking(true); thinkingRef.current = true;
    playBeep(600, 0.06, 'sine');
    // Streams text-gen and TTS together (see speakStreamingReply) instead of waiting
    // for the full reply before synthesizing any audio — this is the fix for AIVA
    // taking 5-6s to start talking; audio now starts as soon as the first sentence
    // is ready instead of after the whole reply is generated.
    const reply = await speakStreamingReply(text.trim());
    setVaThinking(false); thinkingRef.current = false;
    addMessage('aiva', reply);
    if (activeRef.current) startListening();
  };

  const startConversation = async () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setVaUnsupported(true); return; }
    activeRef.current = true; setVaActive(true);
    playBeep(700, 0.1, 'sine');
    if (!apiKeyRef.current) setShowKeyInput(true);
    beginRecording(); // best-effort — never blocks the conversation if mic access fails
    // Kept short deliberately: with non-streaming TTS, synthesis time scales with how much
    // audio has to be generated — a shorter first line means less wait before you hear anything.
    const greeting = apiKeyRef.current
      ? "Hi, I'm AIVA. This call is recorded for quality. Ask me anything."
      : "Hi, I'm AIVA. This call is recorded for quality. I'm in basic mode — add a Gemini key in settings for full answers.";
    addMessage('aiva', greeting);
    const tGreetingStart = performance.now();
    await speak(greeting);
    console.log(`[AIVA timing] TOTAL click-to-audio-finished for greeting: ${Math.round(performance.now() - tGreetingStart)}ms`);
    if (activeRef.current) startListening();
  };

  const stopConversation = () => {
    activeRef.current = false; setVaActive(false);
    try { recognitionRef.current?.stop(); } catch {}
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setVaListening(false); setVaSpeaking(false); setVaThinking(false);
    playBeep(320, 0.1, 'triangle');
    finishRecording();
  };

  const toggleConversation = () => { if (activeRef.current) stopConversation(); else startConversation(); };

  // cleanup on unmount
  useEffect(() => () => {
    activeRef.current = false;
    try { recognitionRef.current?.stop(); } catch {}
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    try { recordingStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    try { if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop(); } catch {}
    try { sharedAudioCtxRef.current?.close(); } catch {}
  }, []);

  // Build (and clean up) playable object URLs whenever the recordings list changes
  useEffect(() => {
    const map: Record<string, string> = {};
    recordings.forEach(r => { map[r.id] = URL.createObjectURL(r.blob); });
    setRecAudioUrls(map);
    return () => { Object.values(map).forEach(u => URL.revokeObjectURL(u)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordings]);

  const handleDeleteRecording = async (id: string) => {
    try { await deleteRecording(id); refreshRecordings(); playBeep(360, 0.06); } catch (e) { console.warn(e); }
  };

  // Effective states that drive the spectral canvas + status labels
  const speaking = vaSpeaking || isSpeaking;
  const listening = vaListening || isListening;

  // Handle dynamic fluctuations of analytics data
  useEffect(() => {
    const interval = setInterval(() => {
      // Fluctuating Latency
      setLatency(prev => {
        const delta = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
        const next = prev + delta;
        const finalVal = next > 9 && next < 16 ? next : prev;
        setLatencyPoints(pts => [...pts.slice(1), finalVal]);
        return finalVal;
      });

      // Fluctuating Tokens
      setTokens(prev => {
        const delta = Math.floor(Math.random() * 32) - 16;
        const next = prev + delta;
        const finalVal = next > 4000 && next < 4200 ? next : prev;
        setTokenPoints(pts => [...pts.slice(1), Math.floor(40 + (finalVal % 40))]);
        return finalVal;
      });

      // Fluctuating Confidence
      setConfidence(prev => {
        const delta = Number(((Math.random() * 0.4) - 0.2).toFixed(1));
        const next = Number((prev + delta).toFixed(1));
        const finalVal = next > 97.0 && next <= 99.6 ? next : prev;
        setConfidencePoints(pts => [...pts.slice(1), finalVal]);
        return finalVal;
      });

      // Fluctuate Intent on occasion
      const intents = ['Query', 'Command', 'Navigate', 'Analyze'];
      if (Math.random() > 0.8) {
        const randomIntent = intents[Math.floor(Math.random() * intents.length)];
        setIntent(randomIntent);
      }
      setIntentPoints(pts => [...pts.slice(1), 10 + Math.floor(Math.random() * 35)]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Parallax Mouse Handler
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dashboardRef.current) return;
    const rect = dashboardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  // 3D Canvas Wave Particle Simulator (recreates the horizontal cyan nested wave sphere from the second image)
  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    // Mini live frequency-bar equalizer (mic level meter) — separate small canvas
    const micCanvas = micWaveCanvasRef.current;
    const micCtx = micCanvas?.getContext('2d') || null;
    let micWidth = 0, micHeight = 0;
    const NUM_BARS = 28;
    const barHeights = new Array(NUM_BARS).fill(0); // smoothed per-bar heights, persists across frames

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
      if (micCanvas) {
        micWidth = micCanvas.width = micCanvas.offsetWidth;
        micHeight = micCanvas.height = micCanvas.offsetHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // Particle waves parameters
    let time = 0;
    const numLines = 15; // Number of nested frequency waves
    const pointsPerLine = 80;

    // Background floating dust stars
    const stars = Array.from({ length: 60 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5 + 0.5,
      speed: Math.random() * 0.2 + 0.1,
      opacity: Math.random() * 0.5 + 0.2
    }));

    const draw3DWaves = () => {
      // Read the caller's REAL mic volume this frame (0-100), if a mic stream is active.
      // Drives both the meter UI below and the wave's amplitude, so what you see actually
      // reflects your voice hitting the mic, not just a canned animation.
      if (micAnalyserRef.current && micDataArrayRef.current) {
        micAnalyserRef.current.getByteFrequencyData(micDataArrayRef.current);
        let sum = 0;
        for (let i = 0; i < micDataArrayRef.current.length; i++) sum += micDataArrayRef.current[i];
        const avg = sum / micDataArrayRef.current.length; // 0-255
        const level = Math.min(100, Math.round((avg / 140) * 100)); // normalize, ~140 = comfortable speaking volume
        micLevelRef.current = micLevelRef.current * 0.7 + level * 0.3; // smooth out jitter
      } else {
        micLevelRef.current = 0;
      }

      // Draw the live mic frequency-bar equalizer from REAL per-bin data (not the averaged level).
      if (micCtx && micCanvas && micWidth > 0) {
        micCtx.clearRect(0, 0, micWidth, micHeight);
        const raw = micDataArrayRef.current;
        const barGap = 3;
        const barWidth = (micWidth - barGap * (NUM_BARS - 1)) / NUM_BARS;

        for (let i = 0; i < NUM_BARS; i++) {
          // Sample a spread of frequency bins per bar (skip the very low rumble bins) for a lively look
          let target = 0;
          if (raw) {
            const binStart = 2 + Math.floor((i / NUM_BARS) * (raw.length * 0.6));
            const binEnd = 2 + Math.floor(((i + 1) / NUM_BARS) * (raw.length * 0.6));
            let sum = 0, count = 0;
            for (let b = binStart; b < Math.max(binEnd, binStart + 1); b++) { sum += raw[b] || 0; count++; }
            target = count ? (sum / count) / 255 : 0;
          }
          // Center bars read slightly louder visually (classic equalizer taper) for a nicer shape
          const taper = 1 - Math.abs((i / (NUM_BARS - 1)) - 0.5) * 0.5;
          target = Math.min(1, target * (1.15 + taper * 0.3));

          barHeights[i] = barHeights[i] * 0.6 + target * 0.4; // smooth per-bar jitter
          const h = Math.max(3, barHeights[i] * (micHeight - 4));
          const x = i * (barWidth + barGap);
          const y = micHeight - h;

          const grad = micCtx.createLinearGradient(0, micHeight, 0, y);
          grad.addColorStop(0, '#0891b2');
          grad.addColorStop(0.55, '#22d3ee');
          grad.addColorStop(1, barHeights[i] > 0.7 ? '#facc15' : '#34d399');
          micCtx.fillStyle = grad;

          if (barHeights[i] > 0.15) {
            micCtx.shadowColor = 'rgba(34, 211, 238, 0.8)';
            micCtx.shadowBlur = 6;
          } else {
            micCtx.shadowBlur = 0;
          }

          const r = Math.min(barWidth / 2, 3);
          micCtx.beginPath();
          micCtx.moveTo(x, y + r);
          micCtx.arcTo(x, y, x + r, y, r);
          micCtx.arcTo(x + barWidth, y, x + barWidth, y + r, r);
          micCtx.lineTo(x + barWidth, micHeight);
          micCtx.lineTo(x, micHeight);
          micCtx.closePath();
          micCtx.fill();
        }
        micCtx.shadowBlur = 0;
      }

      if (micLevelLabelRef.current) {
        micLevelLabelRef.current.textContent = !listening
          ? 'Mic idle'
          : micLevelRef.current < 12
            ? 'Too quiet — AIVA may not hear you'
            : micLevelRef.current < 55
              ? 'Good — AIVA can hear you'
              : 'Strong signal';
      }

      time += (speaking ? 0.08 : listening ? 0.05 + (micLevelRef.current / 100) * 0.04 : 0.03);
      ctx.clearRect(0, 0, width, height);

      // Draw background ambient stars orbiting
      stars.forEach(star => {
        star.x -= star.speed;
        if (star.x < 0) star.x = width;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34, 211, 238, ${star.opacity})`;
        ctx.fill();
      });

      const centerX = width / 2;
      const centerY = height / 2;
      const waveWidth = width * 0.95;

      // Draw horizontal 3D-projected wave bands
      for (let l = 0; l < numLines; l++) {
        const lineOffset = (l / (numLines - 1)) - 0.5; // -0.5 to 0.5
        
        // Dynamic amplitude based on whether active state is speaking/listening
        // While listening, ride the real mic level on top of the base multiplier so the
        // wave visibly grows/shrinks with the caller's actual voice, not a fixed value.
        const activityMultiplier = speaking ? 1.4 : listening ? 0.85 + (micLevelRef.current / 100) * 0.9 : 0.7;
        const amplitude = (75 - Math.abs(lineOffset) * 45) * activityMultiplier;
        
        // Create glowing gradients
        ctx.beginPath();
        
        for (let p = 0; p < pointsPerLine; p++) {
          const t = p / (pointsPerLine - 1); // 0 to 1
          const x = (t - 0.5) * waveWidth + centerX;
          
          // Beautiful envelope function to pinch the wave at the far-left and far-right ends (matching reference picture)
          const envelope = Math.sin(t * Math.PI); // Pinches to 0 at ends, peaks in middle

          // Immersive layered wave functions
          const frequency1 = 6;
          const frequency2 = 12;
          const waveVal1 = Math.sin(t * frequency1 - time + lineOffset * 4);
          const waveVal2 = Math.cos(t * frequency2 + time * 1.5 - lineOffset * 2);
          
          // Layer multiple frequencies
          const waveY = (waveVal1 * 0.7 + waveVal2 * 0.3) * amplitude * envelope;
          
          // Project slightly in 3D perspective
          const rotYAngle = mousePos.x * 0.4; // Mouse interactive skew
          const rotXAngle = mousePos.y * 0.3;
          
          const projX = centerX + (x - centerX) * Math.cos(rotYAngle) - waveY * Math.sin(rotXAngle) * 0.2;
          const projY = centerY + waveY * Math.cos(rotXAngle) + (x - centerX) * Math.sin(rotYAngle) * 0.15;

          // Drawing circles/dots to get that glowing digital particle look from the picture
          if (p % 2 === 0) {
            ctx.fillStyle = `rgba(34, 211, 238, ${0.1 + (envelope * 0.75) * (1 - Math.abs(lineOffset) * 0.8)})`;
            ctx.beginPath();
            const radius = (1.5 + (1 - Math.abs(lineOffset)) * 1.5) * (speaking ? 1.3 : 1.0);
            ctx.arc(projX, projY, radius, 0, Math.PI * 2);
            
            // Add subtle blur glow to center peaks
            if (p > pointsPerLine * 0.3 && p < pointsPerLine * 0.7) {
              ctx.shadowColor = '#22d3ee';
              ctx.shadowBlur = speaking ? 6 : 2;
            }
            
            ctx.fill();
            ctx.shadowBlur = 0; // reset
          }
        }
      }

      // Draw the central glowing light source behind the waves
      const grad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, 130);
      grad.addColorStop(0, 'rgba(6, 182, 212, 0.15)');
      grad.addColorStop(0.5, 'rgba(99, 102, 241, 0.05)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 130, 0, Math.PI * 2);
      ctx.fill();

      animationId = requestAnimationFrame(draw3DWaves);
    };

    draw3DWaves();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, [speaking, listening, mousePos]);

  return (
    <div 
      ref={dashboardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="w-full bg-[#02050e] border border-white/5 rounded-[28px] p-6 flex flex-col gap-6 relative overflow-hidden shadow-2xl transition-all duration-500 hover:border-cyan-500/10 select-none"
    >
      {/* Immersive 3D Space Background Grid and Glow */}
      <div className="absolute inset-0 bg-cyber-grid bg-[size:40px_40px] opacity-5 pointer-events-none" />
      <div className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-cyan-500/[0.03] rounded-full blur-[100px] pointer-events-none" />

      {/* TOP GLOWING TITLE BLOCK CAPSULE (Replica of the header from the second image) */}
      <div className="flex flex-col items-center relative z-30">
        <div className="bg-black/40 border border-white/10 px-5 py-2 rounded-2xl flex items-center gap-3 backdrop-blur-xl shadow-lg">
          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${vaActive ? 'bg-emerald-500/20 border-emerald-400/50' : 'bg-cyan-500/20 border-cyan-400/30'}`}>
            <User className={`w-3 h-3 ${vaActive ? 'text-emerald-300' : 'text-cyan-300'}`} />
          </div>
          <span className="font-sans text-xs font-black tracking-wider text-slate-100 uppercase">
            AI Voice Agent
          </span>
          {vaActive && (
            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">Live</span>
          )}
          <div className="w-px h-3 bg-white/10 mx-1" />
          <button
            onClick={() => { setShowKeyInput(v => !v); playBeep(500, 0.05); }}
            title="Configure Gemini API key for smarter replies"
            className="text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* API key configuration popover */}
        {showKeyInput && (
          <div className="mt-2 bg-slate-950/95 border border-cyan-500/30 rounded-xl p-3 w-[300px] shadow-[0_0_20px_rgba(6,182,212,0.2)] backdrop-blur-xl flex flex-col gap-2">
            <span className="text-[9px] font-mono text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3 h-3 text-cyan-400" />
              Gemini API Key <span className="text-cyan-400/80">— unlocks the real AI</span>
            </span>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[9px] font-mono text-cyan-300 underline decoration-dotted hover:text-cyan-200"
            >
              Get a free key at aistudio.google.com/apikey ↗
            </a>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your own Gemini key…"
              className="w-full text-[10px] font-mono bg-slate-900 text-cyan-200 border border-white/10 focus:border-cyan-400 rounded-lg px-2.5 py-2 outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => { try { localStorage.setItem('aiva_gemini_key', apiKey); } catch {} setShowKeyInput(false); playBeep(720, 0.08); }}
                className="flex-1 text-[9px] font-mono font-bold uppercase tracking-wider bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 rounded-lg py-1.5 cursor-pointer transition-all"
              >
                Save
              </button>
              <button
                onClick={() => { setApiKey(''); try { localStorage.removeItem('aiva_gemini_key'); } catch {} playBeep(360, 0.08); }}
                className="text-[9px] font-mono font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10 rounded-lg py-1.5 px-3 cursor-pointer transition-all"
              >
                Clear
              </button>
            </div>
            <span className={`text-[8px] font-mono leading-snug ${apiKey ? 'text-emerald-400/90' : 'text-amber-400/80'}`}>
              {apiKey
                ? '✓ Real AI mode active — AIVA answers any question via Gemini, and speaks with a guaranteed real female voice (not your device\'s default).'
                : 'Basic mode: built-in engine only knows a few set replies, and AIVA\'s voice falls back to whatever your browser/device has installed — which may not be female. Add a key above to fix both.'}
            </span>

            {/* ===== Admin-only: Call Recordings ===== */}
            <div className="border-t border-white/10 mt-2 pt-3 flex flex-col gap-2">
              <span className="text-[9px] font-mono text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-rose-400" />
                Call Recordings <span className="text-slate-500">— admin only, stored on this device</span>
              </span>

              {recordingsLoading ? (
                <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500 py-2">
                  <Loader className="w-3 h-3 animate-spin" /> Loading…
                </div>
              ) : recordings.length === 0 ? (
                <span className="text-[9px] font-mono text-slate-500 py-1">No recordings yet. They appear here after a voice session ends.</span>
              ) : (
                <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto scrollbar-none pr-0.5">
                  {recordings.map(rec => (
                    <div key={rec.id} className="bg-white/[0.03] border border-white/10 rounded-lg p-2.5 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[8px] font-mono text-slate-400">
                        <span>{rec.timestamp}</span>
                        <span>{Math.floor(rec.duration / 60)}m {rec.duration % 60}s</span>
                      </div>
                      {recAudioUrls[rec.id] && (
                        <audio
                          controls
                          preload="none"
                          src={recAudioUrls[rec.id]}
                          className="w-full h-7"
                          onPlay={() => setPlayingRecId(rec.id)}
                          style={{ colorScheme: 'dark' }}
                        />
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[8px] font-mono text-slate-500 truncate flex-1" title={rec.transcript}>
                          {rec.transcript.split('\n')[0]?.slice(0, 46) || 'No transcript'}
                        </span>
                        <button
                          onClick={() => handleDeleteRecording(rec.id)}
                          title="Delete recording"
                          className="text-slate-500 hover:text-rose-400 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <span className="text-[7px] font-mono text-slate-600 leading-snug">
                Callers see a recording notice before the mic activates. Recordings never leave this browser.
                {apiKey
                  ? ' Both sides are captured: your mic plus AIVA\'s real Gemini voice.'
                  : ' Only the caller\'s mic is captured in basic mode — add a Gemini key above to also record AIVA\'s spoken replies.'}
              </span>
            </div>

            {/* ===== Admin-only: Omnidimension real outbound calling ===== */}
            <div className="border-t border-white/10 mt-2 pt-3 flex flex-col gap-2">
              <span className="text-[9px] font-mono text-slate-300 flex items-center gap-1.5">
                <PhoneCall className="w-3 h-3 text-emerald-400" />
                Omnidimension — Real AI Sales Calls
              </span>

              {omniLoading ? (
                <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500 py-1">
                  <Loader className="w-3 h-3 animate-spin" /> Loading…
                </div>
              ) : !omniHealth ? (
                <span className="text-[9px] font-mono text-amber-400/80">
                  Can't reach the backend (run "npm run server"). Real calling needs it.
                </span>
              ) : (
                <>
                  <span className={`text-[8px] font-mono ${omniHealth.configured ? 'text-emerald-400/90' : 'text-amber-400/80'}`}>
                    {omniHealth.configured
                      ? '✓ OMNIDIM_API_KEY configured on the backend.'
                      : 'No OMNIDIM_API_KEY set — add it to server/.env.local. Get one at omnidim.io/api-management.'}
                  </span>
                  <span className={`text-[8px] font-mono ${omniHealth.geminiAnalysisConfigured ? 'text-emerald-400/90' : 'text-slate-500'}`}>
                    {omniHealth.geminiAnalysisConfigured
                      ? '✓ Call transcripts are analyzed by Gemini into lead updates.'
                      : 'No server-side GEMINI_API_KEY — call updates will use basic fallback, not full AI analysis.'}
                  </span>

                  {/* Per-agent Omnidimension mapping — each AIVA agent dials through their own Omnidimension agent */}
                  <span className="text-[8px] font-mono text-slate-500 mt-1">Agent ID mapping (from your Omnidimension dashboard):</span>
                  <div className="flex flex-col gap-1.5">
                    {agents.map(a => (
                      <div key={a.id} className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-slate-300 font-bold w-14 shrink-0 truncate">{a.name}</span>
                        <input
                          type="number"
                          value={omniAgentIdInputs[a.id] || ''}
                          onChange={(e) => setOmniAgentIdInputs(prev => ({ ...prev, [a.id]: e.target.value }))}
                          placeholder="Omnidimension agent ID"
                          className="flex-1 text-[10px] font-mono bg-slate-900 text-emerald-200 border border-white/10 focus:border-emerald-400 rounded-lg px-2.5 py-1.5 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={saveOmniAgentMapping}
                    className="text-[9px] font-mono font-bold uppercase bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 rounded-lg py-2 px-3 cursor-pointer transition-all"
                  >
                    Save Agent Mapping
                  </button>

                  {/* Autonomous dialing — OFF by default, confirmation required to enable */}
                  <button
                    onClick={toggleAutoDial}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 mt-1 cursor-pointer transition-all ${
                      omniSettings?.autoDialEnabled
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                        : 'bg-white/[0.03] border-white/10 text-slate-400'
                    }`}
                  >
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider">
                      Autonomous follow-up calling
                    </span>
                    {omniSettings?.autoDialEnabled
                      ? <ToggleRight className="w-4 h-4 text-rose-400" />
                      : <ToggleLeft className="w-4 h-4 text-slate-500" />}
                  </button>
                  <span className="text-[7px] font-mono text-slate-600">
                    {omniSettings?.autoDialEnabled
                      ? 'LIVE: AIVA will call leads whose follow-up date has arrived, with no per-call approval.'
                      : 'Off — AIVA will not place any call on its own until you enable this.'}
                  </span>

                  {/* Recent AI call log */}
                  <span className="text-[8px] font-mono text-slate-500 mt-2">Recent AI calls ({callEvents.length})</span>
                  {callEvents.length === 0 ? (
                    <span className="text-[9px] font-mono text-slate-600 py-1">No calls yet.</span>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto scrollbar-none pr-0.5">
                      {callEvents.slice(0, 10).map(ev => (
                        <div key={ev.id} className="bg-white/[0.03] border border-white/10 rounded-lg p-2 flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[8px] font-mono text-slate-400">
                            <span className="font-bold text-slate-200">{ev.leadName}</span>
                            <span>{ev.callStatus} · {ev.sentiment || '—'}</span>
                          </div>
                          <p className="text-[8px] font-mono text-slate-500 leading-snug">{ev.summary || 'No summary available.'}</p>
                          {ev.recordingUrl && (
                            <a href={ev.recordingUrl} target="_blank" rel="noreferrer" className="text-[8px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                              <ExternalLink className="w-2.5 h-2.5" /> Recording
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* THREE-COLUMN IMMERSIVE 3D PERSPECTIVE ENVIRONMENT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">

        {/* LEFT CARD (4 COLS): 3D Perspective Conversation History */}
        <div 
          className="lg:col-span-4 transition-transform duration-300 ease-out"
          style={{
            transform: `perspective(1200px) rotateY(${(15 + mousePos.x * 8).toFixed(1)}deg) rotateX(${(mousePos.y * -5).toFixed(1)}deg)`
          }}
        >
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-[5px_5px_30px_rgba(0,0,0,0.5)] flex flex-col gap-4 relative overflow-hidden">
            {/* Ambient card edge light */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-cyan-400/5 to-transparent pointer-events-none" />
            
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-white/5 pb-2 mb-1 flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
              Conversation History
            </h3>

            <div className="flex flex-col gap-3.5 max-h-[300px] min-h-[240px] overflow-y-auto scrollbar-none">
              {vaMessages.length === 0 ? (
                <>
                  <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-[9px] font-mono">
                      <span className="text-slate-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        System Ready
                      </span>
                      <span className="text-slate-500">#00.0.1</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-normal font-sans">
                      "AIVA voice channel initialized. Tap the call button below and start speaking — I'll reply out loud."
                    </p>
                  </div>
                  {vaUnsupported && (
                    <div className="bg-rose-500/[0.06] border border-rose-500/25 rounded-xl p-3 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                      <p className="text-[10px] text-rose-300/90 leading-normal font-sans">
                        Microphone / speech recognition isn't available or was blocked. Use Chrome and allow mic access to talk to AIVA.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                vaMessages.map((m, i) => (
                  <div
                    key={i}
                    className={`border rounded-xl p-3 flex flex-col gap-1.5 ${m.sender === 'aiva' ? 'bg-cyan-500/[0.06] border-cyan-500/20' : 'bg-white/[0.02] border-white/10'}`}
                  >
                    <div className="flex justify-between items-center text-[9px] font-mono">
                      <span className={`flex items-center gap-1 ${m.sender === 'aiva' ? 'text-cyan-300' : 'text-slate-300'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${m.sender === 'aiva' ? 'bg-cyan-400' : 'bg-emerald-400'}`} />
                        {m.sender === 'aiva' ? 'AIVA' : 'You'}
                      </span>
                      <span className="text-slate-500">{m.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-200 leading-normal font-sans">{m.text}</p>
                  </div>
                ))
              )}
              {vaThinking && (
                <div className="bg-cyan-500/[0.04] border border-cyan-500/20 rounded-xl p-3 flex items-center gap-2">
                  <Loader className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                  <span className="text-[10px] font-mono text-cyan-300/80">AIVA is thinking…</span>
                </div>
              )}
              {vaError && (
                <div className="bg-rose-500/[0.06] border border-rose-500/25 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-[9px] text-rose-300/90 leading-normal font-mono break-words">
                    AI backend error: {vaError.slice(0, 140)}
                  </p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Typed fallback — ask AIVA by text (works even without a mic) */}
            <form
              onSubmit={(e) => { e.preventDefault(); const v = typedInput.trim(); if (!v) return; setTypedInput(''); handleUserSpeech(v); }}
              className="flex items-center gap-2 mt-1"
            >
              <input
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
                placeholder="Type a question and press enter…"
                className="flex-1 text-[10px] font-mono bg-slate-900/70 text-slate-100 border border-white/10 focus:border-cyan-400 rounded-lg px-2.5 py-2 outline-none"
              />
              <button type="submit" title="Ask AIVA" className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 flex items-center justify-center hover:bg-cyan-500/25 cursor-pointer shrink-0">
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* CENTER WAVE SPHERE CANVAS CONTAINER (4 COLS) */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center relative min-h-[300px]">
          {/* Centered live voice core heading overlay */}
          <div className="absolute top-1 font-mono text-[9px] tracking-[0.35em] text-cyan-400/70 uppercase">
            LIVE SPECTRAL ENERGY
          </div>

          {/* Interactive Core Canvas */}
          <div className="w-full h-[280px] relative">
            <canvas ref={waveCanvasRef} className="w-full h-full absolute inset-0 z-0 pointer-events-none" />
          </div>

          <div className={`absolute bottom-8 font-mono text-[10px] tracking-[0.25em] animate-pulse ${vaSpeaking ? 'text-cyan-300' : vaSynthesizing ? 'text-fuchsia-300' : vaThinking ? 'text-indigo-300' : vaListening ? 'text-emerald-300' : 'text-slate-400'}`}>
            {vaSpeaking ? 'AIVA SPEAKING…' : vaSynthesizing ? 'GENERATING VOICE…' : vaThinking ? 'THINKING…' : vaListening ? 'LISTENING…' : vaActive ? 'CONNECTED' : 'STREAM ACTIVE'}
          </div>

          {/* Prominent Start / Stop real-time call button */}
          <button
            onClick={toggleConversation}
            className={`absolute bottom-[-8px] flex items-center gap-2 px-5 py-2.5 rounded-full font-mono text-[11px] font-black uppercase tracking-wider cursor-pointer transition-all border-2 ${
              vaActive
                ? 'bg-rose-500/15 border-rose-400 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.35)] hover:bg-rose-500/25'
                : 'bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.35)] hover:bg-cyan-500/25 animate-pulse'
            }`}
          >
            {vaActive ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            {vaActive ? 'End Voice Chat' : 'Talk to AIVA'}
          </button>

          {/* Recording disclosure — visible to whoever is about to talk to AIVA */}
          <div className={`absolute top-8 flex items-center gap-1.5 text-[8px] font-mono uppercase tracking-wider px-2 py-1 rounded-full border transition-opacity ${vaActive ? 'opacity-100 bg-rose-500/10 border-rose-500/30 text-rose-300' : 'opacity-60 bg-white/5 border-white/10 text-slate-400'}`}>
            <Disc className={`w-2.5 h-2.5 ${vaActive ? 'text-rose-400 animate-pulse' : ''}`} />
            {vaActive ? 'Recording this conversation' : 'Conversations are recorded'}
          </div>

          {/* Live mic frequency-bar equalizer — real per-bin analyser data from the caller's
              actual mic input, so it's visible in real time whether AIVA is hearing them. */}
          <div className={`absolute bottom-[-58px] w-full max-w-[240px] flex flex-col items-center gap-1.5 transition-opacity ${vaActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <canvas ref={micWaveCanvasRef} className="w-full h-9" />
            <span ref={micLevelLabelRef} className="text-[8px] font-mono text-slate-500 uppercase tracking-wider">Mic idle</span>
          </div>
        </div>

        {/* RIGHT CARD (4 COLS): 3D Perspective Real-time Analytics */}
        <div 
          className="lg:col-span-4 transition-transform duration-300 ease-out"
          style={{
            transform: `perspective(1200px) rotateY(${(-15 + mousePos.x * 8).toFixed(1)}deg) rotateX(${(mousePos.y * -5).toFixed(1)}deg)`
          }}
        >
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-[-5px_5px_30px_rgba(0,0,0,0.5)] flex flex-col gap-4 relative overflow-hidden">
            {/* Ambient card edge light */}
            <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/5 to-transparent pointer-events-none" />
            
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-white/5 pb-2 mb-1 flex items-center gap-2">
              <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
              Real-time Analytics
            </h3>

            {/* High-fidelity mini analytic telemetry components with sparklines */}
            <div className="flex flex-col gap-3">
              
              {/* Latency row */}
              <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 flex items-center justify-between hover:bg-white/[0.03] transition-all">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400">Latency:</span>
                  <span className="text-base font-black text-slate-100 font-mono mt-0.5">{latency}ms</span>
                </div>
                {/* SVG Sparkline */}
                <svg className="w-20 h-8" viewBox="0 0 100 30">
                  <path
                    d={latencyPoints.reduce((acc, val, idx) => {
                      const x = (idx / (latencyPoints.length - 1)) * 100;
                      const y = 30 - ((val - 9) / 7) * 25;
                      return acc + `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }, '')}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="1.5"
                  />
                  <circle cx="100" cy={30 - ((latencyPoints[latencyPoints.length-1] - 9) / 7) * 25} r="2" fill="#22d3ee" />
                </svg>
              </div>

              {/* Tokens row */}
              <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 flex items-center justify-between hover:bg-white/[0.03] transition-all">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400">Tokens:</span>
                  <span className="text-base font-black text-slate-100 font-mono mt-0.5">{tokens.toLocaleString()}</span>
                </div>
                {/* SVG Bar Sparkline */}
                <div className="flex items-end gap-1 h-8 w-20">
                  {tokenPoints.slice(-8).map((val, idx) => (
                    <div key={idx} className="flex-1 bg-white/[0.04] h-full rounded-t-sm flex items-end">
                      <div 
                        className="w-full bg-gradient-to-t from-cyan-500 to-indigo-500 rounded-t-sm transition-all duration-300" 
                        style={{ height: `${(val / 80) * 100}%` }} 
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Confidence row */}
              <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 flex items-center justify-between hover:bg-white/[0.03] transition-all">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400">Confidence:</span>
                  <span className="text-base font-black text-slate-100 font-mono mt-0.5">{confidence}%</span>
                </div>
                {/* SVG Area Sparkline */}
                <svg className="w-20 h-8" viewBox="0 0 100 30">
                  <path
                    d={confidencePoints.reduce((acc, val, idx) => {
                      const x = (idx / (confidencePoints.length - 1)) * 100;
                      const y = 30 - ((val - 97) / 2.6) * 25;
                      return acc + `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }, '')}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.5"
                  />
                  <path
                    d={confidencePoints.reduce((acc, val, idx) => {
                      const x = (idx / (confidencePoints.length - 1)) * 100;
                      const y = 30 - ((val - 97) / 2.6) * 25;
                      return acc + `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }, '') + ` L 100 30 L 0 30 Z`}
                    fill="rgba(16, 185, 129, 0.1)"
                  />
                  <circle cx="100" cy={30 - ((confidencePoints[confidencePoints.length-1] - 97) / 2.6) * 25} r="2" fill="#10b981" />
                </svg>
              </div>

              {/* Intent row */}
              <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 flex items-center justify-between hover:bg-white/[0.03] transition-all">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400">Intent:</span>
                  <span className="text-sm font-black text-slate-100 uppercase tracking-wider font-mono mt-0.5">{intent}</span>
                </div>
                {/* Pulse wave graph */}
                <svg className="w-20 h-8" viewBox="0 0 100 30">
                  <path
                    d={intentPoints.reduce((acc, val, idx) => {
                      const x = (idx / (intentPoints.length - 1)) * 100;
                      const y = 15 + Math.sin(idx) * (val / 4);
                      return acc + `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }, '')}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* BOTTOM IMMERSIVE glass CONTROL BAR (Replica of the control pad from second image) */}
      <div className="w-full flex justify-center items-center mt-2 relative z-20">
        <div className="bg-white/[0.02] border border-white/10 px-6 py-2.5 rounded-2xl flex items-center gap-6 backdrop-blur-xl shadow-xl">
          
          {/* Micro Button 1: Mic Trigger toggle (starts/stops live voice chat) */}
          <button
            onClick={toggleConversation}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
              vaListening
                ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : vaActive
                ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300'
                : 'bg-white/5 border-white/10 text-cyan-400 hover:bg-white/10 hover:border-cyan-500/30'
            }`}
            title={vaActive ? 'Stop voice chat' : 'Start voice chat'}
          >
            {vaActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          {/* Micro Button 2: Arrow Next */}
          <button
            onClick={() => {
              playBeep(440, 0.06, 'triangle');
              // Fluctuate stats manually for fun
              setLatency(prev => Math.max(9, Math.min(16, prev + (Math.random() > 0.5 ? 1 : -1))));
            }}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-cyan-300 hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer"
            title="Cycle Voice Stream Nodes"
          >
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Micro Button 3: Active Waveform Preset */}
          <button
            onClick={() => {
              playBeep(520, 0.05, 'sawtooth');
              setActiveButton('wave');
            }}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
              activeButton === 'wave'
                ? 'bg-cyan-500/10 border-cyan-400 text-cyan-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
            title="Dynamic Waves mode"
          >
            <Activity className="w-4 h-4" />
          </button>

          {/* Micro Button 4: System Telemetry Toggle */}
          <button
            onClick={() => {
              playBeep(600, 0.07, 'sine');
              setActiveButton('dots');
            }}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
              activeButton === 'dots'
                ? 'bg-indigo-500/15 border-indigo-400 text-indigo-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
            title="System Telemetry Core"
          >
            <Cpu className="w-4 h-4" />
          </button>

          {/* Inline language capsule indicator */}
          <div className="flex items-center gap-1.5 bg-black/30 border border-white/5 p-1 rounded-xl">
            {['EN', 'ES', 'JA', 'AR', 'HI'].map((lang) => {
              const isSelected = selectedLang === lang;
              return (
                <button
                  key={lang}
                  onClick={() => {
                    setSelectedLang(lang);
                    playBeep(450 + ['EN', 'ES', 'JA', 'AR', 'HI'].indexOf(lang) * 40, 0.08, 'sine');
                  }}
                  className={`text-[9px] font-mono font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-white/10 text-cyan-300 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {lang}
                </button>
              );
            })}
          </div>

        </div>
      </div>

    </div>
  );
}
