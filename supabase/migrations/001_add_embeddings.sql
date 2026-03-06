-- Migration 001: Add vector embeddings to knowledge base (Phase 4b — RAG)
-- Run this in the Supabase SQL Editor if you already ran schema.sql previously.
-- Safe to run multiple times (uses IF NOT EXISTS / CREATE OR REPLACE).

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx
  ON knowledge_base USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

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
