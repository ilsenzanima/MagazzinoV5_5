import { parseSearchWords, fetchWithTimeout } from '../utils';

const thenable = <T>(fn: () => T | Promise<T>): PromiseLike<T> => ({
    then: <TResult1, TResult2>(
        onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) => Promise.resolve().then(fn).then(onfulfilled, onrejected),
});

describe('fetchWithTimeout', () => {
    it('resolves with the result on first success', async () => {
        const query = thenable(() => ({ data: [1, 2], error: null }));
        await expect(fetchWithTimeout(query)).resolves.toEqual({ data: [1, 2], error: null });
    });

    it('retries a query-level network error and succeeds on the next attempt', async () => {
        let calls = 0;
        const query = thenable(() => {
            calls += 1;
            if (calls === 1) return { data: null, error: { message: 'TypeError: Failed to fetch' } };
            return { data: ['ok'], error: null };
        });
        await expect(fetchWithTimeout(query)).resolves.toEqual({ data: ['ok'], error: null });
        expect(calls).toBe(2);
    });

    it('retries a thrown network error and succeeds on the next attempt', async () => {
        let calls = 0;
        const query = thenable(() => {
            calls += 1;
            if (calls === 1) throw new Error('NetworkError when attempting to fetch resource');
            return { data: ['ok'], error: null };
        });
        await expect(fetchWithTimeout(query)).resolves.toEqual({ data: ['ok'], error: null });
        expect(calls).toBe(2);
    });

    it('does not retry a non-network (application) error', async () => {
        let calls = 0;
        const query = thenable(() => {
            calls += 1;
            return { data: null, error: { message: 'permission denied for table purchases' } };
        });
        await expect(fetchWithTimeout(query)).resolves.toEqual({
            data: null,
            error: { message: 'permission denied for table purchases' },
        });
        expect(calls).toBe(1);
    });

    it('gives up after exhausting retries on a persistent network error', async () => {
        let calls = 0;
        const query = thenable(() => {
            calls += 1;
            return { data: null, error: { message: 'Failed to fetch' } };
        });
        const result = await fetchWithTimeout(query, 30000, 2);
        expect(result).toEqual({ data: null, error: { message: 'Failed to fetch' } });
        expect(calls).toBe(3);
    });
});

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
