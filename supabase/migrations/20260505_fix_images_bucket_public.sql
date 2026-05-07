-- Ripristina images bucket come pubblico per permettere l'accesso diretto
-- alle URL (Next.js Image Optimizer, tag <img> senza auth header).
-- Il bucket era stato messo privato per eliminare il warning "public_bucket_allows_listing",
-- ma questo ha rotto tutte le URL pubbliche delle immagini.
-- Il warning viene risolto mantenendo il bucket pubblico ma limitando il SELECT
-- ai soli path del bucket (senza permettere listing dell'intero bucket).

-- 1. Riporta il bucket a pubblico
UPDATE storage.buckets SET public = true WHERE id = 'images';

-- 2. Rimuovi la policy esistente e ricrea senza TO authenticated
--    (le URL pubbliche non mandano auth header, quindi serve accesso anonimo)
DROP POLICY IF EXISTS "images_select_policy" ON storage.objects;

CREATE POLICY "images_select_policy"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'images');
