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
  siteVisitScheduled: string; // empty string or date
  callDuration: string;
  lastContactTime: string;
  recordings: Array<{ id: string; date: string; duration: string; summary: string }>;
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

export const AGENTS: Agent[] = [
  {
    id: "agent_1",
    name: "Kavya",
    role: "Astra Premium Properties Agent",
    voiceName: "Google India English Female / Premium",
    accent: "en-IN",
    tone: "Enthusiastic & Persuasive",
    photoUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&q=80",
    color: "cyan",
    stats: {
      assignedLeads: 28,
      todayCalls: 12,
      pendingCalls: 3,
      completedCalls: 9,
      followUpsDue: 4,
      interestedLeads: 8,
      siteVisits: 3,
      conversionRate: 32
    }
  },
  {
    id: "agent_2",
    name: "Arjun",
    role: "Astra Commercial & Townhouse Expert",
    voiceName: "Google India English Male / Technical",
    accent: "en-IN",
    tone: "Professional & Analytical",
    photoUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&q=80",
    color: "blue",
    stats: {
      assignedLeads: 31,
      todayCalls: 14,
      pendingCalls: 5,
      completedCalls: 9,
      followUpsDue: 6,
      interestedLeads: 7,
      siteVisits: 2,
      conversionRate: 28
    }
  },
  {
    id: "agent_3",
    name: "Ananya",
    role: "Astra Smart Living & Duplex Consultant",
    voiceName: "Google UK English Female / Warm",
    accent: "en-GB",
    tone: "Warm & Friendly",
    photoUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&q=80",
    color: "emerald",
    stats: {
      assignedLeads: 24,
      todayCalls: 10,
      pendingCalls: 2,
      completedCalls: 8,
      followUpsDue: 3,
      interestedLeads: 9,
      siteVisits: 4,
      conversionRate: 38
    }
  },
  {
    id: "agent_4",
    name: "Rohan",
    role: "Astra Suburban & Multi-family Specialist",
    voiceName: "Google US English Male / Supportive",
    accent: "en-US",
    tone: "Patient & Supportive",
    photoUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&q=80",
    color: "amber",
    stats: {
      assignedLeads: 35,
      todayCalls: 16,
      pendingCalls: 6,
      completedCalls: 10,
      followUpsDue: 8,
      interestedLeads: 6,
      siteVisits: 1,
      conversionRate: 21
    }
  },
  {
    id: "agent_5",
    name: "Priya",
    role: "Astra Ultra-Luxury Estate Curator",
    voiceName: "Google US English Female / Elegant",
    accent: "en-US",
    tone: "Elegant & Articulate",
    photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&q=80",
    color: "fuchsia",
    stats: {
      assignedLeads: 18,
      todayCalls: 8,
      pendingCalls: 1,
      completedCalls: 7,
      followUpsDue: 2,
      interestedLeads: 6,
      siteVisits: 5,
      conversionRate: 44
    }
  }
];

