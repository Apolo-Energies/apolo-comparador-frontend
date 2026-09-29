import { NgZone, computed, signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { ContractTemplateService } from '../../../../../core/services/contract-template.service';
import { SignatureWidget } from '../../../../../core/models/contract-template.model';

interface DragInfo {
  i: number; ox: number; oy: number; ow: number; oh: number;
  mx: number; my: number; rect: DOMRect; mode: 'move' | 'resize';
}

interface DrawStart { x: number; y: number; rect: DOMRect; }

export interface SignatureCanvasDeps {
  zone: NgZone;
  templateService: ContractTemplateService;
  alertService: AlertService;
}

/**
 * Owns the "place signature widgets over the contract PDF" canvas: the
 * rendered PDF background pages, page navigation, widget CRUD, draw-to-place
 * and drag/resize interactions. Extracted from ContractTemplateFormComponent
 * to keep it under the file-size guideline (R1).
 */
export class SignatureCanvasController {
  constructor(private readonly deps: SignatureCanvasDeps) {}

  readonly widgets        = signal<SignatureWidget[]>([]);
  readonly currentPage    = signal(1);
  readonly selectedWidget = signal<number | null>(null);
  readonly pdfPages       = signal<string[]>([]);
  readonly loadingPdf     = signal(false);

  readonly pageWidgets = computed(() =>
    this.widgets().map((w, i) => ({ w, i })).filter(({ w }) => w.page === this.currentPage())
  );

  readonly drawDraft = signal<{ left: number; top: number; width: number; height: number } | null>(null);

  private dragInfo: DragInfo | null = null;
  private drawStart: DrawStart | null = null;

  private boundMove     = this.onGlobalMove.bind(this);
  private boundUp       = this.onGlobalUp.bind(this);
  private boundDrawMove = this.onDrawMove.bind(this);
  private boundDrawUp   = this.onDrawUp.bind(this);

  /** Removes any window listeners left over from an in-progress drag/draw. Call from ngOnDestroy. */
  destroy(): void {
    window.removeEventListener('mousemove', this.boundMove);
    window.removeEventListener('mouseup', this.boundUp);
    window.removeEventListener('mousemove', this.boundDrawMove);
    window.removeEventListener('mouseup', this.boundDrawUp);
  }

  // ── PDF background preview ──────────────────────────────────────────────

  async loadPdfPreview(templateId: string): Promise<void> {
    this.loadingPdf.set(true);
    try {
      const { firstValueFrom } = await import('rxjs');
      const blob   = await firstValueFrom(this.deps.templateService.getPreview(templateId));
      const buffer = await blob.arrayBuffer();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfjs  = await import('pdfjs-dist') as any;
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const pdf    = await pdfjs.getDocument({ data: buffer }).promise;
      const pages: string[] = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const page     = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 2 });
        const cvs      = document.createElement('canvas');
        cvs.width      = viewport.width;
        cvs.height     = viewport.height;
        await page.render({ canvasContext: cvs.getContext('2d')!, viewport }).promise;
        pages.push(cvs.toDataURL('image/jpeg', 0.9));
      }
      this.pdfPages.set(pages);
      this.deps.alertService.show(`PDF cargado — ${pages.length} páginas`, 'success');
    } catch {
      this.deps.alertService.show('No se pudo cargar el PDF del template', 'error');
    } finally {
      this.loadingPdf.set(false);
    }
  }

  // ── Page navigation ──────────────────────────────────────────────────────

  prevPage(): void { if (this.currentPage() > 1) this.currentPage.update(p => p - 1); }
  nextPage(): void { this.currentPage.update(p => p + 1); }
  goToPage(page: number): void { this.currentPage.set(page); this.selectedWidget.set(null); }

  /** Loads a template's saved widgets and resets page/selection (used when the editor opens a template). */
  applyTemplateWidgets(list: SignatureWidget[]): void {
    this.widgets.set(list);
    this.currentPage.set(1);
    this.selectedWidget.set(null);
  }

  /** Clears all widget/page/PDF-preview state (used when the form is reset after create/cancel). */
  reset(): void {
    this.widgets.set([]);
    this.currentPage.set(1);
    this.selectedWidget.set(null);
    this.pdfPages.set([]);
  }

  // ── Widget CRUD ──────────────────────────────────────────────────────────

  addWidget(): void {
    const newIdx = this.widgets().length;
    this.widgets.update(ws => [...ws, {
      recipientIndex: 0, page: this.currentPage(), left: 35, top: 40,
      width: 26, height: 9, type: 'signature', required: true, editable: true,
    }]);
    this.selectedWidget.set(newIdx);
  }

  removeWidget(index: number): void {
    this.widgets.update(ws => ws.filter((_, i) => i !== index));
    if (this.selectedWidget() === index) this.selectedWidget.set(null);
  }

  setWidgetType(index: number, value: string): void {
    this.widgets.update(ws => { const c = [...ws]; c[index] = { ...c[index], type: value }; return c; });
  }

  setWidgetRecipient(index: number, value: number): void {
    this.widgets.update(ws => { const c = [...ws]; c[index] = { ...c[index], recipientIndex: value }; return c; });
  }

  setWidgetBool(index: number, field: 'required' | 'editable', value: boolean): void {
    this.widgets.update(ws => { const c = [...ws]; c[index] = { ...c[index], [field]: value }; return c; });
  }

  // ── Draw-to-place ────────────────────────────────────────────────────────

  onCanvasMousedown(event: MouseEvent, canvas: HTMLElement): void {
    // Only start drawing if click is directly on canvas (not on a widget)
    if (event.target !== canvas) return;
    event.preventDefault();
    this.selectedWidget.set(null);
    this.drawStart = { x: event.clientX, y: event.clientY, rect: canvas.getBoundingClientRect() };
    window.addEventListener('mousemove', this.boundDrawMove);
    window.addEventListener('mouseup', this.boundDrawUp);
  }

  private onDrawMove(event: MouseEvent): void {
    const d = this.drawStart;
    if (!d) return;
    const toPercent = (px: number, total: number) => Math.round(Math.max(0, Math.min(100, (px / total) * 100)));
    const x1 = event.clientX - d.rect.left;
    const y1 = event.clientY - d.rect.top;
    this.deps.zone.run(() => {
      this.drawDraft.set({
        left:   toPercent(Math.min(d.x - d.rect.left, x1), d.rect.width),
        top:    toPercent(Math.min(d.y - d.rect.top,  y1), d.rect.height),
        width:  toPercent(Math.abs(x1 - (d.x - d.rect.left)), d.rect.width),
        height: toPercent(Math.abs(y1 - (d.y - d.rect.top)),  d.rect.height),
      });
    });
  }

  private onDrawUp(): void {
    window.removeEventListener('mousemove', this.boundDrawMove);
    window.removeEventListener('mouseup', this.boundDrawUp);
    const draft = this.drawDraft();
    this.drawDraft.set(null);
    this.drawStart = null;
    if (!draft || draft.width < 3 || draft.height < 2) return;  // too small → ignore
    const newIdx = this.widgets().length;
    this.deps.zone.run(() => {
      this.widgets.update(ws => [...ws, {
        recipientIndex: 0, page: this.currentPage(),
        left: draft.left, top: draft.top, width: draft.width, height: draft.height,
        type: 'signature', required: true, editable: true,
      }]);
      this.selectedWidget.set(newIdx);
    });
  }

  // ── Drag / resize ────────────────────────────────────────────────────────

  onWidgetMousedown(event: MouseEvent, index: number, mode: 'move' | 'resize', canvas: HTMLElement): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedWidget.set(index);
    const w = this.widgets()[index];
    this.dragInfo = {
      i: index, ox: w.left, oy: w.top, ow: w.width, oh: w.height,
      mx: event.clientX, my: event.clientY,
      rect: canvas.getBoundingClientRect(), mode,
    };
    window.addEventListener('mousemove', this.boundMove);
    window.addEventListener('mouseup', this.boundUp);
  }

  private onGlobalMove(event: MouseEvent): void {
    const d = this.dragInfo;
    if (!d) return;
    const dx = ((event.clientX - d.mx) / d.rect.width)  * 100;
    const dy = ((event.clientY - d.my) / d.rect.height) * 100;
    this.deps.zone.run(() => {
      this.widgets.update(ws => {
        const copy = [...ws];
        const w    = { ...copy[d.i] };
        if (d.mode === 'move') {
          w.left = Math.round(Math.max(0, Math.min(100 - w.width,  d.ox + dx)));
          w.top  = Math.round(Math.max(0, Math.min(100 - w.height, d.oy + dy)));
        } else {
          w.width  = Math.round(Math.max(5, Math.min(100 - w.left, d.ow + dx)));
          w.height = Math.round(Math.max(3, Math.min(100 - w.top,  d.oh + dy)));
        }
        copy[d.i] = w;
        return copy;
      });
    });
  }

  private onGlobalUp(): void {
    this.dragInfo = null;
    window.removeEventListener('mousemove', this.boundMove);
    window.removeEventListener('mouseup', this.boundUp);
  }
}
