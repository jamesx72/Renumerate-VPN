
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: profiles
-- Stocke les informations critiques de l'utilisateur et son solde RNC
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  plan_tier TEXT DEFAULT 'free' CHECK (plan_tier IN ('free', 'pro', 'elite')),
  is_verified BOOLEAN DEFAULT false,
  balance DECIMAL(20, 8) DEFAULT 0.0,
  reputation INTEGER DEFAULT 100,
  last_claim_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: user_settings
-- Synchronise la configuration du tunnel VPN
CREATE TABLE user_settings (
  user_id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  protocol TEXT DEFAULT 'wireguard',
  dns TEXT DEFAULT 'cloudflare',
  kill_switch BOOLEAN DEFAULT true,
  auto_rotation BOOLEAN DEFAULT false,
  rotation_interval INTEGER DEFAULT 10,
  vortex_bridge TEXT DEFAULT 'none',
  mining_intensity INTEGER DEFAULT 50,
  yield_optimization_ia BOOLEAN DEFAULT true,
  contribution_type TEXT DEFAULT 'passive',
  log_retention_hours INTEGER DEFAULT 168,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: connection_sessions
-- Historique des tunnels établis
CREATE TABLE connection_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  server_country TEXT NOT NULL,
  server_ip TEXT NOT NULL,
  protocol TEXT NOT NULL,
  mode TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  duration_minutes INTEGER,
  data_transferred_mb DECIMAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: transactions
-- Suivi des flux financiers RNC
CREATE TABLE transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  method TEXT CHECK (method IN ('crypto', 'paypal', 'bank_transfer')),
  amount DECIMAL(20, 8) NOT NULL,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RPC: increment_balance
-- Fonction sécurisée pour mettre à jour le solde RNC
CREATE OR REPLACE FUNCTION increment_balance(user_id_param UUID, amount_param DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET balance = balance + amount_param
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS (Row Level Security) Configuration
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own settings" ON user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own sessions" ON connection_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON connection_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
