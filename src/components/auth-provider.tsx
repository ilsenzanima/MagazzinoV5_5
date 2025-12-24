"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { fetchWithTimeout } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  userRole: 'admin' | 'user' | 'operativo' | null;
  realRole: 'admin' | 'user' | 'operativo' | null; // The actual role from DB
  simulatedRole: 'admin' | 'user' | 'operativo' | null; // The role being simulated
  setSimulatedRole: (role: 'admin' | 'user' | 'operativo' | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  userRole: null,
  realRole: null,
  simulatedRole: null,
  setSimulatedRole: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [realRole, setRealRole] = useState<'admin' | 'user' | 'operativo' | null>(null);
  const [simulatedRole, setSimulatedRole] = useState<'admin' | 'user' | 'operativo' | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Effective role is simulatedRole if present, otherwise realRole
  const userRole = simulatedRole || realRole;

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await fetchWithTimeout(
        supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single()
      );
      
      if (data) {
        setRealRole(data.role as 'admin' | 'user' | 'operativo');
      } else {
        setRealRole('user');
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
      setRealRole('user');
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUserRole(session.user.id);
        } else {
            setRealRole(null);
            setSimulatedRole(null);
        }
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
             await fetchUserRole(session.user.id);
        } else {
            setRealRole(null);
            setSimulatedRole(null);
        }

        setLoading(false);
        
        if (event === 'SIGNED_IN') {
             router.refresh();
        }
        if (event === 'SIGNED_OUT') {
             router.push('/login');
             router.refresh();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase]);

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
