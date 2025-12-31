import { supabase } from '@/lib/supabase';
import { User } from '@/lib/types';

export const mapDbProfileToUser = (profile: any): User => {
    const role = (profile.role || 'user') as 'admin' | 'user' | 'operativo';
    let avatarFile = 'user.png';

    if (role === 'admin') avatarFile = 'admin.png';
    else if (role === 'operativo') avatarFile = 'operativo.png';

    return {
        id: profile.id,
        name: profile.full_name || profile.email?.split('@')[0] || 'Utente',
        email: profile.email || '',
        role: role,
        // Use role-based avatar instead of user uploaded one
        avatar: `/avatars/${avatarFile}`,
        status: 'active', // Default value as it's not in profiles table
        lastLogin: profile.updated_at // Using updated_at as proxy for now
    };
};

export const usersApi = {
    getAll: async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data.map(mapDbProfileToUser);
    },

    updateRole: async (id: string, role: 'admin' | 'user' | 'operativo') => {
        const { data, error } = await supabase
            .from('profiles')
            .update({ role })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return mapDbProfileToUser(data);
    },

    delete: async (id: string) => {
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