export const INITIAL_LEADS: Lead[] = [
  {
    id: "lead_1",
    name: "Eleanor Vance",
    phone: "+1 (555) 902-1204",
    source: "Facebook Ads",
    project: "Astra Heights (Manhattan)",
    dateTime: "2026-07-16 09:30 AM",
    agentId: "agent_1", // Kavya
    status: "Contacted",
    interestLevel: "Hot Lead",
    budget: 1200000,
    location: "Manhattan, NY",
    remarks: "Looking for a luxury loft with skyline views, large windows, and premium finishes. High intent buyer.",
    nextFollowUpDate: "2026-07-17",
    timeline: "Immediate",
    whatsappSent: true,
    brochureSent: true,
    priceSheetSent: true,
    siteVisitScheduled: "2026-07-20",
    callDuration: "3m 45s",
    lastContactTime: "2026-07-16 10:15 AM",
    recordings: [
      {
        id: "rec_1",
        date: "2026-07-16",
        duration: "3m 45s",
        summary: "Eleanor is extremely interested in the Manhattan Astra Heights project. She confirmed her budget of $1.2 million and timeline of immediate purchase. WhatsApp digital brochure and location map successfully pushed automatically after call. Scheduled site visit on July 20th."
      }
    ]
  },
  {
    id: "lead_2",
    name: "Rahul Mehra",
    phone: "+91 98765 43210",
    source: "Website",
    project: "Astra Meadows (Bangalore)",
    dateTime: "2026-07-16 11:15 AM",
    agentId: "agent_2", // Arjun
    status: "Pending",
    interestLevel: "Interested",
    budget: 450000,
    location: "Bangalore, IN",
    remarks: "Expressed interest in a 3 BHK penthouse. Wants to know about high-end amenities, clubhouses, and current discounts.",
    nextFollowUpDate: "2026-07-16",
    timeline: "1 Month",
    whatsappSent: false,
    brochureSent: false,
    priceSheetSent: false,
    siteVisitScheduled: "",
    callDuration: "0s",
    lastContactTime: "Never",
    recordings: []
  },
  {
    id: "lead_3",
    name: "Sarah Jenkins",
    phone: "+1 (312) 555-0199",
    source: "Google Ads",
    project: "Astra Smart duplexes (Chicago)",
    dateTime: "2026-07-15 04:45 PM",
    agentId: "agent_3", // Ananya
    status: "Outgoing Retry",
    interestLevel: "Call Later",
    budget: 850000,
    location: "Chicago, IL",
    remarks: "Agent Ananya initiated first auto-call 30s after registration. Client was in a meeting, requested to call later in the evening.",
    nextFollowUpDate: "2026-07-16",
    timeline: "3 Months",
    whatsappSent: true,
    brochureSent: true,
    priceSheetSent: false,
    siteVisitScheduled: "",
    callDuration: "42s",
    lastContactTime: "2026-07-15 04:46 PM",
    recordings: [
      {
        id: "rec_2",
        date: "2026-07-15",
        duration: "42s",
        summary: "Customer was driving/busy. AI Ananya agreed to reschedule call. WhatsApp welcome brochure sent automatically."
      }
    ]
  },
  {
    id: "lead_4",
    name: "Rajesh Patel",
    phone: "+91 99112 23344",
    source: "Sell.Do",
    project: "Astra Grande (Mumbai)",
    dateTime: "2026-07-15 11:00 AM",
    agentId: "agent_5", // Priya
    status: "Completed",
    interestLevel: "Hot Lead",
    budget: 2500000,
    location: "Mumbai, IN",
    remarks: "HNW buyer looking for ultra-luxury sea-facing apartment. Needs 4+ BHK and private parking.",
    nextFollowUpDate: "2026-07-19",
    timeline: "Immediate",
    whatsappSent: true,
    brochureSent: true,
    priceSheetSent: true,
    siteVisitScheduled: "2026-07-18",
    callDuration: "5m 12s",
    lastContactTime: "2026-07-15 11:35 AM",
    recordings: [
      {
        id: "rec_3",
        date: "2026-07-15",
        duration: "5m 12s",
        summary: "Priya discussed details for Astra Grande Mumbai. Customer is highly impressed, scheduled personal site visit on July 18. Shared brochure, pricing structure, and site video link via WhatsApp."
      }
    ]
  },
  {
    id: "lead_5",
    name: "Vikram Singh",
    phone: "+91 98100 11223",
    source: "Manual Entry",
    project: "Astra Vista (Delhi NCR)",
    dateTime: "2026-07-14 02:20 PM",
    agentId: "agent_4", // Rohan
    status: "Handed Over",
    interestLevel: "Interested",
    budget: 350000,
    location: "Delhi, NCR",
    remarks: "Looking for a budget-friendly 2 BHK with family parks. Handed over to Human Agent Sunil Deshmukh for booking details.",
    nextFollowUpDate: "Completed",
    timeline: "1 Month",
    whatsappSent: true,
    brochureSent: true,
    priceSheetSent: true,
    siteVisitScheduled: "2026-07-15",
    callDuration: "4m 20s",
    lastContactTime: "2026-07-14 02:25 PM",
    recordings: [
      {
        id: "rec_4",
        date: "2026-07-14",
        duration: "4m 20s",
        summary: "Rohan answered queries on home loans and local school locations. Client is satisfied, scheduled site visit for July 15 and requested direct handover to a human manager to start financial paperworks."
      }
    ]
  },
  {
    id: "lead_6",
    name: "David Miller",
    phone: "+1 (415) 555-2234",
    source: "API",
    project: "Astra Heights (Manhattan)",
    dateTime: "2026-07-16 11:40 AM",
    agentId: "agent_1", // Kavya
    status: "Pending",
    interestLevel: "Interested",
    budget: 1400000,
    location: "Manhattan, NY",
    remarks: "Inquired about parking facilities and layout modifications. Transferred via API webhook from Astra corporate portal.",
    nextFollowUpDate: "2026-07-16",
    timeline: "Immediate",
    whatsappSent: false,
    brochureSent: false,
    priceSheetSent: false,
    siteVisitScheduled: "",
    callDuration: "0s",
    lastContactTime: "Never",
    recordings: []
  },
  {
    id: "lead_7",
    name: "Anjali Gupta",
    phone: "+91 88877 66554",
    source: "Google Ads",
    project: "Astra Meadows (Bangalore)",
    dateTime: "2026-07-16 11:45 AM",
    agentId: "agent_3", // Ananya
    status: "Pending",
    interestLevel: "Warm Lead",
    budget: 520000,
    location: "Bangalore, IN",
    remarks: "Lead captured from Google Ads landing page. Looking for close proximity to IT corridor.",
    nextFollowUpDate: "2026-07-16",
    timeline: "Immediate",
    whatsappSent: false,
    brochureSent: false,
    priceSheetSent: false,
    siteVisitScheduled: "",
    callDuration: "0s",
    lastContactTime: "Never",
    recordings: []
  }
];

