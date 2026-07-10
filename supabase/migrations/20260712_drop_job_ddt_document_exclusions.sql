-- La categoria "Conf. Ass. DDT" ora si popola solo dagli acquisti associati
-- manualmente alla commessa dalla sezione DDT/Bolle (tag [associated_job:...]),
-- non piu' da tutti i materiali collegati tramite acquisto diretto o bolla
-- interna di movimentazione. Con la selezione ora manuale a monte, il
-- meccanismo di inclusione/esclusione per singolo documento non serve piu'.
DROP TABLE IF EXISTS public.job_ddt_document_exclusions;
