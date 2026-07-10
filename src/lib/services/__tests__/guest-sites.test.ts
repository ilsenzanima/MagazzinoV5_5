import { generatePasscode } from '../guest-sites';

describe('generatePasscode', () => {
    it('should generate a passcode starting with OPI-', () => {
        const code = generatePasscode();
        expect(code.startsWith('OPI-')).toBe(true);
    });

    it('should generate a passcode with exactly 12 characters', () => {
        const code = generatePasscode();
        expect(code.length).toBe(12); // OPI- (4 chars) + 8 random chars = 12
    });

    it('should generate uppercase alfanumeric characters after the prefix', () => {
        const code = generatePasscode();
        const suffix = code.substring(4);
        expect(/^[A-Z0-9]{8}$/.test(suffix)).toBe(true);
    });

    it('should generate different codes on subsequent calls', () => {
        const code1 = generatePasscode();
        const code2 = generatePasscode();
        expect(code1).not.toBe(code2);
    });
});
