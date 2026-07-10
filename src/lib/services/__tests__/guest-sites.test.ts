import { generatePasscode } from '../guest-sites';

describe('generatePasscode', () => {
    it('should generate a passcode starting with OPI-', () => {
        const code = generatePasscode();
        expect(code.startsWith('OPI-')).toBe(true);
    });

    it('should generate a passcode with exactly 10 characters', () => {
        const code = generatePasscode();
        expect(code.length).toBe(10); // OPI- (4 chars) + 6 random chars = 10
    });

    it('should generate uppercase alfanumeric characters after the prefix', () => {
        const code = generatePasscode();
        const suffix = code.substring(4);
        expect(/^[A-Z0-9]{6}$/.test(suffix)).toBe(true);
    });

    it('should generate different codes on subsequent calls', () => {
        const code1 = generatePasscode();
        const code2 = generatePasscode();
        expect(code1).not.toBe(code2);
    });
});
