-- Add notifications table to existing database
-- Run this in Supabase SQL Editor or via psql

-- Drop if exists (for testing only)
DROP TABLE IF EXISTS public.notifications CASCADE;

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- activity_created, activity_response, location_proposed, location_vote, match_response
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  related_id TEXT,  -- ID of related activity/match
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth)
CREATE POLICY "Allow all operations on notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
