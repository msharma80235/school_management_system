// Shared PDF text extraction on modern pdf.js (pdfjs-dist).
// Replaces pdf-parse, whose bundled 2018 pdf.js leaked state between
// documents parsed in the same process (two different files could return
// identical text). Each document here is opened fresh and destroyed after.

export interface PdfText {
  text: string;
  pages: number;
}

export async function extractPdfText(buffer: Buffer): Promise<PdfText> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
  }).promise;

  try {
    const pages = doc.numPages;
    let text = '';
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // Rebuild line structure: a new baseline Y means a new line — downstream
      // consumers (exam generator, safety scanner) rely on real line breaks
      let lastY: number | null = null;
      for (const item of content.items as any[]) {
        if (!('str' in item)) continue;
        const y = item.transform?.[5];
        if (lastY !== null && y !== lastY) text += '\n';
        else if (lastY !== null) text += ' ';
        text += item.str;
        lastY = y;
      }
      text += '\n';
      page.cleanup();
    }
    return { text, pages };
  } finally {
    await doc.destroy();
  }
}
