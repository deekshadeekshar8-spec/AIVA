import type { Agent, AgentId } from '../types/agent';

/**
 * The six AIVA agents. Each definition is self contained: identity, voice,
 * analytics, the script it performs on stage, and the questions it can answer.
 * Swapping the demo scripts for a real LLM later means replacing `intro`/`qa`
 * resolution inside the orchestrator — nothing in the UI layer changes.
 */

export const ava: Agent = {
  id: 'ava',
  index: 'Agent 01',
  name: 'Kavya',
  role: 'Conversation Specialist',
  shortRole: 'Voice Agent',
  mission: 'Handle and understand every voice conversation with customers.',
  personality: 'Friendly, warm, conversational, confident.',
  speakingStyle: 'Natural and approachable.',
  accent: '#22d3ee',
  accentSoft: 'rgba(34, 211, 238, 0.16)',
  avatar: "/3cdd6223-5a59-45ca-9187-2c406b3573ce.jpg",
  focus: '50% 12%',
  status: 'Active',
  liveStatus: ['Listening', 'On call with Rahul', 'Transcribing', 'Summarising'],
  responsibilities: [
  'Make and receive AI calls',
  'Listen and understand spoken questions',
  'Maintain natural conversation',
  'Transcribe every call',
  'Extract important information',
  'Detect conversation signals and buying moments',
  'Summarise calls for the team'],

  analyzes: ['Live speech', 'Conversation flow', 'Questions asked', 'Buying signals', 'Call quality'],
  metrics: [
  { label: 'Total Calls', value: '186', delta: '+24%', tone: 'up' },
  { label: 'Connected Calls', value: '142', delta: '76%', tone: 'flat' },
  { label: 'Active Calls', value: '3', delta: 'live', tone: 'flat' },
  { label: 'Avg Call Duration', value: '4m 12s', delta: '+8%', tone: 'up' },
  { label: 'Conversation Quality', value: '94%', delta: '+3%', tone: 'up' },
  { label: 'Buying Signals', value: '186', delta: '+22%', tone: 'up' },
  { label: 'Calls Today', value: '48', delta: '+11%', tone: 'up' },
  { label: 'Calls This Week', value: '312', delta: '+19%', tone: 'up' }],

  actions: [
  { id: 'start-call', label: 'Start call', kind: 'safe', result: "Calling is currently paused — ask the team to enable it before I can dial a real number." },
  { id: 'pause-call', label: 'Pause call', kind: 'safe', result: "There's no live call in progress to pause right now." },
  { id: 'end-call', label: 'End call', kind: 'confirm', confirmPrompt: "There's no live call in progress. End anyway?", result: 'No live call was active.' },
  { id: 'summarize', label: 'Summarise call', kind: 'safe', result: 'Open a lead’s page to see its real call history and AI-generated summary.' },
  { id: 'to-aria', label: 'Send to Aria', kind: 'handoff', target: 'aria' },
  { id: 'to-mira', label: 'Send to Mira', kind: 'handoff', target: 'mira' }],

  intro: [
  { id: 'a1', text: "Hi, I'm Ava, AIVA's Voice Agent. I handle the conversation layer of your sales operation.", state: 'speaking', duration: 4200 },
  { id: 'a2', text: 'While I speak with customers, I listen for their questions, preferences, concerns and buying signals.', state: 'explaining', highlight: 'liveCall', duration: 4600 },
  { id: 'a3', text: 'Right now I am three minutes into a live call with Rahul Sharma. Every word is transcribed as it happens.', state: 'analyzing', highlight: 'liveCall', reveal: 'transcript', duration: 4800 },
  { id: 'a4', text: 'Once I understand the conversation, I pass the intelligence to the rest of the AIVA team.', state: 'speaking', reveal: 'metrics', duration: 4000 }],

  introVariants: [
  [
  { id: 'av1', text: "Welcome back. I'm still on with Rahul — three minutes in, and he just brought up price.", state: 'speaking', highlight: 'liveCall', duration: 4400 },
  { id: 'av2', text: 'Ask me anything about today\'s calls, or I can pull in Aria or Mira.', state: 'listening', duration: 3200 }],

  [
  { id: 'av3', text: "Good to see you again. Forty-eight calls today, quality holding at ninety-four percent.", state: 'analyzing', reveal: 'metrics', duration: 4400 },
  { id: 'av4', text: "What would you like to know?", state: 'listening', duration: 2600 }]],


  qa: [
  {
    id: 'ava-what',
    question: 'What do you do?',
    match: ['what do you do', 'who are you', 'your job', 'responsibility'],
    lines: [
    { id: 'aw1', text: 'I am the voice of AIVA. I place and receive calls, hold the conversation, and turn spoken language into structured intelligence.', state: 'speaking', duration: 4600 },
    { id: 'aw2', text: 'Today I have handled 48 calls, connected 142 of 186 this week, and flagged 186 buying signals.', state: 'analyzing', reveal: 'metrics', duration: 4200 }]

  },
  {
    id: 'ava-calls',
    question: "Show me today's calls.",
    match: ['calls today', "today's calls", 'show me calls', 'call volume'],
    lines: [
    { id: 'ac1', text: '48 calls today. 37 connected, 3 still live, average duration four minutes twelve seconds.', state: 'explaining', highlight: 'performance', reveal: 'metrics', duration: 4400 },
    { id: 'ac2', text: 'Conversation quality is holding at 94%. Nothing has degraded in the last four hours.', state: 'speaking', duration: 3600 }]

  },
  {
    id: 'ava-handoff',
    question: 'Pass this call to Aria.',
    match: ['pass to aria', 'send to aria', 'handoff', 'give to aria'],
    lines: [
    { id: 'ah1', text: 'Sending the conversation intelligence over now. Aria, the transcript is yours.', state: 'executing', duration: 3600 }],

    handoffTo: 'aria'
  },
  {
    id: 'ava-quality',
    question: 'How is call quality trending?',
    match: ['call quality', 'quality trend', 'how good are the calls', 'quality score'],
    lines: [
    { id: 'aq1', text: 'Conversation quality is at ninety-four percent, up three points this week. Nothing has degraded in the last four hours.', state: 'analyzing', reveal: 'metrics', duration: 4600 }]

  },
  {
    id: 'ava-signals',
    question: 'What buying signals have you found?',
    match: ['buying signal', 'signals found', 'what signals', 'signal detected'],
    lines: [
    { id: 'as1', text: 'One hundred eighty-six buying signals this week, up twenty-two percent. Price mentions, timeline questions, and repeat location asks are the strongest.', state: 'explaining', reveal: 'metrics', duration: 5000 }]

  },
  {
    id: 'ava-summary',
    question: 'Summarise my last call.',
    match: ['summarise', 'summarize', 'last call summary', 'call summary'],
    lines: [
    { id: 'as2', text: 'Rahul Sharma, four minutes twelve seconds. He asked about investment appreciation, named Devanahalli twice, and flagged price as a concern near the end.', state: 'speaking', highlight: 'liveCall', duration: 5200 }]

  }],

  decisions: [
  { time: '11:42', subject: 'Rahul Sharma', detail: 'Buying signal captured — "price is slightly high"' },
  { time: '11:35', subject: 'Priya Nair', detail: 'Call summarised — brochure requested' },
  { time: '11:28', subject: 'Vikram Singh', detail: 'Inbound call connected — 3m 04s' }],

  voice: { pitch: 1.06, rate: 1.0, match: ['female', 'samantha', 'zira', 'google uk english female'] },
  worksWith: ['aria', 'mira', 'zara', 'nia', 'nova']
};

