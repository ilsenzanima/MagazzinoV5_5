import { LoadNote, LoadNoteItem } from "@/lib/types";

// Mock Data Store (In-memory for session, ideally localStorage if we want persistence across reloads)
let MOCK_NOTES: LoadNote[] = [
    {
        id: "1",
        date: new Date().toISOString().split('T')[0],
        noteType: "uscita",
        jobId: "job-1",
        jobCode: "2024-001",
        jobDescription: "Ristrutturazione Villa Rossi",
        notes: "Materiale urgente per tubature",
        status: "pending",
        items: [
            {
                id: "item-1",
                inventoryId: "inv-1",
                inventoryName: "Tubo PVC Ø32",
                inventoryUnit: "m",
                quantity: 50,
                isChecked: false
            },
            {
                id: "item-2",
                inventoryId: "inv-2",
                inventoryName: "Curva 90° PVC Ø32",
                inventoryUnit: "pz",
                quantity: 10,
                isChecked: false
            }
        ],
        createdBy: "user-1",
        createdByName: "Mario Rossi",
        createdAt: new Date().toISOString()
    },
    {
        id: "2",
        date: "2024-01-15",
        noteType: "reso",
        jobId: "job-2",
        jobCode: "2024-002",
        jobDescription: "Nuovo Impianto Elettrico Bianchi",
        notes: "",
        status: "completed",
        items: [
            {
                id: "item-3",
                inventoryId: "inv-3",
                inventoryName: "Cavo FS17 1x2.5",
                inventoryUnit: "m",
                quantity: 100,
                isChecked: true
            }
        ],
        createdBy: "user-2",
        createdByName: "Luigi Verdi",
        createdAt: "2024-01-15T10:00:00Z"
    }
];

export const loadNotesService = {
    getAll: async (filters?: { search?: string; status?: string; jobId?: string }) => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        let results = [...MOCK_NOTES];

        if (filters?.jobId) {
            results = results.filter(n => n.jobId === filters.jobId);
        }

        if (filters?.status) {
            results = results.filter(n => n.status === filters.status);
        }

        if (filters?.search) {
            const searchLower = filters.search.toLowerCase();
            results = results.filter(n =>
                n.jobCode?.toLowerCase().includes(searchLower) ||
                n.jobDescription?.toLowerCase().includes(searchLower) ||
                n.notes?.toLowerCase().includes(searchLower) ||
                n.items.some(i => i.inventoryName.toLowerCase().includes(searchLower))
            );
        }

        // Sort: Pending first, then by date desc
        return results.sort((a, b) => {
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
    },

    getById: async (id: string) => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return MOCK_NOTES.find(n => n.id === id);
    },

    create: async (note: Omit<LoadNote, "id" | "createdAt" | "status">) => {
        await new Promise(resolve => setTimeout(resolve, 600));

        const newNote: LoadNote = {
            ...note,
            id: Math.random().toString(36).substr(2, 9),
            status: "pending",
            createdAt: new Date().toISOString()
        };

        MOCK_NOTES = [newNote, ...MOCK_NOTES];
        return newNote;
    },

    update: async (id: string, updates: Partial<LoadNote>) => {
        await new Promise(resolve => setTimeout(resolve, 400));

        MOCK_NOTES = MOCK_NOTES.map(n =>
            n.id === id ? { ...n, ...updates } : n
        );
        return MOCK_NOTES.find(n => n.id === id);
    },

    delete: async (id: string) => {
        await new Promise(resolve => setTimeout(resolve, 400));
        MOCK_NOTES = MOCK_NOTES.filter(n => n.id !== id);
    },

    toggleStatus: async (id: string, currentStatus: string) => {
        await new Promise(resolve => setTimeout(resolve, 300));
        const newStatus = currentStatus === 'pending' ? 'completed' : 'pending';

        MOCK_NOTES = MOCK_NOTES.map(n =>
            n.id === id ? { ...n, status: newStatus as any } : n
        );
        return MOCK_NOTES.find(n => n.id === id);
    }
};
