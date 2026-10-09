# 🚀 Magazzino V5.5 - Roadmap e Miglioramenti

## Stato Attuale: ✅ IN PRODUZIONE (aggiornato a Ottobre 2026)

Legenda: `[x]` fatto · `[~]` parziale · `[ ]` da fare

---

## 🔧 Aree di Miglioramento Tecniche

### 1. Testing Automatizzato
- [x] Unit test per servizi API (`src/lib/services/`)
- [x] Integration test per flussi critici (acquisti, movimenti, FIFO)
- [x] CI con GitHub Actions (`.github/workflows/test.yml`) su push/PR
- [ ] E2E test con Playwright per UI (nessuna configurazione presente)
- [ ] Ampliare la copertura: oggi ci sono solo 4 file di test (utils, purchases, guest-sites, integration acquisti)
- **Priorità:** Alta
- **Effort:** 2-3 giorni

### 2. Error Handling Strutturato
- [x] Sistema di notifiche toast centralizzato (`notify.ts`)
- [x] Retry automatico per errori di rete transitori (`src/lib/services/utils.ts`)
- [ ] Logging errori su servizio esterno (es. Sentry): non presente
- **Priorità:** Media
- **Effort:** 1 giorno

### 3. Offline Support (PWA)
- [x] Manifest e installabilità (`public/manifest.json`)
- [x] Service Worker per cache statica (`public/sw.js`, versionato e con pulizia vecchie cache)
- [ ] IndexedDB per dati offline
- [ ] Sincronizzazione al ritorno online
- **Priorità:** Media (utile per cantieri)
- **Effort:** 3-4 giorni

### 4. Backup Automatici
- [x] GitHub Action per backup settimanale (domenica 2:00 AM)
- [x] Retention policy (ultimi 12 backup)
- [x] Backup completo di tutte le tabelle con verifica dei conteggi (anche da Impostazioni)
- [ ] Notifica email su completamento/errore (nessuna notifica nel workflow)
- **Priorità:** Alta

---

## 💡 Funzionalità Future

### Alta Priorità

#### Report PDF Avanzati
- [x] Pagina Report con: articoli, presenze, inventario, stampa QR
- [x] Export Excel per l'analisi costi (`src/lib/excel/cost-analysis-excel.ts`)
- [ ] Report inventario con filtri personalizzabili (verificare i filtri attuali)
- [ ] Report commessa per cliente (consuntivo)
- [ ] Report movimenti per periodo
- [ ] Export Excel anche per gli altri report
- **Effort:** 2-3 giorni

#### Barcode Scanner
- [x] Scansione codice articolo con fotocamera (`html5-qrcode`)
- [x] Ricerca rapida da barcode
- [x] Generazione etichette con barcode/QR (`react-barcode`, `react-qr-code`)
- **Effort:** ✅ Già implementato

### Media Priorità

#### Notifiche Push
- [~] Pagina Impostazioni > Notifiche con gli interruttori (solo grafica: non salva niente e non invia niente)
- [ ] Avviso scorte sotto soglia minima
- [ ] Reminder scadenze documenti
- [ ] Notifica nuovi acquisti registrati
- **Effort:** 2 giorni

#### Dashboard Analytics
- [x] Dashboard con statistiche, commesse attive, movimenti e acquisti recenti, grafico presenze (recharts)
- [x] Scadenze corsi e visite mediche dei lavoratori
- [ ] Grafici trend consumi mensili
- [ ] Top articoli per valore/quantità
- [ ] Previsione esaurimento scorte
- **Effort:** 2-3 giorni

### Bassa Priorità

#### API Esterna
- [~] Esistono alcune API interne (`/api/drive`, `/api/backups`, `/api/health`, ecc.), non documentate
- [ ] REST API documentata per integrazioni
- [ ] Webhook per eventi (nuovo acquisto, movimento)
- [ ] Integrazione software contabilità
- **Effort:** 3-5 giorni

#### Multi-Magazzino
- [~] Tabella `warehouses` e selezione del magazzino nei movimenti e nei report
- [ ] Trasferimenti tra magazzini (da verificare)
- [ ] Report consolidati
- **Effort:** 5+ giorni

---

## 🧩 Altre cose in sospeso (dal codice)

- [ ] **Leaked password protection** di Supabase: va attivata a mano dalla dashboard (richiede il piano Pro)
- [ ] Verifica in produzione dopo il deploy della PR #13 (analisi costi senza offerta, backup completo)

---

## 🐛 Bug/Issue da Monitorare

| Issue | Stato | Note |
|-------|-------|------|
| Performance ricerca con molti articoli | ✅ Risolto | Aggiunto fuzzy search RPC |
| Mobile horizontal scroll | ✅ Risolto | Layout responsive ottimizzato |
| Prezzi mancanti non evidenziati | ✅ Risolto | Icone warning aggiunte |
| Elenco commesse (paginazione) | ✅ Risolto | Pagine oltre la 1 e race condition sui tag |
| Separatore migliaia importi | ✅ Risolto | `useGrouping` su tutti i `toLocaleString('it-IT')`; da verificare con hard refresh |
| Service Worker con JS vecchio dopo deploy | ✅ Risolto | Cache versionata |

---

## 📊 Metriche da Raccogliere

- Tempo medio caricamento pagine
- Numero utenti attivi/giorno
- Operazioni più frequenti
- Errori client-side (console)

---

*Ultimo aggiornamento: 9 Ottobre 2026*