export const MOCK_CRM_ACTIVITY_LOGS = [
  {
    id: "log_1",
    timestamp: "10 seconds ago",
    agent: "Kavya",
    lead: "Rahul Mehra",
    type: "assignment",
    message: "New lead Rahul Mehra arrived from Website and auto-assigned to Kavya (Round-Robin)"
  },
  {
    id: "log_2",
    timestamp: "1 minute ago",
    agent: "Arjun",
    lead: "Rahul Mehra",
    type: "schedule",
    message: "Arjun scheduled automated call trigger in 30 seconds"
  },
  {
    id: "log_3",
    timestamp: "15 minutes ago",
    agent: "Kavya",
    lead: "Eleanor Vance",
    type: "whatsapp",
    message: "WhatsApp digital brochure and Manhattan Maps link sent to +1 (555) 902-1204"
  },
  {
    id: "log_4",
    timestamp: "20 minutes ago",
    agent: "Kavya",
    lead: "Eleanor Vance",
    type: "call_complete",
    message: "Automated AI Call completed. Duration: 3m 45s. Customer qualified as: Hot Lead."
  },
  {
    id: "log_5",
    timestamp: "1 hour ago",
    agent: "Priya",
    lead: "Rajesh Patel",
    type: "followup_schedule",
    message: "Priya scheduled Follow-up call for Rajesh Patel on July 19, 2026"
  },
  {
    id: "log_6",
    timestamp: "2 hours ago",
    agent: "Rohan",
    lead: "Vikram Singh",
    type: "handover",
    message: "Lead Vikram Singh handed over to Human Sales Executive Sunil Deshmukh. Lead dossier compiled."
  }
];

