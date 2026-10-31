// Turns real CRM numbers into the text agents actually speak/reason from —
// no fictional customers, no invented statistics. Every figure here traces
// back to useRealCrmStats(), which itself comes straight from the backend.
import type { RealCrmStats } from '../hooks/useRealCrmStats';
import type { AgentId, ScriptLine } from '../types/agent';

/** A compact plain-text summary handed to the LLM as grounding — it's told never to go beyond this. */
export function buildRealDataContext(stats: RealCrmStats, personaId: AgentId): string {
  const mine = stats.byPersona[personaId];
  const lines = [
  `Total leads in the CRM: ${stats.totalLeads}.`,
  `Contacted: ${stats.contactedLeads}. Hot/Interested: ${stats.hotLeads}. Completed: ${stats.completedLeads}. Not reachable: ${stats.notReachableLeads}.`,
  `Site visits scheduled: ${stats.siteVisitsScheduled}. Leads currently in a live call: ${stats.inCallLeads.length}.`,
  mine ? `Your own assigned leads: ${mine.assigned}. Of those, ${mine.contacted} contacted, ${mine.hot} hot/interested, ${mine.completed} completed.` : ''];

  if (stats.inCallLeads.length > 0) {
    lines.push(`Leads currently in a live call: ${stats.inCallLeads.map((l) => l.name).join(', ')}.`);
  }
  return lines.filter(Boolean).join('\n');
}

/** Builds the on-stage intro speech from real numbers instead of a fixed fictional script. */
export function buildRealIntro(personaId: AgentId, agentName: string, stats: RealCrmStats): ScriptLine[] {
  const mine = stats.byPersona[personaId];
  const assigned = mine?.assigned ?? 0;
  const contacted = mine?.contacted ?? 0;
  const hot = mine?.hot ?? 0;

  const openers: Record<AgentId, string> = {
    ava: `Hi, I'm ${agentName}. I handle the conversation layer of your sales operation.`,
    aria: `Hi, I'm ${agentName}. I read intent across every real lead in the CRM.`,
    mira: `Hi, I'm ${agentName}. I track sentiment across your real conversations.`,
    zara: `Hi, I'm ${agentName}. I watch for objections across every real call.`,
    nia: `Hi, I'm ${agentName}. I hold the real history for every customer we've ever spoken to.`,
    nova: `Hi, I'm ${agentName}, running RK Avenue lead generation for RK Developers.`,
  };

  const workloadLine = assigned > 0 ?
  `Right now I have ${assigned} lead${assigned === 1 ? '' : 's'} assigned to me — ${contacted} contacted so far${hot > 0 ? `, ${hot} of them hot or interested` : ''}.` :
  `I don't have any leads assigned to me yet.`;

  const teamLine = `Across the whole team: ${stats.totalLeads} real leads, ${stats.hotLeads} hot or interested, ${stats.contactedLeads} contacted.`;

  return [
  { id: `intro-${personaId}-1`, text: openers[personaId], state: 'speaking', duration: 4000 },
  { id: `intro-${personaId}-2`, text: workloadLine, state: 'explaining', duration: 4200 },
  { id: `intro-${personaId}-3`, text: teamLine, state: 'analyzing', reveal: 'metrics', duration: 4200 },
  { id: `intro-${personaId}-4`, text: 'Ask me anything — I only answer from real data.', state: 'listening', duration: 2600 }];

}
