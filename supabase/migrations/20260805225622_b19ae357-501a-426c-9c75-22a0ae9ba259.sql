CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_ref text NOT NULL,
  email text NOT NULL,
  provider text NOT NULL DEFAULT 'paypal',
  paypal_order_id text NOT NULL UNIQUE,
  paypal_capture_id text,
  payer_email text,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);

CREATE INDEX payments_email_status_idx ON public.payments (lower(email), status);
CREATE UNIQUE INDEX payments_capture_id_key ON public.payments (paypal_capture_id) WHERE paypal_capture_id IS NOT NULL;

GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.payments_validate_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('pending','paid','failed','cancelled') THEN
    RAISE EXCEPTION 'invalid payment status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER payments_validate_status_trg
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.payments_validate_status();