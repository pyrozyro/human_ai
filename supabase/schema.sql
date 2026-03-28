-- ============================================
-- AI-MANUSIA DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create enum type for question status
CREATE TYPE question_status AS ENUM ('pending', 'claiming', 'answered', 'expired');

-- 2. Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  xp INTEGER DEFAULT 0,
  level TEXT DEFAULT 'Bayi AI 👶',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Questions table
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  status question_status DEFAULT 'pending',
  asker_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  responder_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  answer_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_at TIMESTAMPTZ
);

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- Atomic question claim (prevents race condition)
CREATE OR REPLACE FUNCTION claim_question(question_id UUID, responder UUID)
RETURNS BOOLEAN AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE questions
  SET
    status = 'claiming',
    responder_id = responder,
    claimed_at = NOW()
  WHERE id = question_id AND status = 'pending';

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Submit answer + award XP atomically
CREATE OR REPLACE FUNCTION submit_answer(
  question_id UUID,
  answer TEXT,
  response_time_seconds INTEGER
)
RETURNS JSONB AS $$
DECLARE
  q questions%ROWTYPE;
  xp_earned INTEGER := 10;
  new_xp INTEGER;
  new_level TEXT;
BEGIN
  SELECT * INTO q FROM questions WHERE id = question_id FOR UPDATE;

  IF NOT FOUND OR q.status != 'claiming' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Soalan tidak dalam state claiming');
  END IF;

  -- Bonus XP untuk respons laju
  IF response_time_seconds < 10 THEN
    xp_earned := xp_earned + 5;
  END IF;

  -- Update soalan ke answered
  UPDATE questions
  SET status = 'answered', answer_content = answer
  WHERE id = question_id;

  -- Tambah XP kepada responder
  UPDATE profiles
  SET xp = xp + xp_earned
  WHERE id = q.responder_id
  RETURNING xp INTO new_xp;

  -- Kira level baru
  new_level := CASE
    WHEN new_xp <= 50  THEN 'Bayi AI 👶'
    WHEN new_xp <= 150 THEN 'AI Tadika 🧸'
    WHEN new_xp <= 500 THEN 'AI Sekolah Rendah 📚'
    ELSE 'Professor AI 🧠'
  END;

  UPDATE profiles SET level = new_level WHERE id = q.responder_id;

  RETURN jsonb_build_object(
    'success', true,
    'xp_earned', xp_earned,
    'new_xp', new_xp,
    'level', new_level
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-expire questions after 30 seconds (run via pg_cron or edge function)
CREATE OR REPLACE FUNCTION expire_old_questions()
RETURNS void AS $$
BEGIN
  UPDATE questions
  SET status = 'expired'
  WHERE status = 'claiming'
    AND claimed_at < NOW() - INTERVAL '30 seconds';

  UPDATE questions
  SET status = 'expired'
  WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles viewable by all" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Questions policies
CREATE POLICY "Questions viewable by all" ON questions
  FOR SELECT USING (true);

CREATE POLICY "Anyone can ask questions" ON questions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update questions" ON questions
  FOR UPDATE USING (true);

-- ============================================
-- ENABLE REALTIME
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE questions;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- ============================================
-- TRIGGER: Auto-create profile on signup
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
