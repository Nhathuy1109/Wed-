/** Trích chữ từ PDF trên trình duyệt (pdfjs-dist). */

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");

  // Vite: trỏ worker tới file trong node_modules
  if (typeof window !== "undefined") {
    try {
      const workerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url);
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.toString();
    } catch {
      // fallback CDN (cùng major version)
      pdfjs.GlobalWorkerOptions.workerSrc =
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
    }
  }

  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data }).promise;
  const parts: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const line: string[] = [];
    let lastY: number | null = null;

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const anyItem = item as { str: string; transform?: number[] };
      const y = anyItem.transform ? anyItem.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(lastY - y) > 6) {
        const joined = line.join(" ").replace(/\s+/g, " ").trim();
        if (joined) parts.push(joined);
        line.length = 0;
      }
      if (anyItem.str) line.push(anyItem.str);
      if (y !== null) lastY = y;
    }
    const rest = line.join(" ").replace(/\s+/g, " ").trim();
    if (rest) parts.push(rest);
    parts.push("");
  }

  return parts.join("\n");
}
