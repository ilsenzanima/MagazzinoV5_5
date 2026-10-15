// Data di riferimento del prezzo di un articolo in una commessa: la data del PRIMO movimento di
// quell'articolo nella commessa (la data inserita a mano sul documento, non quella di creazione).
// Il prezzo di riferimento d'acquisto si calcola «a quella data»: una bolla modificata mesi dopo
// non cambia i prezzi già fissati per le commesse di allora.
export interface DatedMovement {
    itemId?: string | null;
    date?: string | null;
}

export const firstMovementDates = (movements: DatedMovement[]): Map<string, string> => {
    const map = new Map<string, string>();
    for (const m of movements) {
        if (!m.itemId || !m.date) continue;
        const day = m.date.slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
        const cur = map.get(m.itemId);
        if (cur === undefined || day < cur) map.set(m.itemId, day);
    }
    return map;
};