// Contextual Dialogue Tree for Interactive Simulated calling
export const DIALOGUE_SCRIPTS: Record<string, { prompt: string; intent: string; fieldUpdate?: Partial<Lead>; response: string }[]> = {
  "Eleanor Vance": [
    {
      prompt: "Hello, who is this?",
      intent: "greet",
      response: "Hello, is this Eleanor Vance? I am Kavya, your AI property expert from Project Astra Heights Manhattan. I saw your enquiry about our luxury apartments. Am I speaking with the right person?"
    },
    {
      prompt: "Yes, I am Eleanor. Tell me about the project.",
      intent: "project_info",
      response: "Fantastic! Astra Heights is our crown jewel located in the heart of Manhattan. It features premium 2 and 3 BHK luxury lofts with soaring 12-foot ceilings, floor-to-ceiling skyline windows, and state-of-the-art automated home systems. We also have a 24/7 infinity rooftop pool and a world-class wellness spa. What specific layout size are you seeking, Eleanor?"
    },
    {
      prompt: "I am looking for a luxury loft with skyline views. What is the price?",
      intent: "views_price",
      fieldUpdate: { remarks: "Looking for a luxury loft with skyline views. High interest.", interestLevel: "Hot Lead" },
      response: "Our lofts start at $1.1 million, which includes stunning panoramic skyline views of Manhattan and premium smart appliances. Since you're interested in premium lofts, our executive penthouse units are also available. May I ask what kind of budget you are working with today?"
    },
    {
      prompt: "My budget is about 1.2 million, and I want to buy immediately.",
      intent: "budget_timeline",
      fieldUpdate: { budget: 1200000, timeline: "Immediate", interestLevel: "Hot Lead", status: "Contacted" },
      response: "Perfect, a budget of 1.2 million lines up beautifully with our executive high-floor apartments, which offer some of the best views! And since your purchase timeline is immediate, I can block one of our premier ready-to-move-in units for you. I am sending you the complete interactive digital brochure and current price sheet on WhatsApp right now. Would you like to schedule a site visit this coming Monday, July 20th, to inspect the layouts in person?"
    },
    {
      prompt: "Yes, that works! Send me the details on WhatsApp and schedule the visit.",
      intent: "book_visit",
      fieldUpdate: { siteVisitScheduled: "2026-07-20", brochureSent: true, priceSheetSent: true, whatsappSent: true, status: "Handed Over", interestLevel: "Interested" },
      response: "Processing your request now, Eleanor! I have scheduled your private site visit for Monday, July 20th. I've updated your preferences and sent the digital brochure, location maps, and payment plans to your WhatsApp number. Since you are highly qualified, I am immediately compiling your lead dossier and handing it over to our senior human manager to welcome you in person. We look forward to seeing you at Astra Heights!"
    }
  ],
  "Generic": [
    {
      prompt: "Hello?",
      intent: "greet",
      response: "Hello! I am your AI property advisor from Project Astra. I'm calling to verify your recent interest in our premium smart homes. May I confirm your name and which location you are interested in?"
    },
    {
      prompt: "I'm interested in Bangalore, my name is Amit.",
      intent: "identity",
      fieldUpdate: { name: "Amit Sharma", location: "Bangalore, IN", project: "Astra Meadows (Bangalore)" },
      response: "Excellent, Amit! Astra Meadows in Bangalore is a master-planned green township near the IT corridor. It features lush family parks, a majestic clubhouse, and luxury smart residences. What is your preferred configuration and budget for this property?"
    },
    {
      prompt: "My budget is 450,000 dollars and I want a 3 BHK.",
      intent: "budget",
      fieldUpdate: { budget: 450000, remarks: "Wants a 3 BHK penthouse.", timeline: "1 Month", interestLevel: "Interested" },
      response: "Fantastic! A budget of 450,000 matches our gorgeous 3 BHK corner garden apartments beautifully. I've updated your records and I am sending you our floor plans and amenity guides via WhatsApp as we speak. Would you like me to book a site visit for you this weekend?"
    },
    {
      prompt: "No, please call me tomorrow.",
      intent: "later",
      fieldUpdate: { nextFollowUpDate: "2026-07-17", interestLevel: "Call Later" },
      response: "No worries at all, Amit! I completely understand. I have automatically scheduled a quick follow-up call for tomorrow, July 17th. I will let you discuss with your family. Have a wonderful day!"
    }
  ]
};
