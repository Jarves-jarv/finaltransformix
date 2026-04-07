-- ============================================================
-- TRANSFORMIX AI — SUPABASE PERFORMANCE INDEXES
-- Run this in Supabase Dashboard → SQL Editor
-- These prevent full table scans on every Dashboard load
-- ============================================================

-- Dashboard: progress queries (weight history, latest metrics)
CREATE INDEX IF NOT EXISTS idx_progress_profile_date
  ON progress(profile_id, date DESC);

-- Dashboard: today's workout check
CREATE INDEX IF NOT EXISTS idx_workouts_profile_date
  ON workouts(profile_id, date DESC);

-- Dashboard: today's meals
CREATE INDEX IF NOT EXISTS idx_meals_profile_date
  ON meals(profile_id, date);

-- Split & protocol lookups
CREATE INDEX IF NOT EXISTS idx_splits_profile
  ON splits(profile_id);

CREATE INDEX IF NOT EXISTS idx_active_protocol_profile
  ON active_protocol(profile_id);

-- Community: partner requests
CREATE INDEX IF NOT EXISTS idx_requests_sender
  ON requests(sender_email);

CREATE INDEX IF NOT EXISTS idx_requests_receiver
  ON requests(receiver_email);

CREATE INDEX IF NOT EXISTS idx_partners_user_email
  ON partners(user_email);

CREATE INDEX IF NOT EXISTS idx_community_posts_email
  ON community_posts(user_email);

-- Commerce: referral & earnings lookups
CREATE INDEX IF NOT EXISTS idx_referrals_referrer
  ON referrals(referrer_id);

CREATE INDEX IF NOT EXISTS idx_creator_earnings_creator
  ON creator_earnings(creator_id);

CREATE INDEX IF NOT EXISTS idx_redemptions_creator
  ON redemptions(creator_id);

-- AI usage tracking
CREATE INDEX IF NOT EXISTS idx_ai_usage_date_category
  ON ai_usage(date, category);

-- Video links
CREATE INDEX IF NOT EXISTS idx_video_links_user
  ON video_links(user_id);

-- ============================================================
-- VERIFY: Check if indexes were created
-- ============================================================
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
