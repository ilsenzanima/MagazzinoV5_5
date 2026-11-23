import { format } from 'date-fns';

// Toglie solo i caratteri che Windows/Mac non accettano nei nomi file e gli spazi doppi:
// lettere accentate, «+», «x», numeri e punteggiatura restano come nel nome dell'analisi
const clean = (s: string, max: number) =>
    (s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim().replace(/[. ]+$/, '');

/**
 * Nome file di un'analisi costi: «Nome completo dell'analisi - Offerta - AAAAMMGG».
 * Il nome dell'analisi non viene più accorciato né privato dei simboli, così analisi con nomi
 * simili (es. «... POS 23» e «... POS 25») non si sovrascrivono.
 */
export function costAnalysisFileName(
    input: { proposalTitle: string; versionName: string },
    ext: 'pdf' | 'xlsx' | 'zip' = 'pdf'
): string {
    const name = clean(input.versionName, 120) || 'Analisi costi';
    const offer = clean(input.proposalTitle, 50);
    const parts = [name];
    if (offer && offer.toLowerCase() !== name.toLowerCase()) parts.push(offer);
    parts.push(format(new Date(), 'yyyyMMdd'));
    return `${parts.join(' - ')}.${ext}`;
}
