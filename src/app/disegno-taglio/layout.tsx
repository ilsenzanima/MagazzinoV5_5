import DashboardLayout from "@/components/layout/DashboardLayout";

export default function DisegnoTaglioLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <DashboardLayout>
            {children}
        </DashboardLayout>
    );
}
