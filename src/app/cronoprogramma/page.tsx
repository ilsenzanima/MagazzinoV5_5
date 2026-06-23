import DashboardLayout from "@/components/layout/DashboardLayout";
import { CronoprogrammaGlobalView } from "@/components/jobs/cronoprogramma/CronoprogrammaGlobalView";

export default function CronoprogrammaPage() {
    return (
        <DashboardLayout>
            <CronoprogrammaGlobalView />
        </DashboardLayout>
    );
}