export const aria: Agent = {
  id: 'aria',
  index: 'Agent 02',
  name: 'Arjun',
  role: 'Intent Intelligence Specialist',
  shortRole: 'Intent Agent',
  mission: 'Understand what every customer truly wants.',
  personality: 'Highly intelligent, analytical, precise and confident.',
  speakingStyle: 'Measured, exact, evidence-first.',
  accent: '#a78bfa',
  accentSoft: 'rgba(167, 139, 250, 0.16)',
  avatar: "/7fad5fe3-95ba-4a13-b5f1-af455f8106e6.jpg",
  focus: '50% 12%',
  status: 'Active',
  liveStatus: ['Detecting intent', 'Scoring lead', 'Recalculating', 'Intent confirmed'],
  responsibilities: [
  'Detect purchase, investment and information intent',
  'Detect site-visit and follow-up intent',
  'Detect urgency and buying probability',
  'Analyse customer questions and behaviour',
  'Analyse conversation context'],

  analyzes: ['Conversation content', 'Customer questions', 'Behaviour', 'Conversation history', 'Buying signals', 'Customer context'],
  metrics: [
  { label: 'Conversations Analysed', value: '1,284', delta: '+12%', tone: 'up' },
  { label: 'Buying Signals', value: '186', delta: '+22%', tone: 'up' },
  { label: 'High Intent Leads', value: '73', delta: '+16%', tone: 'up' },
  { label: 'Prediction Accuracy', value: '91%', delta: '+2%', tone: 'up' }],

  actions: [
  { id: 'analyze-lead', label: 'Analyse lead', kind: 'safe', result: 'Open a specific lead’s page to see their real, up-to-date intent analysis.' },
  { id: 'recalculate', label: 'Recalculate intent', kind: 'safe', result: 'Lead scores recalculate automatically after every real call — nothing to trigger manually here.' },
  { id: 'explain', label: 'Explain score', kind: 'safe', result: 'A lead’s score breakdown lives on their own page under AI Sales Employee.' },
  { id: 'prioritise', label: 'Prioritise lead', kind: 'safe', result: 'The Leads page already sorts by real interest level — open it to see who’s hottest right now.' },
  { id: 'to-nova', label: 'Send to Nova', kind: 'handoff', target: 'nova' }],

  intro: [
  { id: 'r1', text: "Hello, I'm Aria. I'm AIVA's Intent Intelligence Agent.", state: 'speaking', duration: 3200 },
  { id: 'r2', text: "My job is to understand what customers really want, even when they don't directly say it.", state: 'speaking', duration: 4200 },
  { id: 'r3', text: 'I combine conversation context, customer behaviour, previous interactions and buying signals to calculate intent.', state: 'explaining', highlight: 'leadDna', reveal: 'signalFlow', duration: 5200 },
  { id: 'r4', text: 'Take Rahul Sharma. Investment intent, ninety-two percent. Devanahalli, thirty to fifty lakhs, urgency seventy-four.', state: 'analyzing', highlight: 'leadDna', reveal: 'intentBreakdown', duration: 5600 },
  { id: 'r5', text: 'Across the pipeline that gives us seventy-three high intent leads from twelve hundred and eighty-four conversations.', state: 'explaining', highlight: 'pipeline', reveal: 'metrics', duration: 5200 },
  { id: 'r6', text: 'Ask me anything about intent, or I can hand Rahul to Nova to act on it.', state: 'listening', duration: 3600 }],

  introVariants: [
  [
  { id: 'rv1', text: "Back again — good. Intent is still trending up, seventy-three high-intent leads and counting.", state: 'analyzing', reveal: 'metrics', duration: 4600 },
  { id: 'rv2', text: 'What do you want to dig into?', state: 'listening', duration: 2600 }],

  [
  { id: 'rv3', text: "Rahul's score hasn't moved — ninety-one percent, investment intent, still waiting on that follow-up.", state: 'explaining', highlight: 'leadDna', duration: 4800 },
  { id: 'rv4', text: 'Ask me why, or ask about another lead.', state: 'listening', duration: 2800 }]],


  qa: [
  {
    id: 'aria-what',
    question: 'What do you do?',
    match: ['what do you do', 'who are you', 'your job', 'responsibility', 'what is your role'],
    lines: [
    { id: 'q1a', text: 'I read intent. Every conversation Ava captures arrives with me, and I decide what the customer is actually trying to achieve.', state: 'speaking', duration: 4800 },
    { id: 'q1b', text: 'Purchase, investment, information, site visit, follow-up — I separate them and attach a probability to each.', state: 'explaining', reveal: 'intentBreakdown', duration: 4800 }]

  },
  {
    id: 'aria-how',
    question: 'How do you calculate intent?',
    match: ['how do you calculate', 'how does intent work', 'calculate intent', 'how do you score', 'methodology'],
    lines: [
    { id: 'q2a', text: 'Let me show you how I calculate intent.', state: 'thinking', reveal: 'signalFlow', duration: 2600 },
    { id: 'q2b', text: 'Conversation, then context, then customer behaviour, then historical memory from Nia, then the buying signals Ava captured.', state: 'explaining', reveal: 'signalFlow', duration: 5600 },
    { id: 'q2c', text: 'Together, these signals give Rahul Sharma a ninety-one percent buying-intent score.', state: 'success', highlight: 'leadDna', reveal: 'intentBreakdown', duration: 4200 }]

  },
  {
    id: 'aria-hot',
    question: "Show me today's high-intent leads.",
    match: ['high intent', 'hot leads', 'today leads', 'best leads', 'immediate attention'],
    lines: [
    { id: 'q3a', text: 'Seventy-three leads cleared my high-intent threshold today. Three need you now.', state: 'analyzing', highlight: 'pipeline', reveal: 'metrics', duration: 4400 },
    { id: 'q3b', text: 'Rahul Sharma at ninety-one, Arjun Mehta at eighty-nine, Vikram Singh at eighty-three. All three are Devanahalli or Sarjapur.', state: 'explaining', highlight: 'leadDna', reveal: 'intentBreakdown', duration: 5600 }]

  },
  {
    id: 'aria-why',
    question: 'Why is Rahul a high-intent lead?',
    match: ['why is rahul', 'why rahul', 'why is this lead', 'why hot', 'why marked hot'],
    lines: [
    { id: 'q4a', text: 'Four reasons. He asked about appreciation, not amenities — that is investor language.', state: 'explaining', highlight: 'leadDna', reveal: 'intentBreakdown', duration: 4600 },
    { id: 'q4b', text: 'He named a specific location, gave a real budget band, and asked about timelines twice in one call.', state: 'analyzing', duration: 4600 },
    { id: 'q4c', text: 'Nia confirmed he requested Devanahalli three days ago. Repeat specificity is the strongest signal I have.', state: 'success', duration: 4800 }]

  },
  {
    id: 'aria-nova',
    question: 'Hand this lead to Nova.',
    match: ['hand to nova', 'send to nova', 'give to nova', 'schedule', 'take action', 'act on'],
    lines: [
    { id: 'q5a', text: 'Agreed — analysis without action is wasted. Passing Rahul to Nova with intent, urgency and price sensitivity attached.', state: 'executing', reveal: 'teamDecision', duration: 5200 }],

    handoffTo: 'nova'
  },
  {
    id: 'aria-accuracy',
    question: 'How accurate is your intent scoring?',
    match: ['how accurate', 'accuracy', 'prediction accuracy', 'how reliable is intent'],
    lines: [
    { id: 'q6a', text: 'Ninety-one percent prediction accuracy, up two points this month. I validate every score against what actually closed.', state: 'analyzing', reveal: 'metrics', duration: 4800 }]

  },
  {
    id: 'aria-trend',
    question: 'Is intent trending up or down?',
    match: ['intent trend', 'trending up', 'trending down', 'is intent improving'],
    lines: [
    { id: 'q7a', text: 'Trending up. High-intent leads grew sixteen percent this month, seventy-three of twelve hundred eighty-four conversations.', state: 'explaining', highlight: 'pipeline', reveal: 'metrics', duration: 5000 }]

  },
  {
    id: 'aria-location',
    question: 'Which locations are customers interested in?',
    match: ['which location', 'popular location', 'top location', 'where do customers want'],
    lines: [
    { id: 'q8a', text: 'Devanahalli leads by a wide margin, followed by Sarjapur and Whitefield. Rahul, Vikram and Sneha all named Devanahalli specifically.', state: 'speaking', highlight: 'leadDna', duration: 5000 }]

  }],

  decisions: [
  { time: '11:42', subject: 'Rahul Sharma', detail: 'Investment Intent — 92%' },
  { time: '11:35', subject: 'Priya Nair', detail: 'Information Intent — 76%' },
  { time: '11:31', subject: 'Arjun Mehta', detail: 'Purchase Intent — 89%' }],

  voice: { pitch: 0.98, rate: 1.02, match: ['female', 'victoria', 'zira', 'google us english'] },
  worksWith: ['ava', 'mira', 'zara', 'nia', 'nova']
};

