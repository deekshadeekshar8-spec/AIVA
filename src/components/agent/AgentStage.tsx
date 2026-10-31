import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRightIcon,
  MicIcon,
  PresentationIcon,
  SendIcon,
  ShieldAlertIcon,
  XIcon } from
'lucide-react';
import { Link } from 'react-router-dom';
import { agents } from '../../data/agents';
import { useAiva } from '../../contexts/AivaContext';
import { useRealCrmStatsContext } from '../../contexts/RealCrmStatsContext';
import { useSpeechInput } from '../../hooks/useSpeechInput';
import { cn } from '../../utils/cn';
import { AgentPortrait } from './AgentAvatar';
import { AgentCharacter } from './AgentCharacter';
import { ConfirmationCard, StageModules } from './StageModules';
import { HandoffBeam } from './HandoffBeam';
import { Eyebrow, StatusDot } from '../ui/Panel';
import type { PanelId } from '../../types/agent';

const PANEL_LABEL: Record<PanelId, string> = {
  mission: 'Mission Control',
  pipeline: 'Lead Pipeline',
  activity: 'Live Activity',
  leadDna: 'Lead DNA',
  performance: 'Total Performance',
  liveCall: 'Live Call',
  recent: 'Recent Activity',
  team: 'AI Agents Working Together'
};

