import type { ScriptLine } from '../types/agent';

/**
 * Inserts a "walking" beat before any script line that targets a new panel,
 * so every agent's scripted intro/QA walks into position before pointing and
 * explaining, instead of teleporting straight into the explaining pose.
 * Applied once, centrally, in AivaContext wherever a queue is set — this is
 * what actually wires the Motion Engine's walking state into all six agents'
 * data-driven scripts without hand-editing every line.
 */
export function withWalkCues(lines: ScriptLine[]): ScriptLine[] {
  const out: ScriptLine[] = [];
  let lastHighlight: string | null = null;

  for (const l of lines) {
    if (l.highlight && l.highlight !== lastHighlight) {
      out.push({
        id: `walk-${l.id}`,
        text: '',
        state: 'walking',
        highlight: l.highlight,
        duration: 900
      });
    }
    out.push(l);
    lastHighlight = l.highlight ?? lastHighlight;
  }

  return out;
}