export const mira: Agent = {
  id: 'mira',
  index: 'Agent 03',
  name: 'Ananya',
  role: 'Emotion & Sentiment Specialist',
  shortRole: 'Sentiment Agent',
  mission: 'Understand how customers feel during every conversation.',
  personality: 'Calm, empathetic, observant and emotionally intelligent.',
  speakingStyle: 'Warm, unhurried, quietly certain.',
  accent: '#34d399',
  accentSoft: 'rgba(52, 211, 153, 0.16)',
  avatar: "/a0eae9fe-56db-4d49-8827-6a6dc72b2f31.jpg",
  focus: '50% 12%',
  status: 'Active',
  liveStatus: ['Analysing sentiment', 'Positive sentiment', 'Tracking emotion', 'Watching hesitation'],
  responsibilities: [
  'Detect positive, negative and neutral sentiment',
  'Detect excitement, hesitation and confusion',
  'Detect frustration and confidence',
  'Track emotional change across a call',
  'Flag customers who need a human'],

  analyzes: ['Tone of voice', 'Pace and pauses', 'Word choice', 'Emotional shifts', 'Escalation risk'],
  metrics: [
  { label: 'Positive Sentiment', value: '92%', delta: '+6%', tone: 'up' },
  { label: 'Interest', value: 'High', tone: 'flat' },
  { label: 'Confidence', value: '88%', delta: '+4%', tone: 'up' },
  { label: 'Hesitation', value: 'Low', tone: 'flat' },
  { label: 'Frustration', value: '12%', delta: '-5%', tone: 'down' },
  { label: 'Calls Monitored', value: '186', delta: '+24%', tone: 'up' }],

  actions: [
  { id: 'analyze-convo', label: 'Analyse conversation', kind: 'safe', result: 'Open a lead’s page and check their real call recordings for sentiment.' },
  { id: 'timeline', label: 'Show emotional timeline', kind: 'safe', result: 'There’s no live call in progress to show a timeline for.' },
  { id: 'flag', label: 'Flag frustrated customer', kind: 'confirm', confirmPrompt: 'Escalating a lead notifies a human manager. Open the specific lead’s page to escalate them by name — continue there instead?', result: 'Open the Automation page to review and resolve real escalations.' },
  { id: 'to-zara', label: 'Send insight to Zara', kind: 'handoff', target: 'zara' }],

  intro: [
  { id: 'm1', text: "I'm Mira. I monitor the emotional signals behind every conversation.", state: 'speaking', duration: 3600 },
  { id: 'm2', text: 'Words tell us what customers say. Emotion tells us how they actually feel.', state: 'speaking', duration: 4000 },
  { id: 'm3', text: 'Rahul is at ninety-two percent positive, confidence eighty-eight, frustration only twelve.', state: 'analyzing', highlight: 'liveCall', reveal: 'sentiment', duration: 5000 },
  { id: 'm4', text: 'But watch the shape of the call — neutral, interested, excited, a dip at nine forty-seven, then positive again.', state: 'explaining', reveal: 'emotionTimeline', duration: 5600 },
  { id: 'm5', text: 'That dip is where price entered the conversation. I sent it to Zara.', state: 'success', duration: 3800 }],

  introVariants: [
  [
  { id: 'mv1', text: "Welcome back. Sentiment is steady — ninety-two percent positive across today's calls.", state: 'analyzing', reveal: 'metrics', duration: 4400 },
  { id: 'mv2', text: 'Ask me who needs attention.', state: 'listening', duration: 2400 }],

  [
  { id: 'mv3', text: "Sneha Reddy is still the one I'm worried about — frustration is rising, not falling.", state: 'warning', reveal: 'sentiment', duration: 4600 },
  { id: 'mv4', text: 'What would you like to check on?', state: 'listening', duration: 2600 }]],


  qa: [
  {
    id: 'mira-what',
    question: 'What do you do?',
    match: ['what do you do', 'who are you', 'your job'],
    lines: [
    { id: 'mw1', text: 'I listen underneath the words — tone, pace, hesitation, the half second before an answer.', state: 'speaking', duration: 4400 },
    { id: 'mw2', text: 'Then I map the emotional arc of the call so the team knows when a customer changed their mind, and why.', state: 'explaining', reveal: 'emotionTimeline', duration: 5000 }]

  },
  {
    id: 'mira-frustrated',
    question: 'Which customers are frustrated?',
    match: ['frustrated', 'angry', 'upset', 'unhappy', 'negative'],
    lines: [
    { id: 'mf1', text: 'One customer is genuinely frustrated. Sneha Reddy — sentiment thirty-four percent, frustration rising across two calls.', state: 'warning', highlight: 'recent', reveal: 'sentiment', duration: 5200 },
    { id: 'mf2', text: 'Her site visit was cancelled and nobody followed up. I would put a human on this one today.', state: 'explaining', duration: 4400 }]

  },
  {
    id: 'mira-zara',
    question: 'Send this to Zara.',
    match: ['send to zara', 'zara', 'objection'],
    lines: [
    { id: 'mz1', text: 'Sending the hesitation window to Zara — nine forty-seven, price mentioned, confidence dropped fourteen points.', state: 'executing', duration: 5000 }],

    handoffTo: 'zara'
  },
  {
    id: 'mira-happiest',
    question: 'Which customers are happiest?',
    match: ['happiest', 'most positive', 'best sentiment', 'who is happy'],
    lines: [
    { id: 'mh1', text: 'Rahul Sharma and Arjun Mehta are both above eighty-five percent positive. Arjun in particular sounds ready to commit.', state: 'analyzing', reveal: 'sentiment', duration: 4800 }]

  },
  {
    id: 'mira-trend',
    question: 'How has sentiment changed today?',
    match: ['sentiment trend', 'sentiment change', 'sentiment today', 'mood today'],
    lines: [
    { id: 'mt1', text: 'Positive sentiment is at ninety-two percent, up six points. Frustration is down five points to twelve percent overall.', state: 'explaining', reveal: 'metrics', duration: 5000 }]

  },
  {
    id: 'mira-confidence',
    question: 'How confident are customers feeling?',
    match: ['how confident', 'confidence level', 'customer confidence'],
    lines: [
    { id: 'mc1', text: 'Confidence is at eighty-eight percent on average, up four points. Hesitation stays low unless price comes up early.', state: 'speaking', reveal: 'sentiment', duration: 4600 }]

  }],

  decisions: [
  { time: '11:44', subject: 'Rahul Sharma', detail: 'Positive — 92%, hesitation at price' },
  { time: '11:32', subject: 'Sneha Reddy', detail: 'Frustration rising — escalation advised' },
  { time: '11:19', subject: 'Arjun Mehta', detail: 'Confidence 84% — ready to commit' }],

  voice: { pitch: 1.0, rate: 0.94, match: ['female', 'karen', 'moira', 'google uk english female'] },
  worksWith: ['ava', 'aria', 'zara', 'nia', 'nova']
};

