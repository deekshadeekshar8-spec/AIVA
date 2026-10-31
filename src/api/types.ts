/** Shapes returned by the real AIVA backend (server/app.js). */

export interface AuthUser {
  id: string | null; // null for the env-configured superadmin, which isn't a stored record
  username: string;
  role: 'admin' | 'member';
  source: 'env' | 'stored';
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  source: string;
  project: string;
  dateTime: string;
  agentId: string;
  status: string;
  interestLevel: string;
  budget: number;
  location: string;
  remarks: string;
  nextFollowUpDate: string | null;
  timeline: string;
  whatsappSent: boolean;
  brochureSent: boolean;
  priceSheetSent: boolean;
  siteVisitScheduled: string;
  callDuration: string;
  lastContactTime: string;
  recordings: Array<{ id: string; date: string; duration: string; summary: string; url?: string; transcript?: string }>;
  leadIntelligence?: {
    interestSummary: string;
    sitePreference: string;
    likelyDecisionMaker: string;
    bestCallTime: string;
    confidence: number;
    confidenceReason: string;
    buyingProbability: number;
    emotionalType: string;
    likelyObjections: string[];
    generatedAt: string;
  };
  callStrategy?: {
    openingStyle: string;
    mainFocus: string;
    avoid: string;
    goal: string;
    negotiationApproach?: string;
    generatedAt: string;
  };
  email?: string;
  note?: string;
  decisionMaker?: string;
  recommendation?: {
    recommendedProject: string;
    reason: string;
  } | null;
  nextBestAction?: { action: string; reason: string };
  callSummary?: string;
  qualified?: boolean;
  qualificationReason?: string;
  keyPoints?: string[];
  customerQuestions?: string[];
  objections?: string[];
  projectInterest?: string;
  siteSizeSqft?: number;
  locationPreference?: string;
  leadScore?: {
    value: number;
    temperature: 'Hot' | 'Warm' | 'Nurture' | 'Cold';
    breakdown: Array<{ signal: string; points: number }>;
  };
  salesBrain?: {
    personality?: string;
    buyingStyle?: string;
    urgencyLevel?: string;
    familyDetails?: string[];
    objectionHistory?: string[];
    preferredCallTime?: string;
    callCount: number;
  };
  buyingSignals?: Record<string, boolean>;
  whatsappFollowUpDueAt?: string | null;
  whatsappActivity?: Array<{
    id: string;
    type: 'brochure' | 'location' | 'images' | 'followup' | 'reply' | 'config' | 'text' | 'maps_link';
    detail: string;
    timestamp: string;
    success: boolean;
    status?: 'sent' | 'delivered' | 'read' | 'failed';
  }>;
}
