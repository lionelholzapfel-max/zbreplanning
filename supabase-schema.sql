-- ZbrePlanning Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  member_id TEXT NOT NULL,
  member_name TEXT NOT NULL,
  member_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities table
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  date DATE,
  time TEXT,
  location TEXT,
  type TEXT DEFAULT 'event' CHECK (type IN ('event', 'world_cup_match')),
  match_id INTEGER,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity participations
CREATE TABLE IF NOT EXISTS public.activity_participations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('yes', 'no', 'maybe')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(activity_id, user_id)
);

-- Match participations (for World Cup)
CREATE TABLE IF NOT EXISTS public.match_participations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id INTEGER NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('yes', 'no', 'maybe')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, user_id)
);

-- Watch locations (proposed places to watch matches)
CREATE TABLE IF NOT EXISTS public.watch_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id INTEGER NOT NULL,
  location TEXT NOT NULL,
  proposed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  votes UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users: Can read all users, can only update own profile
CREATE POLICY "Users can view all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Activities: All authenticated users can view and create
CREATE POLICY "Anyone can view activities" ON public.activities FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create activities" ON public.activities FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update their activities" ON public.activities FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete their activities" ON public.activities FOR DELETE USING (auth.uid() = created_by);

-- Activity participations: All authenticated users can manage their own
CREATE POLICY "Anyone can view participations" ON public.activity_participations FOR SELECT USING (true);
CREATE POLICY "Users can manage own participation" ON public.activity_participations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own participation" ON public.activity_participations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own participation" ON public.activity_participations FOR DELETE USING (auth.uid() = user_id);

-- Match participations: Same as activities
CREATE POLICY "Anyone can view match participations" ON public.match_participations FOR SELECT USING (true);
CREATE POLICY "Users can manage own match participation" ON public.match_participations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own match participation" ON public.match_participations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own match participation" ON public.match_participations FOR DELETE USING (auth.uid() = user_id);

-- Watch locations: Anyone can view, authenticated can propose and vote
CREATE POLICY "Anyone can view locations" ON public.watch_locations FOR SELECT USING (true);
CREATE POLICY "Authenticated users can propose locations" ON public.watch_locations FOR INSERT WITH CHECK (auth.uid() = proposed_by);
CREATE POLICY "Anyone can update votes" ON public.watch_locations FOR UPDATE USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activities_date ON public.activities(date);
CREATE INDEX IF NOT EXISTS idx_activity_participations_activity ON public.activity_participations(activity_id);
CREATE INDEX IF NOT EXISTS idx_match_participations_match ON public.match_participations(match_id);
CREATE INDEX IF NOT EXISTS idx_watch_locations_match ON public.watch_locations(match_id);

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
