export interface Lead {
  id: string;
  name: string;
  phone: string;
  source: 'Facebook Ads' | 'Google Ads' | 'Website' | 'Sell.Do' | 'Manual Entry' | 'API';
  project: string;
  dateTime: string;
  agentId: string;
  status: 'Pending' | 'Call Scheduled' | 'In Call' | 'Contacted' | 'Outgoing Retry' | 'Completed' | 'Handed Over';
  interestLevel: 'Hot Lead' | 'Warm Lead' | 'Cold Lead' | 'Interested' | 'Not Interested' | 'Call Later' | 'Wrong Number' | 'Not Reachable';
  budget: number;
  location: string;
  remarks: string;
  nextFollowUpDate: string;
  timeline: 'Immediate' | '1 Month' | '3 Months' | '6 Months+';
  whatsappSent: boolean;
  brochureSent: boolean;
  priceSheetSent: boolean;
  siteVisitScheduled: string;
  callDuration: string;
  lastContactTime: string;
  recordings: Array<{ id: string; date: string; duration: string; summary: string; url?: string; transcript?: string }>;
  // Extended CRM detail fields (all optional — UI shows "—" when absent)
  owner?: string;
  phoneVerified?: boolean;
  tags?: string[];
  note?: string;
  configuration?: string;
  propertyType?: string;
  lastContactAttemptedByLead?: string;
  lastContactByLead?: string;
  lastContactAttemptedBySales?: string;
  lastContactBySales?: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  voiceName: string;
  accent: string;
  tone: string;
  photoUrl: string;
  color: string;
  stats: {
    assignedLeads: number;
    todayCalls: number;
    pendingCalls: number;
    completedCalls: number;
    followUpsDue: number;
    interestedLeads: number;
    siteVisits: number;
    conversionRate: number;
  };
}

export interface TranscriptItem {
  sender: 'agent' | 'customer';
  text: string;
  time: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  agent: string;
  lead: string;
  type: string;
  message: string;
}
