import {
    composeVariant, missingRequiredFields, defaultValues, cleanValues, packQuantityFrom,
    formatNumberValue, keyFromLabel, VariantTemplate, coefficientFrom, SUBTYPE_KEY, suggestedPackQuantity,
} from '../variant-template';

const guide: VariantTemplate = {
    version: 1,
    pattern: '{larghezza}x{ala}x{lunghezza} [sp. {spessore}]',
    fields: [
        { key: 'larghezza', label: 'Larghezza', kind: 'number', required: true },
        { key: 'ala', label: 'Ala', kind: 'number', required: true },
        { key: 'lunghezza', label: 'Lunghezza', kind: 'number', required: true },
        { key: 'spessore', label: 'Spessore', kind: 'choice', default: '6/10', hideWhenDefault: true },
    ],
};

const porta: VariantTemplate = {
    version: 1,
    pattern: '{resistenza} {misure} {ante} [FM {larghezza}x{altezza} mm] {apertura} [L1 {l1} mm] [L2 {l2} mm] {fissaggio}',
    fields: [
        { key: 'resistenza', label: 'Resistenza', kind: 'choice', required: true },
        { key: 'misure', label: 'Misure', kind: 'choice', required: true },
        { key: 'ante', label: 'Ante', kind: 'choice', required: true },
        { key: 'larghezza', label: 'L', kind: 'number', required: true },
        { key: 'altezza', label: 'H', kind: 'number', required: true },
        { key: 'apertura', label: 'Apertura', kind: 'choice', required: true, showIf: { key: 'ante', equals: '1A' } },
        { key: 'l1', label: 'L1', kind: 'number', showIf: { key: 'ante', equals: '2A' } },
        { key: 'l2', label: 'L2', kind: 'number', showIf: { key: 'ante', equals: '2A' } },
        { key: 'fissaggio', label: 'Fissaggio', kind: 'choice' },
    ],
};

describe('composeVariant', () => {
    it('compone la misura con la virgola decimale e salta lo spessore standard', () => {
        expect(composeVariant(guide, { larghezza: '100', ala: '40', lunghezza: '3000', spessore: '6/10' })).toBe('100x40x3000');
    });

    it('mostra lo spessore quando è diverso dallo standard', () => {
        expect(composeVariant(guide, { larghezza: '150', ala: '80', lunghezza: '4000', spessore: '8/10' })).toBe('150x80x4000 sp. 8/10');
    });

    it('porta a una anta: apertura e nessuna L1/L2', () => {
        expect(composeVariant(porta, {
            resistenza: 'REI 120', misure: 'MIS', ante: '1A', larghezza: '830', altezza: '2150', apertura: 'tirare DX',
            l1: '999', fissaggio: '',
        })).toBe('REI 120 MIS 1A FM 830x2150 mm tirare DX');
    });

    it('porta a due ante: L1 e L2, senza apertura', () => {
        expect(composeVariant(porta, {
            resistenza: 'REI 120', misure: 'MIS', ante: '2A', larghezza: '1120', altezza: '2150',
            apertura: 'tirare SX', l1: '560', l2: '560', fissaggio: 'da tassellare',
        })).toBe('REI 120 MIS 2A FM 1120x2150 mm L1 560 mm L2 560 mm da tassellare');
    });

    it('i gruppi facoltativi spariscono se manca un valore', () => {
        expect(composeVariant(porta, { resistenza: 'EI 60', misure: 'STD', ante: '1A', larghezza: '900' })).toBe('EI 60 STD 1A');
    });
});

describe('numeri e valori', () => {
    it('usa la virgola decimale', () => {
        expect(formatNumberValue('12.5')).toBe('12,5');
        expect(formatNumberValue('12,50')).toBe('12,5');
        expect(formatNumberValue('1200')).toBe('1200');
        expect(formatNumberValue('abc')).toBe('abc');
    });

    it('segnala i campi obbligatori mancanti solo se visibili', () => {
        const missing = missingRequiredFields(porta, { resistenza: 'REI 60', misure: 'STD', ante: '2A', larghezza: '1', altezza: '2' });
        expect(missing.map(f => f.key)).toEqual([]);
        const missing1A = missingRequiredFields(porta, { resistenza: 'REI 60', misure: 'STD', ante: '1A', larghezza: '1', altezza: '2' });
        expect(missing1A.map(f => f.key)).toEqual(['apertura']);
    });

    it('valori predefiniti e pulizia dei dati salvati', () => {
        expect(defaultValues(guide)).toEqual({ spessore: '6/10' });
        expect(cleanValues(porta, { resistenza: 'REI 60', ante: '1A', l1: '500', larghezza: '12.5', apertura: ' tirare SX ' }))
            .toEqual({ resistenza: 'REI 60', ante: '1A', larghezza: '12,5', apertura: 'tirare SX' });
    });

    it('la quantità per confezione arriva dal campo che la prevede', () => {
        const pittura: VariantTemplate = {
            version: 1, pattern: '{peso} KG {colore}',
            fields: [
                { key: 'peso', label: 'Peso', kind: 'number', fillsPackQuantity: true },
                { key: 'colore', label: 'Colore', kind: 'text' },
            ],
        };
        expect(packQuantityFrom(pittura, { peso: '20' })).toBe('20');
        expect(packQuantityFrom(pittura, { peso: '' })).toBe('');
        expect(packQuantityFrom(guide, { larghezza: '10' })).toBe('');
    });

    it('chiave dal nome del campo', () => {
        expect(keyFromLabel('Foro muro: larghezza')).toBe('foro_muro_larghezza');
        expect(keyFromLabel('Spessore')).toBe('spessore');
    });
});

