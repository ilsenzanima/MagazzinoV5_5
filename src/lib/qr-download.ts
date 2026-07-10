// Converte un elemento <svg> (es. generato da react-qr-code) in un file PNG scaricabile.
export function downloadSvgAsPng(svgElement: SVGSVGElement | null, filename: string, size = 1024): void {
    if (!svgElement) return;

    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new window.Image();
    img.onload = () => {
        const padding = Math.round(size * 0.08);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            URL.revokeObjectURL(svgUrl);
            return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, padding, padding, size - padding * 2, size - padding * 2);
        URL.revokeObjectURL(svgUrl);

        canvas.toBlob((pngBlob) => {
            if (!pngBlob) return;
            const pngUrl = URL.createObjectURL(pngBlob);
            const link = document.createElement("a");
            link.href = pngUrl;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(pngUrl);
        }, "image/png");
    };
    img.src = svgUrl;
}
