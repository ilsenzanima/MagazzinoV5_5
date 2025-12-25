-- Update article code generation to use random UUID-based format
-- Format: PPA-XXXXXXXX (8 random hex characters)

CREATE OR REPLACE FUNCTION public.get_next_article_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
  exists_already boolean;
BEGIN
  LOOP
    -- Generate PPA- followed by 8 random hex characters (from UUID)
    new_code := 'PPA-' || upper(substring(gen_random_uuid()::text from 1 for 8));
    
    -- Check if it exists
    SELECT EXISTS (SELECT 1 FROM public.inventory WHERE code = new_code) INTO exists_already;
    
    EXIT WHEN NOT exists_already;
  END LOOP;
  
  RETURN new_code;
END;
$$;
