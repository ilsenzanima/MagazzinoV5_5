"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { JobWorkerCosts } from "./JobWorkerCosts"
import { JobSAL } from "./JobSAL"
import { Movement } from "@/lib/api"

interface JobCostiSALProps {
    jobId: string
    materialCost: number
    movements: Movement[]
}

export function JobCostiSAL({ jobId, materialCost, movements }: JobCostiSALProps) {
    return (
        <Tabs defaultValue="costi" className="space-y-4">
            <TabsList>
                <TabsTrigger value="costi">Costi Totali</TabsTrigger>
                <TabsTrigger value="sal">SAL</TabsTrigger>
            </TabsList>

            <TabsContent value="costi" className="space-y-6 focus-visible:outline-none">
                <JobWorkerCosts jobId={jobId} materialCost={materialCost} />
            </TabsContent>

            <TabsContent value="sal" className="focus-visible:outline-none">
                <JobSAL jobId={jobId} movements={movements} />
            </TabsContent>
        </Tabs>
    )
}
