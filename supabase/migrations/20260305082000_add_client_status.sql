-- Add explicit client status to support manual pipeline/collection control
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS status text
  CHECK (status IN ('ativo', 'prospect', 'inativo', 'inadimplente'))
  DEFAULT 'ativo';

-- Backfill legacy rows based on old implicit rules.
UPDATE public.clients
SET status = CASE
  WHEN cnpj IS NULL OR length(trim(cnpj)) < 5 THEN 'prospect'
  WHEN COALESCE(valor_pago, 0) <= 0 THEN 'inativo'
  ELSE 'ativo'
END
WHERE status IS NULL
   OR status NOT IN ('ativo', 'prospect', 'inativo', 'inadimplente');

ALTER TABLE public.clients
  ALTER COLUMN status SET NOT NULL;
