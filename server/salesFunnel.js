// Sales Traffic Control — real pipeline-stage counts from actual lead status,
// with a bottleneck flag on whichever non-final stage is genuinely backed up.
// Pure function, no I/O, same testing pattern as callOutcomeRules.js.

const STAGE_STATUSES = {
  new: new Set(['Pending']),
  engaged: new Set(['Call Scheduled', 'In Call', 'Contacted', 'Outgoing Retry']),
  converted: new Set(['Handed Over']),
};
const CLOSED_OUT = new Set(['Not Interested', 'Wrong Number']);

export function computeSalesFunnel(leads) {
  const openLeads = (leads || []).filter(l => !CLOSED_OUT.has(l.interestLevel));

  const stages = [
    { id: 'new', label: 'New / Uncontacted', count: 0 },
    { id: 'engaged', label: 'Engaged', count: 0 },
    { id: 'site_visit', label: 'Site Visit', count: 0 },
    { id: 'converted', label: 'Converted', count: 0 },
  ];
  const byId = Object.fromEntries(stages.map(s => [s.id, s]));

  for (const lead of openLeads) {
    if (STAGE_STATUSES.converted.has(lead.status)) { byId.converted.count++; continue; }
    // A lead with a real scheduled site visit that hasn't converted yet sits in
    // the site_visit stage regardless of its raw status — that's the real
    // bottleneck point the funnel needs to expose (spec: "your biggest
    // bottleneck is site-visit scheduling").
    if (lead.siteVisitScheduled) { byId.site_visit.count++; continue; }
    if (STAGE_STATUSES.engaged.has(lead.status)) { byId.engaged.count++; continue; }
    byId.new.count++;
  }

  // Bottleneck: the non-final stage genuinely holding the most leads relative to
  // what actually moved past it — a real backlog, not a guess. Ties broken toward
  // the earliest stage (a backlog at intake blocks everything downstream).
  const nonFinal = stages.slice(0, -1);
  const maxCount = Math.max(...nonFinal.map(s => s.count));
  const bottleneck = maxCount > 0 ? nonFinal.find(s => s.count === maxCount) : null;

  return {
    stages,
    totalOpen: openLeads.length,
    bottleneck: bottleneck ? { stageId: bottleneck.id, label: bottleneck.label, count: bottleneck.count } : null,
  };
}
