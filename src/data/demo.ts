import type { AgentId } from '../types/agent';

export interface Lead {
  id: string;
  name: string;
  city: string;
  phone: string;
  intent: number;
  intentType: string;
  sentiment: string;
  sentimentScore: number;
  budget: string;
  location: string;
  urgency: number;
  priceSensitivity: number;
  investmentPotential: number;
  objection: string;
  lastContact: string;
  previousEmployee: string;
  siteVisit: string;
  nextFollowUp: string;
  stage: string;
  avatar: string;
}

export const leads: Lead[] = [
{
  id: 'rahul-sharma',
  name: 'Rahul Sharma',
  city: 'Bangalore',
  phone: '+91 98765 43210',
  intent: 91,
  intentType: 'Investment',
  sentiment: 'Positive',
  sentimentScore: 92,
  budget: '₹30L – ₹50L',
  location: 'Devanahalli',
  urgency: 74,
  priceSensitivity: 61,
  investmentPotential: 91,
  objection: 'Price',
  lastContact: '3 days ago',
  previousEmployee: 'Arjun',
  siteVisit: 'Not completed',
  nextFollowUp: 'Tomorrow, 11:30 AM',
  stage: 'Interested',
  avatar: 'https://i.pravatar.cc/160?img=13'
},
{
  id: 'priya-nair',
  name: 'Priya Nair',
  city: 'Kochi',
  phone: '+91 90210 55411',
  intent: 76,
  intentType: 'Information',
  sentiment: 'Curious',
  sentimentScore: 71,
  budget: '₹20L – ₹35L',
  location: 'Whitefield',
  urgency: 48,
  priceSensitivity: 72,
  investmentPotential: 64,
  objection: 'Documentation',
  lastContact: 'Yesterday',
  previousEmployee: 'Meera',
  siteVisit: 'Scheduled',
  nextFollowUp: 'Fri, 4:00 PM',
  stage: 'Contacted',
  avatar: 'https://i.pravatar.cc/160?img=45'
},
{
  id: 'arjun-mehta',
  name: 'Arjun Mehta',
  city: 'Hyderabad',
  phone: '+91 99887 21004',
  intent: 89,
  intentType: 'Purchase',
  sentiment: 'Confident',
  sentimentScore: 84,
  budget: '₹50L – ₹80L',
  location: 'Sarjapur',
  urgency: 81,
  priceSensitivity: 44,
  investmentPotential: 88,
  objection: 'Timing',
  lastContact: '6 hours ago',
  previousEmployee: 'Arjun',
  siteVisit: 'Completed',
  nextFollowUp: 'Today, 6:15 PM',
  stage: 'Site Visit Scheduled',
  avatar: 'https://i.pravatar.cc/160?img=33'
},
{
  id: 'sneha-reddy',
  name: 'Sneha Reddy',
  city: 'Chennai',
  phone: '+91 93400 71288',
  intent: 58,
  intentType: 'Follow-up',
  sentiment: 'Frustrated',
  sentimentScore: 34,
  budget: '₹25L – ₹40L',
  location: 'Devanahalli',
  urgency: 62,
  priceSensitivity: 78,
  investmentPotential: 55,
  objection: 'Trust',
  lastContact: '2 days ago',
  previousEmployee: 'Kiran',
  siteVisit: 'Cancelled',
  nextFollowUp: 'Today, 7:00 PM',
  stage: 'Contacted',
  avatar: 'https://i.pravatar.cc/160?img=27'
},
{
  id: 'vikram-singh',
  name: 'Vikram Singh',
  city: 'Delhi',
  phone: '+91 98110 34567',
  intent: 83,
  intentType: 'Site Visit',
  sentiment: 'Positive',
  sentimentScore: 79,
  budget: '₹40L – ₹60L',
  location: 'Devanahalli',
  urgency: 69,
  priceSensitivity: 52,
  investmentPotential: 80,
  objection: 'Family approval',
  lastContact: 'Today',
  previousEmployee: 'Meera',
  siteVisit: 'Scheduled',
  nextFollowUp: 'Sun, 11:30 AM',
  stage: 'New Leads',
  avatar: 'https://i.pravatar.cc/160?img=52'
}];


export const leadById = (id: string) => leads.find((l) => l.id === id) ?? leads[0];

export const missionMetrics = [
{ label: 'Leads Processed', value: '1,284', delta: '+12%', tone: 'voice' as const },
{ label: 'AI Conversations', value: '742', delta: '+18%', tone: 'intent' as const },
{ label: 'Hot Leads', value: '186', delta: '+22%', tone: 'objection' as const },
{ label: 'Site Visits', value: '73', delta: '+16%', tone: 'sentiment' as const },
{ label: 'Pipeline Influenced', value: '₹18.4L', delta: '+28%', tone: 'action' as const }];


