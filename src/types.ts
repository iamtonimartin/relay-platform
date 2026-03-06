export interface Assistant {
  id: string;
  name: string;
  personality?: string;
  tone?: string;
  purpose?: string;
  system_prompt?: string;
  welcome_message?: string;
  avatar_url?: string;
  primary_color: string;
  model_provider: string;
  model_name: string;
  api_key?: string;
  temperature: number;
  max_tokens: number;
  active_hours_start?: string | null;
  active_hours_end?: string | null;
  timezone: string;
  offline_message?: string | null;
  lead_capture_enabled?: boolean;
  lead_capture_fields?: Array<{ field: string; label: string; enabled: boolean; required: boolean }>;
  handoff_triggers?: string[];
  handoff_message?: string | null;
  fallback_handoff_count?: number;
  display_name?: string | null;
  widget_position?: 'bottom-right' | 'bottom-left';
  quick_replies?: string[];
  cookie_consent_enabled?: boolean;
  created_at: string;
}

export interface KnowledgeEntry {
  id: string;
  assistant_id: string;
  type: 'file' | 'url' | 'qa' | 'text';
  content?: string;
  metadata?: string;
  status: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  assistant_id: string;
  channel: string;
  status: 'active' | 'handed_off' | 'closed';
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

// Returned by the conversation_summaries view — includes joined assistant data and last message
export interface ConversationSummary {
  id: string;
  assistant_id: string;
  channel: string;
  status: 'active' | 'handed_off' | 'closed';
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  assistant_name: string;
  assistant_color: string;
  last_message?: string;
  last_message_role?: string;
  message_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system' | 'human';
  content: string;
  created_at: string;
}

export interface AnalyticsData {
  totalConversations: number;
  messagesSent: number;
  handoffRate: number;
  fallbackRate: number;
  leadCaptureRate: number;
  topQuestions: { question: string; count: number }[];
  conversationsOverTime: { date: string; count: number }[];
  busiestHours: { hour: number; label: string; count: number }[];
}