export const zara: Agent = {
  id: 'zara',
  index: 'Agent 04',
  name: 'Rohan',
  role: 'Objection Handling Specialist',
  shortRole: 'Objection Agent',
  mission: 'Understand why customers hesitate — and recommend the response that works.',
  personality: 'Strategic, confident, persuasive and sharp.',
  speakingStyle: 'Direct, decisive, always with a recommendation.',
  accent: '#fbbf24',
  accentSoft: 'rgba(251, 191, 36, 0.16)',
  avatar: "/73c8605c-e71d-43c1-878c-0de25c36eaec.jpg",
  focus: '50% 12%',
  status: 'Active',
  liveStatus: ['Monitoring objections', 'Price objection detected', 'Building strategy', 'Strategy ready'],
  responsibilities: [
  'Detect price, trust and location objections',
  'Detect timing and competitor objections',
  'Detect documentation and financing concerns',
  'Detect family approval concerns',
  'Recommend response strategies',
  'Identify recurring objections across the pipeline'],

  analyzes: ['Objection type', 'Severity', 'Historical outcomes', 'Competitor mentions', 'Win rate by strategy'],
  metrics: [
  { label: 'Objections Detected', value: '214', delta: '+9%', tone: 'up' },
  { label: 'Price Objections', value: '96', delta: '45%', tone: 'flat' },
  { label: 'Strategy Win Rate', value: '68%', delta: '+7%', tone: 'up' },
  { label: 'Escalations', value: '11', delta: '-3', tone: 'down' }],

  actions: [
  { id: 'recommend', label: 'Use response', kind: 'safe', result: 'There’s no live call in progress to hand a response into.' },
  { id: 'similar', label: 'View similar cases', kind: 'safe', result: 'Check the Analytics page for real, live objection win-rate data.' },
  { id: 'ask-ava', label: 'Ask Ava to respond', kind: 'handoff', target: 'ava' },
  { id: 'escalate', label: 'Escalate lead', kind: 'confirm', confirmPrompt: 'Open the specific lead’s page to escalate them by name instead — continue anyway?', result: 'Open the Automation page to review and resolve real escalations.' }],

  intro: [
  { id: 'z1', text: "I'm Zara. I identify the reasons customers hesitate.", state: 'speaking', duration: 3200 },
  { id: 'z2', text: "I don't just detect objections. I determine why the customer is hesitant and recommend the most effective next response.", state: 'speaking', duration: 5200 },
  { id: 'z3', text: 'On this call the objection is explicit — "price is slightly high." Price sensitivity, medium severity, eighty-eight percent confidence.', state: 'analyzing', highlight: 'liveCall', reveal: 'objection', duration: 6000 },
  { id: 'z4', text: 'My recommendation: lead with location value and appreciation potential before discussing discounts.', state: 'success', reveal: 'objection', duration: 4800 }],

  introVariants: [
  [
  { id: 'zv1', text: "Back for more? Price is still the top objection — ninety-six of two hundred fourteen this week.", state: 'analyzing', reveal: 'objection', duration: 4600 },
  { id: 'zv2', text: 'Ask me about a specific lead, or the win rate.', state: 'listening', duration: 2800 }],

  [
  { id: 'zv3', text: "Rahul's objection is still open — I'd lead with appreciation before he brings up price again.", state: 'explaining', highlight: 'leadDna', duration: 4800 },
  { id: 'zv4', text: 'What do you need?', state: 'listening', duration: 2200 }]],


  qa: [
  {
    id: 'zara-what',
    question: 'What do you do?',
    match: ['what do you do', 'who are you', 'your job'],
    lines: [
    { id: 'zw1', text: 'I turn resistance into a plan. Eight objection families, ranked by severity, each with a strategy that has actually closed before.', state: 'speaking', reveal: 'objection', duration: 5400 }]

  },
  {
    id: 'zara-why',
    question: "Why isn't this customer buying?",
    match: ["isn't buying", 'not buying', 'why hesitant', 'why not closing', 'blocker'],
    lines: [
    { id: 'zy1', text: 'It is not the price. It is the absence of a comparison — he has nothing to measure the price against.', state: 'explaining', reveal: 'objection', duration: 5000 },
    { id: 'zy2', text: 'Twenty-six of thirty-eight comparable leads closed once we showed eighteen-month appreciation first. Discounting closed nine.', state: 'analyzing', duration: 5400 }]

  },
  {
    id: 'zara-ava',
    question: 'Ask Ava to respond.',
    match: ['ask ava', 'ava respond', 'use response', 'say it'],
    lines: [
    { id: 'za1', text: 'Loading the appreciation-first response into the live call. Ava, take it from here.', state: 'executing', duration: 4000 }],

    handoffTo: 'ava'
  },
  {
    id: 'zara-common',
    question: "What's the most common objection?",
    match: ['most common objection', 'common objection', 'top objection', 'biggest objection'],
    lines: [
    { id: 'zc1', text: 'Price, by a wide margin — ninety-six of two hundred fourteen objections. Trust and timing come next, far behind.', state: 'analyzing', reveal: 'objection', duration: 4800 }]

  },
  {
    id: 'zara-winrate',
    question: "What's your strategy win rate?",
    match: ['win rate', 'how often do strategies work', 'success rate', 'strategy success'],
    lines: [
    { id: 'zwr1', text: 'Sixty-eight percent, up seven points. Leading with location value beats leading with discounts almost three to one.', state: 'explaining', reveal: 'objection', duration: 5000 }]

  },
  {
    id: 'zara-competitor',
    question: 'Are customers mentioning competitors?',
    match: ['competitor', 'mentioned a competitor', 'competition', 'other builders'],
    lines: [
    { id: 'zco1', text: "Occasionally, but it's rarely the real blocker. When it comes up, showing appreciation data closes the comparison faster than matching price.", state: 'speaking', duration: 4800 }]

  }],

  decisions: [
  { time: '11:41', subject: 'Rahul Sharma', detail: 'Price sensitivity — medium, strategy issued' },
  { time: '11:22', subject: 'Sneha Reddy', detail: 'Trust objection — escalation advised' },
  { time: '11:04', subject: 'Vikram Singh', detail: 'Family approval — joint site visit proposed' }],

  voice: { pitch: 0.92, rate: 1.05, match: ['female', 'tessa', 'zira'] },
  worksWith: ['ava', 'aria', 'mira', 'nia', 'nova']
};

