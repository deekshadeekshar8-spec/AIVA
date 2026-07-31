import React, { useEffect, useRef } from 'react';
import { 
  Phone, PhoneCall, PhoneOff, Mic, MicOff, Activity, User, MapPin, Sparkles, Clock, Globe, FileText, CheckCircle
} from 'lucide-react';
import { Lead, Agent, TranscriptItem } from '../types';
import { DIALOGUE_SCRIPTS } from '../data';

interface CallingConsoleProps {
  isCalling: boolean;
  isRinging: boolean;
  micActive: boolean;
  isAiSpeaking: boolean;
  audioVolume: number;
  transcript: TranscriptItem[];
  activeAgent: Agent;
  activeLead: Lead;
  initiateCall: (leadId?: string) => void;
  toggleMicrophone: () => void;
  endCall: () => void;
  handleCustomerUtterance: (text: string) => void;
  isSpeechSupported: boolean;
}

export default function CallingConsole({
  isCalling,
  isRinging,
  micActive,
  isAiSpeaking,
  audioVolume,
  transcript,
  activeAgent,
  activeLead,
  initiateCall,
  toggleMicrophone,
  endCall,
  handleCustomerUtterance,
  isSpeechSupported
}: CallingConsoleProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Dynamic voice waves visualizer inside the console
  useEffect(() => {
    if (isCalling && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2;
        
        let gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, 'rgba(6, 182, 212, 0.05)');
        gradient.addColorStop(0.5, isAiSpeaking ? 'rgba(236, 72, 153, 0.9)' : 'rgba(6, 182, 212, 0.9)');
        gradient.addColorStop(1, 'rgba(6, 182, 212, 0.05)');
        ctx.strokeStyle = gradient;

        ctx.beginPath();
        const sliceWidth = canvas.width / 100;
        let x = 0;

        for (let i = 0; i < 100; i++) {
          const noise = Math.sin(i * 0.15 + Date.now() * 0.012) * (isAiSpeaking ? 24 : (micActive ? 12 : 3));
          const waveHeight = noise * (audioVolume > 0 ? audioVolume * 1.5 : 1) + canvas.height / 2;
          if (i === 0) {
            ctx.moveTo(x, waveHeight);
          } else {
            ctx.lineTo(x, waveHeight);
          }
          x += sliceWidth;
        }
        ctx.stroke();
        animationFrameId.current = requestAnimationFrame(draw);
      };
      draw();
    } else {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    }
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [isCalling, isAiSpeaking, micActive, audioVolume]);

  return (
    <div className="iceglass rounded-2xl p-6 flex flex-col gap-6 relative overflow-hidden transition-all duration-300">
      <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex justify-between items-center border-b border-white/10 pb-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400 font-mono">Cognitive Audio Command Center</h2>
          <p className="text-xs text-slate-400">Interact with the active outbound AI Agent via live voice or direct input.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono px-3 py-1 bg-white/[0.03] border border-white/10 text-slate-300 rounded-lg backdrop-blur-md">
            ACTIVE AGENT: <strong className="text-cyan-400">{activeAgent.name}</strong>
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold text-emerald-400 font-mono">AGENT ONLINE</span>
          </div>
        </div>
      </div>

      {/* Orbital Speech Visualizer */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center gap-6 shadow-inner relative min-h-[300px]">
        <div className="absolute top-3 left-4 font-mono text-[10px] text-slate-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          AUDIO STREAM FEED // MONO_16KHZ
        </div>
        <div className="absolute top-3 right-4 font-mono text-[10px] text-slate-500">
          DECIBELS: {(audioVolume * 2).toFixed(1)} dB
        </div>

        {/* Pulsing Core Hologram */}
        <div className={`relative w-36 h-36 rounded-full flex items-center justify-center transition-all duration-500 ${isCalling ? 'shadow-[0_0_50px_rgba(6,182,212,0.15)]' : ''}`}>
          <div className={`absolute inset-0 rounded-full border border-cyan-500/20 animate-spin ${isCalling ? 'scale-110 opacity-100' : 'scale-90 opacity-0'}`} style={{ animationDuration: '8s' }} />
          <div className={`absolute inset-2 rounded-full border border-indigo-500/20 animate-reverse-spin ${isCalling ? 'scale-105 opacity-100' : 'scale-90 opacity-0'}`} style={{ animationDuration: '12s' }} />
          
          <div className={`w-28 h-28 rounded-full bg-gradient-to-tr from-[#09152e] to-[#12244e] border-2 flex flex-col items-center justify-center transition-all duration-500 ${isAiSpeaking ? 'border-pink-500 shadow-[0_0_30px_rgba(236,72,153,0.3)]' : isCalling ? 'border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.3)]' : 'border-white/10 shadow-none'}`}>
            {isRinging ? (
              <PhoneCall className="w-10 h-10 text-cyan-400 animate-bounce" />
            ) : isCalling ? (
              <div className="flex flex-col items-center">
                <Activity className={`w-8 h-8 ${isAiSpeaking ? 'text-pink-500' : 'text-cyan-400'} animate-pulse`} />
                <span className="text-[9px] font-mono mt-1 text-slate-400 font-bold uppercase tracking-widest">
                  {isAiSpeaking ? 'AI TALKING' : 'LISTENING'}
                </span>
              </div>
            ) : (
              <Phone className="w-10 h-10 text-slate-600" />
            )}
          </div>
        </div>

        {/* Animated Audio Waveform */}
        <div className="w-full max-w-lg mt-2">
          <canvas 
            ref={canvasRef} 
            width={500} 
            height={60} 
            className="w-full h-16 bg-white/[0.02] rounded-xl border border-white/5"
          />
        </div>

        {/* Call Controller Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
          {!isCalling && !isRinging ? (
            <button
              onClick={() => initiateCall()}
              className="flex items-center gap-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs uppercase tracking-widest px-8 py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-105 cursor-pointer"
            >
              <PhoneCall className="w-5 h-5" />
              Answer/Initiate AI Call
            </button>
          ) : (
            <div className="flex gap-4">
              <button
                onClick={toggleMicrophone}
                className={`flex items-center gap-2 font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-all border ${micActive ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.25)]' : 'bg-white/[0.02] text-slate-400 border-white/5 hover:border-white/10'} cursor-pointer`}
              >
                {micActive ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4" />}
                {micActive ? 'Mute Mic' : 'Talk with Voice'}
              </button>
              <button
                onClick={endCall}
                className="flex items-center gap-2 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(244,63,94,0.3)] cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
                End Dialogue
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Dialogue Transcript and Chat Fallback */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            Live Cognitive Transcript
          </h3>
          {isSpeechSupported ? (
            <span className="text-[10px] text-emerald-400 font-mono">✔ speech recognition ready</span>
          ) : (
            <span className="text-[10px] text-indigo-400 font-mono">⚠️ speech recognition fallback mode</span>
          )}
        </div>

        <div className="bg-white/[0.01] border border-white/10 rounded-xl p-4 h-52 overflow-y-auto flex flex-col gap-3 scrollbar-thin">
          {transcript.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-4">
              <Phone className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">No active call transcript. Click "Answer/Initiate AI Call" to simulate.</p>
            </div>
          ) : (
            transcript.map((item, idx) => (
              <div 
                key={idx} 
                className={`flex flex-col max-w-[85%] ${item.sender === 'agent' ? 'self-start' : 'self-end items-end'}`}
              >
                <span className="text-[9px] font-mono text-slate-500 mb-0.5">{item.sender === 'agent' ? `AI Agent (${activeAgent.name})` : activeLead.name} • {item.time}</span>
                <div className={`p-3 rounded-xl text-xs leading-relaxed ${item.sender === 'agent' ? 'bg-white/5 border border-white/10 text-slate-200' : 'bg-cyan-500/15 border-cyan-500/35 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.15)]'}`}>
                  {item.text}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Text and Suggested Input Panel */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] text-slate-400 font-mono">CUSTOMER PRESETS (CLICK TO SIMULATE VOICE INPUT):</p>
          <div className="flex flex-wrap gap-2">
            {(DIALOGUE_SCRIPTS[activeLead.name] || DIALOGUE_SCRIPTS["Generic"]).map((step, idx) => (
              <button
                key={idx}
                disabled={!isCalling}
                onClick={() => handleCustomerUtterance(step.prompt)}
                className="text-[11px] bg-white/[0.02] hover:bg-white/[0.08] border border-white/10 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 rounded-lg px-3 py-1.5 text-left transition-all max-w-xs truncate disabled:opacity-45 disabled:pointer-events-none cursor-pointer font-sans"
                title={step.prompt}
              >
                "{step.prompt}"
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
