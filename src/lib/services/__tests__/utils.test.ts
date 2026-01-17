import { parseSearchWords } from '../utils';

describe('parseSearchWords', () => {
    it('should return empty array for empty string', () => {
        expect(parseSearchWords('')).toEqual([]);
    });

    it('should return empty array for null/undefined', () => {
        expect(parseSearchWords(null as any)).toEqual([]);
        expect(parseSearchWords(undefined as any)).toEqual([]);
    });

    it('should split search term into words', () => {
        expect(parseSearchWords('rossi mario')).toEqual(['rossi', 'mario']);
    });

    it('should trim whitespace', () => {
        expect(parseSearchWords('  rossi  mario  ')).toEqual(['rossi', 'mario']);
    });

    it('should convert to lowercase', () => {
        expect(parseSearchWords('ROSSI Mario')).toEqual(['rossi', 'mario']);
    });

    it('should handle single word', () => {
        expect(parseSearchWords('rossi')).toEqual(['rossi']);
    });

    it('should handle multiple spaces between words', () => {
        expect(parseSearchWords('rossi    mario')).toEqual(['rossi', 'mario']);
    });
});
