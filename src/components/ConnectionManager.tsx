"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase"; // Use singleton instance
import { useRouter } from "next/navigation";

export function ConnectionManager() {
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

        if (!sessionError && session) {
          // 2. If we have a session, check if token is close to expiry (e.g. within 5 mins)
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

        // 3. Network status check only (no DB query to avoid lag on navigation)
        if (!navigator.onLine) {
          setIsOnline(false);
        } else if (!isOnline) {
          setIsOnline(true);
          console.log("Connection restored");
        }

      } catch (err) {
        console.error("Connection check exception:", err);
      } finally {
        checkInProgress.current = false;
      }
    };

    // Run immediately on mount
    checkConnection();

    // Run every 120 seconds (optimized from 60s to reduce overhead)
    const intervalId = setInterval(checkConnection, 120000);

    // Only check on online/offline events, avoid aggressive focus checks
    const handleOnline = () => {
      console.log("Device online, checking connection...");
      checkConnection();
    }

    const handleOffline = () => {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []); // Empty dependency array - effect runs once on mount

  // This component is invisible
  return null;
}
