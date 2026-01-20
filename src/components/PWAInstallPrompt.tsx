'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showButton, setShowButton] = useState(false);

    useEffect(() => {
        // Check if already running as standalone app (installed)
        const isStandaloneMode =
            window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches ||
            (window.navigator as any).standalone === true; // iOS Safari

        if (isStandaloneMode) {
            console.log('[PWA] App is running in standalone mode - hiding install button');
            setShowButton(false);
            return; // Don't set up install prompt if already installed
        }

        const handler = (e: Event) => {
            // Prevent Chrome from showing the default prompt
            e.preventDefault();
            // Save the event for later
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setShowButton(true);
            console.log('[PWA] Install prompt available');
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user's response
        const { outcome } = await deferredPrompt.userChoice;
        console.log('[PWA] User response:', outcome);

        // Clear the prompt
        setDeferredPrompt(null);
        setShowButton(false);
    };

    if (!showButton) return null;

    return (
        <Button
            onClick={handleInstall}
            variant="outline"
            size="sm"
            className="fixed bottom-4 right-4 z-50 shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
            <Download className="mr-2 h-4 w-4" />
            Installa App
        </Button>
    );
}
