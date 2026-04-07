-- Transformix AI: Full Database Schema
-- Execute this in the Supabase SQL Editor to set up a fresh database.

-- 1. Profiles Table (Core User Data)
CREATE TABLE IF NOT EXISTS profiles (
  id SERIAL PRIMARY KEY,
  auth_id UUID UNIQUE, -- Linked to auth.users
  name TEXT,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  role TEXT DEFAULT 'user',
  gender TEXT,
  age INTEGER,
  height FLOAT, -- Stored in cm
  weight FLOAT, -- Stored in kg
  body_type TEXT,
  experience TEXT,
  goal TEXT,
  diet_preference TEXT,
  typical_meals TEXT[] DEFAULT '{}',
  equipment TEXT[] DEFAULT '{}',
  gym_name TEXT,
  is_pass_active BOOLEAN DEFAULT FALSE,
  plan TEXT,
  plan_expiry_date BIGINT,
  pass_expiry_date BIGINT,
  referrals INTEGER DEFAULT 0,
  video_uploads INTEGER DEFAULT 0,
  trophy_status TEXT DEFAULT 'none', -- none, applied, awarded, rejected, shipped
  trophy_rejection_reason TEXT,
  trophy_delivery JSONB DEFAULT '{}',
  documentation_status TEXT DEFAULT 'pending', -- pending, verified
  last_purchase_price FLOAT DEFAULT 0,
  last_coupon_used TEXT,
  last_affiliate_id INTEGER,
  profile_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Leaves Table (Activity Gaps)
CREATE TABLE IF NOT EXISTS leaves (
  id SERIAL PRIMARY KEY,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  duration_days INTEGER,
  timestamp BIGINT
);

-- 3. Workout Splits (Templates)
CREATE TABLE IF NOT EXISTS splits (
  id TEXT PRIMARY KEY,
  profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  days_per_week INTEGER,
  style TEXT,
  level TEXT,
  avg_time INTEGER,
  is_custom BOOLEAN DEFAULT FALSE,
  ai_optimized BOOLEAN DEFAULT FALSE,
  category TEXT,
  description TEXT,
  recommendation_tag TEXT,
  days JSONB NOT NULL DEFAULT '[]'
);

-- 4. Active Protocol (Current Workout Phase)
CREATE TABLE IF NOT EXISTS active_protocol (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  split_id TEXT,
  split_name TEXT,
  generated_at BIGINT,
  days JSONB NOT NULL DEFAULT '[]',
  current_day_index INTEGER DEFAULT 0
);

-- 5. Active Diet (Current Nutrition Plan)
CREATE TABLE IF NOT EXISTS active_diet (
  id TEXT PRIMARY KEY, -- diet_{profileId}
  profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  plan JSONB NOT NULL DEFAULT '[]',
  generated_at BIGINT
);

-- 6. Workouts (Logged Sessions)
CREATE TABLE IF NOT EXISTS workouts (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  date TIMESTAMPTZ DEFAULT NOW(),
  name TEXT,
  muscle_group TEXT,
  exercises JSONB DEFAULT '[]',
  duration_minutes INTEGER DEFAULT 45,
  split_name TEXT,
  split_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Meals (Logged Nutrition)
CREATE TABLE IF NOT EXISTS meals (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT,
  calories FLOAT,
  protein FLOAT,
  carbs FLOAT,
  fats FLOAT,
  quality INTEGER,
  date DATE DEFAULT CURRENT_DATE
);

-- 8. Progress (Metrics Tracking)
CREATE TABLE IF NOT EXISTS progress (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  weight FLOAT,
  body_fat FLOAT,
  biceps FLOAT,
  waist FLOAT,
  chest FLOAT,
  thighs FLOAT
);

-- 9. Photos (Progress Pictures)
CREATE TABLE IF NOT EXISTS photos (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  date TIMESTAMPTZ DEFAULT NOW(),
  data TEXT -- Base64 encoded image
);

-- 10. Community Requests (Friend/Partner Invites)
CREATE TABLE IF NOT EXISTS requests (
  id SERIAL PRIMARY KEY,
  sender_email TEXT,
  sender_name TEXT,
  sender_img TEXT,
  receiver_email TEXT,
  receiver_name TEXT,
  receiver_img TEXT,
  partner_name TEXT,
  partner_id TEXT,
  img TEXT,
  goal TEXT,
  status TEXT DEFAULT 'pending',
  timestamp BIGINT
);

-- 11. Community Posts (LFG Posts)
CREATE TABLE IF NOT EXISTS community_posts (
  id SERIAL PRIMARY KEY,
  user_email TEXT,
  name TEXT,
  gender TEXT,
  bio TEXT,
  goal TEXT,
  preferred_time TEXT,
  timestamp BIGINT
);

-- 12. Partners (Connected Users)
CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  user_email TEXT,
  partner_email TEXT,
  partner_name TEXT,
  name TEXT,
  partner_id TEXT,
  img TEXT,
  goal TEXT,
  timestamp BIGINT
);

-- 13. System Config (Pricing & Global Constants)
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value FLOAT
);

