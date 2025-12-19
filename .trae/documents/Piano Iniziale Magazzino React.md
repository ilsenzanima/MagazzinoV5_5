# Piano di Sviluppo: Magazzino React (Fase 1)

## Obiettivo
Creare la struttura base dell'applicazione di gestione magazzino utilizzando Next.js e TypeScript, implementando la Home Page e la Dashboard UI statica basata sui design forniti.

## Stack Tecnologico
- **Framework**: Next.js 14+ (App Router)
- **Linguaggio**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/ui (per componenti accessibili e stile coerente)
- **Icone**: Lucide React
- **Grafici**: Recharts
- **Backend**: Supabase (setup client iniziale)

## Passaggi Operativi

### 1. Inizializzazione Progetto
- Creazione nuovo progetto Next.js nella directory corrente (`d:\Magazzino\MagazzinoV5_5`).
- Configurazione di TypeScript, ESLint e Tailwind CSS.
- Installazione dipendenze: `lucide-react`, `recharts`, `@supabase/supabase-js`, `clsx`, `tailwind-merge`.

### 2. Setup UI & Componenti Base
- Configurazione componenti UI base (Button, Card, Input) tramite Shadcn/ui o custom Tailwind components per velocizzare lo sviluppo.
- Definizione dei colori e font per rispecchiare il design "blu/clean" degli screenshot.

### 3. Sviluppo Pagine
- **Home Page (`/`)**: 
  - Layout di benvenuto.
  - Pulsanti "Accedi" e "Registrati" (mock navigazione verso dashboard).
- **Dashboard (`/dashboard`)**:
  - **Header**: Titolo e User Avatar.
  - **Stat Cards**: Componenti per visualizzare "Articoli in Stock", "Ordini", "Avvisi".
  - **Charts Section**: Placeholder funzionanti con Recharts per "Andamento Scorte" e "Stato Ordini".
  - **Quick Actions**: Pulsanti grandi per azioni frequenti.
  - **Recent Activity**: Lista scrollabile simulata.

### 4. Configurazione Supabase (Stub)
- Creazione file `lib/supabase.ts` per il client.
- Creazione file `.env.local.example` per le chiavi API.

## Verifica
- Avvio server locale (`npm run dev`).
- Verifica navigazione Home -> Dashboard.
- Verifica responsività (mobile-friendly come da screenshot).
