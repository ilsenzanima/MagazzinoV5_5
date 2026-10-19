-- Commesse "in cantiere": segna le commesse attive dove gli operai stanno lavorando davvero,
-- cosi' compaiono per prime nelle ricerche (ore, movimentazioni, acquisti, note di carico).
-- Ripristino: ALTER TABLE jobs DROP COLUMN on_site;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS on_site boolean NOT NULL DEFAULT false;