-- 14. Coupons (Promotion System)
CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE,
  discount_amount FLOAT,
  creator_commission FLOAT,
  gift_hamper TEXT,
  active BOOLEAN DEFAULT TRUE,
  usages JSONB DEFAULT '[]'
);

-- 15. Creator Mappings (Vanity Codes)
CREATE TABLE IF NOT EXISTS creator_mappings (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  base_coupon_id INTEGER REFERENCES coupons(id) ON DELETE CASCADE,
  custom_code TEXT UNIQUE
);

-- 16. Referrals (Success Log)
CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  referrer_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  referee_name TEXT,
  amount_paid FLOAT,
  code_used TEXT,
  timestamp BIGINT
);

-- 17. Creator Earnings (Affiliate Revenue)
CREATE TABLE IF NOT EXISTS creator_earnings (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  buyer_name TEXT,
  amount_paid FLOAT,
  commission_earned FLOAT,
  code_used TEXT,
  timestamp BIGINT
);

-- 18. Redemptions (Cashout Requests)
CREATE TABLE IF NOT EXISTS redemptions (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  amount FLOAT,
  upi_id TEXT,
  status TEXT DEFAULT 'pending', -- pending, completed, rejected
  timestamp BIGINT
);

-- 19. Referral Refunds (Student Milestones)
CREATE TABLE IF NOT EXISTS referral_refunds (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  milestone INTEGER,
  amount FLOAT,
  status TEXT DEFAULT 'pending',
  timestamp BIGINT
);

-- 20. Prompts (AI Instruction Sets)
CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. Video Links (Social Proof uploads)
CREATE TABLE IF NOT EXISTS video_links (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  url TEXT UNIQUE,
  timestamp BIGINT,
  status TEXT DEFAULT 'synced'
);

-- 22. Gyms (Verified Physical Locations)
CREATE TABLE IF NOT EXISTS gyms (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE,
  location TEXT,
  equipment TEXT[] DEFAULT '{}',
  rating FLOAT,
  image TEXT
);

-- 23. Equipment Requests (User-suggested gear)
CREATE TABLE IF NOT EXISTS equipment_requests (
  id SERIAL PRIMARY KEY,
  gym_name TEXT,
  equipment_name TEXT,
  user_name TEXT,
  timestamp BIGINT,
  status TEXT DEFAULT 'pending',
  proof_image TEXT
);

-- 24. AI Usage (Daily Rate Limiting)
CREATE TABLE IF NOT EXISTS ai_usage (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT, -- WORKOUT, NUTRITION, VISION, SYSTEM
  date DATE DEFAULT CURRENT_DATE,
  count INTEGER DEFAULT 0
);

-- 25. Error Logs
CREATE TABLE IF NOT EXISTS error_logs (
  id SERIAL PRIMARY KEY,
  error TEXT,
  stack TEXT,
  user_id INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ───── PERFORMANCE INDEXES ─────
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_id ON profiles(auth_id);
CREATE INDEX IF NOT EXISTS idx_weight_history_profile_date ON progress(profile_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_creator_mappings_custom_code ON creator_mappings(custom_code);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_creator_id ON creator_earnings(creator_id);
CREATE INDEX IF NOT EXISTS idx_workouts_profile_created ON workouts(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meals_profile_created ON meals(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_active_protocols_profile ON active_protocol(profile_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_profile_date ON ai_usage(profile_id, date);
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp DESC);
