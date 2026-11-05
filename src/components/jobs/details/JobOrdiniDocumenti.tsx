"use client"

import { useState } from "react"
import { FileText, ShoppingCart } from "lucide-react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { NotchTabs } from "@/components/ui/notch-tabs"
import { SupplierOffers } from "@/components/shared/SupplierOffers"
import { JobOrdini } from "@/components/jobs/details/JobOrdini"

interface Props {
    jobId: string
    jobCode?: string
    jobLabel?: string
}

export function JobOrdiniDocumenti({ jobId, jobCode, jobLabel }: Props) {
    const [tab, setTab] = useState("offerte")
    return (
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <NotchTabs
                title="Ordini"
                value={tab}
                onValueChange={setTab}
                items={[
                    { value: "offerte", label: "Offerte Fornitori", icon: <FileText /> },
                    { value: "conferme", label: "Conferme d'ordine", icon: <ShoppingCart /> },
                ]}
            >
                <TabsContent value="offerte" className="space-y-4">
                    <SupplierOffers jobId={jobId} jobLabel={jobLabel} inStrip />
                </TabsContent>

                <TabsContent value="conferme" className="space-y-4">
                    <JobOrdini jobId={jobId} jobCode={jobCode} />
                </TabsContent>
            </NotchTabs>
        </Tabs>
    )
}
