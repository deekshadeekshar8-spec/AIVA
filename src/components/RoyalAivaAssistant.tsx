import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Sparkles, Send, ShieldAlert, Cpu, Award, Zap, HelpCircle, TrendingUp } from 'lucide-react';
import { Lead, Agent } from '../types';
import { AivaLogo } from './AivaLogo';

interface RoyalAivaAssistantProps {
  leads: Lead[];
  agents: Agent[];
  playBeep: (freq: number, duration: number, type?: 'sine' | 'square' | 'triangle') => void;
  triggerToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export default function RoyalAivaAssistant({ leads, agents, playBeep, triggerToast }: RoyalAivaAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [aivaText, setAivaText] = useState<string>("Greetings, Commander. I am AIVA, your sovereign AI operations director. I oversee our autonomous sales force. Ask me anything about our pipeline or tell me to perform an analysis.");
  const [userInput, setUserInput] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [audioVolume, setAudioVolume] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const animationRef = useRef<number | null>(null);

  // Computed data for AIVA's intelligence
  const stats = React.useMemo(() => {
    const total = leads.length;
    const hotLeads = leads.filter(l => l.interestLevel === 'Hot Lead' || l.interestLevel === 'Interested');
    const siteVisits = leads.filter(l => l.siteVisitScheduled !== '').length;
    const completed = leads.filter(l => l.status === 'Completed' || l.status === 'Handed Over').length;
    const bestAgent = [...agents].sort((a, b) => b.stats.conversionRate - a.stats.conversionRate)[0];
    
    return {
      total,
      hotLeadsCount: hotLeads.length,
      siteVisits,
      completed,
      bestAgentName: bestAgent ? bestAgent.name : "N/A",
      bestAgentRate: bestAgent ? bestAgent.stats.conversionRate : 0
    };
  }, [leads, agents]);

  // Speech Recognition Setup for AIVA
  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onstart = () => {
      setIsListening(true);
      playBeep(650, 0.15, 'sine');
    };
    rec.onend = () => {
      setIsListening(false);
    };
    rec.onerror = (e: any) => {
      console.error('Aiva Recognition Error', e);
      setIsListening(false);
    };
    rec.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      handleUserInput(text);
    };

