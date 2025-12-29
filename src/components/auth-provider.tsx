"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
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
  const STORAGE_KEY_ROLE_TS = 'fireblock_role_ts';
  const STORAGE_KEY_SIMULATED_ROLE = 'fireblock_simulated_role';
  const MIN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Effective role is simulatedRole if present, otherwise realRole
  const userRole = simulatedRole || realRole;

  // Refs for deduplication and freshness
  const fetchPromiseRef = useRef<Promise<any> | null>(null);
  const lastFetchedRef = useRef<number>(0);

  /* Ref to track if component is mounted to avoid React state update warnings */
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchUserRole = async (userId: string) => {
    // 1. Deduplication: If a fetch is already running, wait for it
    if (fetchPromiseRef.current) {
      return fetchPromiseRef.current;
    }

    // 2. Cache Check (Time-based)
    if (Date.now() - lastFetchedRef.current < MIN_CACHE_TTL) {
      console.log("Role checks skipped (Cache Fresh)");
      return;
    }

    // 3. LocalStorage Timestamp Check
    if (typeof window !== 'undefined') {
      const ts = localStorage.getItem(STORAGE_KEY_ROLE_TS);
      const savedRole = localStorage.getItem(STORAGE_KEY_ROLE);
      if (ts && savedRole && (Date.now() - Number(ts) < MIN_CACHE_TTL)) {
        console.log("Role cache valid from storage");
        lastFetchedRef.current = Number(ts);
        if (isMountedRef.current) setRealRole(savedRole as 'admin' | 'user' | 'operativo');
        return;
      }
    }

    const fetcher = async () => {
      try {
        console.log("Fetching user role for:", userId);
        // Timeout set to 15s to be safe, but no retries to prevent blocking UI for too long
        const { data, error } = await fetchWithTimeout(
          supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .maybeSingle(),
          15000
        );

        if (!isMountedRef.current) return;

        if (data) {
          const role = data.role as 'admin' | 'user' | 'operativo';
          setRealRole(role);

          if (typeof window !== 'undefined') {
            const oldRole = localStorage.getItem(STORAGE_KEY_ROLE);
            localStorage.setItem(STORAGE_KEY_ROLE, role);
            localStorage.setItem(STORAGE_KEY_ROLE_TS, Date.now().toString());
            lastFetchedRef.current = Date.now();

            if (oldRole !== role) {
              router.refresh();
            }
          }
        } else {
          // Default to user if no profile found
          setRealRole('user');
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_ROLE, 'user');
            localStorage.setItem(STORAGE_KEY_ROLE_TS, Date.now().toString());
            lastFetchedRef.current = Date.now();
          }
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        // Fallback to user on error to allow app usage
        if (isMountedRef.current && !realRole) setRealRole('user');
      } finally {
        fetchPromiseRef.current = null;
      }
    };

    fetchPromiseRef.current = fetcher();
    return fetchPromiseRef.current;
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // 1. Optimistic Load from Cache
        let cacheIsValid = false;
        if (typeof window !== 'undefined') {
          const cachedRole = localStorage.getItem(STORAGE_KEY_ROLE) as 'admin' | 'user' | 'operativo' | null;
          const cachedRoleTs = localStorage.getItem(STORAGE_KEY_ROLE_TS);
          const cachedSimulated = sessionStorage.getItem(STORAGE_KEY_SIMULATED_ROLE) as 'admin' | 'user' | 'operativo' | null;

          if (cachedRole) {
            setRealRole(cachedRole);
            if (cachedRoleTs) {
              lastFetchedRef.current = Number(cachedRoleTs);
              if (Date.now() - Number(cachedRoleTs) < MIN_CACHE_TTL) {
                cacheIsValid = true;
              }
            }
          }
          if (cachedSimulated) setSimulatedRole(cachedSimulated);
        }

        // 2. Get Session
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (initialSession?.user) {
          setSession(initialSession);
          setUser(initialSession.user);

          // Fetch will internally check if cache is fresh and skip if needed
          // But we double check here to prevent even the call attempt on mount
          if (!cacheIsValid) {
            fetchUserRole(initialSession.user.id);
          }
        } else {
          setSession(null);
          setUser(null);
          setRealRole(null);
          setSimulatedRole(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY_ROLE);
            localStorage.removeItem(STORAGE_KEY_ROLE_TS);
            sessionStorage.removeItem(STORAGE_KEY_SIMULATED_ROLE);
            lastFetchedRef.current = 0;
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
            // Check cache before fetching even on refresh
            let skipFetch = false;
            if (typeof window !== 'undefined') {
              const cachedRoleTs = localStorage.getItem(STORAGE_KEY_ROLE_TS);
              if (cachedRoleTs && (Date.now() - Number(cachedRoleTs) < MIN_CACHE_TTL)) {
                skipFetch = true;
                console.log("Token refreshed, but role cache is fresh. Skipping fetch.");
              }
            }

            if (!skipFetch) {
              await fetchUserRole(newSession.user.id);
            }
          } else {
            setRealRole(null);
            setSimulatedRole(null);
            if (typeof window !== 'undefined') {
              localStorage.removeItem(STORAGE_KEY_ROLE);
              localStorage.removeItem(STORAGE_KEY_ROLE_TS);
              sessionStorage.removeItem(STORAGE_KEY_SIMULATED_ROLE);
              lastFetchedRef.current = 0;
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
        localStorage.removeItem(STORAGE_KEY_ROLE_TS);
        sessionStorage.removeItem(STORAGE_KEY_SIMULATED_ROLE);
        lastFetchedRef.current = 0;
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
