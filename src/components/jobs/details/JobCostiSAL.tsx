"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { JobWorkerCosts } from "./JobWorkerCosts"
import { JobSAL } from "./JobSAL"

interface JobCostiSALProps {
    jobId: string
    materialCost: number
}

export function JobCostiSAL({ jobId, materialCost }: JobCostiSALProps) {
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
                <JobSAL jobId={jobId} />
            </TabsContent>
        </Tabs>
    )
}
