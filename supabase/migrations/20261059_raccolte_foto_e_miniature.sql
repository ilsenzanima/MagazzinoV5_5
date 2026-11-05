-- Documenti Cantiere: i tipi "raccolta di foto" compaiono in tabella con una riga per raccolta
-- (una per tipo e una per ogni cartella) e si aprono in una pagina di miniature.
ALTER TABLE public.job_site_document_types
  ADD COLUMN IF NOT EXISTS is_photo_gallery boolean NOT NULL DEFAULT false;

-- I due tipi foto già in uso diventano raccolte
UPDATE public.job_site_document_types
SET is_photo_gallery = true
WHERE name IN ('Foto', 'Foto ispezione');

-- Miniature delle foto (generate dal server al primo accesso, ~320px WebP).
-- Bucket privato senza policy: ci accede solo il server con la chiave di servizio.
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', false)
ON CONFLICT (id) DO NOTHING;
