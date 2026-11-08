"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import DashboardLayout from "@/components/layout/DashboardLayout";
import WorkerDetailContent from "./components/worker-detail-content";
import { Loader2, AlertCircle } from "lucide-react";
import { Worker, workersApi } from "@/lib/api";

export default function WorkerPage() {
    const { id } = useParams<{ id: string }>();
    const { userRole } = useAuth();
    const router = useRouter();
    // L'utente semplice vede solo l'elenco degli operai, non le schede
    useEffect(() => {
        if (userRole === "user") router.replace("/workers");
    }, [userRole, router]);
    const [worker, setWorker] = useState<Worker | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        const load = async () => {
            try {
                setLoading(true);
                const data = await workersApi.getById(id);
                setWorker(data);
            } catch (e: any) {
                setError(e.message || "Impossibile recuperare i dati dell'operaio.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    return (
        <DashboardLayout>
            {userRole === "user" ? null : loading ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center p-8 text-red-500">
                    <AlertCircle className="h-8 w-8 mb-2" />
                    <p className="font-semibold">Errore</p>
                    <p>{error}</p>
                </div>
            ) : worker ? (
                <WorkerDetailContent worker={worker} />
            ) : null}
        </DashboardLayout>
    );
}
