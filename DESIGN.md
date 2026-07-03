# Design System - Magazzino V5.5

Riferimento del design system così com'è implementato nel codice: stack, token, componenti e convenzioni. Non è un documento aspirazionale — se aggiungi o cambi qualcosa nella UI, aggiorna anche qui.

## Stack

- **Next.js** (App Router) + **React** + **TypeScript**
- **Tailwind CSS v4** (via `@tailwindcss/postcss`, nessun `tailwind.config` separato — i token sono in `src/app/globals.css`)
- **shadcn/ui** (stile `new-york`, `baseColor: neutral`) — componenti in `src/components/ui/`, generati/estesi da lì, non da libreria esterna
- **Radix UI** primitives sotto i componenti shadcn (dialog, select, checkbox, popover, ecc.)
- **lucide-react** come unica icon library
- **class-variance-authority (cva)** per le varianti dei componenti
- **next-themes** per il cambio tema

Config di riferimento: `components.json` (schema shadcn).

## Colori e temi

Tutti i colori sono **CSS custom properties** in formato `oklch()`, definite in `src/app/globals.css` e mappate a token semantici via `@theme inline`. Non usare colori hex/rgb hardcoded nei componenti generici: usa le classi Tailwind che puntano ai token (`bg-primary`, `text-muted-foreground`, `border-border`, ecc.), così i temi restano coerenti automaticamente.

Tre temi disponibili, selezionabili dall'utente (`next-themes`, classe su `<html>`):

| Tema | Selettore | Note |
|---|---|---|
| Light | `:root` (default) | bianco/nero neutro |
| Dark | `.dark` | inversione standard shadcn |
| Gray | `.gray` | tema custom "OPI Firesafe": sfondo grigio chiaro, primary blu (`#1A365D`), accent rosso (`#C00016`) |

Token semantici principali (uguali per nome in tutti i temi, valore diverso):
`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, più `chart-1`…`chart-5` e la famiglia `sidebar-*` per il menu laterale.

**Eccezione nota e intenzionale**: i badge di stato di dominio (fasi cronoprogramma, stati commessa/presenza, ecc.) usano classi Tailwind letterali invece dei token semantici, perché rappresentano uno stato di business fisso e riconoscibile a colpo d'occhio, non un ruolo di superficie UI:

```ts
const STATUS_BADGE: Record<JobTask['status'], string> = {
  planned: "bg-slate-500",
  in_progress: "bg-blue-600",
  completed: "bg-green-600",
  delayed: "bg-amber-500",
}
```

Segui questo pattern quando aggiungi un nuovo badge di stato: oggetto `Record<Stato, classeTailwind>` accanto a un `Record<Stato, etichettaItaliana>`, non colori inline sparsi nel JSX.

## Tipografia

Font caricati in `src/app/layout.tsx` via `next/font/google`:

- **Geist Sans / Geist Mono** — default
- **Inter** — usato per i titoli quando è attivo il font di accessibilità Lexend
- **Lexend** — font opzionale ottimizzato per la lettura
- **OpenDyslexic** — font opzionale per dislessia (caricato via `@font-face` da CDN in `globals.css`)

Cambio font gestito in `src/app/settings/page.tsx` aggiungendo/rimuovendo le classi `font-lexend` / `font-opendyslexic` su `document.body`. Se aggiungi testo con markup custom, non forzare `font-family` inline: eredita sempre dal body per rispettare la scelta di accessibilità dell'utente.

## Radius e forme

Un'unica variabile sorgente, `--radius: 0.625rem`, da cui derivano `--radius-sm|md|lg|xl|2xl|3xl|4xl` (in `globals.css`). Usa le classi Tailwind corrispondenti (`rounded-md`, `rounded-lg`, ecc.) invece di valori px hardcoded.

## Componenti base (`src/components/ui/`)

Tutti generati in stile shadcn/ui, con varianti via `cva`. Non duplicare uno di questi componenti altrove: se manca una variante, estendi il file esistente.

**Button** (`button.tsx`) — varianti: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`. Dimensioni: `default`, `sm`, `lg`, `icon`, `icon-sm`, `icon-lg` (le dimensioni icon sono più grandi su mobile per il target touch, più piccole da `md:` in su).

**Badge** (`badge.tsx`) — varianti: `default`, `secondary`, `destructive`, `outline`. Per stati di dominio, override diretto della classe colore (vedi sezione Colori).

