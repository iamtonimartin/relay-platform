import { Assistant, KnowledgeEntry, ConversationSummary, Message, AnalyticsData } from '../types';

const API_BASE = '/api';

// --- Token helpers ---

export function getToken(): string | null {
  return localStorage.getItem('relay_token');
}

export function setToken(token: string): void {
  localStorage.setItem('relay_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('relay_token');
}

// Returns auth headers; if no token exists, returns empty (middleware will reject if needed)
function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Fetch wrapper that redirects to /login on 401
async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers as Record<string, string> || {}),
    },
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    // Return a never-resolving promise so calling code doesn't continue
    return new Promise(() => {});
  }
  return res;
}

export const api = {
  async login(email: string, password: string): Promise<{ token: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data;
  },

  async getAssistants(): Promise<Assistant[]> {
    const res = await apiFetch(`${API_BASE}/assistants`);
    if (!res.ok) throw new Error('Failed to fetch assistants');
    return res.json();
  },

  async createAssistant(data: Partial<Assistant>): Promise<Assistant> {
    const res = await apiFetch(`${API_BASE}/assistants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create assistant');
    return res.json();
  },

  async getAssistant(id: string): Promise<Assistant> {
    const res = await apiFetch(`${API_BASE}/assistants/${id}`);
    if (!res.ok) throw new Error('Failed to fetch assistant');
    return res.json();
  },

  async updateAssistant(id: string, data: Partial<Assistant>): Promise<Assistant> {
    const res = await apiFetch(`${API_BASE}/assistants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update assistant');
    return res.json();
  },

  async deleteAssistant(id: string): Promise<void> {
    const res = await apiFetch(`${API_BASE}/assistants/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete assistant');
  },

  async uploadAvatar(id: string, file: File): Promise<{ avatar_url: string }> {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await apiFetch(`${API_BASE}/assistants/${id}/avatar`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to upload avatar');
    return data;
  },

  async getKnowledge(assistantId: string): Promise<KnowledgeEntry[]> {
    const res = await apiFetch(`${API_BASE}/assistants/${assistantId}/knowledge`);
    if (!res.ok) throw new Error('Failed to fetch knowledge');
    return res.json();
  },

  async addKnowledge(assistantId: string, data: Partial<KnowledgeEntry>): Promise<KnowledgeEntry> {
    const res = await apiFetch(`${API_BASE}/assistants/${assistantId}/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add knowledge');
    return res.json();
  },

  async deleteKnowledge(id: string): Promise<void> {
    const res = await apiFetch(`${API_BASE}/knowledge/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete knowledge entry');
  },

  async uploadKnowledgeFile(assistantId: string, file: File): Promise<KnowledgeEntry> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiFetch(`${API_BASE}/assistants/${assistantId}/knowledge/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to upload file');
    return data;
  },

  async scrapeUrl(assistantId: string, url: string): Promise<KnowledgeEntry> {
    const res = await apiFetch(`${API_BASE}/assistants/${assistantId}/knowledge/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to scrape URL');
    return data;
  },

  async chat(
    assistantId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options: { debug?: boolean } = {}
  ): Promise<{ response: string; sources?: Array<{ type: string; label: string; snippet: string }>; systemPrompt?: string }> {
    const res = await apiFetch(`${API_BASE}/assistants/${assistantId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, ...options }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to get chat response');
    return data;
  },

  async getSettings(): Promise<Record<string, string>> {
    const res = await apiFetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async saveSettings(data: Record<string, string>): Promise<Record<string, string>> {
    const res = await apiFetch(`${API_BASE}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save settings');
    return res.json();
  },

  async getLeads(): Promise<any[]> {
    const res = await apiFetch(`${API_BASE}/leads`);
    if (!res.ok) throw new Error('Failed to fetch leads');
    return res.json();
  },

  async getAnalytics(params?: { start?: string; end?: string }): Promise<AnalyticsData> {
    const qs = params
      ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => !!v) as [string, string][])).toString()
      : '';
    const res = await apiFetch(`${API_BASE}/analytics${qs}`);
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return res.json();
  },

  async getAssistantAnalytics(id: string): Promise<AnalyticsData> {
    const res = await apiFetch(`${API_BASE}/assistants/${id}/analytics`);
    if (!res.ok) throw new Error('Failed to fetch assistant analytics');
    return res.json();
  },

  async getConversations(): Promise<ConversationSummary[]> {
    const res = await apiFetch(`${API_BASE}/conversations`);
    if (!res.ok) throw new Error('Failed to fetch conversations');
    return res.json();
  },

  async getConversationMessages(conversationId: string): Promise<Message[]> {
    const res = await apiFetch(`${API_BASE}/conversations/${conversationId}/messages`);
    if (!res.ok) throw new Error('Failed to fetch messages');
    return res.json();
  },

  async updateConversationStatus(id: string, status: string): Promise<void> {
    const res = await apiFetch(`${API_BASE}/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update conversation');
  },

  async deleteConversation(id: string): Promise<void> {
    const res = await apiFetch(`${API_BASE}/conversations/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete conversation');
  },

  async sendAgentMessage(conversationId: string, content: string): Promise<Message> {
    const res = await apiFetch(`${API_BASE}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send message');
    return data;
  },
};
