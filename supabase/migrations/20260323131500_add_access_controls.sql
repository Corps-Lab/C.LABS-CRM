-- User access status control (active/inactive) for CRM login permission
CREATE TABLE IF NOT EXISTS public.access_controls (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.access_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can read access controls" ON public.access_controls;
DROP POLICY IF EXISTS "Managers can manage access controls" ON public.access_controls;
DROP POLICY IF EXISTS "Users can read own access control" ON public.access_controls;

CREATE POLICY "Managers can read access controls"
  ON public.access_controls FOR SELECT
  USING (public.is_manager(auth.uid()));

CREATE POLICY "Managers can manage access controls"
  ON public.access_controls FOR ALL
  USING (public.is_manager(auth.uid()))
  WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "Users can read own access control"
  ON public.access_controls FOR SELECT
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_access_controls_updated_at ON public.access_controls;
CREATE TRIGGER update_access_controls_updated_at
BEFORE UPDATE ON public.access_controls
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