Altri componenti disponibili: `Card`, `Dialog`, `AlertDialog`, `Sheet` (drawer mobile), `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Popover`, `Command` (ricerca/combobox), `Tabs`, `Table`, `Toast`/`Toaster`, `Avatar`, `Separator`, `Skeleton`, `ConfirmDeleteDialog`, `SearchableSelect`, `PaginationControls`, `HelpTip`.

## Pattern ricorrenti

**Form in Dialog** — creazione/modifica di un'entità: `Dialog` con `DialogHeader`/`DialogTitle`/`DialogDescription`, campi in `<div className="space-y-4 py-2">`, footer con bottone "Elimina" (ghost, rosso) a sinistra se in modifica e "Annulla"/"Salva" a destra. Vedi `JobCronoprogramma.tsx` o `CronoprogrammaGlobalView.tsx` come riferimento completo.

**Card + lista mobile parallela** — le viste principali mostrano un componente ricco (grafico, tabella) sempre visibile, più una lista di `Card` compatte nascosta da `md:` in su (`className="md:hidden"`) come fallback leggibile su schermi piccoli.

**Stato di caricamento** — spinner inline coerente:
```tsx
<div className="flex justify-center items-center py-12">
  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
  <span className="ml-2 text-slate-500 text-sm">Caricamento...</span>
</div>
```

**Notifiche** — mai `alert()`/toast ad-hoc: usa sempre `notify.error(...)` / `notify.success(...)` da `@/lib/notify`.

**Conferme distruttive** — `confirm()` nativo per azioni semplici, `ConfirmDeleteDialog` per flussi che meritano più contesto.

**Etichette e stati** — tutta la UI è in italiano. Ogni enum di stato ha un oggetto `Record<Stato, string>` di label accanto alla dichiarazione del tipo/componente (mai stringhe tradotte inline sparse).

## Icone

Solo `lucide-react`. Dimensione standard nei bottoni/testo: `h-4 w-4`; nei titoli di sezione: `h-5 w-5`/`h-6 w-6`. Non mischiare altre icon library.

## Accessibilità e mobile

- Target touch minimo 44×44px (`.touch-target` in `globals.css`, e size `icon` più grande su mobile nei Button)
- `.scroll-shadow-x` per segnalare overflow orizzontale nelle tabelle
- `.scrollbar-hide` per nascondere scrollbar mantenendo lo scroll
- `.pb-safe-area-bottom` per rispettare le safe area su mobile (notch/home indicator)
- Font di accessibilità opzionali (Lexend, OpenDyslexic) selezionabili dall'utente — vedi Tipografia

## Cronoprogramma / Gantt (caso speciale)

Il Gantt (`frappe-gantt`) non supporta i CSS custom property del design system, quindi i colori delle barre sono hardcoded in `globals.css` con selettori per sottostringa e `!important` (necessario per vincere la specificità della libreria):

```css
.gantt [class*="task-status-planned"] .bar { fill: #94a3b8 !important; }
.gantt [class*="task-status-in-progress"] .bar { fill: #3b82f6 !important; }
.gantt [class*="task-status-completed"] .bar { fill: #22c55e !important; }
.gantt [class*="task-status-delayed"] .bar { fill: #f59e0b !important; }
```

Stessa logica per il contorno colorato per commessa nella vista globale (`job-color-0`…`job-color-7`). Se aggiungi un nuovo stato o serve un nuovo colore commessa, segui lo stesso pattern (classe combinata `stato--colore` senza spazi, perché `frappe-gantt` chiama `classList.add()` sull'intera stringa).

## Cosa NON fare

- Non introdurre una libreria UI diversa da shadcn/Radix per componenti che esistono già in `src/components/ui/`
- Non hardcodare colori hex/rgb per elementi di superficie UI (usa i token) — l'eccezione sono gli stati di dominio (vedi sopra) e il Gantt (vincolo tecnico della libreria)
- Non creare varianti di `Button`/`Badge` ad-hoc con classi custom quando esiste già una variante `cva` adatta
- Non forzare `font-family` inline (rompe la selezione font di accessibilità)

## File di riferimento

| Cosa | Dove |
|---|---|
| Token colore/tema | `src/app/globals.css` |
| Config shadcn | `components.json` |
| Font | `src/app/layout.tsx` |
| Switch tema/font | `src/components/theme-provider.tsx`, `src/app/settings/page.tsx` |
| Componenti base | `src/components/ui/` |
| Notifiche | `src/lib/notify.ts` |
