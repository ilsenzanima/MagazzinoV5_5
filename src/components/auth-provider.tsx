"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase"; // Use singleton instance
import { useRouter } from "next/navigation";
import { fetchWithTimeout } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<{ error: AuthError | null }>;
  userRole: 'admin' | 'user' | 'operativo' | null;
  realRole: 'admin' | 'user' | 'operativo' | null; // The actual role from DB
  simulatedRole: 'admin' | 'user' | 'operativo' | null; // The role being simulated
  setSimulatedRole: (role: 'admin' | 'user' | 'operativo' | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => ({ error: null }),
  userRole: null,
  realRole: null,
  simulatedRole: null,
  setSimulatedRole: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Use singleton instance instead of creating new one
  // const [supabase] = useState(() => createClient()); 
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [realRole, setRealRole] = useState<'admin' | 'user' | 'operativo' | null>(null);
  const [simulatedRole, setSimulatedRole] = useState<'admin' | 'user' | 'operativo' | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Effective role is simulatedRole if present, otherwise realRole
  const userRole = simulatedRole || realRole;

  const fetchUserRole = async (userId: string, retries = 3) => {
    try {
      // Increased timeout for role fetching (critical operation)
      // and use maybeSingle() instead of single() to avoid errors on missing rows
      const { data, error } = await fetchWithTimeout(
        supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle(),
        10000 // 10 seconds timeout for this critical call
      );
      
      if (data) {
        setRealRole(data.role as 'admin' | 'user' | 'operativo');
      } else {
        // If profile doesn't exist yet (e.g. just registered), default to user
        setRealRole('user');
      }
    } catch (error) {
      console.error(`Error fetching user role (attempts left: ${retries}):`, error);
      if (retries > 0) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, 3 - retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchUserRole(userId, retries - 1);
      }
      // Non resettiamo il ruolo in caso di errore per preservare la sessione
      // durante i refresh del token in background
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // 1. Prendi la sessione iniziale
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (initialSession?.user) {
          setSession(initialSession);
          setUser(initialSession.user);
          await fetchUserRole(initialSession.user.id);
        } else {
            // Se non c'è sessione, puliamo tutto subito
            setSession(null);
            setUser(null);
            setRealRole(null);
            setSimulatedRole(null);
        }
      } catch (error) {
        console.error("Auth init error:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // 2. Ascolta i cambiamenti
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;
        
        // Aggiorna solo se la sessione è effettivamente cambiata o è un evento di Sign In/Out esplicito
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
            setSession(newSession);
            setUser(newSession?.user ?? null);
            
            if (newSession?.user) {
                await fetchUserRole(newSession.user.id);
            } else {
                setRealRole(null);
                setSimulatedRole(null);
            }
            
            if (event === 'SIGNED_IN') router.refresh();
            if (event === 'SIGNED_OUT') {
                router.push('/login'); 
                router.refresh();
            }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const value = {
    user,
    session,
    loading,
    signOut: async () => await supabase.auth.signOut(),
    userRole,
    realRole,
    simulatedRole,
    setSimulatedRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
