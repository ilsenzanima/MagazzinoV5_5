# 🚀 Magazzino V5.5 - Roadmap e Miglioramenti

## Stato Attuale: ✅ IN PRODUZIONE (Gennaio 2026)

---

## 🔧 Aree di Miglioramento Tecniche

### 1. Testing Automatizzato
- [x] Unit test per servizi API (`src/lib/services/`)
- [x] Integration test per flussi critici (acquisti, movimenti, FIFO)
- [ ] E2E test con Playwright per UI
- **Priorità:** Alta
- **Effort:** 2-3 giorni

### 2. Error Handling Strutturato
- [ ] Sistema di notifiche toast centralizzato
- [ ] Logging errori su servizio esterno (es. Sentry)
- [ ] Retry automatico per operazioni fallite
- **Priorità:** Media
- **Effort:** 1 giorno

### 3. Offline Support (PWA)
- [ ] Service Worker per cache statica
- [ ] IndexedDB per dati offline
- [ ] Sincronizzazione al ritorno online
- **Priorità:** Media (utile per cantieri)
- **Effort:** 3-4 giorni

### 4. Backup Automatici
- [ ] GitHub Action per backup giornaliero
- [ ] Notifica email su completamento/errore
- [ ] Retention policy (es. ultimi 30 giorni)
- **Priorità:** Alta
- **Effort:** 0.5 giorni

---

## 💡 Funzionalità Future

### Alta Priorità

#### Report PDF Avanzati
- [ ] Report inventario con filtri personalizzabili
- [ ] Report commessa per cliente (consuntivo)
- [ ] Report movimenti per periodo
- [ ] Export in Excel oltre che PDF
- **Effort:** 2-3 giorni

#### Barcode Scanner
- [ ] Scansione codice articolo con fotocamera
- [ ] Ricerca rapida da barcode
- [ ] Generazione etichette con barcode
- **Effort:** 1-2 giorni

### Media Priorità

#### Notifiche Push
- [ ] Avviso scorte sotto soglia minima
- [ ] Reminder scadenze documenti
- [ ] Notifica nuovi acquisti registrati
- **Effort:** 2 giorni

#### Dashboard Analytics
- [ ] Grafici trend consumi mensili
- [ ] Top articoli per valore/quantità
- [ ] Previsione esaurimento scorte
- **Effort:** 2-3 giorni

#### Document Scanner Avanzato
- [ ] Rilevamento bordi automatico (OpenCV.js)
- [ ] Multi-page scan → singolo PDF
- [ ] OCR per estrazione dati DDT
- **Effort:** 3-4 giorni

### Bassa Priorità

#### API Esterna
- [ ] REST API documentata per integrazioni
- [ ] Webhook per eventi (nuovo acquisto, movimento)
- [ ] Integrazione software contabilità
- **Effort:** 3-5 giorni

#### Multi-Magazzino
- [ ] Gestione più sedi/depositi
- [ ] Trasferimenti tra magazzini
- [ ] Report consolidati
- **Effort:** 5+ giorni

---

## 🐛 Bug/Issue da Monitorare

| Issue | Stato | Note |
|-------|-------|------|
| Performance ricerca con molti articoli | ✅ Risolto | Aggiunto fuzzy search RPC |
| Mobile horizontal scroll | ✅ Risolto | Layout responsive ottimizzato |
| Prezzi mancanti non evidenziati | ✅ Risolto | Icone warning aggiunte |

---

## 📊 Metriche da Raccogliere

- Tempo medio caricamento pagine
- Numero utenti attivi/giorno
- Operazioni più frequenti
- Errori client-side (console)

---

*Ultimo aggiornamento: 17 Gennaio 2026*
