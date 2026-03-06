-- Migration 006: Widget appearance settings per assistant
-- Run this in the Supabase SQL Editor.

ALTER TABLE assistants
  ADD COLUMN IF NOT EXISTS display_name     TEXT,    -- name shown to end users in the widget header (defaults to assistant name)
  ADD COLUMN IF NOT EXISTS widget_position  TEXT DEFAULT 'bottom-right';  -- 'bottom-right' | 'bottom-left'
