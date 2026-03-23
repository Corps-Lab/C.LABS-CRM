-- Add Nome Fantasia support for client registration/autofill
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS nome_fantasia text;

-- Backfill from razão social when empty to keep UI populated.
UPDATE public.clients
SET nome_fantasia = razao_social
WHERE nome_fantasia IS NULL OR btrim(nome_fantasia) = '';
