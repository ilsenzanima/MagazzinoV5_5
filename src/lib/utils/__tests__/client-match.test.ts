import { normalizeCompanyName, vatDigits, clientMatchReason } from '../client-match';

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
