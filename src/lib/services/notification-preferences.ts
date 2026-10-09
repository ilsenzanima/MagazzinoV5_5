import { supabase } from '@/lib/supabase';

export interface NotificationPreferences {
    lowStock: boolean;
    outOfStock: boolean;
    expiringCourses: boolean;
    expiringMedicalExams: boolean;
}

// Valori usati finché l'utente non salva nulla (la riga in tabella non esiste).
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
    lowStock: true,
    outOfStock: true,
    expiringCourses: true,
    expiringMedicalExams: true,
};

interface PreferencesRow {
    low_stock: boolean;
    out_of_stock: boolean;
    expiring_courses: boolean;
    expiring_medical_exams: boolean;
}

const mapDbToPreferences = (db: PreferencesRow): NotificationPreferences => ({
    lowStock: db.low_stock,
    outOfStock: db.out_of_stock,
    expiringCourses: db.expiring_courses,
    expiringMedicalExams: db.expiring_medical_exams,
});

export const notificationPreferencesApi = {
    // Preferenze dell'utente; se non ne ha mai salvate restituisce i default
    get: async (userId: string): Promise<NotificationPreferences> => {
        const { data, error } = await supabase
            .from('user_notification_preferences')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;
        return data ? mapDbToPreferences(data) : DEFAULT_NOTIFICATION_PREFERENCES;
    },

    // Salva tutte le preferenze (crea la riga alla prima volta)
    save: async (userId: string, prefs: NotificationPreferences): Promise<void> => {
        const { error } = await supabase
            .from('user_notification_preferences')
            .upsert({
                user_id: userId,
                low_stock: prefs.lowStock,
                out_of_stock: prefs.outOfStock,
                expiring_courses: prefs.expiringCourses,
                expiring_medical_exams: prefs.expiringMedicalExams,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

        if (error) throw error;
    },
};
