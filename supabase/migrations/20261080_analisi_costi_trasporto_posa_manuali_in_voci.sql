-- Trasporto (A) e Posa (B) ora si definiscono solo dalle schede apposite dell'analisi costi.
-- Le analisi che avevano un valore digitato a mano nei parametri (senza voci) ricevono una voce
-- con quel valore, così resta modificabile. Il totale dell'analisi non cambia.

insert into public.proposal_cost_analysis_rows (proposal_id, version_id, type, item_name, unit_price, qty_estimated, sort_order)
select p.proposal_id, p.version_id, 'transport', 'Trasporto (valore precedente)', p.trasporto, 1, 0
from public.proposal_cost_analysis_params p
where p.trasporto > 0
  and not exists (select 1 from public.proposal_cost_analysis_rows r where r.version_id = p.version_id and r.type = 'transport');

insert into public.proposal_cost_analysis_rows (proposal_id, version_id, type, item_name, unit_price, qty_estimated, sort_order)
select p.proposal_id, p.version_id, 'posa', 'Posa (valore precedente)', p.posa, 1, 0
from public.proposal_cost_analysis_params p
where p.posa > 0
  and not exists (select 1 from public.proposal_cost_analysis_rows r where r.version_id = p.version_id and r.type = 'posa');

insert into public.job_cost_analysis_rows (job_id, type, item_name, unit_price, qty_estimated, sort_order)
select p.job_id, 'transport', 'Trasporto (valore precedente)', p.trasporto, 1, 0
from public.job_cost_analysis_params p
where p.trasporto > 0
  and not exists (select 1 from public.job_cost_analysis_rows r where r.job_id = p.job_id and r.type = 'transport');

insert into public.job_cost_analysis_rows (job_id, type, item_name, unit_price, qty_estimated, sort_order)
select p.job_id, 'posa', 'Posa (valore precedente)', p.posa, 1, 0
from public.job_cost_analysis_params p
where p.posa > 0
  and not exists (select 1 from public.job_cost_analysis_rows r where r.job_id = p.job_id and r.type = 'posa');
