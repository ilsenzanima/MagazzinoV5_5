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

  // Cache keys
  const STORAGE_KEY_ROLE = 'fireblock_user_role';
  const STORAGE_KEY_SIMULATED_ROLE = 'fireblock_simulated_role';

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
        const role = data.role as 'admin' | 'user' | 'operativo';
        setRealRole(role);
        // Update cache
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_ROLE, role);
        }
      } else {
        // If profile doesn't exist yet (e.g. just registered), default to user
        setRealRole('user');
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_ROLE, 'user');
        }
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
    // Track if we've just fetched to avoid double calls
    let justFetched = false;

    const initAuth = async () => {
      try {
        // 1. Prendi la sessione iniziale
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        // Try to load from cache first for immediate feedback
        if (typeof window !== 'undefined') {
          const cachedRole = localStorage.getItem(STORAGE_KEY_ROLE) as 'admin' | 'user' | 'operativo' | null;
          const cachedSimulated = sessionStorage.getItem(STORAGE_KEY_SIMULATED_ROLE) as 'admin' | 'user' | 'operativo' | null;
          
          if (cachedRole) setRealRole(cachedRole);
          if (cachedSimulated) setSimulatedRole(cachedSimulated);
        }

        if (initialSession?.user) {
          setSession(initialSession);
          setUser(initialSession.user);
          
          // Background fetch to update cache/state if changed
          justFetched = true;
          fetchUserRole(initialSession.user.id).finally(() => {
             // Reset flag after a reasonable time or immediately? 
             // actually justFetched is local to the effect scope but shared with the closure?
             // No, initAuth is called once. 
             // We need to signal to the subscription.
             setTimeout(() => { justFetched = false; }, 2000);
          });
        } else {
            // Se non c'è sessione, puliamo tutto subito
            setSession(null);
            setUser(null);
            setRealRole(null);
            setSimulatedRole(null);
            if (typeof window !== 'undefined') {
              localStorage.removeItem(STORAGE_KEY_ROLE);
              sessionStorage.removeItem(STORAGE_KEY_SIMULATED_ROLE);
            }
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
                // Skip if we just fetched in initAuth (prevent double fetch on load)
                if (!justFetched) {
                  await fetchUserRole(newSession.user.id);
                }
            } else {
                setRealRole(null);
                setSimulatedRole(null);
                if (typeof window !== 'undefined') {
                  localStorage.removeItem(STORAGE_KEY_ROLE);
                  sessionStorage.removeItem(STORAGE_KEY_SIMULATED_ROLE);
                }
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

  // Update simulated role persistence
  const updateSimulatedRole = (role: 'admin' | 'user' | 'operativo' | null) => {
    setSimulatedRole(role);
    if (typeof window !== 'undefined') {
      if (role) {
        sessionStorage.setItem(STORAGE_KEY_SIMULATED_ROLE, role);
      } else {
        sessionStorage.removeItem(STORAGE_KEY_SIMULATED_ROLE);
      }
    }
  };

  const value = {
    user,
    session,
    loading,
    signOut: async () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY_ROLE);
        sessionStorage.removeItem(STORAGE_KEY_SIMULATED_ROLE);
      }
      return await supabase.auth.signOut();
    },
    userRole,
    realRole,
    simulatedRole,
    setSimulatedRole: updateSimulatedRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
