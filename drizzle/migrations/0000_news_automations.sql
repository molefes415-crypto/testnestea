CREATE TABLE public.news_automations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_key text NOT NULL, event_id text NOT NULL, event_data jsonb NOT NULL,
 account_login bigint NOT NULL, account_server text NOT NULL, token_cipher text, symbols text[] NOT NULL,
 lot numeric NOT NULL CHECK (lot > 0), trades integer NOT NULL CHECK (trades BETWEEN 1 AND 100), lead_seconds integer NOT NULL CHECK (lead_seconds BETWEEN 1 AND 900),
 execute_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','scheduled','preparing','executing','completed','partial','skipped','failed','cancelled')),
 detail text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_key,event_id)
);
GRANT ALL ON public.news_automations TO service_role;
ALTER TABLE public.news_automations ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.news_automations IS 'Private durable trading jobs; server verifies personal MT5 capability before owner-scoped reads and writes. No browser role grants.';
CREATE INDEX news_automations_due ON public.news_automations(execute_at) WHERE status IN ('queued','scheduled','preparing');
CREATE TABLE public.news_automation_orders (
 job_id uuid NOT NULL REFERENCES public.news_automations(id) ON DELETE CASCADE, symbol text NOT NULL, ordinal integer NOT NULL,
 status text NOT NULL CHECK (status IN ('sending','sent','rejected','unknown')), signal jsonb NOT NULL, result jsonb, PRIMARY KEY(job_id,symbol,ordinal)
);
GRANT ALL ON public.news_automation_orders TO service_role;
ALTER TABLE public.news_automation_orders ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.news_automation_orders IS 'Private at-most-once order attempts. Ambiguous gateway responses are never retried automatically.';
