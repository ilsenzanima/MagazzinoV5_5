"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { toast } from "sonner"
import { Worker } from "@/lib/api"
import { leaveRequestsApi } from "@/lib/api"

const formSchema = z.object({
    workerId: z.string().min(1, "Seleziona un dipendente"),
    startDate: z.string().min(1, "Seleziona data inizio"),
    endDate: z.string().min(1, "Seleziona data fine"),
    hours: z.number().min(1, "Minimo 1 ora").max(24, "Massimo 24 ore"),
}).refine(data => new Date(data.endDate) >= new Date(data.startDate), {
    message: "La data fine deve essere uguale o successiva alla data inizio",
    path: ["endDate"],
})

interface LeaveRequestFormProps {
    workers: Worker[]
    onSuccess?: () => void
}

export function LeaveRequestForm({ workers, onSuccess }: LeaveRequestFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const today = format(new Date(), "yyyy-MM-dd")

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            workerId: "",
            startDate: today,
            endDate: today,
            hours: 8,
        },
    })

    // When startDate changes, update endDate to match if it's before startDate
    const startDate = form.watch("startDate")
    useEffect(() => {
        const currentEndDate = form.getValues("endDate")
        if (currentEndDate && new Date(currentEndDate) < new Date(startDate)) {
            form.setValue("endDate", startDate)
        }
    }, [startDate, form])

    const workerOptions = workers.map(w => ({
        value: w.id,
        label: `${w.firstName} ${w.lastName || ''}`.trim(),
    }))

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsSubmitting(true)
        try {
            await leaveRequestsApi.create({
                workerId: values.workerId,
                startDate: values.startDate,
                endDate: values.endDate,
                hours: values.hours,
            })
            toast.success("Richiesta inviata con successo")
            form.reset({
                workerId: "",
                startDate: today,
                endDate: today,
                hours: 8,
            })
            if (onSuccess) onSuccess()
        } catch (error) {
            console.error(error)
            toast.error("Errore durante l'invio della richiesta")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 bg-white dark:bg-card p-6 rounded-lg shadow-sm border dark:border-border">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Data Inizio</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Data Fine</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} min={startDate} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="hours"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Ore (per giorno)</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={24}
                                        value={field.value}
                                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                                        onBlur={field.onBlur}
                                        name={field.name}
                                        ref={field.ref}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="workerId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Dipendente</FormLabel>
                                <FormControl>
                                    <SearchableSelect
                                        options={workerOptions}
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        placeholder="Seleziona dipendente..."
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Richiedi Permesso
                </Button>
            </form>
        </Form>
    )
}
