import { parseQuantityExpression } from '../quantity-expression';

const secchi = { packQuantity: 12, coefficient: 1, unit: 'PZ' };
const lastre = { packQuantity: null, coefficient: 3, unit: 'MQ' };

describe('calcolatrice delle quantità', () => {
    it('somma confezioni e pezzi', () => {
        const r = parseQuantityExpression('2 conf + 3 pz', secchi);
        expect(r).toMatchObject({ ok: true, quantity: 27, pieces: 27 });
        expect(r.parts).toEqual(['2 conf = 24 PZ', '+ 3 pz = 3 PZ']);
    });

    it('sottrae pezzi dalle confezioni', () => {
        expect(parseQuantityExpression('3 scatole - 1 pz', secchi)).toMatchObject({ ok: true, quantity: 35 });
        expect(parseQuantityExpression('3 CONF-1PZ', secchi)).toMatchObject({ ok: true, quantity: 35 });
    });

    it('senza unità sono pezzi, con il coefficiente', () => {
        expect(parseQuantityExpression('4', lastre)).toMatchObject({ ok: true, quantity: 12, pieces: 4 });
        expect(parseQuantityExpression('4 pz + 1,5 mq', lastre)).toMatchObject({ ok: true, quantity: 13.5, pieces: 4.5 });
    });

    it('accetta direttamente l\'unità dell\'articolo', () => {
        expect(parseQuantityExpression('5 kg', { packQuantity: 20, coefficient: 1, unit: 'KG' })).toMatchObject({ ok: true, quantity: 5 });
        expect(parseQuantityExpression('1,5 conf', { packQuantity: 20, coefficient: 1, unit: 'KG' })).toMatchObject({ ok: true, quantity: 30 });
    });

    it('segnala gli errori invece di indovinare', () => {
        expect(parseQuantityExpression('2 conf', lastre)).toMatchObject({ ok: false, error: expect.stringContaining('confezione') });
        expect(parseQuantityExpression('2 banane', secchi)).toMatchObject({ ok: false, error: expect.stringContaining('banane') });
        expect(parseQuantityExpression('1 conf - 20 pz', secchi)).toMatchObject({ ok: false, error: expect.stringContaining('zero') });
        expect(parseQuantityExpression('', secchi)).toMatchObject({ ok: false, error: '' });
        expect(parseQuantityExpression('abc', secchi).ok).toBe(false);
    });
});
