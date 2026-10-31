import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState } from
'react';
import { agentMap, agents } from '../data/agents';
import { resolveCommand } from '../utils/orchestrator';
import { useAgentVoice } from '../hooks/useAgentVoice';
import { agentEvents } from '../motion/agentEvents';
import { withWalkCues } from '../motion/withWalkCues';
import { chatWithAgent } from '../api/client';
import { useAuth } from './AuthContext';
import { useRealCrmStatsContext } from './RealCrmStatsContext';
import { buildRealDataContext, buildRealIntro } from '../utils/realDataNarrative';
import type {
  Agent,
  AgentActionDef,
  AgentId,
  AgentState,
  PanelId,
  ScriptLine,
  StageModule } from
'../types/agent';

export interface TranscriptEntry {
  id: string;
  speaker: 'user' | AgentId;
  text: string;
  time: string;
}

export interface ActionRecord {
  id: string;
  agentId: AgentId;
  label: string;
  result: string;
  time: string;
}

interface AivaContextValue {
  activeAgent: Agent | null;
  stageOpen: boolean;
  presentationMode: boolean;
  agentStates: Record<AgentId, AgentState>;
  currentLine: ScriptLine | null;
  speaking: boolean;
  highlight: PanelId | null;
  revealed: StageModule[];
  transcript: TranscriptEntry[];
  routing: string | null;
  handoff: {from: AgentId;to: AgentId;} | null;
  pendingConfirm: {agentId: AgentId;action: AgentActionDef;} | null;
  actionLog: ActionRecord[];
  voiceEnabled: boolean;
  listening: boolean;
  summon: (id: AgentId) => void;
  ask: (text: string) => void;
  runAction: (agentId: AgentId, actionId: string) => void;
  confirmPending: () => void;
  cancelPending: () => void;
  dismiss: () => void;
  togglePresentation: () => void;
  setVoiceEnabled: (on: boolean) => void;
  setListening: (on: boolean) => void;
  /** Low-level primitives the Agent Motion Engine (src/motion) composes into imperative calls. */
  perform: (lines: ScriptLine[], handoffTo?: AgentId) => void;
  setAgentState: (id: AgentId, state: AgentState) => void;
  highlightPanel: (id: PanelId | null) => void;
}

const AivaContext = createContext<AivaContextValue | null>(null);

const now = () =>
new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

const initialStates = agents.reduce((acc, a) => {
  acc[a.id] = 'idle';
  return acc;
}, {} as Record<AgentId, AgentState>);

const estimate = (line: ScriptLine) =>
line.duration ?? Math.max(2400, line.text.split(/\s+/).length / 2.6 * 1000);

