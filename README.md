# Magazzino V5.5

Gestionale interno per **OPI Fire Safe** — magazzino, acquisti, movimentazione merce, commesse e presenze.

## Stack

- **Frontend**: Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- **UI**: Tailwind CSS v4 + shadcn/ui + Radix UI
- **Backend / DB**: Supabase (PostgreSQL 17, Auth, Storage, Realtime)
- **Deploy**: Vercel → [fire-block.org](https://www.fire-block.org)

## Funzionalità principali

| Modulo | Descrizione |
|---|---|
| **Acquisti** | Gestione bolle di acquisto con FIFO automatico |
| **Movimentazione** | Bolle di entrata / uscita / vendita / eccedenze |
| **Magazzino** | Inventario articoli con lotti e disponibilità |
| **Commesse** | Gestione cantieri con associazione movimenti e acquisti |
| **Fornitori / Clienti** | Anagrafica con storico acquisti |
| **Presenze** | Registro presenze operai con richieste ferie/permessi |
| **Corsi e visite mediche** | Scadenzari con alert dashboard |
| **Report** | Export PDF bolle, inventario, presenze |
| **PWA** | Installabile su mobile/desktop |

## Setup locale

### Prerequisiti

- Node.js 20+
- Account Supabase con progetto attivo

### Installazione

```bash
git clone https://github.com/ilsenzanima/MagazzinoV5_5.git
cd MagazzinoV5_5
npm install
```

### Variabili d'ambiente

Crea un file `.env.local` nella root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

### Avvio

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

## Test

```bash
npm test                  # unit test
npm run test:integration  # integration test
npm run test:coverage     # coverage
```

## Deploy

Il deploy avviene automaticamente su Vercel ad ogni push su `master`.

### Configurazione Supabase (obbligatoria per produzione)

In **Authentication → URL Configuration** del dashboard Supabase:
- **Site URL**: `https://www.fire-block.org`
- **Redirect URLs**: `https://www.fire-block.org/auth/callback`

## Struttura progetto

```
src/
├── app/              # Route Next.js (App Router)
│   ├── auth/         # Callback, reset password, forgot password
│   ├── purchases/    # Acquisti
│   ├── movements/    # Movimentazione
│   ├── inventory/    # Magazzino
│   ├── jobs/         # Commesse
│   ├── workers/      # Operai
│   ├── attendance/   # Presenze
│   └── settings/     # Impostazioni (admin, profilo, backup)
├── components/       # Componenti React riutilizzabili
├── lib/
│   ├── api.ts        # Re-export API pubbliche
│   ├── services/     # Logica accesso dati (Supabase)
│   ├── supabase/     # Client/server/middleware Supabase
│   └── pdf/          # Generatori PDF (jsPDF)
└── hooks/            # Custom React hooks
supabase/
└── migrations/       # Migrazioni SQL
```
