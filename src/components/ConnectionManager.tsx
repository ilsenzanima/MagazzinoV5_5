"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function ConnectionManager() {
  const supabase = createClient();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Function to check connection and warm up the database/session
    const checkConnection = async () => {
      try {
        // Simple lightweight query to wake up the connection
        const { error } = await supabase
          .from('inventory')
          .select('id')
          .limit(1);

        if (error) {
          console.warn("Connection check failed:", error.message);
          setIsOnline(false);
          
          // Attempt to refresh session if it's an auth error
          // This is handled automatically by supabase-js mostly, but we can force a check
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
            console.warn("Session issue detected during connection check");
          }
        } else {
          if (!isOnline) {
            console.log("Connection restored");
            setIsOnline(true);
          }
        }
      } catch (err) {
        console.error("Connection check exception:", err);
        setIsOnline(false);
      }
    };

    // Run immediately on mount
    checkConnection();

    // Run every 30 seconds
    const intervalId = setInterval(checkConnection, 30000);

    // Run when tab becomes visible (user comes back)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("Tab visible, checking connection...");
        checkConnection();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", checkConnection);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", checkConnection);
    };
  }, [supabase, isOnline]);

  // This component is invisible
  return null;
}
