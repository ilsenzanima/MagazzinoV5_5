"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SupplierOffers } from "@/components/shared/SupplierOffers"
import { JobOrdini } from "@/components/jobs/details/JobOrdini"

interface Props {
    jobId: string
    jobCode?: string
}

export function JobOrdiniDocumenti({ jobId, jobCode }: Props) {
    return (
        <Tabs defaultValue="offerte" className="space-y-4">
            <TabsList>
                <TabsTrigger value="offerte">Offerte Fornitori</TabsTrigger>
                <TabsTrigger value="conferme">Conferme d&apos;ordine</TabsTrigger>
            </TabsList>

            <TabsContent value="offerte" className="space-y-4">
                <SupplierOffers jobId={jobId} />
            </TabsContent>

            <TabsContent value="conferme" className="space-y-4">
                <JobOrdini jobId={jobId} jobCode={jobCode} />
            </TabsContent>
        </Tabs>
    )
}
