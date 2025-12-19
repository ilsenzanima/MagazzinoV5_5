Ecco il piano per iniziare il progetto **Magazzino React + Supabase**.

Dato che la directory corrente è vuota, inizieremo con un setup pulito. L'obiettivo della **Fase 1** è creare l'infrastruttura di base, la Home Page (Landing) e la Dashboard visiva (basata sui tuoi screenshot), utilizzando dati fittizi per ora.

### 🛠️ Stack Tecnologico
- **Frontend**: React (con Vite per velocità e performance).
- **Stiling**: Tailwind CSS (perfetto per replicare il design "mobile-app" pulito delle immagini).
- **Routing**: React Router (per navigare tra Home e Dashboard).
- **Grafici**: Recharts (per i grafici della dashboard).
- **Icone**: Lucide React (per le icone moderne).
- **Backend/DB**: Supabase (configurazione client).
- **Hosting**: Predisposizione per Vercel.

### 📅 Fase 1: Setup e UI Principale

#### 1. Inizializzazione Progetto
- Creazione progetto Vite + React.
- Installazione dipendenze: `tailwindcss`, `react-router-dom`, `recharts`, `lucide-react`, `@supabase/supabase-js`.
- Configurazione del sistema di design (colori, font) per matchare le immagini (Blu primario, sfondi grigio chiaro).

#### 2. Struttura del Codice
Organizzeremo il progetto in modo scalabile:
```text
src/
  ├── components/   # Componenti riutilizzabili (Card, Button, Header)
  ├── pages/        # Pagine intere (Home, Dashboard)
  ├── lib/          # Configurazione Supabase
  └── assets/       # Immagini/Loghi
```

#### 3. Implementazione Home Page (Landing)
- Una pagina di benvenuto pulita.
- **Pulsanti**: "Accedi" e "Registrati" ben visibili (che per ora porteranno alla Dashboard o a placeholder).

#### 4. Implementazione Dashboard (UI)
Replicherò fedelmente il design "Dashboard Principale" che hai allegato:
- **Header**: Titolo e icona profilo.
- **Stat Cards**: 3 card in alto (Articoli in Stock, Ordini in Sospeso, Avvisi).
- **Sezione Grafici**:
  - Grafico lineare per "Andamento Scorte".
  - Grafico a ciambella per "Stato Ordini".
- **Azioni Rapide**: Pulsanti grandi per "Nuovo Ordine" e "Inventario Rapido".
- **Attività Recenti**: Lista scrollabile degli ultimi movimenti.

#### 5. Integrazione Supabase (Setup Iniziale)
- Creazione del file di configurazione `supabaseClient.js`.
- Predisposizione delle variabili d'ambiente (`.env`) per URL e Chiave API (che dovrai recuperare dalla dashboard di Supabase).

---

### ❓ Domande per te
1. Preferisci usare **JavaScript** standard o **TypeScript**? (Consiglio JS per iniziare velocemente a "provare", TS se vuoi più robustezza futura). *Nel dubbio procederò con JavaScript standard.*
2. Hai già creato il progetto su Supabase o ti serve una guida anche per quello?

Se approvi questo piano, inizierò subito con l'inizializzazione del progetto!