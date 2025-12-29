import DashboardLayout from "@/components/layout/DashboardLayout";

export default function AttendanceLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <DashboardLayout>
            {children}
        </DashboardLayout>
    );
}
