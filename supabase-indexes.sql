-- Transformix AI: Database Optimization Script
-- Execute these in the Supabase SQL Editor to improve query performance

-- 1. Profiles Table Optimizations
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_id ON profiles(auth_id);

-- 2. Performance Tracking (Metrics)
-- Used for "hasTodayWeightEntry" and history charts
CREATE INDEX IF NOT EXISTS idx_weight_history_profile_date ON weight_history(profile_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_logs_profile_date ON daily_logs(profile_id, date DESC);

-- 3. Affiliate & Referral System
-- Critical for the completePurchase parallelization results
CREATE INDEX IF NOT EXISTS idx_creator_mappings_custom_code ON creator_mappings(custom_code);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_creator_id ON creator_earnings(creator_id);

-- 4. Audit & Activity Logs
-- Used in Dashboard and History tabs
CREATE INDEX IF NOT EXISTS idx_workouts_profile_created ON workouts(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meals_profile_created ON meals(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_active_protocols_profile ON active_protocols(profile_id);

-- 5. AI Usage Tracking
-- Optimized for checkAndIncrementAIUsage
CREATE INDEX IF NOT EXISTS idx_ai_usage_profile_date ON ai_usage(profile_id, date);

-- 6. Error & Sync Logs
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp DESC);
