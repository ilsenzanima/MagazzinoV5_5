import DashboardLayout from "@/components/layout/DashboardLayout";
import { SinglePieceCalculator } from "@/components/cutting-simulator/SinglePieceCalculator";

export const metadata = {
    title: "Calcolatore Pezzi Singoli | Magazzino V5.5",
    description: "Calcolatore rapido per canali dritti, gomiti e pezzi piatti con ottimizzazione del taglio",
};

export default function SinglePiecePage() {
    return (
        <DashboardLayout>
            <SinglePieceCalculator />
        </DashboardLayout>
    );
}
