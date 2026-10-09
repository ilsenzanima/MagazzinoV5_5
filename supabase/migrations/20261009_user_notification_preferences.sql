-- Preferenze notifiche per utente (pagina Impostazioni > Notifiche e campanella in sidebar).
-- Una riga per utente: se manca, l'app usa i valori di default qui sotto.
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    low_stock boolean NOT NULL DEFAULT true,
    out_of_stock boolean NOT NULL DEFAULT true,
    expiring_courses boolean NOT NULL DEFAULT true,
    expiring_medical_exams boolean NOT NULL DEFAULT true,
    -- id degli avvisi già visti nella campanella: il contatore mostra solo quelli nuovi
    seen_alert_ids text[] NOT NULL DEFAULT '{}',
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notification preferences" ON public.user_notification_preferences;
DROP POLICY IF EXISTS "Users insert own notification preferences" ON public.user_notification_preferences;
DROP POLICY IF EXISTS "Users update own notification preferences" ON public.user_notification_preferences;

CREATE POLICY "Users read own notification preferences"
    ON public.user_notification_preferences FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users insert own notification preferences"
    ON public.user_notification_preferences FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users update own notification preferences"
    ON public.user_notification_preferences FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);
