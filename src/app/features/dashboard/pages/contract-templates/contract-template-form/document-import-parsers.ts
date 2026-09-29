/**
 * Pure "convert an external document into editor HTML" parsers (docx / pdf /
 * html), decoupled from the editor/alert side effects. Extracted from
 * DocumentImportController to keep it under the file-size guideline (R1).
 */

/** Converts a Word (.docx) buffer into sanitized HTML ready for the ngx-editor content. */
export async function convertDocxToHtml(buffer: ArrayBuffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod     = await import('mammoth') as any;
  const mammoth = mod.default ?? mod;

  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      styleMap: [
        'u => u',
        'strike => s',
        'br[type="page"] => hr:fresh',
        "p[style-name='__center']  => p.docx-center:fresh",
        "p[style-name='__right']   => p.docx-right:fresh",
        "p[style-name='__justify'] => p.docx-justify:fresh",
      ],
      transformDocument: mammoth.transforms.paragraph((para: any) => {
        const alignMap: Record<string, string> = {
          center: '__center', right: '__right', both: '__justify',
        };
        const tag = para.alignment && alignMap[para.alignment];
        return tag ? { ...para, styleName: tag } : para;
      }),
      convertImage: mammoth.images.inline((img: any) =>
        img.read('base64').then((b64: string) => ({
          src: `data:${img.contentType};base64,${b64}`,
        }))
      ),
    }
  );

  const dom = new DOMParser().parseFromString(result.value as string, 'text/html');

  // Alignment classes → inline style
  const alignMap: Record<string, string> = {
    'docx-center': 'center', 'docx-right': 'right', 'docx-justify': 'justify',
  };
  for (const [cls, align] of Object.entries(alignMap)) {
    dom.querySelectorAll(`.${cls}`).forEach(el => {
      el.classList.remove(cls);
      (el as HTMLElement).style.textAlign = align;
    });
  }

  // Quitar párrafos vacíos: &nbsp; ( ), zero-width (​), solo <br>
  dom.querySelectorAll('p').forEach(p => {
    const text = (p.textContent ?? '').replace(/[\s ​‌‍﻿]+/g, '');
    const hasContent = text.length > 0 || !!p.querySelector('img, table');
    if (!hasContent) p.remove();
  });

  return dom.body.innerHTML;
}

export interface PdfConversionResult {
  html: string;
  pageCount: number;
}

/** Converts a PDF buffer into a best-effort editable HTML reconstruction (paragraphs/headings only, no layout). */
export async function convertPdfToHtml(buffer: ArrayBuffer): Promise<PdfConversionResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs = await import('pdfjs-dist') as any;
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const pdf = await pdfjs.getDocument({ data: buffer.slice(0) }).promise;
  let html  = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Agrupar items por línea (mismo Y redondeado — PDF Y crece hacia arriba)
    const lineMap = new Map<number, any[]>();
    for (const item of content.items as any[]) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push(item);
    }

    // Ordenar de arriba a abajo
    const lines = Array.from(lineMap.entries()).sort((a, b) => b[0] - a[0]);
    let prevY: number | undefined;

    for (const [y, items] of lines) {
      const lineText = items.map((it: any) => it.str).join('').trim();
      if (!lineText) continue;

      const fontSize = Math.abs(items[0].transform[0]);
      const fontName = (items[0].fontName ?? '').toLowerCase();
      const isBold   = fontName.includes('bold') || fontName.includes('heavy') || fontName.includes('black');

      // Gap mayor a 1.8× fontSize = separación de párrafo
      if (prevY !== undefined && (prevY - y) > fontSize * 1.8) {
        html += '<p>&nbsp;</p>';
      }

      if (fontSize >= 14) {
        html += `<h2 style="text-align:center"><strong>${lineText}</strong></h2>`;
      } else if (isBold) {
        html += `<p><strong>${lineText}</strong></p>`;
      } else {
        html += `<p>${lineText}</p>`;
      }

      prevY = y;
    }

    if (i < pdf.numPages) html += '<hr>';
  }

  return { html: html || '<p></p>', pageCount: pdf.numPages };
}

/** Sanitizes a raw HTML document for editor import: strips scripts/styles/links and preserves page-break rules as `<hr>`. */
export function convertHtmlDocument(rawHtml: string): string {
  const dom = new DOMParser().parseFromString(rawHtml, 'text/html');
  dom.querySelectorAll('script, style, link').forEach(el => el.remove());
  // Preserve inline page-break rules as <hr>
  dom.querySelectorAll('[style*="page-break"], [style*="break-after"]').forEach(el => {
    el.insertAdjacentHTML('afterend', '<hr>');
  });
  return dom.body.innerHTML.trim() || '<p></p>';
}