export const performanceStats = [
{ label: 'Total Calls', value: '186', delta: '↑ 24%' },
{ label: 'Connected', value: '142', delta: '76%' },
{ label: 'Hot Leads', value: '73', delta: '39%' },
{ label: 'Revenue Influenced', value: '₹18.4L', delta: '↑ 28%' }];


export const performanceCurve = [22, 30, 27, 41, 55, 49, 63, 72, 68, 79, 86, 91];

export const pipeline = [
{ stage: 'New Leads', count: 482, pct: 100, delta: '+12%', color: '#60a5fa' },
{ stage: 'Contacted', count: 361, pct: 75, delta: '+15%', color: '#a78bfa' },
{ stage: 'Interested', count: 186, pct: 39, delta: '+22%', color: '#34d399' },
{ stage: 'Site Visit Scheduled', count: 73, pct: 15, delta: '+28%', color: '#fbbf24' },
{ stage: 'Booked', count: 42, pct: 9, delta: '+18%', color: '#2dd4bf' }];


export interface ActivityItem {
  time: string;
  title: string;
  detail: string;
  agent: AgentId;
}

export const liveActivity: ActivityItem[] = [
{ time: '11:42', title: 'AIVA called Rahul Sharma', detail: 'High intent detected · Devanahalli', agent: 'ava' },
{ time: '11:40', title: 'WhatsApp message sent', detail: 'Location + project details', agent: 'nova' },
{ time: '11:38', title: 'Site visit scheduled', detail: 'Sun, 11:30 AM · Devanahalli', agent: 'nova' },
{ time: '11:36', title: 'CRM updated automatically', detail: 'Lead moved to Hot', agent: 'nova' },
{ time: '11:34', title: 'Follow-up reminder set', detail: 'For 2 days', agent: 'nia' },
{ time: '11:31', title: 'Price objection logged', detail: 'Strategy recommended', agent: 'zara' }];


export const recentActivity = [
{ name: 'Rahul Sharma', title: 'Site visit scheduled', detail: 'Devanahalli', time: '11:42 AM', agent: 'nova' as AgentId },
{ name: 'Priya Nair', title: 'WhatsApp message sent', detail: 'Location + Brochure', time: '11:38 AM', agent: 'nova' as AgentId },
{ name: 'Arjun Mehta', title: 'CRM updated', detail: 'Lead status: Engaged', time: '11:36 AM', agent: 'nia' as AgentId },
{ name: 'Sneha Reddy', title: 'Call ended', detail: 'Duration: 04m 32s', time: '11:32 AM', agent: 'ava' as AgentId },
{ name: 'Vikram Singh', title: 'New lead captured', detail: 'From website', time: '11:28 AM', agent: 'aria' as AgentId }];


export const liveTranscript = [
{ speaker: 'AIVA', text: 'Are you looking for a plot for investment or personal use?', at: '00:28' },
{ speaker: 'Customer', text: "I'm actually looking for something near Devanahalli.", at: '00:35' },
{ speaker: 'AIVA', text: 'Devanahalli has seen 34% appreciation in the last 18 months.', at: '00:44' },
{ speaker: 'Customer', text: 'That sounds good, but the price is slightly high for me.', at: '00:58' }];


export const emotionTimeline = [
{ time: '09:41', label: 'Neutral', value: 50, tone: '#64748b' },
{ time: '09:43', label: 'Interested', value: 68, tone: '#60a5fa' },
{ time: '09:45', label: 'Excited', value: 88, tone: '#34d399' },
{ time: '09:47', label: 'Slight hesitation', value: 58, tone: '#fbbf24' },
{ time: '09:49', label: 'Positive', value: 84, tone: '#34d399' }];


export const teamDecision = {
  lead: 'Rahul Sharma',
  intent: 'Investment — 92%',
  sentiment: 'Positive',
  objection: 'Price',
  memory: 'Devanahalli preference',
  recommendation: 'Follow-up',
  nextAction: 'Schedule call tomorrow at 11:30 AM'
};

export const teamChatter: {agent: AgentId;line: string;}[] = [
{ agent: 'ava', line: "I've completed Rahul's conversation." },
{ agent: 'aria', line: 'I detected investment intent at 92%.' },
{ agent: 'mira', line: 'His sentiment is strongly positive.' },
{ agent: 'zara', line: 'His primary concern is pricing.' },
{ agent: 'nia', line: 'He previously requested a Devanahalli project.' },
{ agent: 'nova', line: 'I recommend a follow-up tomorrow at 11:30 AM.' }];