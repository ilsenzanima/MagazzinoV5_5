
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { CalendarIcon, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
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
    date: z.string().min(1, "Seleziona una data"),
    hours: z.coerce.number().min(1, "Minimo 1 ora").max(24, "Massimo 24 ore"),
})

interface LeaveRequestFormProps {
    workers: Worker[]
    onSuccess?: () => void
}

export function LeaveRequestForm({ workers, onSuccess }: LeaveRequestFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            workerId: "",
            date: format(new Date(), "yyyy-MM-dd"), // Default today
            hours: 8,
        },
    })

    const workerOptions = workers.map(w => ({
        value: w.id,
        label: `${w.first_name} ${w.last_name || ''}`.trim(),
    }))

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsSubmitting(true)
        try {
            await leaveRequestsApi.create({
                workerId: values.workerId,
                date: values.date,
                hours: values.hours,
            })
            toast.success("Richiesta inviata con successo")
            form.reset({
                ...values,
                workerId: "", // Reset worker but keep date/hours maybe? Or reset all. Let's reset worker.
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Giorno</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
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
                                <FormLabel>Ore</FormLabel>
                                <FormControl>
                                    <Input type="number" min={1} max={24} {...field} />
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
