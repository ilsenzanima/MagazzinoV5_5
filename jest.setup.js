import '@testing-library/jest-dom';

// Mock Supabase client
jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            ilike: jest.fn().mockReturnThis(),
            or: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockReturnThis(),
            single: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockReturnThis(),
        })),
        rpc: jest.fn(),
        storage: {
            from: jest.fn(() => ({
                upload: jest.fn(),
                getPublicUrl: jest.fn(),
            })),
        },
        auth: {
            getSession: jest.fn(),
            getUser: jest.fn(),
        },
    },
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/',
}));

// Suppress console errors in tests unless explicitly needed
const originalError = console.error;
beforeAll(() => {
    console.error = (...args) => {
        if (
            typeof args[0] === 'string' &&
            args[0].includes('Warning: ReactDOM.render')
        ) {
            return;
        }
        originalError.call(console, ...args);
    };
});

afterAll(() => {
    console.error = originalError;
});
