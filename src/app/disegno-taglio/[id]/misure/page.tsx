import SiteMeasurementTool from "@/components/cutting-simulator/SiteMeasurementTool";

export const metadata = {
    title: "Rilievo Misure Cantiere | Magazzino V5.5",
    description: "Strumento mobile per il rilievo rapido di stanze e condotte in cantiere",
};

export default async function MisurePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <SiteMeasurementTool projectId={id} />;
}
