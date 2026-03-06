-- Relay Platform — Supabase Schema
-- Run this once in the Supabase SQL Editor: https://supabase.com/dashboard/project/uikyopigsihpleendakn/sql/new
-- Enables pgvector for future vector-based RAG search (Phase 4b)

CREATE EXTENSION IF NOT EXISTS vector;

-- Assistants
CREATE TABLE IF NOT EXISTS assistants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  personality TEXT,
  tone TEXT,
  purpose TEXT,
  system_prompt TEXT,
  welcome_message TEXT,
  avatar_url TEXT,
  primary_color TEXT DEFAULT '#0f172a',
  model_provider TEXT DEFAULT 'anthropic',
  model_name TEXT DEFAULT 'claude-sonnet-4-6',
  api_key TEXT,
  temperature FLOAT DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2048,
  active_hours_start TEXT,
  active_hours_end TEXT,
  timezone TEXT DEFAULT 'UTC',
  offline_message TEXT,
  cookie_consent_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge base entries
CREATE TABLE IF NOT EXISTS knowledge_base (
  id TEXT PRIMARY KEY,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'file', 'url', 'qa', 'text'
  content TEXT,
  metadata TEXT, -- JSON string (filename, URL, title etc.)
  status TEXT DEFAULT 'indexed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations (for inbox and handoff — Phase 5)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- 'web', 'whatsapp', 'messenger', 'instagram'
  status TEXT DEFAULT 'active', -- 'active', 'handed_off', 'closed'
  user_name TEXT,
  user_email TEXT,
  user_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages within conversations
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user', 'assistant', 'system', 'human'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outbound webhooks (Phase 7)
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  assistant_id TEXT,
  event_type TEXT NOT NULL,
  url TEXT NOT NULL,
  headers TEXT, -- JSON string
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead capture
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  data TEXT, -- JSON string for custom fields
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform-level settings (API keys, general config)
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Vector embedding column for knowledge base (Phase 4b — RAG)
-- text-embedding-3-small produces 1536-dimensional vectors
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- IVFFlat index for fast approximate nearest-neighbour search
-- 'lists' should be roughly sqrt(row count); 100 is a safe default for up to ~1M rows
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx
  ON knowledge_base USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Semantic search function — called from the chat endpoint via supabase.rpc()
-- Returns the top match_count KB entries whose embedding is within similarity_threshold of the query
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding vector(1536),
  p_assistant_id text,
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.3
)
RETURNS TABLE (
  id text,
  content text,
  metadata text,
  type text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kb.id,
    kb.content,
    kb.metadata,
    kb.type,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base kb
  WHERE kb.assistant_id = p_assistant_id
    AND kb.embedding IS NOT NULL
    AND 1 - (kb.embedding <=> query_embedding) > similarity_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
$$;
