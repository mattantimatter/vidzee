-- Migration v4: Add credits system and video_format column

-- Step 1: Add video_format to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_format text DEFAULT '16:9';

-- Step 2: Create credits table
CREATE TABLE IF NOT EXISTS credits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  balance integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 3: Create credit_transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'bonus')),
  description text,
  stripe_session_id text,
  project_id uuid REFERENCES projects(id),
  created_at timestamptz DEFAULT now()
);

-- Step 4: Enable RLS
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Step 5: RLS Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credits' AND policyname = 'Users can view own credits') THEN
    CREATE POLICY "Users can view own credits" ON credits FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_transactions' AND policyname = 'Users can view own transactions') THEN
    CREATE POLICY "Users can view own transactions" ON credit_transactions FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credits' AND policyname = 'Service role can manage credits') THEN
    CREATE POLICY "Service role can manage credits" ON credits FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_transactions' AND policyname = 'Service role can manage transactions') THEN
    CREATE POLICY "Service role can manage transactions" ON credit_transactions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
