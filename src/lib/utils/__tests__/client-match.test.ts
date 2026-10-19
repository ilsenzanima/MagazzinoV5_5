import { normalizeCompanyName, vatDigits, clientMatchReason, sameAddress, sameFreeTextAddress } from '../client-match';

describe('confronto committenti', () => {
    it('toglie forma giuridica, punteggiatura e accenti', () => {
        expect(normalizeCompanyName('Rossi Costruzioni S.r.l.')).toBe('rossi costruzioni');
        expect(normalizeCompanyName('  ROSSI   costruzioni SRL ')).toBe('rossi costruzioni');
        expect(normalizeCompanyName("Società Edile Perù S.p.A.")).toBe('edile peru');
    });

    it('le partite IVA si confrontano per cifre', () => {
        expect(vatDigits('IT 012.345.678-90')).toBe('01234567890');
        expect(vatDigits('IT01234567890')).toBe('01234567890');
    });

    it('riconosce stessa partita IVA, stesso nome e nome simile', () => {
        expect(clientMatchReason({ name: 'Alfa', vatNumber: 'IT01234567890' }, { name: 'Beta', vatNumber: '01234567890' }))
            .toBe('stessa-partita-iva');
        expect(clientMatchReason({ name: 'Rossi Costruzioni Srl' }, { name: 'rossi costruzioni s.r.l.' })).toBe('stesso-nome');
        expect(clientMatchReason({ name: 'Rossi Costruzioni Srl' }, { name: 'Rossi Costruzioni Edili' })).toBe('nome-simile');
    });

    it('nomi diversi o troppo corti non coincidono', () => {
        expect(clientMatchReason({ name: 'Rossi Srl' }, { name: 'Bianchi Srl' })).toBeNull();
        expect(clientMatchReason({ name: 'AB Srl' }, { name: 'AB Costruzioni' })).toBeNull();
        expect(clientMatchReason({ name: 'Rossi', vatNumber: '123' }, { name: 'Verdi', vatNumber: '123' })).toBeNull();
    });
});

describe('indirizzo', () => {
    it('stessa via e stesso civico nello stesso comune', () => {
        expect(sameAddress(
            { street: 'Via G. Garibaldi', streetNumber: '10/A', city: 'Milano' },
            { street: 'viale g garibaldi', streetNumber: '10', city: 'MILANO' }
        )).toBe(true);
        expect(sameAddress(
            { street: 'Via Roma', streetNumber: '10', postalCode: '20100' },
            { street: 'Via Roma', streetNumber: '10', postalCode: '20100', city: 'Milano' }
        )).toBe(true);
    });

    it('civico o comune diversi non coincidono', () => {
        expect(sameAddress({ street: 'Via Roma', streetNumber: '10', city: 'Milano' }, { street: 'Via Roma', streetNumber: '12', city: 'Milano' })).toBe(false);
        expect(sameAddress({ street: 'Via Roma', streetNumber: '10', city: 'Milano' }, { street: 'Via Roma', streetNumber: '10', city: 'Torino' })).toBe(false);
        expect(sameAddress({ street: 'Via', streetNumber: '10', city: 'Milano' }, { street: 'Via', streetNumber: '10', city: 'Milano' })).toBe(false);
    });

    it('stesso indirizzo con nome diverso è un avviso', () => {
        expect(clientMatchReason(
            { name: 'Alfa Srl', street: 'Via Roma', streetNumber: '10', city: 'Milano' },
            { name: 'Beta Spa', street: 'Via Roma', streetNumber: '10', city: 'Milano' }
        )).toBe('stesso-indirizzo');
    });
});

describe('indirizzo in un solo campo', () => {
    it('uguale ignorando maiuscole, punteggiatura e via/viale', () => {
        expect(sameFreeTextAddress('Via Roma 10, 00100 Roma (RM)', 'VIA ROMA 10 00100 ROMA RM')).toBe(true);
        expect(sameFreeTextAddress('Via Roma 10, 00100 Roma', 'Viale Roma 12, 00100 Roma')).toBe(false);
        expect(sameFreeTextAddress('Roma', 'Roma')).toBe(false);
        expect(sameFreeTextAddress('', undefined)).toBe(false);
    });
});