export function AgentStage() {
  const realStats = useRealCrmStatsContext();
  const {
    activeAgent,
    stageOpen,
    agentStates,
    currentLine,
    highlight,
    revealed,
    transcript,
    routing,
    handoff,
    pendingConfirm,
    presentationMode,
    ask,
    summon,
    runAction,
    confirmPending,
    cancelPending,
    dismiss,
    togglePresentation
  } = useAiva();

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const onVoice = useCallback(
    (text: string) => {
      ask(text);
    },
    [ask]
  );
  const speech = useSpeechInput(onVoice);

  useEffect(() => {
    if (!stageOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismiss, stageOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [revealed.length, transcript.length]);

  if (!activeAgent) return null;
  const state = agentStates[activeAgent.id];
  const accent = activeAgent.accent;

  return (
    <AnimatePresence>
      {stageOpen &&
      <motion.div
        className="fixed inset-0 z-50"
        style={{ ['--accent' as string]: accent }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label={`${activeAgent.name}, ${activeAgent.role}`}>
        
          {/* Dimmed command center + ambient colour shift */}
          <motion.button
          type="button"
          aria-label="Close agent"
          onClick={dismiss}
          className="absolute inset-0 cursor-default"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          style={{
            background: `radial-gradient(80% 60% at 18% 70%, ${accent}22, transparent 60%), rgba(3,5,11,${presentationMode ? 0.94 : 0.8})`,
            backdropFilter: 'blur(3px)'
          }} />
        

          <HandoffBeam handoff={handoff} />

          {/* Character */}
          <div
          className={cn(
            'pointer-events-none absolute left-1/2 top-[9vh] h-[32vh] w-[54vw] -translate-x-1/2 md:top-auto md:bottom-0 md:h-[88vh] md:w-[36vw] md:max-w-[540px] md:translate-x-0',
            presentationMode ? 'md:left-[5%]' : 'md:left-[1.5%]'
          )}>
          
            <AgentCharacter agent={activeAgent} state={state} atPanel={Boolean(highlight)} className="h-full w-full" />
          </div>

          {/* Pointing indicator toward an illuminated panel */}
          <AnimatePresence>
            {highlight &&
          <motion.div
            key={highlight}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
            className="pointer-events-none absolute bottom-[44%] left-[min(29vw,430px)] hidden items-center gap-2 xl:flex">
            
                <span className="h-px w-16" style={{ background: accent, opacity: 0.6 }} />
                <span
              className="rounded-full px-2.5 py-1 text-[11px]"
              style={{ background: `${accent}1f`, color: accent }}>
              
                  {PANEL_LABEL[highlight]}
                </span>
              </motion.div>
          }
          </AnimatePresence>

          {/* Identity + caption column, clear of the character */}
          <div className="pointer-events-none absolute inset-x-4 top-4 bottom-[54vh] flex flex-col md:inset-x-auto md:bottom-20 md:left-[min(38vw,556px)] md:right-[436px] md:top-12">
            <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, ease: [0.23, 1, 0.32, 1] }}>
            
              <Eyebrow>
                {activeAgent.index} · {activeAgent.shortRole}
              </Eyebrow>
              <h2 className="font-serif text-[40px] leading-[0.95] text-ink md:text-[68px]">{activeAgent.name}</h2>
              <p className="mt-1 text-[13px] text-ink-muted">{activeAgent.role}</p>
              <p className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-widest" style={{ color: accent }}>
                <StatusDot color={accent} /> {state}
              </p>
              {routing && <p className="mt-1 text-[11px] text-ink-faint">Orchestrator · {routing}</p>}
            </motion.div>

            <div className="mt-auto">
              <AnimatePresence mode="wait">
                {currentLine?.text &&
              <motion.div
                key={currentLine.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
                className="glass rounded-2xl px-5 py-4"
                style={{ boxShadow: `0 0 0 1px ${accent}33, 0 24px 60px -30px #000` }}>
                
                    <p className="font-serif text-[16px] leading-snug text-ink md:text-[23px]">{currentLine.text}</p>
                  </motion.div>
              }
              </AnimatePresence>
            </div>
          </div>

          {/* Intelligence column */}
          <div
          className={cn(
            'absolute inset-x-0 bottom-0 top-[52vh] flex flex-col md:inset-y-8 md:left-auto md:right-6 md:top-8 md:w-[400px]',
            presentationMode && 'md:w-[440px]'
          )}>
          
            <div className="glass flex items-center justify-between rounded-t-2xl px-4 py-3 md:rounded-2xl">
              <div className="flex items-center gap-2">
                <AgentPortrait agent={activeAgent} size={30} active />
                <div>
                  <p className="text-[12px] text-ink">{activeAgent.name}'s intelligence</p>
                  <p className="text-[10px] text-ink-faint">{activeAgent.mission}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                type="button"
                onClick={togglePresentation}
                aria-pressed={presentationMode}
                aria-label="Toggle presentation mode"
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-lg border border-line transition-colors duration-200 ease-cinema',
                  presentationMode ? 'text-ink' : 'text-ink-faint hover:text-ink'
                )}
                style={presentationMode ? { background: `${accent}1f`, borderColor: `${accent}55` } : undefined}>
                
                  <PresentationIcon className="h-4 w-4" />
                </button>
                <button
                type="button"
                onClick={dismiss}
                aria-label="Close agent"
                className="grid h-8 w-8 place-items-center rounded-lg border border-line text-ink-faint transition-colors duration-200 ease-cinema hover:text-ink">
                
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="thin-scroll mt-3 flex-1 space-y-3 overflow-y-auto px-4 pb-3 md:px-0">
              {presentationMode &&
            <div className="glass rounded-2xl p-4">
                  <Eyebrow>{activeAgent.name} presentation</Eyebrow>
                  <p className="mt-2 font-serif text-2xl leading-tight text-ink">{activeAgent.mission}</p>
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">{activeAgent.personality}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {activeAgent.analyzes.map((a) =>
                <span key={a} className="rounded-full border border-line px-2 py-1 text-[11px] text-ink-muted">
                        {a}
                      </span>
                )}
                  </div>
                </div>
            }

              {pendingConfirm &&
            <ConfirmationCard
              accent={accent}
              prompt={pendingConfirm.action.confirmPrompt ?? 'Confirm this action?'}
              onConfirm={confirmPending}
              onCancel={cancelPending} />

            }

              <StageModules agent={activeAgent} revealed={revealed} realStats={realStats} />

              {revealed.length === 0 && !pendingConfirm &&
            <div className="glass rounded-2xl p-4">
                  <Eyebrow>Standing by</Eyebrow>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                    {activeAgent.name} is bringing her analysis on screen as she speaks. Ask a question at any point —
                    she will stop and listen.
                  </p>
                </div>
            }

              <Link
              to={`/agents/${activeAgent.id}`}
              onClick={dismiss}
              className="glass flex items-center justify-between rounded-2xl px-4 py-3 text-[13px] text-ink-muted transition-colors duration-200 ease-cinema hover:text-ink">
              
                Open {activeAgent.name}'s full profile
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>

            {/* Interaction dock */}
            <div className="glass rounded-b-2xl px-4 py-3 md:mt-3 md:rounded-2xl">
              <div className="thin-scroll -mx-1 mb-2.5 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {activeAgent.qa.slice(0, 4).map((qa) =>
              <button
                key={qa.id}
                type="button"
                onClick={() => ask(qa.question)}
                className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[11px] text-ink-muted transition-colors duration-150 ease-cinema hover:border-transparent hover:text-ink"
                style={{ backgroundColor: 'transparent' }}>
                
                    {qa.question}
                  </button>
              )}
              </div>

              <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!input.trim()) return;
                ask(input);
                setInput('');
              }}
              className="flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3 py-1.5">
              
                <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Interrupt ${activeAgent.name}…`}
                aria-label={`Ask ${activeAgent.name}`}
                className="w-full bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none" />
              
                <button
                type="button"
                onClick={() => speech.listening ? speech.stop() : speech.start()}
                aria-label="Speak"
                className={cn(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors duration-150 ease-cinema',
                  speech.listening ? 'text-ink' : 'text-ink-faint hover:text-ink'
                )}
                style={speech.listening ? { background: `${accent}2a` } : undefined}>
                
                  <MicIcon className="h-3.5 w-3.5" />
                </button>
                <button
                type="submit"
                aria-label="Send"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-void"
                style={{ background: accent }}>
                
                  <SendIcon className="h-3.5 w-3.5" />
                </button>
              </form>

              <div className="thin-scroll -mx-1 mt-2.5 flex gap-1.5 overflow-x-auto px-1">
                {activeAgent.actions.map((action) =>
              <button
                key={action.id}
                type="button"
                onClick={() => runAction(activeAgent.id, action.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-ink-muted transition-colors duration-150 ease-cinema hover:text-ink"
                style={action.kind === 'handoff' ? { borderColor: `${accent}55` } : undefined}>
                
                    {action.kind === 'confirm' && <ShieldAlertIcon className="h-3 w-3 text-agent-objection" />}
                    {action.label}
                  </button>
              )}
              </div>
            </div>
          </div>

          {/* Team roster — switch agents without leaving the stage */}
          <div className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-[#070b16]/80 px-3 py-2 backdrop-blur-xl md:flex">
            {agents.map((a) =>
          <button
            key={a.id}
            type="button"
            onClick={() => summon(a.id)}
            aria-label={`Summon ${a.name}`}
            aria-pressed={a.id === activeAgent.id}
            className={cn(
              'flex items-center gap-2 rounded-full px-2 py-1 transition-opacity duration-200 ease-cinema',
              a.id === activeAgent.id ? 'opacity-100' : 'opacity-55 hover:opacity-100'
            )}>
            
                <AgentPortrait agent={a} size={26} active={a.id === activeAgent.id} />
                <span className="text-[11px] text-ink">{a.name}</span>
              </button>
          )}
          </div>
        </motion.div>
      }
    </AnimatePresence>);

}