/**
 * AIVA agent domain types.
 * The UI layer never invents agent behaviour — it renders whatever an Agent
 * definition (data/agents.ts) and the orchestrator (utils/orchestrator.ts) say.
 */

export type AgentId = 'ava' | 'aria' | 'mira' | 'zara' | 'nia' | 'nova';

/** Finite state machine every agent avatar + panel reacts to. */
export type AgentState =
'idle' |
'entering' |
'walking' |
'listening' |
'thinking' |
'speaking' |
'explaining' |
'analyzing' |
'executing' |
'success' |
'warning' |
'error' |
'exiting';

/** Dashboard regions an agent can walk to, point at and illuminate. */
export type PanelId =
'mission' |
'pipeline' |
'activity' |
'leadDna' |
'performance' |
'liveCall' |
'recent' |
'team';

/** Modules an agent can reveal on its own stage while presenting. */
export type StageModule =
'metrics' |
'intentBreakdown' |
'signalFlow' |
'sentiment' |
'emotionTimeline' |
'objection' |
'memory' |
'actionQueue' |
'transcript' |
'teamDecision';

export interface AgentMetric {
  label: string;
  value: string;
  delta?: string;
  tone?: 'up' | 'down' | 'flat';
}

export interface AgentActionDef {
  id: string;
  label: string;
  /** safe = runs immediately, confirm = destructive/needs consent, handoff = passes to another agent */
  kind: 'safe' | 'confirm' | 'handoff';
  target?: AgentId;
  /** Confirmation copy shown by the agent before a sensitive action. */
  confirmPrompt?: string;
  result?: string;
}

export interface ScriptLine {
  id: string;
  text: string;
  state: AgentState;
  /** Dashboard panel to illuminate + walk toward while this line plays. */
  highlight?: PanelId;
  /** Stage module to reveal while this line plays. */
  reveal?: StageModule;
  /** Fallback duration (ms) when speech synthesis is unavailable or muted. */
  duration?: number;
}

export interface AgentQA {
  id: string;
  question: string;
  /** Keywords the orchestrator matches against free-text / voice input. */
  match: string[];
  lines: ScriptLine[];
  handoffTo?: AgentId;
}

export interface AgentDecision {
  time: string;
  subject: string;
  detail: string;
}

export interface Agent {
  id: AgentId;
  index: string;
  name: string;
  role: string;
  shortRole: string;
  mission: string;
  personality: string;
  speakingStyle: string;
  accent: string;
  accentSoft: string;
  avatar: string;
  /** Horizontal focal point of the portrait, used to frame the face. */
  focus: string;
  status: string;
  liveStatus: string[];
  responsibilities: string[];
  analyzes: string[];
  metrics: AgentMetric[];
  actions: AgentActionDef[];
  intro: ScriptLine[];
  /** Shorter alternate greetings played on repeat visits within a session, so re-opening an agent doesn't replay the same onboarding script every time. One is picked at random. */
  introVariants?: ScriptLine[][];
  qa: AgentQA[];
  decisions: AgentDecision[];
  voice: {pitch: number;rate: number;match: string[];};
  worksWith: AgentId[];
}