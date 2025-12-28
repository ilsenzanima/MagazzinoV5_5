"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { Worker, workersApi } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const formSchema = z.object({
    firstName: z.string().min(2, "Il nome deve avere almeno 2 caratteri"),
    lastName: z.string().min(2, "Il cognome deve avere almeno 2 caratteri"),
    email: z.string().email("Inserisci un'email valida"),
});

interface WorkerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workerToEdit?: Worker | null;
    onSuccess: () => void;
}

export function WorkerDialog({
    open,
    onOpenChange,
    workerToEdit,
    onSuccess,
}: WorkerDialogProps) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
        },
    });

    useEffect(() => {
        if (workerToEdit) {
            form.reset({
                firstName: workerToEdit.firstName,
                lastName: workerToEdit.lastName,
                email: workerToEdit.email || "",
            });
        } else {
            form.reset({
                firstName: "",
                lastName: "",
                email: "",
            });
        }
    }, [workerToEdit, form, open]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            setLoading(true);
            if (workerToEdit) {
                await workersApi.update(workerToEdit.id, values);
                toast({
                    title: "Operaio aggiornato",
                    description: "I dati dell'operaio sono stati aggiornati con successo.",
                });
            } else {
                await workersApi.create({ ...values, isActive: true });
                toast({
                    title: "Operaio creato",
                    description: "Il nuovo operaio è stato aggiunto al sistema.",
                });
            }
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Errore",
                description: "Si è verificato un errore durante il salvataggio.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        {workerToEdit ? "Modifica Operaio" : "Nuovo Operaio"}
                    </DialogTitle>
                    <DialogDescription>
                        Inserisci i dati anagrafici dell'operaio.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="firstName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Mario" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="lastName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cognome</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Rossi" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input placeholder="mario.rossi@example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {workerToEdit ? "Salva Modifiche" : "Crea Operaio"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
