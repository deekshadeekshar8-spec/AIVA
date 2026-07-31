import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, X, Send, Loader } from 'lucide-react';
import { Agent, Lead } from '../types';
import { base64ToUint8Array, pcm16ToWavArrayBuffer } from '../utils/audio';

interface AgentVoiceChatProps {
  agent: Agent;
  leads: Lead[]; // full leads array — filtered to this agent inside
  onClose: () => void;
  playBeep?: (freq: number, duration: number, type?: 'sine' | 'square' | 'triangle') => void;
}

// A distinct Gemini native TTS voice per agent so the 5 agents don't all sound
// identical to each other or to AIVA's own "Kore" voice.
const AGENT_VOICE_NAME: Record<string, string> = {
  agent_1: 'Kore',    // Kavya
  agent_2: 'Charon',  // Arjun
  agent_3: 'Aoede',   // Ananya
  agent_4: 'Fenrir',  // Rohan
  agent_5: 'Leda',    // Priya
};

// Tailwind's build-time scanner needs these as complete literal strings — a template
// literal like `from-${agent.color}-500` would never get generated in the CSS build.
const AGENT_GRADIENT: Record<string, string> = {
  agent_1: 'from-teal-400 to-emerald-400',     // Kavya
  agent_2: 'from-blue-500 to-cyan-400',        // Arjun
  agent_3: 'from-violet-500 to-purple-400',    // Ananya
  agent_4: 'from-orange-400 to-amber-400',     // Rohan
  agent_5: 'from-fuchsia-500 to-pink-400',     // Priya
};

type Msg = { sender: 'user' | 'agent'; text: string };

