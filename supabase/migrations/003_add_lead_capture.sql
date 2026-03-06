-- Migration 003: Add lead capture configuration to assistants
-- Run this in the Supabase SQL Editor before using the Lead Capture tab.

ALTER TABLE assistants
  ADD COLUMN IF NOT EXISTS lead_capture_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_capture_fields JSONB NOT NULL DEFAULT '[
    {"field":"name",  "label":"Your name",      "enabled":true,  "required":true},
    {"field":"email", "label":"Email address",  "enabled":true,  "required":true},
    {"field":"phone", "label":"Phone number",   "enabled":false, "required":false}
  ]'::jsonb;

-- Also ensure user_phone exists on conversations (may not have been in original schema)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS user_phone TEXT;
