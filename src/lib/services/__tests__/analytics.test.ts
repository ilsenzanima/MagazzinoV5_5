jest.mock('@/lib/supabase', () => ({ supabase: {} }));

import { analyzeJob, buildComparisonRows, buildTimeline, JobMovementRow } from '../analytics';

const mov = (type: string, code: string, quantity: number, date: Date, extra: Partial<JobMovementRow> = {}): JobMovementRow => ({
    type,
    item_id: `id-${code}`,
    item_code: code,
    item_name: `Articolo ${code}`,
    item_model: null,
    item_unit: 'PZ',
    quantity,
    pieces: null,
    coefficient: null,
    is_fictitious: false,
    date: date.toISOString(),
    ...extra,
});

describe('analyzeJob', () => {
    it('calcola la quantità reale in commessa: andati meno rientrati', () => {
        const rows = [
            mov('exit', 'VITI', -1000, new Date(2026, 0, 10)),
            mov('exit', 'VITI', -500, new Date(2026, 0, 20)),
            mov('entry', 'VITI', 300, new Date(2026, 1, 5)),
        ];
        const [viti] = analyzeJob('j1', rows).items;
        expect(viti.sent).toBe(1500);
        expect(viti.returned).toBe(300);
        expect(viti.net).toBe(1200);
        expect(viti.movements).toBe(3);
    });

    it('conta gli acquisti diretti e le vendite come merce andata in commessa', () => {
        const rows = [
            mov('purchase', 'A', 10, new Date(2026, 0, 1)),
            mov('sale', 'A', -2, new Date(2026, 0, 2)),
            mov('exit', 'A', -3, new Date(2026, 0, 3)),
        ];
        expect(analyzeJob('j1', rows).items[0].net).toBe(15);
    });

    it('ignora i tipi non pertinenti e i movimenti senza codice articolo', () => {
        const rows = [
            mov('return_to_supplier', 'A', -5, new Date(2026, 0, 1)),
            mov('exit', 'B', -5, new Date(2026, 0, 1), { item_code: null }),
        ];
        const result = analyzeJob('j1', rows);
        expect(result.items).toHaveLength(0);
        expect(result.movementCount).toBe(0);
        expect(result.firstDate).toBeNull();
    });

    it('tiene separati gli articoli fittizi con lo stesso codice', () => {
        const rows = [
            mov('exit', 'A', -1, new Date(2026, 0, 1)),
            mov('exit', 'A', -1, new Date(2026, 0, 1), { is_fictitious: true }),
        ];
        expect(analyzeJob('j1', rows).items).toHaveLength(2);
    });

    it('calcola i pezzi netti dal campo pezzi o dal coefficiente', () => {
        const rows = [
            mov('exit', 'LASTRA', -12, new Date(2026, 0, 1), { pieces: 10, item_unit: 'MQ' }),
            mov('entry', 'LASTRA', 2.4, new Date(2026, 0, 5), { pieces: null, coefficient: 1.2, item_unit: 'MQ' }),
        ];
        const [lastra] = analyzeJob('j1', rows).items;
        expect(lastra.net).toBe(9.6);
        expect(lastra.netPieces).toBe(8); // 10 pezzi andati - 2 rientrati
    });

    it('riporta primo e ultimo movimento e i movimenti per mese', () => {
        const rows = [
            mov('exit', 'A', -1, new Date(2026, 0, 10)),
            mov('exit', 'B', -1, new Date(2026, 0, 12)),
            mov('entry', 'A', 1, new Date(2026, 2, 3)),
        ];
        const result = analyzeJob('j1', rows);
        expect(result.firstDate?.getMonth()).toBe(0);
        expect(result.lastDate?.getMonth()).toBe(2);
        expect(Object.values(result.monthlyActivity).sort()).toEqual([1, 2]);
    });
});

describe('buildComparisonRows', () => {
    it('unisce gli articoli di più commesse e lascia vuoto dove non compaiono', () => {
        const j1 = analyzeJob('j1', [mov('exit', 'A', -4, new Date(2026, 0, 1)), mov('exit', 'B', -1, new Date(2026, 0, 1))]);
        const j2 = analyzeJob('j2', [mov('exit', 'A', -6, new Date(2026, 3, 1))]);
        const rows = buildComparisonRows([j1, j2]);
        expect(rows.map(r => r.code)).toEqual(['A', 'B']);
        expect(rows[0].byJob.j1.net).toBe(4);
        expect(rows[0].byJob.j2.net).toBe(6);
        expect(rows[1].byJob.j2).toBeUndefined();
    });
});

describe('buildTimeline', () => {
    const j1 = analyzeJob('j1', [
        mov('exit', 'A', -10, new Date(2026, 0, 10)),
        mov('entry', 'A', 4, new Date(2026, 2, 10)),
    ]);
    const j2 = analyzeJob('j2', [mov('exit', 'A', -7, new Date(2026, 5, 1))]);

    it('mostra la quantità cumulata di un articolo, con i rientri che la riducono', () => {
        const points = buildTimeline([j1], 'A|0', 'calendar');
        expect(points.map(p => p.j1)).toEqual([10, 10, 6]);
        expect(points.map(p => p.label)).toEqual(['gen 26', 'feb 26', 'mar 26']);
    });

    it('in modalità calendario lascia vuoti i mesi in cui la commessa non era attiva', () => {
        const points = buildTimeline([j1, j2], 'A|0', 'calendar');
        expect(points).toHaveLength(6);
        expect(points[0].j2).toBeNull();
        expect(points[5].j2).toBe(7);
        expect(points[5].j1).toBeNull();
    });

    it('in modalità dall\'inizio allinea le commesse sul primo mese', () => {
        const points = buildTimeline([j1, j2], 'A|0', 'fromStart');
        expect(points).toHaveLength(3);
        expect(points[0].label).toBe('Mese 1');
        expect(points[0].j1).toBe(10);
        expect(points[0].j2).toBe(7);
        expect(points[1].j2).toBeNull();
    });

    it('senza articolo mostra il numero di movimenti per mese', () => {
        const points = buildTimeline([j1], null, 'calendar');
        expect(points.map(p => p.j1)).toEqual([1, 0, 1]);
    });

    it('restituisce un elenco vuoto se nessuna commessa ha movimenti', () => {
        expect(buildTimeline([analyzeJob('j9', [])], null, 'calendar')).toEqual([]);
    });
});
