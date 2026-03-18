"use client";

import React, { useState, useEffect } from "react";
import { ProjectInfoView } from "@/components/cutting-simulator/ProjectInfoView";
import { defaultProject, migrateProject, type DuctProject } from "@/lib/cutting-simulator/project-model";

interface ProjectInfoClientProps {
    id: string;
}

export function ProjectInfoClient({ id }: ProjectInfoClientProps) {
    const [project, setProject] = useState<DuctProject | null>(null);

    useEffect(() => {
        // In un caso reale, caricherebbe da Supabase usando l'id
        // Per ora usiamo il progetto di default migrato
        const initial = migrateProject({
            ...defaultProject(),
            id: id,
            name: id === "demo" ? "APT Gorizia - Taglio Canala Principale" : "Nuovo Progetto",
            jobCode: id === "demo" ? "2026-03-APT" : undefined,
            description: "Riepilogo del progetto di taglio per la commessa specificata."
        } as DuctProject);
        
        setProject(initial);
    }, [id]);

    if (!project) return null;

    return <ProjectInfoView project={project} projectId={id} />;
}
