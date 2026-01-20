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
        const handler = (e: Event) => {
            // Prevent Chrome from showing the default prompt
            e.preventDefault();
            // Save the event for later
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setShowButton(true);
            console.log('[PWA] Install prompt available');
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('[PWA] App is already installed');
            setShowButton(false);
        }

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
