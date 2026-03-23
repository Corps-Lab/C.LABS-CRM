-- Adds delivery time to demands so date + hour can be managed in the CRM
ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS hora_entrega time without time zone NOT NULL DEFAULT '18:00:00';

