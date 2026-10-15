# Appunto di lavoro: prezzi di commessa e prezzo di riferimento d'acquisto

Stato al 13/10/2026 (branch `claude/hopeful-pasteur-q0jx1d`). Da continuare in locale / in un'altra chat.

## Il problema

Il Promastop-W risultava a 218,65 €/ML nelle commesse. Causa: l'ordine 15416129 (6 confezioni a 218,65 €)
è stato convertito nell'acquisto 50188627826 (108 ML a 12,147 €) ma l'ordine è rimasto nel database con la
riga vecchia. La funzione `get_max_purchase_prices` faceva il massimo su TUTTE le righe di `purchase_items`
(ordini e acquisti cancellati compresi) e il valore sbagliato è stato "congelato" in
`job_cost_analysis_rows.max_purchase_price` (e `proposal_cost_analysis_rows`).

## Regola decisa (punto 1, FATTO)

- Gli **ordini non si contano mai** (possono avere un prezzo diverso da quello dell'acquisto effettivo).
- Si contano solo gli acquisti veri: `purchases.order_type = 'purchase'` e `deleted_at IS NULL`.
- Prezzo = **massimo degli ultimi 6 mesi** (data bolla); se negli ultimi 6 mesi non ci sono acquisti,
  **prezzo dell'ultimo acquisto** (data bolla più recente, spareggio su `created_at`).
- Implementata in tre punti coerenti:
  - funzione SQL `get_max_purchase_prices` → `supabase/migrations/20261013_max_purchase_price_recent_real_purchases.sql`
    (applicata anche sul database di produzione "Magazzino");
  - piano B nel codice: `costAnalysisApi.getMaxPurchasePrices` (`src/lib/services/cost-analysis.ts`) con
    `buildReferencePriceMap` (`src/lib/utils/reference-purchase-price.ts`, test in `__tests__`);
  - `costAnalysisApi.getMaxPurchasePrice` (singolo) ora passa dalla stessa funzione.

## Ancora da fare

1. **Ricalcolare i prezzi massimi già "congelati"** nelle righe di analisi costi:
   circa 87 righe in `job_cost_analysis_rows` (80 senza `unit_price` manuale) e 13 in
   `proposal_cost_analysis_rows`. Solo dove `unit_price` è NULL: i prezzi manuali non si toccano.
   Fare PRIMA un'anteprima (vecchio → nuovo prezzo) e farla approvare. Esempio: la commessa
   `15cab992-9fea-4d35-a388-dbb0ec1ff8ff` ha il Promastop-W congelato a 218,6517 (deve diventare 12,147).
2. Impatto atteso sui totali della scheda Costi (prima della correzione): CXX 93.805→339.216,
   MON-UW1H 16.720→84.427, CHI 8.526→41.877, GRI 3.472→31.720, DAR 5.487→8.859.
3. 11 articoli esistono solo in ordini (es. Porte tagliafuoco PROGET): senza prezzo automatico finché non
   c'è un acquisto vero. Decidere cosa mostrare.
4. Lotti sospetti da verificare uno per uno con i valori reali: Fassajoint bolla 1757 (10,22 vs 0,87),
   AF Multicollar bolla 1276 (171,60 vs 56,59), Sacchetto WURTH 8833579479, SUPER FINISH bolla 2468 (qty 0),
   Nastro adesivo, Viti fosfatate nere, Silicone.
5. **Allineamento scheda Costi** (commit 876be2b, `JobCostiSAL` usa `loadJobPriceMap`): già sul branch,
   NON ancora unito a master. Unirlo dopo il ricalcolo (punto 1 di questa lista) e solo su richiesta esplicita.

## Note tecniche utili

- Prezzo di commessa = `unit_price ?? max_purchase_price` della riga di analisi (`buildJobPriceMap`,
  `src/lib/utils/job-prices.ts`); articoli non ancora importati: prezzo dell'offerta, altrimenti prezzo di
  riferimento d'acquisto (`loadJobPriceMap`, `src/lib/services/job-price-lookup.ts`).
- La scheda Analisi Costi importa in automatico gli articoli dei movimenti quando viene aperta.
- Tabella articoli = `inventory`. Supabase project id `qbnldeezzcinadkfzams`. `apply_migration` va in timeout:
  usare istruzioni singole con `execute_sql`.
