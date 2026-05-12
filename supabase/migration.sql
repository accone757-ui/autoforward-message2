-- AutoForward schema migration
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/vdkbetuwgozvbkzelmur/sql/new

-- accounts: Telegram userbot sessions
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  session_string text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'idle', 'banned', 'restricted')),
  type text NOT NULL DEFAULT 'self_created' CHECK (type IN ('self_created', 'purchased')),
  region text NOT NULL DEFAULT 'Unknown',
  messages_sent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- campaigns: forwarding campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  sources text[] NOT NULL DEFAULT '{}',
  targets text[] NOT NULL DEFAULT '{}',
  filters jsonb NOT NULL DEFAULT '{}',
  delay_secs integer NOT NULL DEFAULT 30,
  loop boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'stopped' CHECK (status IN ('running', 'stopped')),
  messages_sent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_run timestamptz
);

-- products: store listings
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  region text NOT NULL,
  price numeric(10,2) NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  buy_link text NOT NULL DEFAULT 'https://t.me/digital_market1199',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- users: platform users (admin view)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id text NOT NULL UNIQUE,
  username text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'idle', 'banned')),
  region text NOT NULL DEFAULT 'Unknown',
  account_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (open access with anon key)
CREATE POLICY IF NOT EXISTS "allow_all_accounts" ON public.accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_campaigns" ON public.campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_users" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- Seed initial products
INSERT INTO public.products (sku, region, price, stock, buy_link) VALUES
  ('AC-1042', 'United States 🇺🇸', 3.50, 12, 'https://t.me/digital_market1199'),
  ('AC-1199', 'Canada 🇨🇦', 4.20, 7, 'https://t.me/digital_market1199'),
  ('AC-2087', 'United Kingdom 🇬🇧', 5.00, 4, 'https://t.me/digital_market1199'),
  ('AC-3301', 'Germany 🇩🇪', 4.50, 9, 'https://t.me/digital_market1199')
ON CONFLICT (sku) DO NOTHING;

-- Seed admin user
INSERT INTO public.users (telegram_id, username, status, region, account_count) VALUES
  ('6464428203', 'Wolf_002196', 'active', 'Unknown', 0)
ON CONFLICT (telegram_id) DO NOTHING;