export const nia: Agent = {
  id: 'nia',
  index: 'Agent 05',
  name: 'Priya',
  role: 'Customer Memory Specialist',
  shortRole: 'Memory Agent',
  mission: 'Make sure AIVA never forgets a customer.',
  personality: 'Quiet, intelligent, observant and extremely knowledgeable.',
  speakingStyle: 'Softly spoken, precise with detail and dates.',
  accent: '#60a5fa',
  accentSoft: 'rgba(96, 165, 250, 0.16)',
  avatar: "/ffd54ce2-a4ce-44e6-abd9-eeab0922fbf0.jpg",
  focus: '50% 12%',
  status: 'Active',
  liveStatus: ['Recalling memory', 'History retrieved', 'Indexing conversation', 'Timeline updated'],
  responsibilities: [
  'Store conversation history',
  'Remember preferences, objections and promises',
  'Remember site visits and follow-ups',
  'Remember the assigned employee',
  'Build the customer timeline',
  'Retrieve historical information on demand'],

  analyzes: ['Past conversations', 'Preferences', 'Commitments made', 'Employee interactions', 'Follow-up debt'],
  metrics: [
  { label: 'Customers Remembered', value: '12,480', delta: '+312', tone: 'up' },
  { label: 'Conversations Stored', value: '48,116', delta: '+742', tone: 'up' },
  { label: 'Recall Accuracy', value: '99.2%', tone: 'flat' },
  { label: 'Open Promises', value: '27', delta: '-4', tone: 'down' }],

  actions: [
  { id: 'timeline', label: 'View timeline', kind: 'safe', result: 'Open a lead’s page for their real call and WhatsApp timeline.' },
  { id: 'search', label: 'Search memory', kind: 'safe', result: 'Use the Memory Vault page to search real remembered customers by name or phone.' },
  { id: 'retrieve', label: 'Retrieve conversation', kind: 'safe', result: 'Use the Conversations page to search real call transcripts.' },
  { id: 'update', label: 'Update memory', kind: 'confirm', confirmPrompt: 'A lead’s remembered details are edited on their own page, not here. Open the Leads page instead?', result: 'Open a lead’s page to edit their real remarks.' }],

  intro: [
  { id: 'n1', text: "Hi, I'm Nia. I make sure AIVA never forgets a customer.", state: 'speaking', duration: 3400 },
  { id: 'n2', text: 'Every conversation, preference, objection and commitment becomes part of the customer\'s memory.', state: 'speaking', duration: 4600 },
  { id: 'n3', text: 'Rahul Sharma. Last contact three days ago with Arjun. Investment plot, Devanahalli, thirty to fifty lakhs.', state: 'analyzing', highlight: 'leadDna', reveal: 'memory', duration: 5800 },
  { id: 'n4', text: 'He objected on price before. His site visit was never completed. That is the gap the team keeps missing.', state: 'warning', reveal: 'memory', duration: 5200 }],

  introVariants: [
  [
  { id: 'nv1', text: "Good to see you. Twenty-seven promises are still open across the pipeline — Rahul's site visit is the oldest.", state: 'analyzing', reveal: 'memory', duration: 4800 },
  { id: 'nv2', text: 'Ask me about any customer.', state: 'listening', duration: 2400 }],

  [
  { id: 'nv3', text: "Nothing's changed on Rahul since we last spoke — still waiting on that site visit.", state: 'speaking', reveal: 'memory', duration: 4400 },
  { id: 'nv4', text: 'What do you need me to recall?', state: 'listening', duration: 2600 }]],


  qa: [
  {
    id: 'nia-what',
    question: 'What do you do?',
    match: ['what do you do', 'who are you', 'your job'],
    lines: [
    { id: 'nw1', text: 'I am the continuity of this company. Twelve thousand customers, forty-eight thousand conversations, all retrievable in under a second.', state: 'speaking', reveal: 'memory', duration: 5600 }]

  },
  {
    id: 'nia-history',
    question: "Show me Rahul Sharma's history.",
    match: ['history', 'rahul history', 'previous', 'past conversation', 'memory'],
    lines: [
    { id: 'nh1', text: 'Three interactions. First contact eleven days ago from the website. Call four days later with Arjun. Then silence.', state: 'explaining', reveal: 'memory', duration: 5400 },
    { id: 'nh2', text: 'He asked for Devanahalli twice, and we promised a site visit that never happened. Follow-up is due tomorrow at eleven thirty.', state: 'analyzing', highlight: 'leadDna', duration: 5600 }]

  },
  {
    id: 'nia-promises',
    question: 'What promises are still open?',
    match: ['open promise', 'promises open', 'outstanding promise', 'unfulfilled promise'],
    lines: [
    { id: 'np1', text: 'Twenty-seven open promises across the pipeline, down four this week. Rahul\'s site visit and Priya\'s brochure are the oldest.', state: 'analyzing', reveal: 'memory', duration: 5000 }]

  },
  {
    id: 'nia-accuracy',
    question: 'How accurate is your memory?',
    match: ['how accurate is your memory', 'recall accuracy', 'memory accuracy'],
    lines: [
    { id: 'na1', text: 'Ninety-nine point two percent recall accuracy across forty-eight thousand stored conversations. I would rather say nothing than guess.', state: 'speaking', reveal: 'metrics', duration: 4800 }]

  },
  {
    id: 'nia-facts',
    question: 'What do you remember about Rahul?',
    match: ['what do you remember', 'remember about rahul', 'rahul facts', 'tell me about rahul'],
    lines: [
    { id: 'nf1', text: 'Budget thirty to fifty lakhs, wants Devanahalli, objected on price once, promised a callback after Saturday, and his site visit is still outstanding.', state: 'explaining', highlight: 'leadDna', reveal: 'memory', duration: 5600 }]

  }],

  decisions: [
  { time: '11:39', subject: 'Rahul Sharma', detail: 'Devanahalli preference reinforced (3rd mention)' },
  { time: '11:27', subject: 'Priya Nair', detail: 'Brochure promise logged — due today' },
  { time: '11:12', subject: 'Sneha Reddy', detail: 'Cancelled site visit surfaced to team' }],

  voice: { pitch: 1.04, rate: 0.9, match: ['female', 'fiona', 'zira'] },
  worksWith: ['ava', 'aria', 'mira', 'zara', 'nova']
};

