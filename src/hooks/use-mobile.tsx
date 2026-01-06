import { useEffect, useState } from "react";

/**
 * Hook per rilevare il tipo di dispositivo basato su media queries
 * @returns {Object} - { isMobile, isTablet, isDesktop }
 */
export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);
    const [isTablet, setIsTablet] = useState(false);

    useEffect(() => {
        // Media queries per i breakpoint Tailwind
        const mobileQuery = window.matchMedia("(max-width: 767px)");
        const tabletQuery = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");

        // Funzione per aggiornare lo stato
        const updateDeviceType = () => {
            setIsMobile(mobileQuery.matches);
            setIsTablet(tabletQuery.matches);
        };

        // Imposta lo stato iniziale
        updateDeviceType();

        // Aggiungi listener per cambiamenti
        mobileQuery.addEventListener("change", updateDeviceType);
        tabletQuery.addEventListener("change", updateDeviceType);

        // Cleanup
        return () => {
            mobileQuery.removeEventListener("change", updateDeviceType);
            tabletQuery.removeEventListener("change", updateDeviceType);
        };
    }, []);

    return {
        isMobile,
        isTablet,
        isDesktop: !isMobile && !isTablet,
    };
}
