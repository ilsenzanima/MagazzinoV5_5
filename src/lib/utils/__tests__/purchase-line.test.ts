import {
    applyPieces, applyQuantity, applyPacks, applyPrice, applyTotal, packsFromQuantity, checkPrice, LineAmounts,
} from '../purchase-line';

const empty: LineAmounts = { pieces: '', quantity: '', price: '0', total: '0' };

describe('calcoli della riga di acquisto', () => {
    it('i pezzi diventano quantità con il coefficiente e aggiornano il totale', () => {
        const v = applyPieces({ ...empty, price: '2' }, 0.72, '10');
        expect(v).toEqual({ pieces: '10', quantity: '7.20', price: '2', total: '14.40' });
    });

    it('la quantità ricava i pezzi; con coefficiente 1 restano uguali', () => {
        expect(applyQuantity(empty, 0.5, '10')).toMatchObject({ quantity: '10', pieces: '20.00' });
        expect(applyQuantity(empty, 1, '7')).toMatchObject({ quantity: '7', pieces: '7' });
    });

    it('un valore non numerico svuota quantità e totale', () => {
        expect(applyPieces({ pieces: '3', quantity: '3.00', price: '1', total: '3.00' }, 1, '')).toMatchObject({ quantity: '', total: '' });
    });

    it('le confezioni moltiplicano la quantità per confezione', () => {
        const v = applyPacks({ ...empty, price: '1.5' }, 1, 20, '3');
        expect(v).toMatchObject({ quantity: '60', pieces: '60', total: '90.00' });
        expect(packsFromQuantity('60', 20)).toBe(3);
        expect(packsFromQuantity('', 20)).toBeNull();
        expect(packsFromQuantity('60', null)).toBeNull();
    });

    it('il prezzo ricalcola il totale e il totale ricava il prezzo unitario', () => {
        const withQty = applyQuantity(empty, 1, '4');
        expect(applyPrice(withQty, '2.5').total).toBe('10.00');
        expect(applyTotal(withQty, '9')).toMatchObject({ price: '2.25000', total: '9' });
    });
});

describe('confronto del prezzo con il riferimento', () => {
    it('senza riferimento o prezzo non dice nulla', () => {
        expect(checkPrice({ price: 0, reference: 2 }).kind).toBe('none');
        expect(checkPrice({ price: 2, reference: null }).kind).toBe('none');
    });

    it('in linea, più alto, più basso', () => {
        expect(checkPrice({ price: 2.2, reference: 2 }).kind).toBe('ok');
        expect(checkPrice({ price: 3, reference: 2 })).toMatchObject({ kind: 'higher', message: expect.stringContaining('50%') });
        expect(checkPrice({ price: 1, reference: 2 })).toMatchObject({ kind: 'lower', message: expect.stringContaining('50%') });
    });

    it('riconosce il prezzo di una confezione intera e propone quello unitario', () => {
        const r = checkPrice({ price: 40, reference: 2, packQuantity: 20, unit: 'KG' });
        expect(r.kind).toBe('pack');
        expect(r.suggestedPrice).toBe(2);
    });

    it('con la confezione di 1 non lo scambia per prezzo a confezione', () => {
        expect(checkPrice({ price: 40, reference: 2, packQuantity: 1 }).kind).toBe('higher');
    });
});
