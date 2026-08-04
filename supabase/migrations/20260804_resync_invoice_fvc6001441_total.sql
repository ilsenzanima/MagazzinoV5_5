-- One-off data fix: invoices.total_amount is a client-maintained cache column
-- (see mapDbToInvoice in src/lib/services/invoices.ts) that must be explicitly
-- resynced after every change to linked purchases/items. Invoice FVC6001441
-- (ECOFIN, registered 2026-08-03 by an "operativo" user) ended up with
-- total_amount = 0 despite its linked bolla (C6004654) having real, non-zero
-- item prices totaling 564.235 -- the invoice list page showed 0 while the
-- detail page (which recomputes live from line items) showed the correct total.
UPDATE public.invoices
SET total_amount = 564.235
WHERE id = '57205b5b-2623-41c8-baf2-c04b1a1a475d'
  AND total_amount = 0;
