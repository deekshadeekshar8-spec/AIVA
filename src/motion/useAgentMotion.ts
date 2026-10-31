import { useCallback, useMemo } from 'react';
import { useAiva } from '../contexts/AivaContext';
import { agentEvents } from './agentEvents';
import type { AgentId, PanelId, ScriptLine } from '../types/agent';

/**
 * Imperative motion API for a single agent. One hook, parameterised by
 * agentId — every agent (Ava..Nova) shares this exact engine, so gesture
 * differences come only from data/agents.ts (voice, accent, script tone),
 * never from duplicated animation code.
 *
 * Each call composes AivaContext's existing state machine + script player
 * (perform/setAgentState/highlightPanel) rather than reimplementing motion,
 * so it stays in sync with AgentAvatar's rendering and Panel's glow/dim
 * behaviour for free.
 *
 * Swapping the rendered character later (static JPG -> multi-pose 2.5D ->
 * rigged 3D/video) only touches AgentAvatar; this API and every call site
 * that uses it are unaffected.
 */
export interface AgentMotion {
  /** Bring the agent on stage and let it play its scripted introduction. */
  enter: () => void;
  /** Speak arbitrary text with the given duration budget (ms, used when TTS is muted/unsupported). */
  speak: (text: string, opts?: { duration?: number; highlight?: PanelId }) => void;
  /** Stop talking and actively wait for the user. */
  listen: () => void;
  /** Brief "processing" beat before a longer analysis/walk/explain sequence. */
  think: (ms?: number) => void;
  /** Move focus toward a dashboard panel (drives AgentAvatar's walk pose + Panel glow). */
  walkTo: (panel: PanelId) => void;
  /** Alias of walkTo — turn attention toward a panel without a full walk cue. */
  turnTo: (panel: PanelId) => void;
  /** Point at + narrate a specific panel. */
  pointTo: (panel: PanelId, text?: string) => void;
  /** Full explain beat: walk, point, and narrate a panel. */
  explain: (panel: PanelId, text: string, ms?: number) => void;
  /** Perform a write/execute action against a panel (e.g. updating the CRM). */
  interact: (panel: PanelId, text: string, ms?: number) => void;
  /** Drop the highlight and return attention to the user. */
  returnToUser: () => void;
  /** Hand off to another agent. */
  handoffTo: (target: AgentId, text: string) => void;
  /** Leave the stage. */
  exit: () => void;
}

const line = (state: ScriptLine['state'], text: string, extra?: Partial<ScriptLine>): ScriptLine => ({
  id: `motion-${state}-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
  text,
  state,
  ...extra
});

export function useAgentMotion(agentId: AgentId): AgentMotion {
  const { summon, perform, setAgentState, highlightPanel, dismiss } = useAiva();

  const enter = useCallback(() => summon(agentId), [summon, agentId]);

  const speak = useCallback(
    (text: string, opts?: { duration?: number; highlight?: PanelId }) => {
      perform([line('speaking', text, { duration: opts?.duration, highlight: opts?.highlight })]);
    },
    [perform, agentId]
  );

  const listen = useCallback(() => setAgentState(agentId, 'listening'), [setAgentState, agentId]);

  const think = useCallback(
    (ms = 1400) => perform([line('thinking', 'Thinking…', { duration: ms })]),
    [perform, agentId]
  );

  const walkTo = useCallback(
    (panel: PanelId) => {
      setAgentState(agentId, 'walking');
      highlightPanel(panel);
    },
    [setAgentState, highlightPanel, agentId]
  );

  const turnTo = useCallback((panel: PanelId) => highlightPanel(panel), [highlightPanel]);

  const pointTo = useCallback(
    (panel: PanelId, text?: string) => {
      highlightPanel(panel);
      if (text) perform([line('explaining', text, { highlight: panel })]);
      else setAgentState(agentId, 'explaining');
    },
    [highlightPanel, perform, setAgentState, agentId]
  );

  const explain = useCallback(
    (panel: PanelId, text: string, ms?: number) => {
      setAgentState(agentId, 'walking');
      highlightPanel(panel);
      window.setTimeout(() => perform([line('explaining', text, { duration: ms, highlight: panel })]), 480);
    },
    [perform, setAgentState, highlightPanel, agentId]
  );

  const interact = useCallback(
    (panel: PanelId, text: string, ms?: number) => {
      agentEvents.emit({ type: 'ACTION_STARTED', agentId, detail: text });
      perform([line('executing', text, { duration: ms, highlight: panel })]);
    },
    [perform, agentId]
  );

  const returnToUser = useCallback(() => {
    highlightPanel(null);
    setAgentState(agentId, 'listening');
  }, [highlightPanel, setAgentState, agentId]);

  const handoffTo = useCallback(
    (target: AgentId, text: string) => {
      perform([line('executing', text, { duration: 3200 })], target);
    },
    [perform]
  );

  const exit = useCallback(() => dismiss(), [dismiss]);

  return useMemo(
    () => ({ enter, speak, listen, think, walkTo, turnTo, pointTo, explain, interact, returnToUser, handoffTo, exit }),
    [enter, speak, listen, think, walkTo, turnTo, pointTo, explain, interact, returnToUser, handoffTo, exit]
  );
}
