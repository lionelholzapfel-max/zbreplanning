-- ZbrePlanning Database Schema (FIXED for simple auth)
-- Run this in your Supabase SQL Editor
-- This version works WITHOUT Supabase Auth (using simple localStorage auth)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (comment out in production)
DROP TABLE IF EXISTS public.watch_locations CASCADE;
DROP TABLE IF EXISTS public.match_participations CASCADE;
DROP TABLE IF EXISTS public.activity_participations CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Users table (standalone, no auth.users reference)
CREATE TABLE public.users (
  id TEXT PRIMARY KEY,  -- Using TEXT instead of UUID for simple member IDs
  email TEXT NOT NULL,
  member_id TEXT NOT NULL,
  member_name TEXT NOT NULL,
  member_slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities table
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  date DATE,
  time TEXT,
  location TEXT,
  type TEXT DEFAULT 'event' CHECK (type IN ('event', 'world_cup_match')),
  match_id INTEGER,
  created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity participations
CREATE TABLE public.activity_participations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('yes', 'no', 'maybe')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(activity_id, user_id)
);

-- Match participations (for World Cup)
CREATE TABLE public.match_participations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id INTEGER NOT NULL,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('yes', 'no', 'maybe')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, user_id)
);

-- Watch locations (proposed places to watch matches)
CREATE TABLE public.watch_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id INTEGER NOT NULL,
  location TEXT NOT NULL,
  proposed_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  votes TEXT[] DEFAULT '{}',  -- Array of user IDs who voted
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Enable Row Level Security (but allow all operations for anon users)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies (permissive for anon key access since no real auth)

-- Users
CREATE POLICY "Allow all operations on users" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- Activities
CREATE POLICY "Allow all operations on activities" ON public.activities FOR ALL USING (true) WITH CHECK (true);

-- Activity participations
CREATE POLICY "Allow all operations on activity_participations" ON public.activity_participations FOR ALL USING (true) WITH CHECK (true);

-- Match participations
CREATE POLICY "Allow all operations on match_participations" ON public.match_participations FOR ALL USING (true) WITH CHECK (true);

-- Watch locations
CREATE POLICY "Allow all operations on watch_locations" ON public.watch_locations FOR ALL USING (true) WITH CHECK (true);

-- Notifications
CREATE POLICY "Allow all operations on notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_activities_date ON public.activities(date);
CREATE INDEX idx_activities_created_by ON public.activities(created_by);
CREATE INDEX idx_activity_participations_activity ON public.activity_participations(activity_id);
CREATE INDEX idx_activity_participations_user ON public.activity_participations(user_id);
CREATE INDEX idx_match_participations_match ON public.match_participations(match_id);
CREATE INDEX idx_match_participations_user ON public.match_participations(user_id);
CREATE INDEX idx_watch_locations_match ON public.watch_locations(match_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_participations_updated_at
  BEFORE UPDATE ON public.activity_participations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER match_participations_updated_at
  BEFORE UPDATE ON public.match_participations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Insert initial test data (optional)
-- INSERT INTO public.users (id, email, member_id, member_name, member_slug) VALUES
-- ('1', 'benjamin-oyowe@zbre.team', '1', 'Benjamin Oyowe', 'benjamin-oyowe');
