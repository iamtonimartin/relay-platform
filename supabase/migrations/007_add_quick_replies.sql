-- Migration 007: Quick replies per assistant
-- Run this in the Supabase SQL Editor.

ALTER TABLE assistants
  ADD COLUMN IF NOT EXISTS quick_replies JSONB DEFAULT '[]'::jsonb;  -- array of strings shown as tap buttons in the widget
