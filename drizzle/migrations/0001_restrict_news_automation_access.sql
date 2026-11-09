REVOKE ALL ON public.news_automations FROM anon, authenticated;
REVOKE ALL ON public.news_automation_orders FROM anon, authenticated;
GRANT ALL ON public.news_automations TO service_role;
GRANT ALL ON public.news_automation_orders TO service_role;