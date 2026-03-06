-- Migration 011: Conversation tags + fix conversation_summaries view
-- Run this in the Supabase SQL Editor.

-- Add tags column to conversations (array of free-form strings stored as JSONB)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Recreate the conversation_summaries view to include tags, user_email and user_phone
-- (user_email and user_phone were added to the conversations table in earlier migrations
--  but were missing from the original view definition)
-- DROP first because CREATE OR REPLACE cannot reorder existing columns
DROP VIEW IF EXISTS conversation_summaries;
CREATE VIEW conversation_summaries AS
SELECT
  c.id,
  c.assistant_id,
  c.channel,
  c.status,
  c.user_name,
  c.user_email,
  c.user_phone,
  c.tags,
  c.created_at,
  c.updated_at,
  a.name          AS assistant_name,
  a.primary_color AS assistant_color,
  (
    SELECT content FROM messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) AS last_message,
  (
    SELECT role FROM messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) AS last_message_role,
  (
    SELECT COUNT(*) FROM messages
    WHERE conversation_id = c.id
  ) AS message_count
FROM conversations c
JOIN assistants a ON a.id = c.assistant_id;