export function AivaProvider({ children }: {children: React.ReactNode;}) {
  const { speak, cancel, supported } = useAgentVoice();
  const { user } = useAuth();
  const realStats = useRealCrmStatsContext();

  const [activeId, setActiveId] = useState<AgentId | null>(null);
  const [stageOpen, setStageOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [agentStates, setAgentStates] = useState<Record<AgentId, AgentState>>(initialStates);
  const [queue, setQueue] = useState<ScriptLine[]>([]);
  const [lineIndex, setLineIndex] = useState(0);
  const [highlight, setHighlight] = useState<PanelId | null>(null);
  const [revealed, setRevealed] = useState<StageModule[]>([]);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [routing, setRouting] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<{from: AgentId;to: AgentId;} | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{agentId: AgentId;action: AgentActionDef;} | null>(null);
  const [actionLog, setActionLog] = useState<ActionRecord[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [listening, setListening] = useState(false);

  const timers = useRef<number[]>([]);
  const tokenRef = useRef(0);
  const pendingHandoff = useRef<AgentId | null>(null);
  /** Agents already greeted this session — repeat summons get a varied greeting instead of replaying the same onboarding script. */
  const visitedAgents = useRef<Set<AgentId>>(new Set());
  /** Mirrors `transcript` for synchronous reads inside `ask` without retriggering the callback on every message. */
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const introFor = useCallback(
    (id: AgentId) => {
      visitedAgents.current.add(id);
      return buildRealIntro(id, agentMap[id].name, realStats);
    },
    [realStats]
  );

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms);
    timers.current.push(t);
    return t;
  }, []);

  useEffect(() => () => {
    clearTimers();
    cancel();
  }, [cancel, clearTimers]);

  const setState = useCallback((id: AgentId, state: AgentState) => {
    setAgentStates((prev) => prev[id] === state ? prev : { ...prev, [id]: state });
  }, []);

  const currentLine = queue[lineIndex] ?? null;
  const activeAgent = activeId ? agentMap[activeId] : null;

  /* ---------------------------------------------------------------- player */
  useEffect(() => {
    if (!activeId) return;
    const line = queue[lineIndex];

    if (!line) {
      if (queue.length) {
        setState(activeId, 'listening');
        const target = pendingHandoff.current;
        if (target) {
          pendingHandoff.current = null;
          const from = activeId;
          setHandoff({ from, to: target });
          agentEvents.emit({ type: 'HANDOFF_STARTED', agentId: from, to: target });
          later(() => {
            setHandoff(null);
            const to = agentMap[target];
            setState(from, 'idle');
            setActiveId(target);
            setState(target, 'entering');
            agentEvents.emit({ type: 'HANDOFF_COMPLETE', agentId: from, to: target });
            agentEvents.emit({ type: 'AGENT_ACTIVATED', agentId: target });
            setTranscript((t) => [
            ...t,
            { id: `hx-${Date.now()}`, speaker: target, text: `New intelligence received from ${agentMap[from].name}.`, time: now() }]
            );
            later(() => {
              setQueue(withWalkCues([
              {
                id: `recv-${Date.now()}`,
                text: `Intelligence received from ${agentMap[from].name}. Picking it up now.`,
                state: 'analyzing',
                duration: 3600
              },
              ...to.intro.slice(-2)])
              );
              setLineIndex(0);
            }, 900);
          }, 2200);
        }
      }
      return;
    }

    tokenRef.current += 1;
    const token = tokenRef.current;

    setState(activeId, line.state);
    setHighlight(line.highlight ?? null);
    if (line.state === 'speaking' || line.state === 'explaining') {
      agentEvents.emit({ type: 'SPEECH_STARTED', agentId: activeId, detail: line.text });
    }
    if (line.state === 'analyzing') {
      agentEvents.emit({ type: 'ANALYSIS_STARTED', agentId: activeId });
    }
    if (line.state === 'executing') {
      agentEvents.emit({ type: 'ACTION_STARTED', agentId: activeId, detail: line.text });
    }
    if (line.reveal) {
      setRevealed((prev) => prev.includes(line.reveal as StageModule) ? prev : [...prev, line.reveal as StageModule]);
    }
    if (line.text) {
      setTranscript((prev) => {
        if (prev.length && prev[prev.length - 1].text === line.text) return prev;
        return [...prev, { id: `${line.id}-${Date.now()}`, speaker: activeId, text: line.text, time: now() }];
      });
    }

    const advance = () => {
      if (tokenRef.current !== token) return;
      if (line.state === 'speaking' || line.state === 'explaining') {
        agentEvents.emit({ type: 'SPEECH_ENDED', agentId: activeId, detail: line.text });
      }
      if (line.state === 'analyzing') {
        agentEvents.emit({ type: 'ANALYSIS_COMPLETE', agentId: activeId });
      }
      if (line.state === 'executing') {
        agentEvents.emit({ type: 'ACTION_COMPLETE', agentId: activeId });
      }
      setLineIndex((i) => i + 1);
    };

    const spoken = Boolean(line.text) && voiceEnabled && supported && speak(line.text, agentMap[activeId].voice, advance);
    const budget = spoken ? estimate(line) * 2.4 : estimate(line);
    later(advance, budget);

    return () => {

      // token guard handles stale advances
    }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, queue, lineIndex, voiceEnabled, supported]);

  /* --------------------------------------------------------------- actions */
  const play = useCallback(
    (lines: ScriptLine[], handoffTo?: AgentId) => {
      clearTimers();
      cancel();
      tokenRef.current += 1;
      pendingHandoff.current = handoffTo ?? null;
      setQueue(withWalkCues(lines));
      setLineIndex(0);
    },
    [cancel, clearTimers]
  );

  const summon = useCallback(
    (id: AgentId) => {
      clearTimers();
      cancel();
      tokenRef.current += 1;
      pendingHandoff.current = null;
      setActiveId(id);
      setStageOpen(true);
      setRevealed([]);
      setHighlight(null);
      setRouting(null);
      setTranscript([]);
      setQueue([]);
      setLineIndex(0);
      setState(id, 'entering');
      agentEvents.emit({ type: 'AGENT_ACTIVATED', agentId: id });
      later(() => {
        setQueue(withWalkCues(introFor(id)));
        setLineIndex(0);
      }, 1100);
    },
    [cancel, clearTimers, later, setState, introFor]
  );

  const ask = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const result = resolveCommand(trimmed, activeId);
      setRouting(result.routing);

      const historyForLlm = transcriptRef.current.
      slice(-10).
      map((entry) => ({ speaker: entry.speaker === 'user' ? 'user' as const : 'agent' as const, text: entry.text }));

      setTranscript((prev) => [...prev, { id: `u-${Date.now()}`, speaker: 'user', text: trimmed, time: now() }]);

      clearTimers();
      cancel();
      tokenRef.current += 1;
      const token = tokenRef.current;

      const speakLines = (lines: ScriptLine[], handoffTo?: AgentId) => {
        if (tokenRef.current !== token) return; // a newer ask/summon superseded this one
        visitedAgents.current.add(result.agentId);
        play(lines, handoffTo);
      };

      const startWith = (id: AgentId) => {
        setActiveId(id);
        setStageOpen(true);
        setState(id, 'listening');
        later(() => {
          setState(id, 'thinking');
          later(async () => {
            const agentDef = agentMap[id];
            try {
              const { reply } = await chatWithAgent({
                agent: {
                  name: agentDef.name,
                  role: agentDef.role,
                  mission: agentDef.mission,
                  personality: agentDef.personality,
                  responsibilities: agentDef.responsibilities,
                  analyzes: agentDef.analyzes
                },
                realDataContext: buildRealDataContext(realStats, id),
                history: historyForLlm,
                message: trimmed,
                userName: user?.username
              });
              speakLines([
              {
                id: `llm-${Date.now()}`,
                text: reply,
                state: 'speaking',
                duration: Math.max(2800, reply.split(/\s+/).length / 2.6 * 1000)
              }]
              );
            } catch (err) {
              // Real backend unreachable, or GEMINI_API_KEY not configured — say so
              // plainly instead of answering with a scripted, fictional-lead reply.
              speakLines([
              {
                id: `err-${Date.now()}`,
                text: "I couldn't reach the AI service just now, so I don't want to guess. Try again in a moment.",
                state: 'warning',
                duration: 3600
              }]
              );
            }
          }, 500);
        }, 500);
      };

      if (result.agentId !== activeId) {
        if (activeId) setState(activeId, 'idle');
        setRevealed([]);
        setHighlight(null);
        setState(result.agentId, 'entering');
        setActiveId(result.agentId);
        setStageOpen(true);
        later(() => startWith(result.agentId), 900);
      } else {
        startWith(result.agentId);
      }
    },
    [activeId, cancel, clearTimers, later, play, setState, user]
  );

  const commit = useCallback(
    (agentId: AgentId, action: AgentActionDef) => {
      const record: ActionRecord = {
        id: `${action.id}-${Date.now()}`,
        agentId,
        label: action.label,
        result: action.result ?? 'Action completed.',
        time: now()
      };
      setActionLog((prev) => [record, ...prev].slice(0, 12));
      agentEvents.emit({ type: 'ACTION_COMPLETE', agentId, detail: record.result });
      play([
      {
        id: `act-${Date.now()}`,
        text: `${action.result ?? 'Done.'}`,
        state: 'success',
        duration: 3600
      }]
      );
    },
    [play]
  );

  const runAction = useCallback(
    (agentId: AgentId, actionId: string) => {
      const agent = agentMap[agentId];
      const action = agent.actions.find((a) => a.id === actionId);
      if (!action) return;

      if (action.kind === 'handoff' && action.target) {
        play(
          [
          {
            id: `ho-${Date.now()}`,
            text: `Passing this to ${agentMap[action.target].name} now.`,
            state: 'executing',
            duration: 3000
          }],

          action.target
        );
        return;
      }

      if (action.kind === 'confirm') {
        setPendingConfirm({ agentId, action });
        play([
        {
          id: `conf-${Date.now()}`,
          text: action.confirmPrompt ?? 'This action needs your confirmation. Should I continue?',
          state: 'warning',
          duration: 4600
        }]
        );
        return;
      }

      setState(agentId, 'executing');
      agentEvents.emit({ type: 'ACTION_STARTED', agentId, detail: action.label });
      commit(agentId, action);
    },
    [commit, play, setState]
  );

  const confirmPending = useCallback(() => {
    if (!pendingConfirm) return;
    const { agentId, action } = pendingConfirm;
    setPendingConfirm(null);
    setState(agentId, 'executing');
    commit(agentId, action);
  }, [commit, pendingConfirm, setState]);

  const cancelPending = useCallback(() => {
    if (!pendingConfirm) return;
    const { agentId } = pendingConfirm;
    setPendingConfirm(null);
    play([
    { id: `cx-${Date.now()}`, text: 'Cancelled. Nothing was written to the CRM.', state: 'speaking', duration: 3000 }]
    );
    setState(agentId, 'listening');
  }, [pendingConfirm, play, setState]);

  const dismiss = useCallback(() => {
    clearTimers();
    cancel();
    tokenRef.current += 1;
    pendingHandoff.current = null;
    setPendingConfirm(null);
    setHighlight(null);
    setQueue([]);
    setLineIndex(0);
    if (activeId) setState(activeId, 'exiting');
    later(() => {
      setStageOpen(false);
      setPresentationMode(false);
      if (activeId) setState(activeId, 'idle');
      setActiveId(null);
      setRevealed([]);
      setRouting(null);
    }, 520);
  }, [activeId, cancel, clearTimers, later, setState]);

  const togglePresentation = useCallback(() => setPresentationMode((p) => !p), []);

  const speaking = currentLine?.state === 'speaking' || currentLine?.state === 'explaining';

  const value = useMemo<AivaContextValue>(
    () => ({
      activeAgent,
      stageOpen,
      presentationMode,
      agentStates,
      currentLine,
      speaking,
      highlight,
      revealed,
      transcript,
      routing,
      handoff,
      pendingConfirm,
      actionLog,
      voiceEnabled,
      listening,
      summon,
      ask,
      runAction,
      confirmPending,
      cancelPending,
      dismiss,
      togglePresentation,
      setVoiceEnabled,
      setListening,
      perform: play,
      setAgentState: setState,
      highlightPanel: setHighlight
    }),
    [
    activeAgent,
    stageOpen,
    presentationMode,
    agentStates,
    currentLine,
    speaking,
    highlight,
    revealed,
    transcript,
    routing,
    handoff,
    pendingConfirm,
    actionLog,
    voiceEnabled,
    listening,
    summon,
    ask,
    runAction,
    confirmPending,
    cancelPending,
    dismiss,
    togglePresentation,
    play,
    setState,
    setHighlight]

  );

  return <AivaContext.Provider value={value}>{children}</AivaContext.Provider>;
}

export function useAiva() {
  const ctx = useContext(AivaContext);
  if (!ctx) throw new Error('useAiva must be used inside <AivaProvider>');
  return ctx;
}