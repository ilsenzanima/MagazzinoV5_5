import { CuttingSimulatorClient } from "@/components/cutting-simulator/CuttingSimulatorClient";

export const metadata = {
    title: "Disegno e Taglio | Magazzino V5.5",
    description: "Simulatore di taglio e progettazione condotte per ottimizzare l'uso del materiale",
};

export default function DisegnoTaglioPage() {
    return <CuttingSimulatorClient />;
}
