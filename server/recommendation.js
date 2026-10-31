// Property Recommendation Engine (spec section 4) — matches a lead's REAL stated
// budget/location preference against the real 2-project catalogue
// (server/businessFacts.js), with concrete reasoning grounded in the actual rate
// card and location facts. Never a random pick, and never a project outside the
// real catalogue.
import { PROJECTS, SITE_SIZES_SQFT, computeSitePrice } from './businessFacts.js';

const LOCATION_KEYWORDS = {
  'Garden City': ['airport', 'kempegowda', 'strr', 'nh-648', 'nh648', 'chanakya'],
  'North Metro City': ['amity', 'university', 'devanahalli north', 'metro city'],
};

function locationMatchScore(project, locationPreference) {
  if (!locationPreference) return 0;
  const lower = locationPreference.toLowerCase();
  return (LOCATION_KEYWORDS[project] || []).some(kw => lower.includes(kw)) ? 1 : 0;
}

// Largest site size the given budget can actually afford in this project, or
// null if even the smallest real site size is out of reach.
function largestAffordableSize(project, budget) {
  if (!budget) return null;
  let best = null;
  for (const size of SITE_SIZES_SQFT) {
    const price = computeSitePrice(project, size);
    if (price && price.total <= budget) best = size;
  }
  return best;
}

// Returns { recommendedProject, reason, alternatives: [...] } or null if there's
// not enough real signal (no budget AND no location preference) to recommend
// anything — AIVA should ask a qualifying question first, not guess.
export function recommendProject({ budget, locationPreference }) {
  if (!budget && !locationPreference) return null;

  const evaluated = Object.keys(PROJECTS).map(project => {
    const affordableSize = largestAffordableSize(project, budget);
    const locationMatch = locationMatchScore(project, locationPreference);
    const cheapestTotal = computeSitePrice(project, SITE_SIZES_SQFT[0])?.total ?? null;
    return { project, affordableSize, locationMatch, cheapestTotal, ratePerSqft: PROJECTS[project].ratePerSqft };
  });

  // Rank: real location match first (the lead explicitly said where they want to
  // be), then whichever project fits more of their budget, then lower rate/sqft
  // as a tiebreaker (more site for the same money).
  evaluated.sort((a, b) => {
    if (b.locationMatch !== a.locationMatch) return b.locationMatch - a.locationMatch;
    const aAfford = a.affordableSize ?? -1;
    const bAfford = b.affordableSize ?? -1;
    if (bAfford !== aAfford) return bAfford - aAfford;
    return a.ratePerSqft - b.ratePerSqft;
  });

  const top = evaluated[0];
  const other = evaluated[1];
  if (!top) return null;

  const reasonParts = [];
  if (top.locationMatch) {
    reasonParts.push(`matches the location you mentioned (${PROJECTS[top.project].location})`);
  }
  if (budget) {
    if (top.affordableSize) {
      reasonParts.push(`your budget of ₹${budget.toLocaleString('en-IN')} comfortably fits a ${top.affordableSize} sqft site here (₹${top.ratePerSqft}/sqft)`);
    } else if (top.cheapestTotal) {
      reasonParts.push(`even the smallest site here (${SITE_SIZES_SQFT[0]} sqft) runs about ₹${top.cheapestTotal.toLocaleString('en-IN')}, above the stated budget — worth flagging before recommending further`);
    }
  }
  if (!reasonParts.length) reasonParts.push(`it's the lower rate per sqft of the two real projects (₹${top.ratePerSqft}/sqft)`);

  let reason = `${top.project} — ${reasonParts.join('; ')}.`;
  if (other && (other.locationMatch || (budget && other.affordableSize))) {
    reason += ` ${other.project} is also worth mentioning as an alternative.`;
  }

  return {
    recommendedProject: top.project,
    reason,
    affordableSizeSqft: top.affordableSize,
    alternatives: evaluated.slice(1).map(e => e.project),
  };
}