export const nova: Agent = {
  id: 'nova',
  index: 'Agent 06',
  name: 'Vistara',
  role: 'RK Avenue Lead Generation',
  shortRole: 'RK Developers Agent',
  mission: 'Turn AIVA intelligence into real actions.',
  personality: 'Energetic, efficient, decisive and action-oriented.',
  speakingStyle: 'Fast, clipped, always ends with a next step.',
  accent: '#2dd4bf',
  accentSoft: 'rgba(45, 212, 191, 0.16)',
  avatar: "/a59a5ba1-97b7-4682-9f7f-daa1dd87adff.jpg",
  focus: '50% 10%',
  status: 'Active',
  liveStatus: ['Ready for action', 'Follow-up prepared', 'Updating CRM', 'Task created'],
  responsibilities: [
  'Create, update, assign and reassign leads',
  'Schedule calls and site visits',
  'Create reminders and tasks',
  'Send WhatsApp and SMS',
  'Update CRM status and move pipeline stages',
  'Notify sales employees and trigger automations'],

  analyzes: ['Recommended next action', 'Best contact window', 'Employee availability', 'Pipeline stage fit'],
  metrics: [
  { label: 'Actions Executed', value: '3,412', delta: '+18%', tone: 'up' },
  { label: 'Follow-ups Scheduled', value: '287', delta: '+24%', tone: 'up' },
  { label: 'CRM Updates', value: '1,904', delta: '+15%', tone: 'up' },
  { label: 'Automation Success', value: '99.1%', tone: 'flat' }],

  actions: [
  { id: 'schedule', label: 'Schedule follow-up', kind: 'safe', result: 'Open a lead’s page to set their real next follow-up date.' },
  { id: 'assign', label: 'Assign employee', kind: 'safe', result: 'Open a lead’s page to change their assigned agent.' },
  { id: 'whatsapp', label: 'Send WhatsApp', kind: 'safe', result: 'Open a lead’s page to send them a real WhatsApp message.' },
  { id: 'task', label: 'Create task', kind: 'safe', result: 'Use a lead’s Remarks field to leave a real note for the team.' },
  { id: 'delete', label: 'Delete lead', kind: 'confirm', confirmPrompt: 'Deleting a lead is real and can’t be undone — open the Leads page to delete a specific one by name. Continue there instead?', result: 'Open the Leads page to delete a specific real lead.' }],

  intro: [
  { id: 'v1', text: "I'm Nova. The other agents create intelligence. I turn that intelligence into action.", state: 'speaking', duration: 4400 },
  { id: 'v2', text: 'Rahul Sharma, buying intent ninety-one percent, price objection open, Devanahalli preference on record.', state: 'analyzing', highlight: 'leadDna', reveal: 'actionQueue', duration: 5600 },
  { id: 'v3', text: 'Recommended action: follow-up call, tomorrow at eleven thirty, with Arjun who already has the relationship.', state: 'explaining', highlight: 'pipeline', reveal: 'actionQueue', duration: 5400 },
  { id: 'v4', text: 'Nothing sensitive executes without your confirmation. Say the word and it is in the CRM.', state: 'listening', duration: 4000 }],

  introVariants: [
  [
  { id: 'vv1', text: "Back again. I've executed three thousand four hundred actions this month, ninety-nine point one percent success.", state: 'analyzing', reveal: 'metrics', duration: 4800 },
  { id: 'vv2', text: 'What do you want me to run?', state: 'listening', duration: 2400 }],

  [
  { id: 'vv3', text: "Rahul's follow-up is still pending your approval — tomorrow, eleven thirty, with Arjun.", state: 'explaining', highlight: 'leadDna', reveal: 'actionQueue', duration: 4800 },
  { id: 'vv4', text: 'Approve it, or tell me what else to do.', state: 'listening', duration: 2800 }]],


  qa: [
  {
    id: 'nova-what',
    question: 'What do you do?',
    match: ['what do you do', 'who are you', 'your job'],
    lines: [
    { id: 'vw1', text: 'I execute. Leads, assignments, follow-ups, WhatsApp, CRM stages, reminders — three thousand four hundred actions this month.', state: 'speaking', reveal: 'actionQueue', duration: 5600 }]

  },
  {
    id: 'nova-schedule',
    question: 'Schedule a follow-up tomorrow.',
    match: ['schedule', 'follow up', 'follow-up', 'book a call', 'set a reminder'],
    lines: [
    { id: 'vs1', text: 'Ready to schedule. Tomorrow, eleven thirty, Rahul Sharma, owner Arjun. Confirm and I will write it to the CRM.', state: 'executing', reveal: 'actionQueue', duration: 5200 }]

  },
  {
    id: 'nova-decision',
    question: 'What does the team recommend?',
    match: ['team decision', 'recommend', 'what should i do', 'next action'],
    lines: [
    { id: 'vd1', text: 'Consolidating the team. Ava has the conversation, Aria the intent, Mira the sentiment, Zara the objection, Nia the history.', state: 'thinking', reveal: 'teamDecision', duration: 5600 },
    { id: 'vd2', text: 'One decision comes out of it: follow-up call tomorrow at eleven thirty, led by location value.', state: 'success', reveal: 'teamDecision', duration: 4800 }]

  },
  {
    id: 'nova-automation',
    question: 'How reliable is your automation?',
    match: ['automation success', 'how reliable', 'automation rate', 'does automation work'],
    lines: [
    { id: 'vr1', text: 'Ninety-nine point one percent automation success. When something is too sensitive to auto-run, I stop and ask you first.', state: 'speaking', reveal: 'metrics', duration: 4800 }]

  },
  {
    id: 'nova-crm',
    question: 'What CRM updates have you made?',
    match: ['crm update', 'what have you updated', 'crm changes', 'updates today'],
    lines: [
    { id: 'vc1', text: 'Nineteen hundred four CRM updates this month, up fifteen percent. Most recent: Arjun Mehta moved to Engaged.', state: 'analyzing', reveal: 'actionQueue', duration: 5000 }]

  },
  {
    id: 'nova-assign',
    question: 'Assign this lead to an employee.',
    match: ['assign employee', 'who should handle', 'assign this lead', 'reassign'],
    lines: [
    { id: 'va1', text: 'Arjun already has the relationship with Rahul and has capacity. Assigning now and notifying him on WhatsApp.', state: 'executing', reveal: 'actionQueue', duration: 4800 }]

  }],

  decisions: [
  { time: '11:42', subject: 'Rahul Sharma', detail: 'Site visit scheduled — Sun 11:30 AM' },
  { time: '11:38', subject: 'Priya Nair', detail: 'WhatsApp sent — brochure + location' },
  { time: '11:36', subject: 'Arjun Mehta', detail: 'CRM stage moved → Engaged' }],

  voice: { pitch: 0.82, rate: 1.08, match: ['male', 'daniel', 'alex', 'google uk english male'] },
  worksWith: ['ava', 'aria', 'mira', 'zara', 'nia']
};

export const agents: Agent[] = [ava, aria, mira, zara, nia, nova];

export const agentMap: Record<AgentId, Agent> = {
  ava,
  aria,
  mira,
  zara,
  nia,
  nova
};

export const getAgent = (id: AgentId) => agentMap[id];