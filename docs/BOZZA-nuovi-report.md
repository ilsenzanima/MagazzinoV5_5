# Bozza: nuovi report

Bozza da valutare. Ogni voce sarebbe una nuova scheda nella pagina Report (visibile solo ad admin e operativi), con la stessa impostazione delle altre liste: tabella con filtri nelle intestazioni, ordinamento, 50 righe per pagina, schede su telefono, esportazione PDF o Excel dove serve.

| # | Report | Cosa mostra | Dati già disponibili |
|---|--------|-------------|----------------------|
| 1 | **Acquisti per fornitore** | Per periodo (anno / intervallo): fornitore, numero acquisti, speso, confronto con l'anno prima; cliccando un fornitore, gli articoli e i prezzi | Sì (le stesse funzioni della scheda Statistiche fornitore) |
| 2 | **Ore e costo per commessa** | Per commessa e mese: ore degli operai, costo manodopera (ore × tariffa), numero di operai | Sì (presenze e tariffe operai; la logica esiste già nei costi/SAL della commessa) |
| 3 | **Costi commessa** | Materiali + manodopera per commessa, con totale e incidenza | Sì (materiali dalle uscite, manodopera come sopra) |
| 4 | **Sotto scorta** | Articoli con giacenza sotto il minimo, con quanto manca e ultimo fornitore/prezzo | Sì (`min_stock` sugli articoli) |
| 5 | **Articoli fermi** | Articoli con giacenza ma senza movimenti da N mesi, con valore immobilizzato | Sì (movimenti) |
| 6 | **Scadenze operai** | Corsi e visite mediche in scadenza nei prossimi 30/60/90 giorni | Sì (corsi e visite già registrati) |
| 7 | **Controllo giacenze** | Articoli la cui giacenza non coincide con acquisti − uscite + rientri, per trovare i valori sporchi | Sì, da costruire in SQL |

## Consiglio
Partire da **4 (sotto scorta)**, **6 (scadenze operai)** e **1 (acquisti per fornitore)**: sono quelli che si usano più spesso e hanno già i dati pronti. Il **7** è utile per tenere pulito il magazzino, soprattutto per i numeri ambigui da rotella del mouse.

## Da decidere
- Chi vede cosa: tutto ad admin e operativi, oppure i costi (2 e 3) solo agli admin?
- Formato di esportazione: PDF come gli altri report, oppure anche Excel?
