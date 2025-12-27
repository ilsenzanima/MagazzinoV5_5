"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function ConnectionManager() {
  const supabase = createClient();
  const [isOnline, setIsOnline] = useState(true);
  const router = useRouter();
  const checkInProgress = useRef(false);

  useEffect(() => {
    // Function to check connection and verify session validity
    const checkConnection = async () => {
      if (checkInProgress.current) return;
      checkInProgress.current = true;

      try {
        // 1. Check Auth Session first (local check, very fast)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
            // If we are supposed to be logged in (we are in a protected route), this is bad.
            // But ConnectionManager runs everywhere.
            // We just log it for now, AuthProvider handles redirects.
            // console.debug("Session check: No active session");
        } else {
            // 2. If we have a session, check if token is close to expiry (e.g. within 5 mins)
            // Supabase auto-refreshes, but if the tab was sleeping, we might need to nudge it.
            const expiresAt = session.expires_at || 0;
            const now = Math.floor(Date.now() / 1000);
            const timeUntilExpiry = expiresAt - now;

            if (timeUntilExpiry < 300 && timeUntilExpiry > 0) {
                console.log(`Token expiring in ${timeUntilExpiry}s, refreshing...`);
                const { error: refreshError } = await supabase.auth.refreshSession();
                if (refreshError) {
                    console.warn("Manual token refresh failed:", refreshError);
                } else {
                    console.log("Token refreshed successfully");
                }
            }
        }

        // 3. Lightweight DB Ping (only if online)
        if (navigator.onLine) {
            const { error } = await supabase
              .from('inventory')
              .select('id')
              .limit(1)
              .maybeSingle(); // Use maybeSingle to avoid 406 errors on empty table

            if (error) {
              console.warn("DB Connection check failed:", error.message);
              // If error is related to Auth (JWT expired), try to recover
              if (error.message.includes('JWT') || error.code === 'PGRST301') {
                  console.error("JWT Error detected, attempting session refresh...");
                  await supabase.auth.refreshSession();
              }
              setIsOnline(false);
            } else {
              if (!isOnline) {
                console.log("Connection restored");
                setIsOnline(true);
              }
            }
        } else {
            setIsOnline(false);
        }

      } catch (err) {
        console.error("Connection check exception:", err);
        setIsOnline(false);
      } finally {
        checkInProgress.current = false;
      }
    };

    // Run immediately on mount
    checkConnection();

    // Run every 60 seconds (relaxed from 30s to reduce load)
    const intervalId = setInterval(checkConnection, 60000);

    // Run when tab becomes visible (user comes back from sleep/other tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("Tab visible, waking up connection...");
        checkConnection();
      }
    };

    // Run when device comes back online
    const handleOnline = () => {
        console.log("Device online, checking connection...");
        checkConnection();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", checkConnection);
    window.addEventListener("online", handleOnline);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", checkConnection);
      window.removeEventListener("online", handleOnline);
    };
  }, [supabase, isOnline]);

  // This component is invisible
  return null;
}
