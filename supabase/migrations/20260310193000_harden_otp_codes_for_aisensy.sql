ALTER TABLE public.otp_codes
  ADD COLUMN IF NOT EXISTS code_hash TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'otp_codes_delivery_status_check'
  ) THEN
    ALTER TABLE public.otp_codes
      ADD CONSTRAINT otp_codes_delivery_status_check
      CHECK (delivery_status IN ('pending', 'sent', 'failed'));
  END IF;
END $$;

UPDATE public.otp_codes
SET
  consumed_at = COALESCE(consumed_at, NOW()),
  expires_at = LEAST(expires_at, NOW()),
  delivery_status = CASE
    WHEN delivery_status = 'pending' THEN 'failed'
    ELSE delivery_status
  END
WHERE code_hash IS NULL;

CREATE INDEX IF NOT EXISTS idx_otp_codes_delivery_status
  ON public.otp_codes(delivery_status);

CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_active
  ON public.otp_codes(phone, created_at DESC)
  WHERE verified = false;
