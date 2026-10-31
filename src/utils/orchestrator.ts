import { agentMap, agents } from '../data/agents';
import type { AgentId, ScriptLine } from '../types/agent';

/**
 * AIVA ORCHESTRATOR
 * USER → orchestrator → agent selection → specialised agent → handoff → action.
 *
 * This is deliberately isolated from the UI: today it resolves natural language
 * against scripted agent knowledge, tomorrow the same function signature can be
 * backed by an LLM router without touching a single component.
 */

export interface OrchestratorResult {
  agentId: AgentId;
  lines: ScriptLine[];
  handoffTo?: AgentId;
  /** Short user-facing explanation of the routing decision. */
  routing: string;
  matched: boolean;
}

const NAME_MATCH: Record<string, AgentId> = {
  ava: 'ava',
  aria: 'aria',
  mira: 'mira',
  zara: 'zara',
  nia: 'nia',
  nova: 'nova'
};

const DOMAIN_MATCH: {agent: AgentId;keywords: string[];}[] = [
{ agent: 'nova', keywords: ['schedule', 'follow up', 'follow-up', 'assign', 'whatsapp', 'sms', 'crm', 'task', 'reminder', 'create lead', 'delete', 'execute', 'book', 'automation', 'automate', 'reliable', 'update'] },
{ agent: 'nia', keywords: ['history', 'previous', 'remember', 'memory', 'last contact', 'past', 'before', 'timeline', 'promise', 'recall'] },
{ agent: 'zara', keywords: ['objection', "isn't buying", 'not buying', 'hesitant', 'hesitation', 'price is', 'competitor', 'blocker', 'why not', 'win rate', 'strategy'] },
{ agent: 'mira', keywords: ['sentiment', 'feel', 'feeling', 'emotion', 'frustrated', 'angry', 'upset', 'happy', 'happiest', 'mood', 'confident', 'confidence'] },
{ agent: 'aria', keywords: ['intent', 'hot lead', 'high-intent', 'high intent', 'buying', 'score', 'why is', 'priorit', 'attention', 'accurate', 'accuracy', 'location', 'trending'] },
{ agent: 'ava', keywords: ['call', 'calls', 'conversation', 'transcript', 'speak', 'talk', 'listen', 'quality', 'signal'] }];


function fallbackLines(agentId: AgentId, input: string): ScriptLine[] {
  const agent = agentMap[agentId];
  return [
  {
    id: `fallback-${Date.now()}`,
    text: `That one sits just outside what I track. I handle ${agent.mission.toLowerCase().replace(/\.$/, '')} — ask me about ${agent.analyzes.slice(0, 2).join(' or ').toLowerCase()}, or name another agent and I will bring them in.`,
    state: 'thinking',
    duration: 5200
  },
  {
    id: `fallback-echo-${Date.now()}`,
    text: `Logged your request — "${input.trim()}" — so the team can learn from it.`,
    state: 'speaking',
    duration: 3600
  }];

}

export function resolveCommand(rawInput: string, activeAgentId: AgentId | null): OrchestratorResult {
  const input = rawInput.trim().toLowerCase();
  if (!input) {
    return {
      agentId: activeAgentId ?? 'aria',
      lines: [],
      routing: 'No command received',
      matched: false
    };
  }

  // 1. Explicit agent address wins ("Nova, schedule a follow-up").
  let target: AgentId | null = null;
  let addressed = false;
  for (const [name, id] of Object.entries(NAME_MATCH)) {
    if (new RegExp(`\\b${name}\\b`).test(input)) {
      target = id;
      addressed = true;
      break;
    }
  }

  // 2. Otherwise route by domain keywords.
  if (!target) {
    for (const rule of DOMAIN_MATCH) {
      if (rule.keywords.some((k) => input.includes(k))) {
        target = rule.agent;
        break;
      }
    }
  }

  // 3. Otherwise the agent already on stage keeps the conversation.
  if (!target) target = activeAgentId ?? 'aria';

  const agent = agentMap[target];
  const scored = agent.qa.
  map((qa) => ({
    qa,
    score: qa.match.reduce((acc, k) => input.includes(k) ? acc + k.length : acc, 0)
  })).
  sort((a, b) => b.score - a.score);

  const best = scored[0];
  const routing = addressed ?
  `Addressed directly · ${agent.name}` :
  `Routed by ${agent.shortRole.toLowerCase()} signals · ${agent.name}`;

  if (best && best.score > 0) {
    return {
      agentId: target,
      lines: best.qa.lines,
      handoffTo: best.qa.handoffTo,
      routing,
      matched: true
    };
  }

  return {
    agentId: target,
    lines: fallbackLines(target, rawInput),
    routing,
    matched: false
  };
}

/** Suggested prompts shown in the command bar. */
export const suggestedCommands = [
"Show me today's high-intent leads.",
'Why is Rahul a high-intent lead?',
"Ask Zara why this customer isn't buying.",
'Nova, schedule a follow-up tomorrow.',
'Which customers are frustrated?',
"Show me Rahul Sharma's history."];


export const agentDirectory = agents.map((a) => ({ id: a.id, name: a.name, role: a.shortRole, accent: a.accent }));