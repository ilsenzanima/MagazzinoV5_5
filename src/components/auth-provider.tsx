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
  setSimulatedRole: () => { },
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
      console.log("Fetching user role for:", userId);
      // Increased timeout for role fetching to 5s (fail faster than 10s)
      const { data, error } = await fetchWithTimeout(
        supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle(),
        5000
      );

      if (data) {
        const role = data.role as 'admin' | 'user' | 'operativo';
        setRealRole(role);
        // Update cache
        if (typeof window !== 'undefined') {
          const oldRole = localStorage.getItem(STORAGE_KEY_ROLE);
          localStorage.setItem(STORAGE_KEY_ROLE, role);
          // Only refresh if role actually changed
          if (oldRole !== role) {
            router.refresh();
          }
        }
      } else {
        // Default to user if no profile
        setRealRole('user');
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_ROLE, 'user');
        }
      }
    } catch (error) {
      console.error(`Error fetching user role (attempts left: ${retries}):`, error);
      if (retries > 0) {
        const delay = Math.pow(2, 3 - retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchUserRole(userId, retries - 1);
      }
      // Fallback: keep existing role or default to 'user' if nothing set
      if (!realRole) setRealRole('user');
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // 1. Optimistic Load from Cache
        if (typeof window !== 'undefined') {
          const cachedRole = localStorage.getItem(STORAGE_KEY_ROLE) as 'admin' | 'user' | 'operativo' | null;
          const cachedSimulated = sessionStorage.getItem(STORAGE_KEY_SIMULATED_ROLE) as 'admin' | 'user' | 'operativo' | null;

          if (cachedRole) {
            console.log("Loaded role from cache:", cachedRole);
            setRealRole(cachedRole);
          }
          if (cachedSimulated) setSimulatedRole(cachedSimulated);
        }

        // 2. Get Session
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (initialSession?.user) {
          setSession(initialSession);
          setUser(initialSession.user);

          // Background fetch to ensure cache is fresh
          // Don't await this to unblock UI immediately
          fetchUserRole(initialSession.user.id);
        } else {
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

    // 3. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        // Always update session
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
          setSession(newSession);
          setUser(newSession?.user ?? null);

          if (newSession?.user) {
            const userIdChanged = user?.id !== newSession.user.id;
            // Fetch if user changed or it's a fresh login
            // (Optimistic initAuth handles the initial load, this handles updates)
            if (event === 'SIGNED_IN' || userIdChanged) {
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
