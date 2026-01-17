/**
 * Toast Notification Utilities
 * 
 * Centralized toast notifications to replace alert() calls.
 * Provides success, error, warning, and info toast variants.
 */

import { toast } from "@/components/ui/use-toast";

export const notify = {
    /**
     * Show a success toast (green)
     */
    success: (message: string, title?: string) => {
        toast({
            title: title || "Successo",
            description: message,
            variant: "default",
            className: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
        });
    },

    /**
     * Show an error toast (red)
     */
    error: (message: string, title?: string) => {
        toast({
            title: title || "Errore",
            description: message,
            variant: "destructive",
        });
    },

    /**
     * Show a warning toast (amber)
     */
    warning: (message: string, title?: string) => {
        toast({
            title: title || "Attenzione",
            description: message,
            variant: "default",
            className: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",
        });
    },

    /**
     * Show an info toast (blue)
     */
    info: (message: string, title?: string) => {
        toast({
            title: title,
            description: message,
            variant: "default",
        });
    },
};

// Export individual functions for convenience
export const { success, error, warning, info } = notify;
