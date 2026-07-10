-- Tracking dei tentativi di accesso al portale ospiti, per rate-limiting anti brute-force
CREATE TABLE IF NOT EXISTS public.guest_login_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_site_id uuid REFERENCES public.guest_sites(id) ON DELETE CASCADE,
    ip_address text NOT NULL,
    success boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indici per le query di conteggio tentativi nella finestra temporale
CREATE INDEX IF NOT EXISTS idx_guest_login_attempts_site_ip_created
    ON public.guest_login_attempts (guest_site_id, ip_address, created_at);
CREATE INDEX IF NOT EXISTS idx_guest_login_attempts_ip_created
    ON public.guest_login_attempts (ip_address, created_at);

-- Nessuna policy: la tabella e' scritta/letta esclusivamente tramite service role
-- dall'API route del portale ospiti (bypassa RLS), quindi RLS resta abilitata
-- senza policy per negare di default qualsiasi accesso da client anon/authenticated.
ALTER TABLE public.guest_login_attempts ENABLE ROW LEVEL SECURITY;