describe('sottotipi e coefficiente', () => {
    const porte: VariantTemplate = {
        version: 2, pattern: '', fields: [], subtypeLabel: 'Componente',
        subtypes: [
            { key: 'maniglione', label: 'Maniglione', pattern: '{modello} [per porta {larghezza} mm]', fields: [
                { key: 'modello', label: 'Modello', kind: 'choice', required: true },
                { key: 'larghezza', label: 'Larghezza', kind: 'number' },
            ] },
            { key: 'chiudiporta', label: 'Chiudiporta', pattern: '{modello} {finitura}', fields: [
                { key: 'modello', label: 'Modello', kind: 'choice', required: true },
                { key: 'finitura', label: 'Finitura', kind: 'choice' },
            ] },
        ],
    };

    it('senza sottotipo scelto chiede prima il sottotipo', () => {
        expect(composeVariant(porte, { modello: 'CP1' })).toBe('');
        const missing = missingRequiredFields(porte, {});
        expect(missing.map(f => f.key)).toEqual([SUBTYPE_KEY]);
        expect(missing[0].label).toBe('Componente');
    });

    it('usa campi e modello del sottotipo scelto', () => {
        expect(composeVariant(porte, { [SUBTYPE_KEY]: 'maniglione', modello: 'SLASH SL BM', larghezza: '1340' }))
            .toBe('SLASH SL BM per porta 1340 mm');
        expect(composeVariant(porte, { [SUBTYPE_KEY]: 'chiudiporta', modello: 'CP1', finitura: 'argento' }))
            .toBe('CP1 argento');
    });

    it('i valori salvati includono il sottotipo e solo i campi di quel sottotipo', () => {
        expect(cleanValues(porte, { [SUBTYPE_KEY]: 'chiudiporta', modello: 'CP1', larghezza: '99', finitura: ' argento ' }))
            .toEqual({ [SUBTYPE_KEY]: 'chiudiporta', modello: 'CP1', finitura: 'argento' });
        expect(defaultValues(porte, 'maniglione')).toEqual({ [SUBTYPE_KEY]: 'maniglione' });
    });

    it('coefficiente: area per le lastre in MQ, lunghezza in metri per i profili in ML', () => {
        const lastre: VariantTemplate = {
            version: 2, pattern: '', fields: [],
            coefficient: { kind: 'area', widthKey: 'l', lengthKey: 'h', whenUnit: 'MQ' },
        };
        expect(coefficientFrom(lastre, { l: '1200', h: '2500' }, 'MQ')).toBe(3);
        expect(coefficientFrom(lastre, { l: '1200', h: '3000' }, 'mq')).toBe(3.6);
        expect(coefficientFrom(lastre, { l: '1200', h: '3000' }, 'PZ')).toBeNull();
        expect(coefficientFrom(lastre, { l: '1200' }, 'MQ')).toBeNull();

        const guide: VariantTemplate = {
            version: 2, pattern: '', fields: [],
            coefficient: { kind: 'length', lengthKey: 'lunghezza', whenUnit: 'ML' },
        };
        expect(coefficientFrom(guide, { lunghezza: '4000' }, 'ML')).toBe(4);
        expect(coefficientFrom(guide, { lunghezza: '2800' }, 'ML')).toBe(2.8);
    });
});

describe('quantità per confezione suggerita', () => {
    const lana: VariantTemplate = {
        version: 2, pattern: '', fields: [],
        subtypes: [{
            key: 'pannello', label: 'Pannello', pattern: '{spessore}x{larghezza}x{lunghezza}',
            packFromSheets: { sheetsKey: 'fogli', widthKey: 'larghezza', lengthKey: 'lunghezza' },
            fields: [
                { key: 'spessore', label: 'Sp', kind: 'number' },
                { key: 'larghezza', label: 'L', kind: 'number' },
                { key: 'lunghezza', label: 'H', kind: 'number' },
                { key: 'fogli', label: 'Fogli', kind: 'number', hideFromVariant: true },
            ],
        }],
    };
    const v = { [SUBTYPE_KEY]: 'pannello', spessore: '50', larghezza: '600', lunghezza: '1200', fogli: '10' };

    it('con MQ i fogli diventano m² (10 fogli da 0,72 m² = 7,2), con PZ restano pezzi', () => {
        expect(suggestedPackQuantity(lana, v, 'MQ')).toBe(7.2);
        expect(suggestedPackQuantity(lana, v, 'PZ')).toBe(10);
        expect(suggestedPackQuantity(lana, v, 'KG')).toBeNull();
        expect(suggestedPackQuantity(lana, { ...v, fogli: '' }, 'MQ')).toBeNull();
    });

    it('il peso è anche la confezione solo con l\'unità prevista', () => {
        const stucco: VariantTemplate = {
            version: 2, pattern: '{contenitore} [{peso} KG]',
            fields: [
                { key: 'contenitore', label: 'Contenitore', kind: 'choice' },
                { key: 'peso', label: 'Peso', kind: 'number', fillsPackQuantity: true, packWhenUnit: 'KG' },
            ],
        };
        expect(suggestedPackQuantity(stucco, { peso: '25' }, 'KG')).toBe(25);
        expect(suggestedPackQuantity(stucco, { peso: '25' }, 'PZ')).toBeNull();
    });
});
