import { format } from 'date-fns';

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

// Toglie solo i caratteri che Windows/Mac non accettano nei nomi file e gli spazi doppi:
// lettere accentate, «+», «x», numeri e punteggiatura restano come nel nome dell'analisi
const clean = (s: string, max: number) =>
    (s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim().replace(/[. ]+$/, '');

/**
 * Nome file di un'analisi costi: «Offerta - GGmesAAAA - Nome completo dell'analisi»
 * (la data è quella del giorno in cui si scarica, mese con le prime 3 lettere, es. 24nov2026).
 * Il nome dell'analisi non viene più accorciato né privato dei simboli, così analisi con nomi
 * simili (es. «... POS 23» e «... POS 25») non si sovrascrivono.
 */
export function costAnalysisFileName(
    input: { proposalTitle: string; versionName: string },
    ext: 'pdf' | 'xlsx' | 'zip' = 'pdf'
): string {
    const name = clean(input.versionName, 120) || 'Analisi costi';
    const offer = clean(input.proposalTitle, 50);
    const parts: string[] = [];
    if (offer && offer.toLowerCase() !== name.toLowerCase()) parts.push(offer);
    const now = new Date();
    parts.push(`${format(now, 'dd')}${MESI[now.getMonth()]}${format(now, 'yyyy')}`);
    parts.push(name);
    return `${parts.join(' - ')}.${ext}`;
}
