CREATE TABLE public.auto_robots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_key text NOT NULL UNIQUE,
  token_cipher text,
  account_login bigint NOT NULL,
  account_server text NOT NULL,
  bot_name text NOT NULL DEFAULT 'TRADE NEST EA',
  symbols jsonb NOT NULL DEFAULT '[]'::jsonb,
  news_enabled boolean NOT NULL DEFAULT true,
  running boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  detail text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.auto_robots TO service_role;
ALTER TABLE public.auto_robots ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.auto_robot_trades (
  robot_id uuid NOT NULL REFERENCES public.auto_robots(id) ON DELETE CASCADE,
  signal_key text NOT NULL,
  symbol text NOT NULL,
  direction text NOT NULL,
  status text NOT NULL DEFAULT 'sending',
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (robot_id, signal_key)
);
GRANT ALL ON public.auto_robot_trades TO service_role;
ALTER TABLE public.auto_robot_trades ENABLE ROW LEVEL SECURITY;