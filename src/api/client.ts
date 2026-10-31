// IMPORTANT: use `!== undefined`, not `||` — an intentionally EMPTY string in
// production (same-origin relative /api/** paths, routed by firebase.json) is
// falsy, so `||` would wrongly override it back to the localhost dev default.
const _rawApiUrl = (import.meta as any).env?.VITE_API_URL;
const API_URL = _rawApiUrl !== undefined ? _rawApiUrl : 'http://localhost:8787';

const TOKEN_KEY = 'aiva.auth';

/**
 * The "token" here is a full `Basic <base64>` header value — the real backend
 * (server/app.js) authenticates every request via a custom `X-Aiva-Auth`
 * header (not the standard `Authorization`, which Firebase Hosting's proxy
 * intercepts as a Google IAM credential before it ever reaches the function).
 * "Remember me" persists it in localStorage; unchecked keeps it in
 * sessionStorage, cleared when the tab closes.
 */
export const getToken = () => localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
export const setToken = (token: string, remember: boolean) => {
  if (remember) localStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.setItem(TOKEN_KEY, token);
};
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Aiva-Auth': token } : {}),
      ...options.headers
    }
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.error === 'string') message = body.error;
      else if (body.error) message = JSON.stringify(body.error);
    } catch {
      // response wasn't JSON — keep the generic message
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  apiUrl: API_URL
};

export interface AgentChatRequest {
  agent: {
    name: string;
    role: string;
    mission: string;
    personality: string;
    responsibilities: string[];
    analyzes: string[];
  };
  /** A plain-text block of REAL CRM numbers/lead facts to ground the reply — never invented by the model. */
  realDataContext: string;
  history: { speaker: 'user' | 'agent'; text: string }[];
  message: string;
  userName?: string;
}

export interface AgentChatResponse {
  reply: string;
}

/**
 * Real LLM reply, routed through the backend's own Gemini key (POST /api/ai/chat
 * — the same proxy the rest of the app already uses, not a fake/scripted answer).
 * The system instruction locks the model into character AND into only using the
 * real numbers it's handed — it's told explicitly never to invent a statistic.
 */
export async function chatWithAgent(body: AgentChatRequest): Promise<AgentChatResponse> {
  const systemInstruction = [
  `You are ${body.agent.name}, ${body.agent.role} on the AIVA AI sales team.`,
  `Mission: ${body.agent.mission}`,
  `Personality: ${body.agent.personality}`,
  `You analyse: ${body.agent.analyzes.join(', ')}.`,
  `You are responsible for: ${body.agent.responsibilities.join('; ')}.`,
  '',
  'Here is the REAL, current CRM data you must ground every answer in. Never invent a number, a name, or a statistic that is not in this data — if you don\'t know something, say so plainly instead of guessing.',
  body.realDataContext,
  '',
  'Reply in character, in 1-4 sentences, conversational and confident. Plain text only, no markdown.'].
  join('\n');

  const history = body.history.map((h) => `${h.speaker === 'user' ? (body.userName || 'User') : body.agent.name}: ${h.text}`).join('\n');
  const contents = history ? `${history}\n${body.userName || 'User'}: ${body.message}` : body.message;

  const res = await api.post<{ ok: boolean; text: string }>('/api/ai/chat', { contents, systemInstruction });
  return { reply: res.text };
}
