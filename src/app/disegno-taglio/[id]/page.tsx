import DashboardLayout from "@/components/layout/DashboardLayout";
import { ProjectInfoClient } from "@/components/cutting-simulator/ProjectInfoClient";

export const metadata = {
    title: "Info Progetto | Magazzino V5.5",
    description: "Riepilogo e gestione del progetto di taglio",
};

export default async function DisegnoTaglioPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <DashboardLayout>
            <ProjectInfoClient id={id} />
        </DashboardLayout>
    );
}
