import { pageWindow } from '@/components/ui/pagination-controls';

describe('pageWindow', () => {
    it('poche pagine: tutte', () => expect(pageWindow(1, 3)).toEqual([1, 2, 3]));
    it('inizio: prime pagine, salto, ultima', () => expect(pageWindow(1, 13)).toEqual([1, 2, 3, 'gap', 13]));
    it('centro: prima, salto, vicine, salto, ultima', () => expect(pageWindow(7, 13)).toEqual([1, 'gap', 6, 7, 8, 'gap', 13]));
    it('fine: prima, salto, ultime pagine', () => expect(pageWindow(13, 13)).toEqual([1, 'gap', 11, 12, 13]));
});
