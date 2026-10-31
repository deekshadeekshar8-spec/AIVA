import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellIcon, LogOutIcon, MicIcon, SearchIcon, SendIcon, Volume2Icon, VolumeXIcon } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAiva } from '../../contexts/AivaContext';
import { useAuth } from '../../contexts/AuthContext';
import { useRealCrmStatsContext } from '../../contexts/RealCrmStatsContext';
import { useSpeechInput } from '../../hooks/useSpeechInput';
import { suggestedCommands } from '../../utils/orchestrator';

export function CommandBar() {
  const { ask, voiceEnabled, setVoiceEnabled, setListening, actionLog } = useAiva();
  const { user, logout } = useAuth();
  const { leads } = useRealCrmStatsContext();
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [notifOpen]);

  const handleVoice = useCallback(
    (text: string) => {
      setValue(text);
      ask(text);
      setOpen(false);
    },
    [ask]
  );

  const speech = useSpeechInput(handleVoice);

  useEffect(() => {
    setListening(speech.listening);
  }, [speech.listening, setListening]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (text: string) => {
    if (!text.trim()) return;
    ask(text);
    setValue('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const matchingLeads = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 2) return [];
    return leads.filter((l) => l.name.toLowerCase().includes(q) || l.phone.includes(q)).slice(0, 5);
  }, [value, leads]);

  const openLead = (leadId: string) => {
    navigate(`/leads/${leadId}`);
    setValue('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <header className="relative z-[80] flex items-center gap-4 border-b border-line bg-[#05080f]/80 px-4 py-3 backdrop-blur-xl md:px-6">
      <div className="relative mx-auto w-full max-w-[560px]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(value);
          }}
          role="search">
          
          <div
            className={cn(
              'flex items-center gap-2.5 rounded-full border border-line bg-white/[0.03] px-4 py-2 transition-colors duration-200 ease-cinema',
              open && 'border-agent-voice/40 bg-white/[0.05]'
            )}>
            
            <SearchIcon className="h-4 w-4 shrink-0 text-ink-faint" />
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setOpen(true)}
              onBlur={() => window.setTimeout(() => setOpen(false), 140)}
              placeholder="Search leads, calls, or ask AIVA…"
              aria-label="Ask AIVA"
              className="w-full bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none" />
            
            <button
              type="button"
              onClick={() => speech.listening ? speech.stop() : speech.supported ? speech.start() : inputRef.current?.focus()}
              aria-label={speech.listening ? 'Stop listening' : 'Speak to AIVA'}
              className={cn(
                'grid h-7 w-7 place-items-center rounded-full transition-colors duration-200 ease-cinema',
                speech.listening ?
                'bg-agent-voice/20 text-agent-voice' :
                'text-ink-faint hover:bg-white/[0.06] hover:text-ink'
              )}>
              
              <MicIcon className="h-3.5 w-3.5" />
            </button>
            {value.trim() &&
            <button
              type="submit"
              aria-label="Ask AIVA"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-void transition-opacity duration-150 ease-cinema hover:opacity-90"
              style={{ background: 'var(--accent, #22d3ee)' }}>

                <SendIcon className="h-3.5 w-3.5" />
              </button>
            }
            <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[10px] text-ink-faint sm:block">
              ⌘ K
            </kbd>
          </div>
        </form>

        {open &&
        <div className="glass absolute left-0 right-0 top-[calc(100%+8px)] max-h-[380px] overflow-y-auto rounded-2xl p-2 shadow-panel">
            {matchingLeads.length > 0 &&
          <>
                <p className="px-3 py-2 text-[10px] uppercase tracking-widest text-ink-faint">Matching Leads</p>
                {matchingLeads.map((lead) =>
            <button
              key={lead.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => openLead(lead.id)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors duration-150 ease-cinema hover:bg-white/[0.05]">

                    <span className="text-ink">{lead.name}</span>
                    <span className="text-[11px] text-ink-faint">{lead.phone}</span>
                  </button>
            )}
              </>
          }
            <p className="px-3 py-2 text-[10px] uppercase tracking-widest text-ink-faint">
              {speech.listening ? 'Listening…' : 'Ask your AI sales team'}
            </p>
            {suggestedCommands.map((cmd) =>
          <button
            key={cmd}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => submit(cmd)}
            className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-ink-muted transition-colors duration-150 ease-cinema hover:bg-white/[0.05] hover:text-ink">

                {cmd}
              </button>
          )}
          </div>
        }
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          aria-label={voiceEnabled ? 'Mute agent voices' : 'Unmute agent voices'}
          className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-muted transition-colors duration-200 ease-cinema hover:text-ink">
          
          {voiceEnabled ? <Volume2Icon className="h-4 w-4" /> : <VolumeXIcon className="h-4 w-4" />}
        </button>
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            aria-label="Notifications"
            aria-expanded={notifOpen}
            className="relative grid h-9 w-9 place-items-center rounded-full border border-line text-ink-muted transition-colors duration-200 ease-cinema hover:text-ink">

            <BellIcon className="h-4 w-4" />
            {actionLog.length > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-agent-objection" />}
          </button>
          {notifOpen &&
          <div className="glass absolute right-0 top-[calc(100%+8px)] z-10 max-h-[360px] w-[300px] overflow-y-auto rounded-2xl p-2 shadow-panel">
              <p className="px-3 py-2 text-[10px] uppercase tracking-widest text-ink-faint">Recent actions</p>
              {actionLog.length === 0 &&
            <p className="px-3 py-4 text-[12.5px] text-ink-faint">No actions yet — ask an agent to do something.</p>
            }
              {actionLog.map((record) =>
            <div key={record.id} className="rounded-lg px-3 py-2 hover:bg-white/[0.05]">
                  <p className="flex items-center justify-between text-[10px] text-ink-faint">
                    <span>{record.label}</span>
                    <span>{record.time}</span>
                  </p>
                  <p className="text-[12.5px] leading-snug text-ink">{record.result}</p>
                </div>
            )}
            </div>
          }
        </div>
        <div className="hidden text-right md:block">
          <p className="text-[11px] text-ink">{now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
          <p className="text-[11px] text-ink-faint">{now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-1.5">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-[11px] text-ink">
            {(user?.username ?? '?').slice(0, 1).toUpperCase()}
          </span>
          <div className="hidden text-left leading-tight sm:block">
            <p className="text-[11px] text-ink">{user?.username}</p>
            <p className="text-[10px] text-ink-faint">
              {user?.role === 'admin' ? 'Admin' : 'Member'}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
            className="ml-1 grid h-7 w-7 place-items-center rounded-full text-ink-faint transition-colors duration-150 ease-cinema hover:bg-red-400/10 hover:text-red-400">

            <LogOutIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>);

}