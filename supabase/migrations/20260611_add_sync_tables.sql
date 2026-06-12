-- Add source column to match_results to track auto vs admin entry
ALTER TABLE match_results ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'admin' CHECK (source IN ('admin', 'auto'));

-- Create sync_log table to track sync operations
CREATE TABLE IF NOT EXISTS sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  matches_synced INTEGER DEFAULT 0,
  matches_checked INTEGER DEFAULT 0,
  error_message TEXT
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_sync_log_created_at ON sync_log(created_at DESC);
