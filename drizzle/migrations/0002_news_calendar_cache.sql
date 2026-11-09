CREATE TABLE public.news_calendar_cache (id int PRIMARY KEY, events jsonb NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON public.news_calendar_cache FROM anon, authenticated;
GRANT ALL ON public.news_calendar_cache TO service_role;
ALTER TABLE public.news_calendar_cache ENABLE ROW LEVEL SECURITY;