export default function AgentVoiceChat({ agent, leads, onClose, playBeep = () => {} }: AgentVoiceChatProps) {
  const [apiKey] = useState<string>(() => {
    try { return localStorage.getItem('aiva_gemini_key') || ''; } catch { return ''; }
  });
  const [active, setActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [textInput, setTextInput] = useState('');
  const [unsupported, setUnsupported] = useState(false);
  const [error, setError] = useState('');

  const activeRef = useRef(active);
  const speakingRef = useRef(false);
  const thinkingRef = useRef(false);
  const synthesizingRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const genaiModuleRef = useRef<Promise<any> | null>(null);
  const messagesRef = useRef<Msg[]>([]);

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { speakingRef.current = speaking; }, [speaking]);
  useEffect(() => { thinkingRef.current = thinking; }, [thinking]);
  useEffect(() => { synthesizingRef.current = synthesizing; }, [synthesizing]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const getGenAIModule = () => {
    if (!genaiModuleRef.current) genaiModuleRef.current = import('@google/genai');
    return genaiModuleRef.current;
  };
  useEffect(() => { if (apiKey) getGenAIModule(); }, [apiKey]);

  const getAudioCtx = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return audioCtxRef.current;
  };

  // Real work briefing for THIS agent only — their own leads, nothing fabricated.
  const persona = useMemo(() => {
    const mine = leads.filter(l => l.agentId === agent.id);
    const lines = mine.slice(0, 30).map(l =>
      `- ${l.name} (${l.phone}): status=${l.status}, interest=${l.interestLevel}, project=${l.project}, ` +
      `budget=${l.budget ? '$' + l.budget.toLocaleString() : 'unknown'}, next follow-up=${l.nextFollowUpDate || 'none'}, ` +
      `remarks="${l.remarks || 'none'}".`
    ).join('\n');
    return [
      `You are ${agent.name}, a real AI sales agent working as a ${agent.role} at a real-estate company. Your tone is ${agent.tone}. Speak in the first person as yourself — never say "I'll check with the agent" or refer to yourself in third person, because you ARE the agent.`,
      `You are being asked questions by your Manager. Answer honestly using ONLY the real data below about YOUR OWN leads (there are ${mine.length} total assigned to you). If asked something not covered by this data, say you don't have that information — never invent numbers, names, or outcomes.`,
      `\n=== YOUR ASSIGNED LEADS (showing up to 30 of ${mine.length}) ===\n${lines || 'You have no leads assigned yet.'}`,
      `\nKeep replies SHORT — 1 to 2 sentences, spoken naturally out loud. No markdown, no bullet points, no emojis.`,
    ].join('\n');
  }, [agent, leads]);

  const addMessage = (sender: Msg['sender'], text: string) => setMessages(prev => [...prev, { sender, text }]);

  // ---- TTS ----
  const synthesizeSpeech = async (text: string): Promise<AudioBuffer | null> => {
    if (!apiKey) return null;
    const { GoogleGenAI } = await getGenAIModule();
    const ai = new GoogleGenAI({ apiKey });
    const res: any = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: text,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: AGENT_VOICE_NAME[agent.id] || 'Kore' } } },
      },
    });
    const part = res?.candidates?.[0]?.content?.parts?.[0];
    const inline = part?.inlineData;
    if (!inline?.data) return null;
    const mime: string = inline.mimeType || 'audio/pcm;rate=24000';
    const rateMatch = /rate=(\d+)/.exec(mime);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
    const pcmBytes = base64ToUint8Array(inline.data);
    const wavBuffer = pcm16ToWavArrayBuffer(pcmBytes, sampleRate, 1);
    const ctx = getAudioCtx();
    return ctx.decodeAudioData(wavBuffer);
  };

  const playBuffer = (ctx: AudioContext, buffer: AudioBuffer): Promise<void> => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    setSpeaking(true);
    return new Promise(resolve => { src.onended = () => { setSpeaking(false); resolve(); }; src.start(); });
  };

  const speakBrowserVoice = (text: string) => new Promise<void>(resolve => {
    if (!('speechSynthesis' in window)) { resolve(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.onstart = () => setSpeaking(true);
    u.onend = () => { setSpeaking(false); resolve(); };
    u.onerror = () => { setSpeaking(false); resolve(); };
    window.speechSynthesis.speak(u);
  });

  const extractReadyChunks = (buffer: string, flushAll: boolean): { ready: string[]; rest: string } => {
    const parts = buffer.match(/[^.!?]+[.!?]*/g) || (buffer ? [buffer] : []);
    const ready: string[] = [];
    let acc = '';
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      acc += parts[i];
      const endsWithPunct = /[.!?]\s*$/.test(parts[i]);
      if (acc.trim().length >= 20 && endsWithPunct) { ready.push(acc.trim()); acc = ''; }
      else if (isLast && flushAll && acc.trim()) { ready.push(acc.trim()); acc = ''; }
    }
    return { ready, rest: acc };
  };

  // Streams Gemini's reply and overlaps TTS synthesis with generation, same pipelining
  // pattern used for AIVA's own voice — the agent starts talking as soon as the first
  // sentence is ready instead of waiting for the whole reply.
  const speakStreamingReply = async (input: string): Promise<string> => {
    if (!apiKey) {
      const fallback = "I'm in basic mode right now — add a Gemini API key in AIVA's settings so I can actually answer questions.";
      await speakBrowserVoice(fallback);
      return fallback;
    }
    let fullText = '';
    let buffer = '';
    const queue: string[] = [];
    let streamEnded = false;
    let wake: (() => void) | null = null;
    const notify = () => { if (wake) { const w = wake; wake = null; w(); } };

    const producer = (async () => {
      try {
        const { GoogleGenAI } = await getGenAIModule();
        const ai = new GoogleGenAI({ apiKey });
        const history = messagesRef.current.slice(-8).map(m => `${m.sender === 'user' ? 'Manager' : agent.name}: ${m.text}`).join('\n');
        const stream: any = await ai.models.generateContentStream({
          model: 'gemini-flash-latest',
          contents: `${history}\nManager: ${input}\n${agent.name}:`,
          config: { systemInstruction: persona },
        });
        for await (const part of stream) {
          const t = part?.text || '';
          if (!t) continue;
          fullText += t;
          buffer += t;
          const { ready, rest } = extractReadyChunks(buffer, false);
          buffer = rest;
          if (ready.length) { queue.push(...ready); notify(); }
        }
        const { ready } = extractReadyChunks(buffer, true);
        if (ready.length) queue.push(...ready);
      } catch (e: any) {
        setError(e?.message || 'Gemini call failed');
      } finally {
        streamEnded = true;
        notify();
      }
    })();

    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch {} }
    setSynthesizing(true);
    let spokeAny = false;
    while (true) {
      if (queue.length === 0) {
        if (streamEnded) break;
        await new Promise<void>(resolve => { wake = resolve; });
        continue;
      }
      const chunk = queue.shift()!;
      const buf = await synthesizeSpeech(chunk);
      if (!spokeAny) { setSynthesizing(false); spokeAny = true; }
      if (buf) await playBuffer(ctx, buf);
    }
    setSynthesizing(false);
    await producer;
    return fullText.trim() || "I don't have anything to add on that right now.";
  };

  const ensureRecognition = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setUnsupported(true); return null; }
    if (recognitionRef.current) return recognitionRef.current;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (e: any) => {
      const text = e.results[e.results.length - 1][0].transcript;
      handleUserSpeech(text);
    };
    rec.onend = () => {
      setListening(false);
      if (activeRef.current && !speakingRef.current && !thinkingRef.current && !synthesizingRef.current) {
        try { rec.start(); setListening(true); } catch {}
      }
    };
    rec.onerror = (e: any) => {
      setListening(false);
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') { setUnsupported(true); activeRef.current = false; setActive(false); }
    };
    recognitionRef.current = rec;
    return rec;
  };

  const startListening = () => {
    const rec = ensureRecognition();
    if (!rec) return;
    try { rec.start(); setListening(true); } catch {}
  };

  const handleUserSpeech = async (text: string, fromTextBox = false) => {
    if (!text || !text.trim()) return;
    try { recognitionRef.current?.stop(); } catch {}
    addMessage('user', text.trim());
    setThinking(true);
    playBeep(600, 0.06, 'sine');
    const reply = await speakStreamingReply(text.trim());
    setThinking(false);
    addMessage('agent', reply);
    if (activeRef.current && !fromTextBox) startListening();
  };

  const startConversation = async () => {
    setActive(true); activeRef.current = true;
    playBeep(700, 0.1, 'sine');
    const greeting = apiKey
      ? `Hi, I'm ${agent.name}. Ask me about my leads or anything else.`
      : `Hi, I'm ${agent.name}. Add a Gemini key in AIVA settings so I can really talk.`;
    addMessage('agent', greeting);
    if (apiKey) {
      const buf = await synthesizeSpeech(greeting);
      if (buf) await playBuffer(getAudioCtx(), buf);
      else await speakBrowserVoice(greeting);
    } else {
      await speakBrowserVoice(greeting);
    }
    if (activeRef.current) startListening();
  };

  const stopConversation = () => {
    activeRef.current = false; setActive(false);
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
  };

  useEffect(() => () => { try { recognitionRef.current?.stop(); } catch {} window.speechSynthesis?.cancel(); }, []);

  const submitText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const t = textInput.trim();
    setTextInput('');
    handleUserSpeech(t, true);
  };

  const gradient = AGENT_GRADIENT[agent.id] || 'from-indigo-500 to-cyan-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-panel rounded-3xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`relative w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md`}>
              <span className="text-white font-black text-lg">{agent.name[0]}</span>
              {speaking && <span className="absolute -inset-1 rounded-2xl ring-2 ring-emerald-400 pulse-ring" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{agent.name}</h3>
              <p className="text-[11px] text-slate-500">{agent.role}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {unsupported && (
          <div className="mb-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3">
            Voice mic isn't available/allowed in this browser — you can still type below.
          </div>
        )}
        {error && (
          <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</div>
        )}

        <div className="flex flex-col gap-2.5 max-h-[280px] overflow-y-auto mb-4 pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`text-sm rounded-2xl px-3.5 py-2 max-w-[85%] ${m.sender === 'user' ? 'self-end ml-auto bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
              {m.text}
            </div>
          ))}
          {thinking && <div className="text-xs text-slate-400 flex items-center gap-1.5"><Loader className="w-3.5 h-3.5 animate-spin" /> {agent.name} is thinking…</div>}
          {synthesizing && <div className="text-xs text-slate-400 flex items-center gap-1.5"><Loader className="w-3.5 h-3.5 animate-spin" /> Generating voice…</div>}
        </div>

        <div className="flex items-center justify-center mb-4">
          <button
            onClick={() => active ? stopConversation() : startConversation()}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm cursor-pointer transition-all ${
              active ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/30'
            }`}
          >
            {active ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {active ? (listening ? `Listening…` : `Talking to ${agent.name}`) : `Talk to ${agent.name}`}
          </button>
        </div>

        <form onSubmit={submitText} className="flex items-center gap-2">
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={`Type a question for ${agent.name}...`}
            className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-300"
          />
          <button type="submit" className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
