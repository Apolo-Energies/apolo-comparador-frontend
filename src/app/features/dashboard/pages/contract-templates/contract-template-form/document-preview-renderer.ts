/**
 * Pure iframe-rendering helpers for the document-import preview (docx / pdf /
 * html), isolated from Angular styles. Extracted from DocumentImportController
 * to keep it under the file-size guideline (R1) and to separate "how a
 * pending file is rendered" from "how a confirmed file is imported into the
 * editor".
 */

/** Renders a Word (.docx) buffer inside a preview `<iframe>`. */
export async function renderDocxPreview(frame: HTMLIFrameElement, buffer: ArrayBuffer): Promise<void> {
  const { renderAsync } = await import('docx-preview');
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      /* Scroll horizontal si el A4 es más ancho que el iframe */
      html, body { margin: 0; overflow-x: auto; overflow-y: auto; background: #f0f0f0; }
      body { padding: 32px 16px; }
      .docx-wrapper { background: transparent !important; }
      .docx-wrapper section.docx { margin-bottom: 24px !important; border-radius: 2px; box-shadow: 0 4px 28px rgba(0,0,0,.18); }
    </style>
  </head><body></body></html>`);
  doc.close();
  await renderAsync(buffer.slice(0), doc.body, doc.head, {
    className: 'docx', inWrapper: true, ignoreWidth: false, ignoreHeight: false,
    breakPages: true, useBase64URL: true, renderHeaders: true, renderFooters: true,
    renderFootnotes: true, experimental: true, trimXmlDeclaration: true,
  });
}

/** Renders a PDF buffer inside a preview `<iframe>` via an object URL. Returns the URL so the caller can revoke it later. */
export function renderPdfPreview(frame: HTMLIFrameElement, buffer: ArrayBuffer): string {
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  frame.src = url;
  return url;
}

/** Renders raw HTML inside a preview `<iframe>`, fully isolated from Angular styles. */
export function renderHtmlPreview(frame: HTMLIFrameElement, html: string): void {
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
}
