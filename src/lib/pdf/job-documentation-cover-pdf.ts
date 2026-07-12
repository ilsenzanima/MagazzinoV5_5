import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { CoverPdfJobInfo, CoverPdfSection } from "@/lib/zip/documentation-zip-types";

// Genera il PDF di copertina/indice dello zip "documentazione completa": intestazione in
// stile bolle interne OPI, dati della commessa, e il contenuto diviso in capitoli (un
// capitolo per macro-categoria, una sottovoce per gruppo/cartella) navigabile come un manuale
// tramite i segnalibri nativi del PDF (pannello indice del lettore, es. Adobe Acrobat/Reader).
// Ogni documento ha inoltre un link relativo che apre direttamente il file dentro lo zip una
// volta estratto (funziona nei lettori che risolvono i link relativi; negli altri resta
// comunque leggibile il nome/percorso del file).
export async function buildCoverPdfBlob(job: CoverPdfJobInfo, sections: CoverPdfSection[]): Promise<Blob> {
    const { default: jsPDF } = await import("jspdf");

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;
    const bottomLimit = pageHeight - 16;

    const grayBg: [number, number, number] = [245, 245, 245];
    const borderColor: [number, number, number] = [180, 180, 180];
    const primaryColor: [number, number, number] = [200, 60, 30];

    // --- Intestazione (logo + dati aziendali, stile bolle interne) ---
    try {
        const logoUrl = "/logo_header.png";
        const logoData = await fetch(logoUrl)
            .then((res) => res.blob())
            .then(
                (blob) =>
                    new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    })
            );
        doc.addImage(logoData as string, "PNG", 60, 8, 90, 22);
    } catch {
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("OPI Firesafe", pageWidth / 2, 20, { align: "center" });
    }

    doc.setFontSize(7);
    doc.setTextColor(80);
    doc.setFont("helvetica", "normal");
    doc.text("Via G. Galilei, 8 Fraz. Feletto Umberto 33010 TAVAGNACCO (UD)", pageWidth - margin, 36, { align: "right" });
    doc.text("Tel. 0432-1901608 - email: amministrazione@opifiresafe.com", pageWidth - margin, 39, { align: "right" });

    let y = 46;
    doc.setDrawColor(...borderColor);
    doc.setFillColor(...grayBg);
    doc.roundedRect(margin, y, contentWidth, 6, 1, 1, "FD");
    doc.setFontSize(8);
    doc.setTextColor(50);
    doc.setFont("helvetica", "bold");
    doc.text("DOCUMENTAZIONE COMPLETA COMMESSA", margin + 2, y + 4.2);
    y += 6;

    const periodText =
        job.startDate || job.endDate
            ? `Periodo: ${job.startDate ? format(new Date(job.startDate), "dd/MM/yyyy", { locale: it }) : "N/D"} - ${job.endDate ? format(new Date(job.endDate), "dd/MM/yyyy", { locale: it }) : "N/D"}`
            : "";
    const descLines = job.description ? doc.splitTextToSize(job.description, contentWidth - 4) : [];
    const infoBoxHeight = 8 + (job.description ? descLines.length * 4.5 + 2 : 0) + (periodText ? 5 : 0);
    doc.setDrawColor(...borderColor);
    doc.roundedRect(margin, y, contentWidth, infoBoxHeight, 1, 1, "S");
    doc.setFontSize(13);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(`${job.code} - ${job.name || "Commessa"}`, margin + 2, y + 6);
    let infoY = y + 6;
    if (job.description) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(70);
        infoY += 5;
        doc.text(descLines, margin + 2, infoY);
        infoY += descLines.length * 4.5;
    }
    if (periodText) {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        infoY += periodText && job.description ? 2 : 5;
        doc.text(periodText, margin + 2, infoY);
    }
    y += infoBoxHeight + 6;

    // --- Nota d'uso: spiega i link e il disclaimer sulla compatibilità dei lettori PDF ---
    const noteLines = doc.splitTextToSize(
        "Il nome di ogni documento elencato qui sotto è un collegamento che apre direttamente il file corrispondente all'interno di questa cartella zip. A seconda del programma usato per aprire questo PDF, i collegamenti potrebbero non funzionare: in quel caso è comunque possibile leggere il percorso indicato accanto a ciascun gruppo di documenti per trovare manualmente il file desiderato.",
        contentWidth - 6
    );
    const noteBoxHeight = noteLines.length * 3.8 + 5;
    doc.setDrawColor(...borderColor);
    doc.setFillColor(250, 247, 240);
    doc.roundedRect(margin, y, contentWidth, noteBoxHeight, 1, 1, "FD");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(90);
    doc.text(noteLines, margin + 3, y + 4.5);
    y += noteBoxHeight + 8;

    // --- Contenuto: un capitolo per sezione, sottovoci per gruppo, con segnalibri PDF ---
    const ensureSpace = (needed: number) => {
        if (y + needed > bottomLimit) {
            doc.addPage();
            y = margin;
        }
    };

    for (const section of sections) {
        ensureSpace(14);
        const sectionPage = (doc.internal as any).getCurrentPageInfo().pageNumber;
        const sectionBookmark = doc.outline.add(null, section.title, { pageNumber: sectionPage });

        doc.setFillColor(...primaryColor);
        doc.rect(margin, y, contentWidth, 8, "F");
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(section.title.toUpperCase(), margin + 2, y + 5.5);
        y += 12;

        if (section.groups.length === 0) {
            doc.setFontSize(9);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(150);
            doc.text("Nessun documento in questa sezione.", margin + 2, y);
            y += 8;
        }

        for (const group of section.groups) {
            ensureSpace(11);
            const groupPage = (doc.internal as any).getCurrentPageInfo().pageNumber;
            doc.outline.add(sectionBookmark, group.label, { pageNumber: groupPage });

            doc.setFontSize(9.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(60);
            doc.text(group.label, margin + 2, y + 3.5);

            // Percorso della cartella come testo (non link): l'apertura diretta della cartella
            // non è affidabile in tutti i lettori PDF (funziona in Acrobat/browser ma non in
            // tutti, es. PDFgear), quindi mostriamo il percorso per trovare il file a mano.
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(140);
            const folderPathLabel = `${group.folderRelativePath}/`;
            doc.text(folderPathLabel, margin + contentWidth - 2, y + 3.5, { align: "right", maxWidth: contentWidth / 2 });

            y += 6;
            doc.setDrawColor(220, 220, 220);
            doc.line(margin, y - 2, margin + contentWidth, y - 2);

            for (const entry of group.entries) {
                ensureSpace(7);
                doc.setFontSize(9);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(0, 0, 200);
                const nameLines = doc.splitTextToSize(entry.name, contentWidth - 8);
                doc.text(nameLines[0], margin + 5, y + 3.5);
                doc.link(margin + 2, y, contentWidth - 4, 6, { url: entry.relativePath });
                if (entry.notes) {
                    doc.setFontSize(7.5);
                    doc.setFont("helvetica", "italic");
                    doc.setTextColor(130);
                    doc.text(entry.notes, margin + contentWidth - 2, y + 3.5, { align: "right", maxWidth: 60 });
                }
                y += 6.5;
            }
            y += 3;
        }
        y += 2;
    }

    // --- Numerazione pagine ---
    const pageCount = (doc.internal as any).getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(120);
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.text(`Pagina ${i} di ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: "right" });
    }

    return doc.output("blob");
}