    recognitionRef.current = rec;
  }, [leads, agents]);

  // Audio wave animation for AIVA
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2.5;

      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, 'rgba(6, 182, 212, 0.05)');
      gradient.addColorStop(0.5, isSpeaking ? 'rgba(6, 182, 212, 0.95)' : isListening ? 'rgba(99, 102, 241, 0.95)' : 'rgba(6, 182, 212, 0.4)');
      gradient.addColorStop(1, 'rgba(6, 182, 212, 0.05)');
      ctx.strokeStyle = gradient;

      ctx.beginPath();
      const points = 80;
      const sliceWidth = canvas.width / points;
      let x = 0;

      for (let i = 0; i < points; i++) {
        // Multi-frequency royal sine wave calculations
        const speed = Date.now() * 0.008;
        const baseFreq = i * 0.12;
        const wave1 = Math.sin(baseFreq - speed) * (isSpeaking ? 22 : isListening ? 14 : 3);
        const wave2 = Math.cos(baseFreq * 0.5 + speed * 1.5) * (isSpeaking ? 12 : isListening ? 6 : 2);
        const waveHeight = wave1 + wave2 + canvas.height / 2;

        if (i === 0) {
          ctx.moveTo(x, waveHeight);
        } else {
          ctx.lineTo(x, waveHeight);
        }
        x += sliceWidth;
      }
      ctx.stroke();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isSpeaking, isListening]);

  // Speak Response function
  const speakAiva = (text: string) => {
    if (!window.speechSynthesis || !voiceEnabled) {
      setAivaText(text);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Premium elegant voice choice
    const voices = window.speechSynthesis.getVoices();
    const premiumVoice = voices.find(v => v.lang.startsWith('en-GB') || v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Elegant'));
    if (premiumVoice) {
      utterance.voice = premiumVoice;
    }
    
    utterance.rate = 1.05;
    utterance.pitch = 1.1;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setAivaText(text);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Main intelligence query routing engine
  const handleUserInput = (queryText: string) => {
    if (!queryText.trim()) return;
    setUserInput("");
    
    const text = queryText.toLowerCase();
    let response = "";

    if (text.includes('performance') || text.includes('how are') || text.includes('how is') || text.includes('status') || text.includes('going on') || text.includes('work')) {
      response = `Our AIVA sales network is performing magnificently. Currently, we have ${stats.total} total leads synchronised in the CRM. Of these, we have already processed and qualified ${stats.completed} high-end entries, with ${stats.hotLeadsCount} hot leads designated for direct human contact. ${stats.bestAgentName} is currently directing our peak sales charts with a conversion rate of ${stats.bestAgentRate} percent.`;
    } 
    else if (text.includes('agent') || text.includes('who is') || text.includes('kavya') || text.includes('arjun') || text.includes('ananya')) {
      response = `Our field contains 5 specialized virtual personas. Kavya handles premium luxury residences; Arjun is our technical advisor for commercial assets; Ananya directs smart living segments; Rohan oversees multi-family units; and Priya manages ultra-luxury estates. At this exact moment, ${stats.bestAgentName} is our primary converter at ${stats.bestAgentRate}% efficiency.`;
    } 
    else if (text.includes('hot') || text.includes('interested') || text.includes('pipeline')) {
      response = `We have marked ${stats.hotLeadsCount} active leads as extremely hot. This includes Eleanor Vance, who is seeking a luxury loft in Manhattan with a budget of 1.2 million dollars. We have scheduled ${stats.siteVisits} physical site visits, and WhatsApp automated asset sheets have been successfully pushed to all high-intent customers.`;
    }
    else if (text.includes('follow-up') || text.includes('pending') || text.includes('schedule')) {
      response = `The scheduler currently has several automated retries prepared. We have specific follow-ups scheduled for customer Amit Sharma tomorrow, and Sarah Jenkins has a callback configured. Our system dialer is configured to retry unreachable customers within 30 seconds of any new lead arrival.`;
    } 
    else if (text.includes('rules') || text.includes('workflow') || text.includes('how does')) {
      response = `AIVA operates under strict automated protocols. First, incoming leads are parsed and assigned via round-robin distribution. Second, the assigned agent dials within 30 seconds. Third, calls are recorded, analyzed, and transcribed. Fourth, dynamic qualification updates the CRM. Finally, interested leads are packaged and handed over to humans.`;
    }
    else {
      // Fallback response with dynamic summary
      response = `I hear you, Commander. As your operation supervisor AIVA, I can report that the current sales pipeline is active. We have ${stats.total} leads in our ledger, of which ${stats.hotLeadsCount} are marked as highly prospective. Would you like me to compile a comprehensive daily report or run a voice check with one of our specialized agents?`;
    }

    speakAiva(response);
    triggerToast(`AIVA processed: "${queryText.substring(0, 30)}..."`, 'success');
  };

  const toggleAivaMic = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    } else {
      if (!recognitionRef.current) {
        triggerToast("Voice recognition is not supported in this browser version. Please type your query.", "error");
        return;
      }
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Handle preset queries directly
  const runPresetQuery = (query: string) => {
    playBeep(580, 0.08, 'sine');
    handleUserInput(query);
  };

  return (
    <div className="relative rounded-2xl p-6 overflow-hidden border-2 border-cyan-500/30 iceglass flex flex-col gap-6">
      {/* Royal Design Overlays */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header Info */}
      <div className="flex justify-between items-start border-b border-cyan-500/20 pb-4">
        <div className="flex items-center gap-3">
          <AivaLogo size={42} animated={true} layout="icon-only" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-cyan-400 to-indigo-500 font-mono">AIVA OPERATIONAL SUPERVISOR</h3>
              <span className="text-[9px] px-2 py-0.5 bg-white/5 text-cyan-300 border border-white/10 rounded font-mono font-bold animate-pulse backdrop-blur-md">ROYAL ADMIN ASSISTANT</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">Supreme Core Dialogue Engine // Voice & Telemetry</p>
          </div>
        </div>

        {/* Audio Output Settings */}
        <button
          onClick={() => { setVoiceEnabled(!voiceEnabled); playBeep(500, 0.1); }}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${voiceEnabled ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-white/5 border-white/10 text-slate-500'}`}
          title={voiceEnabled ? "Mute AIVA Voice" : "Unmute AIVA Voice"}
        >
          {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* Royal Hologram Core Widget */}
      <div className="flex flex-col md:flex-row items-center gap-6 bg-white/[0.02] border border-white/10 p-6 rounded-xl backdrop-blur-md">
        <div className="relative flex-shrink-0 flex items-center justify-center w-36 h-36 rounded-full border border-cyan-500/15">
          {/* Orbital glowing ring */}
          <div className={`absolute inset-0 rounded-full border-2 border-dashed border-cyan-500/20 animate-spin ${isSpeaking ? 'opacity-100 scale-105' : 'opacity-40 scale-95'}`} style={{ animationDuration: '24s' }} />
          <div className={`absolute inset-2 rounded-full border border-indigo-500/20 animate-reverse-spin ${isListening ? 'opacity-100 scale-105' : 'opacity-40 scale-95'}`} style={{ animationDuration: '14s' }} />

          {/* Central majestic core */}
          <div 
            onClick={toggleAivaMic}
            className={`w-24 h-24 rounded-full bg-gradient-to-b from-[#09152e] to-[#12244e] border flex flex-col items-center justify-center transition-all duration-500 cursor-pointer ${isSpeaking ? 'border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.4)] scale-105' : isListening ? 'border-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.4)] scale-105' : 'border-white/10 hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)]'}`}
          >
            {isSpeaking ? (
              <AivaLogo size={40} animated={true} variant="full" layout="icon-only" />
            ) : isListening ? (
              <AivaLogo size={40} animated={true} variant="full" layout="icon-only" className="animate-pulse" />
            ) : (
              <AivaLogo size={40} animated={false} variant="minimal" layout="icon-only" />
            )}
            <span className="text-[8px] font-mono mt-1 font-bold tracking-widest text-slate-500">
              {isSpeaking ? "SPEAKING" : isListening ? "LISTENING" : "STANDBY"}
            </span>
          </div>
        </div>

        {/* Text Feed Console */}
        <div className="flex-1 flex flex-col gap-3">
          <div className="relative p-4 rounded-xl border border-cyan-500/20 bg-white/[0.01] min-h-[100px] flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-cyan-300 mt-0.5 flex-shrink-0 animate-pulse" />
            <div className="flex-1">
              <p className="text-[10px] font-mono uppercase tracking-wider text-cyan-300 font-bold">AIVA SAYS:</p>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed font-sans">{aivaText}</p>
            </div>
          </div>

          {/* Canvas Waveform */}
          <canvas ref={canvasRef} width={400} height={32} className="w-full h-8 bg-white/5 rounded border border-white/10" />
        </div>
      </div>

      {/* Suggestive Command Queries */}
      <div className="flex flex-col gap-2">
        <p className="text-[9px] font-mono uppercase tracking-wider text-slate-500">Suggested Admin Commands (AIVA will voice-respond):</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { label: "Analyze performance & work progress", q: "How is work going on?" },
            { label: "Summarize hot prospects & pipeline", q: "Give me a pipeline summary" },
            { label: "Review agent allocation & conversions", q: "Who is our best agent?" },
            { label: "Explain AIVA workflow rules", q: "How do system rules work?" }
          ].map((cmd, idx) => (
            <button
              key={idx}
              onClick={() => runPresetQuery(cmd.q)}
              className="text-left text-xs bg-white/[0.02] hover:bg-white/[0.08] border border-white/5 hover:border-cyan-500/20 p-2.5 rounded-lg flex items-center justify-between text-slate-300 hover:text-cyan-300 transition-all cursor-pointer"
            >
              <span className="font-sans text-[11px] font-medium">{cmd.label}</span>
              <Zap className="w-3 h-3 text-cyan-500" />
            </button>
          ))}
        </div>
      </div>

      {/* Manual text query console */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleUserInput(userInput); }}
        className="flex gap-2"
      >
        <input 
          type="text" 
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Ask AIVA a direct operation question (e.g., 'who is kavya', 'explain rules')..."
          className="flex-1 text-xs iceglass-input rounded-xl px-4 py-3 placeholder-slate-500"
        />
        <button
          type="submit"
          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-3 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          Query
        </button>
        <button
          type="button"
          onClick={toggleAivaMic}
          className={`px-3 py-3 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${isListening ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.25)]' : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20'}`}
          title="Voice command mode"
        >
          {isListening ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
