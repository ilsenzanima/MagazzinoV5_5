// «Calcolatrice» per le quantità: "2 conf + 3 pz", "3 conf - 1 pz", "5 kg", "12".
// Il risultato è la quantità nell'unità dell'articolo; i pezzi si ricavano col coefficiente.

export interface ExpressionContext {
    packQuantity?: number | null;   // quantità per confezione, nell'unità dell'articolo
    coefficient: number;            // unità per pezzo
    unit: string;                   // unità dell'articolo (KG, MQ, PZ...)
}

export interface ExpressionResult {
    ok: boolean;
    quantity?: number;
    pieces?: number;
    parts?: string[];     // es. ["2 conf = 24 PZ", "3 pz = 3 PZ"]
    error?: string;
}

const PACK_WORDS = new Set(['conf', 'confezione', 'confezioni', 'scatola', 'scatole', 'sc', 'cf', 'secchio', 'secchi', 'sacco', 'sacchi', 'rotolo', 'rotoli']);
const PIECE_WORDS = new Set(['pz', 'pezzo', 'pezzi', 'p']);

const round2 = (n: number) => Math.round(n * 100) / 100;

export function parseQuantityExpression(input: string, ctx: ExpressionContext): ExpressionResult {
    const text = input.trim().toLowerCase().replace(/,/g, '.');
    if (!text) return { ok: false, error: '' };

    // Termini separati da + o - (il segno dopo l'inizio o dopo un altro operatore appartiene al numero)
    const tokens = text.match(/[+-]?\s*[^+-]+/g);
    if (!tokens) return { ok: false, error: 'Scrivi una quantità, per esempio "2 conf + 3 pz"' };

    const coefficient = ctx.coefficient > 0 ? ctx.coefficient : 1;
    const unitWord = ctx.unit.toLowerCase();
    let quantity = 0;
    const parts: string[] = [];

    for (let i = 0; i < tokens.length; i++) {
        const raw = tokens[i].replace(/\s+/g, ' ').trim();
        const sign = raw.startsWith('-') ? -1 : 1;
        const body = raw.replace(/^[+-]\s*/, '');
        const match = body.match(/^(\d+(?:\.\d+)?)\s*([a-zàèéìòù]*)$/);
        if (!match) return { ok: false, error: `Non capisco "${tokens[i].trim()}"` };
        const value = parseFloat(match[1]);
        const word = match[2];

        let termQty: number;
        let label: string;
        if (word === '' || PIECE_WORDS.has(word)) {
            termQty = value * coefficient;               // senza unità = pezzi
            label = `${value} pz`;
        } else if (PACK_WORDS.has(word)) {
            if (!ctx.packQuantity || ctx.packQuantity <= 0) {
                return { ok: false, error: 'Per questo articolo non è indicata la quantità per confezione' };
            }
            termQty = value * ctx.packQuantity;
            label = `${value} conf`;
        } else if (word === unitWord) {
            termQty = value;
            label = `${value} ${ctx.unit}`;
        } else {
            return { ok: false, error: `Unità "${word}" non riconosciuta (usa conf, pz o ${ctx.unit.toLowerCase()})` };
        }

        quantity += sign * termQty;
        parts.push(`${sign < 0 ? '− ' : i > 0 ? '+ ' : ''}${label} = ${round2(termQty)} ${ctx.unit}`);
    }

    quantity = round2(quantity);
    if (!(quantity > 0)) return { ok: false, parts, error: 'Il risultato deve essere maggiore di zero' };
    return { ok: true, quantity, pieces: round2(quantity / coefficient), parts };
}
