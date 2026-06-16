import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef,
  effect, inject, input, NgZone, OnDestroy, OnInit, output, signal, ViewChild,
  computed,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AlertService, ButtonComponent, DialogComponent, InputFieldComponent, SelectFieldComponent } from '@apolo-energies/ui';
import { Editor, NgxEditorModule, Toolbar, toHTML, schema as ngxSchema } from 'ngx-editor';
import { Schema, MarkSpec, DOMParser as PMParser } from 'prosemirror-model';
import { tableNodes, tableEditing } from 'prosemirror-tables';
import { ContractTemplateService } from '../../../../../services/contract-template.service';
import { ContractTemplate, SignatureWidget } from '../../../../../entities/contract-template.model';

// ── Signature block HTML ────────────────────────────────────────────────────
// vertical-align:bottom garantiza que las líneas siempre queden a la misma altura
// sin importar qué haya encima en cada columna (imagen, espacio, etc.)
const SIGNATURE_BLOCK = `<table style="width:100%;border-collapse:collapse;margin-top:50px;table-layout:fixed"><tbody><tr style="vertical-align:bottom"><td style="width:45%;border-top:1.5px solid #111;padding-top:10px;vertical-align:bottom;text-align:left"><p>Apolo Business S.L.</p><p>&nbsp;</p><p>P.p. D. Wenceslao González Vicens</p></td><td style="width:10%">&nbsp;</td><td style="width:45%;border-top:1.5px solid #111;padding-top:10px;vertical-align:bottom;text-align:left"><p>{{ClientName}}</p><p>&nbsp;</p><p>P.p. {{ClientName}}</p></td></tr></tbody></table>`;

// ── Font size mark ──────────────────────────────────────────────────────────
const FONT_SIZE_MARK: MarkSpec = {
  attrs:    { pt: {} },
  parseDOM: [{ style: 'font-size', getAttrs: (v: string | Node) => ({ pt: typeof v === 'string' ? v : '' }) }],
  toDOM:    (node: any) => ['span', { style: `font-size: ${node.attrs['pt']}` }, 0],
};

const FONT_SIZES = ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '20pt', '24pt', '28pt', '32pt'];

// ── Custom schema with table support + style preservation ──────────────────
const CONTRACT_TABLE_NODES = tableNodes({
  tableGroup: 'block',
  cellContent: 'block+',
  cellAttributes: {
    style: {
      default:    null,
      getFromDOM: (dom: Element) => (dom as HTMLElement).getAttribute('style'),
      setDOMAttr: (value: unknown, attrs: Record<string, unknown>) => { if (value) attrs['style'] = value; },
    },
  },
});

const CONTRACT_SCHEMA = new Schema({
  nodes: (ngxSchema.spec.nodes as any).append({
    ...CONTRACT_TABLE_NODES,
    table: {
      ...CONTRACT_TABLE_NODES.table,
      attrs:    { style: { default: null } },
      parseDOM: [{ tag: 'table', getAttrs: (dom: Element) => ({ style: (dom as HTMLElement).getAttribute('style') }) }],
      toDOM:    (node: any) => { const a: Record<string, unknown> = {}; if (node.attrs['style']) a['style'] = node.attrs['style']; return ['table', a, ['tbody', 0]] as any; },
    },
  }),
  marks: (ngxSchema.spec.marks as any).addToEnd('font_size', FONT_SIZE_MARK),
});

const PLACEHOLDER_GROUPS = [
  {
    label: 'Cliente',
    items: ['{{ClientName}}', '{{Dni}}', '{{Cif}}', '{{CompanyName}}', '{{Email}}', '{{Phone}}', '{{BankAccount}}', '{{Date}}'],
  },
  {
    label: 'Dirección legal',
    items: ['{{Address1}}', '{{LegalCity}}', '{{LegalStreet}}', '{{LegalNumber}}'],
  },
  {
    label: 'Dirección notificación',
    items: ['{{Address2}}', '{{NotificationCity}}', '{{NotificationStreet}}', '{{NotificationNumber}}'],
  },
];

const TYPE_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'company',    label: 'Empresa'    },
];

const TOOLBAR: Toolbar = [
  ['bold', 'italic', 'underline', 'strike'],
  [{ heading: ['h1', 'h2', 'h3'] }],
  ['ordered_list', 'bullet_list'],
  ['align_left', 'align_center', 'align_right', 'align_justify'],
  ['link', 'horizontal_rule'],
  ['undo', 'redo'],
];

@Component({
  selector: 'app-contract-template-form',
  standalone: true,
  imports: [DialogComponent, ReactiveFormsModule, ButtonComponent, InputFieldComponent, SelectFieldComponent, NgxEditorModule],
  templateUrl: './contract-template-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractTemplateFormComponent implements OnInit, OnDestroy {
  readonly open     = input<boolean>(false);
  readonly template = input<ContractTemplate | null>(null);

  readonly saved     = output<void>();
  readonly cancelled = output<void>();

  private fb              = inject(FormBuilder);
  private templateService = inject(ContractTemplateService);
  private alertService    = inject(AlertService);
  private cdr             = inject(ChangeDetectorRef);

  readonly saving            = signal(false);
  readonly importing         = signal(false);
  readonly confirming        = signal(false);
  readonly contentError      = signal(false);
  readonly previewOpen       = signal(false);
  readonly isNewVersion      = signal(true);
  readonly widgets           = signal<SignatureWidget[]>([]);
  readonly currentPage       = signal(1);
  readonly selectedWidget    = signal<number | null>(null);
  readonly pdfPages          = signal<string[]>([]);
  readonly loadingPdf        = signal(false);
  readonly placeholderGroups = PLACEHOLDER_GROUPS;
  readonly typeOptions       = TYPE_OPTIONS;

  readonly pageWidgets = computed(() =>
    this.widgets().map((w, i) => ({ w, i })).filter(({ w }) => w.page === this.currentPage())
  );

  readonly drawDraft = signal<{ left: number; top: number; width: number; height: number } | null>(null);

  private dragInfo: {
    i: number; ox: number; oy: number; ow: number; oh: number;
    mx: number; my: number; rect: DOMRect; mode: 'move' | 'resize';
  } | null = null;

  private drawStart: { x: number; y: number; rect: DOMRect } | null = null;

  private readonly zone    = inject(NgZone);
  private boundMove        = this.onGlobalMove.bind(this);
  private boundUp          = this.onGlobalUp.bind(this);
  private boundDrawMove    = this.onDrawMove.bind(this);
  private boundDrawUp      = this.onDrawUp.bind(this);

  readonly isEditMode = computed(() => this.template() !== null);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // Setter fires as soon as the iframe enters the DOM (inside @if previewOpen)
  @ViewChild('previewFrame')
  set previewFrameRef(ref: ElementRef<HTMLIFrameElement> | undefined) {
    if (ref) this.renderPreview(ref.nativeElement);
  }

  editor!: Editor;
  toolbar = TOOLBAR;
  readonly fontSizes = FONT_SIZES;
  private editorDoc: Record<string, unknown> = {};
  private editorSub?: Subscription;
  private pendingBuffer?: ArrayBuffer;
  private pendingFileType?: 'docx' | 'pdf' | 'html';
  private pendingHtml?: string;
  private pendingBlobUrl?: string;

  readonly form = this.fb.group({
    code:        ['', [Validators.required, Validators.pattern(/^[A-Z0-9_]+$/)]],
    name:        ['', Validators.required],
    type:        ['individual', Validators.required],
    version:     ['1.0', Validators.required],
    changeNotes: [''],
  });

  constructor() {
    effect(() => {
      const tpl = this.template();
      if (!this.editor) return;
      this.applyTemplate(tpl);
    });
  }

  ngOnInit(): void {
    this.editor = new Editor({ schema: CONTRACT_SCHEMA, plugins: [tableEditing()] });
    this.editorSub = this.editor.valueChanges.subscribe(doc => { this.editorDoc = doc; });
    const tpl = this.template();
    if (tpl) this.applyTemplate(tpl);
  }

  ngOnDestroy(): void {
    this.editor.destroy();
    this.editorSub?.unsubscribe();
    window.removeEventListener('mousemove', this.boundMove);
    window.removeEventListener('mouseup', this.boundUp);
    window.removeEventListener('mousemove', this.boundDrawMove);
    window.removeEventListener('mouseup', this.boundDrawUp);
  }

  // ── Edit mode ────────────────────────────────────────────────────────────

  private applyTemplate(tpl: ContractTemplate | null): void {
    if (!tpl) {
      this.form.controls.code.enable();
      this.form.controls.name.enable();
      this.form.controls.type.enable();
      this.widgets.set([]);
      return;
    }
    this.isNewVersion.set(true);
    this.form.patchValue({
      code: tpl.code, name: tpl.name, type: tpl.type,
      version: this.bumpVersion(tpl.version), changeNotes: '',
    });
    this.form.controls.code.disable();
    this.form.controls.name.disable();
    this.form.controls.type.disable();
    this.form.controls.version.enable();
    this.editor.setContent(tpl.content);
    this.editorDoc = {};
    this.widgets.set(tpl.signatureWidgets ? [...tpl.signatureWidgets] : []);
    this.currentPage.set(1);
    this.selectedWidget.set(null);
    this.contentError.set(false);
    this.cdr.markForCheck();
  }

  setVersionMode(isNew: boolean): void {
    this.isNewVersion.set(isNew);
    const tpl = this.template();
    if (!tpl) return;
    if (isNew) {
      this.form.controls.version.setValue(this.bumpVersion(tpl.version));
      this.form.controls.version.enable();
    } else {
      this.form.controls.version.setValue(tpl.version);
      this.form.controls.version.disable();
    }
  }

  private bumpVersion(v: string): string {
    const parts = v.split('.');
    const last  = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(last)) parts[parts.length - 1] = String(last + 1);
    return parts.join('.');
  }

  typeLabel(type: string): string {
    return type === 'individual' ? 'Individual' : 'Empresa';
  }

  // ── Document import with preview (docx / pdf / html) ────────────────────

  triggerImport(): void { this.fileInput.nativeElement.click(); }

  async onFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    (event.target as HTMLInputElement).value = '';

    this.importing.set(true);
    this.cdr.markForCheck();

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      this.pendingFileType = ext === 'pdf' ? 'pdf' : (ext === 'html' || ext === 'htm') ? 'html' : 'docx';
      this.pendingBuffer   = await file.arrayBuffer();
      if (this.pendingFileType === 'html') this.pendingHtml = await file.text();
      this.previewOpen.set(true);  // ViewChild setter triggers renderPreview
    } catch {
      this.alertService.show('Error al abrir el documento', 'error');
    } finally {
      this.importing.set(false);
      this.cdr.markForCheck();
    }
  }

  private async renderPreview(frame: HTMLIFrameElement): Promise<void> {
    if (!this.pendingBuffer || !this.pendingFileType) return;
    try {
      if (this.pendingFileType === 'docx') {
        await this.renderDocxInFrame(frame);
      } else if (this.pendingFileType === 'pdf') {
        this.renderPdfInFrame(frame);
      } else {
        this.renderHtmlInFrame(frame);
      }
    } catch {
      this.alertService.show('Error al renderizar la vista previa', 'error');
    }
  }

  private async renderDocxInFrame(frame: HTMLIFrameElement): Promise<void> {
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
    await renderAsync(this.pendingBuffer!.slice(0), doc.body, doc.head, {
      className: 'docx', inWrapper: true, ignoreWidth: false, ignoreHeight: false,
      breakPages: true, useBase64URL: true, renderHeaders: true, renderFooters: true,
      renderFootnotes: true, experimental: true, trimXmlDeclaration: true,
    });
    this.cdr.markForCheck();
  }

  private renderPdfInFrame(frame: HTMLIFrameElement): void {
    if (this.pendingBlobUrl) URL.revokeObjectURL(this.pendingBlobUrl);
    const blob = new Blob([this.pendingBuffer!], { type: 'application/pdf' });
    this.pendingBlobUrl = URL.createObjectURL(blob);
    frame.src = this.pendingBlobUrl;
  }

  private renderHtmlInFrame(frame: HTMLIFrameElement): void {
    const doc = frame.contentDocument!;
    doc.open();
    // Write the raw HTML inside the iframe — fully isolated from Angular styles
    doc.write(this.pendingHtml ?? '');
    doc.close();
  }

  onCancelPreview(): void {
    this.previewOpen.set(false);
    this.clearPending();
  }

  async onConfirmImport(): Promise<void> {
    if (!this.pendingFileType) return;
    this.confirming.set(true);
    this.cdr.markForCheck();

    try {
      if (this.pendingFileType === 'docx') {
        await this.importDocx();
      } else if (this.pendingFileType === 'pdf') {
        await this.importPdf();
      } else {
        this.importHtml();
      }
      this.previewOpen.set(false);
      this.clearPending();
    } catch {
      this.alertService.show('Error al importar el documento', 'error');
    } finally {
      this.confirming.set(false);
      this.cdr.markForCheck();
    }
  }

  private async importDocx(): Promise<void> {
    if (!this.pendingBuffer) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod     = await import('mammoth') as any;
    const mammoth = mod.default ?? mod;

    const result = await mammoth.convertToHtml(
      { arrayBuffer: this.pendingBuffer },
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

    // Quitar párrafos vacíos: &nbsp; ( ), zero-width (​), solo <br>
    dom.querySelectorAll('p').forEach(p => {
      const text = (p.textContent ?? '').replace(/[\s ​‌‍﻿]+/g, '');
      const hasContent = text.length > 0 || !!p.querySelector('img, table');
      if (!hasContent) p.remove();
    });

    this.editor.setContent(dom.body.innerHTML);
    this.contentError.set(false);
    this.alertService.show('Word importado correctamente', 'success');
  }

  private async importPdf(): Promise<void> {
    if (!this.pendingBuffer) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfjs = await import('pdfjs-dist') as any;
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

    const pdf = await pdfjs.getDocument({ data: this.pendingBuffer.slice(0) }).promise;
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

    this.editor.setContent(html || '<p></p>');
    this.contentError.set(false);
    this.alertService.show(`PDF importado como texto editable (${pdf.numPages} páginas)`, 'success');
  }

  private importHtml(): void {
    if (!this.pendingHtml) return;
    const dom = new DOMParser().parseFromString(this.pendingHtml, 'text/html');
    dom.querySelectorAll('script, style, link').forEach(el => el.remove());
    // Preserve inline page-break rules as <hr>
    dom.querySelectorAll('[style*="page-break"], [style*="break-after"]').forEach(el => {
      el.insertAdjacentHTML('afterend', '<hr>');
    });
    this.editor.setContent(dom.body.innerHTML.trim() || '<p></p>');
    this.contentError.set(false);
    this.alertService.show('HTML importado correctamente', 'success');
  }

  private clearPending(): void {
    this.pendingBuffer   = undefined;
    this.pendingFileType = undefined;
    this.pendingHtml     = undefined;
    if (this.pendingBlobUrl) {
      URL.revokeObjectURL(this.pendingBlobUrl);
      this.pendingBlobUrl = undefined;
    }
  }

  // ── Editor helpers ───────────────────────────────────────────────────────

  applyFontSize(pt: string): void {
    const { state, dispatch } = this.editor.view;
    const { from, to, empty } = state.selection;
    if (empty || !pt) return;
    dispatch(state.tr.addMark(from, to, state.schema.marks['font_size'].create({ pt })));
    this.editor.view.focus();
  }

  insertPlaceholder(placeholder: string): void {
    const { state, dispatch } = this.editor.view;
    const { from, to } = state.selection;
    dispatch(state.tr.insertText(placeholder, from, to));
    this.editor.view.focus();
  }

  insertPageBreak(): void {
    const { state, dispatch } = this.editor.view;
    const hrNode = state.schema.nodes['horizontal_rule'];
    if (!hrNode) return;
    dispatch(state.tr.replaceSelectionWith(hrNode.create()).scrollIntoView());
    this.editor.view.focus();
  }

  insertSignatureBlock(): void {
    const { state, dispatch } = this.editor.view;
    const dom = document.createElement('div');
    dom.innerHTML = SIGNATURE_BLOCK;
    const slice = PMParser.fromSchema(state.schema).parseSlice(dom);
    dispatch(state.tr.replaceSelection(slice).scrollIntoView());
    this.editor.view.focus();
  }

  // ── Signature widgets ────────────────────────────────────────────────────

  prevPage(): void { if (this.currentPage() > 1) this.currentPage.update(p => p - 1); }
  nextPage(): void { this.currentPage.update(p => p + 1); }
  goToPage(page: number): void { this.currentPage.set(page); this.selectedWidget.set(null); }

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
    this.zone.run(() => {
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
    this.zone.run(() => {
      this.widgets.update(ws => [...ws, {
        recipientIndex: 0, page: this.currentPage(),
        left: draft.left, top: draft.top, width: draft.width, height: draft.height,
        type: 'signature', required: true, editable: true,
      }]);
      this.selectedWidget.set(newIdx);
    });
  }

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
    this.zone.run(() => {
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

  exportHtml(): void {
    const html = toHTML(
      this.editor.view.state.doc.toJSON() as Record<string, unknown>,
      this.editor.schema,
    );
    const name = this.form.getRawValue().name || this.template()?.name || 'template';
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${name.toLowerCase().replace(/\s+/g, '-')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  onCodeInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.toUpperCase();
    this.form.controls.code.setValue(value);
    this.form.controls.code.markAsTouched();
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const html = toHTML(this.editor.view.state.doc.toJSON() as Record<string, unknown>, this.editor.schema).trim();
    if (!html || html === '<p></p>') { this.contentError.set(true); return; }
    this.contentError.set(false);
    this.saving.set(true);

    const { version, changeNotes } = this.form.getRawValue();
    const signatureWidgets = this.widgets().length ? this.widgets() : undefined;

    if (this.isEditMode()) {
      const tpl = this.template()!;
      if (this.isNewVersion()) {
        this.templateService.createVersion(tpl.code, {
          version: version!, content: html, changeNotes: changeNotes || undefined, signatureWidgets,
        }).subscribe({
          next: () => { this.alertService.show('Nueva versión creada correctamente', 'success'); this.saving.set(false); this.resetForm(); this.saved.emit(); },
          error: () => { this.saving.set(false); this.alertService.show('Error al crear la versión', 'error'); },
        });
      } else {
        this.templateService.updateContent(tpl.id, {
          content: html, changeNotes: changeNotes || undefined, signatureWidgets,
        }).subscribe({
          next: () => { this.alertService.show('Plantilla actualizada correctamente', 'success'); this.saving.set(false); this.resetForm(); this.saved.emit(); },
          error: () => { this.saving.set(false); this.alertService.show('Error al actualizar la plantilla', 'error'); },
        });
      }
    } else {
      const { code, name, type } = this.form.getRawValue();
      this.templateService.create({
        code: code!, name: name!, type: type as 'individual' | 'company',
        version: version!, content: html, changeNotes: changeNotes || undefined, signatureWidgets,
      }).subscribe({
        next: () => { this.alertService.show('Plantilla creada correctamente', 'success'); this.saving.set(false); this.resetForm(); this.saved.emit(); },
        error: (err) => { this.saving.set(false); this.alertService.show(err.status === 409 ? 'Ya existe una plantilla con ese código' : 'Error al crear la plantilla', 'error'); },
      });
    }
  }

  onCancel(): void { this.resetForm(); this.cancelled.emit(); }

  async loadPdfPreview(): Promise<void> {
    const tpl = this.template();
    if (!tpl) return;
    this.loadingPdf.set(true);
    try {
      const { firstValueFrom } = await import('rxjs');
      const blob   = await firstValueFrom(this.templateService.getPreview(tpl.id));
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
      this.alertService.show(`PDF cargado — ${pages.length} páginas`, 'success');
    } catch {
      this.alertService.show('No se pudo cargar el PDF del template', 'error');
    } finally {
      this.loadingPdf.set(false);
    }
  }

  private resetForm(): void {
    this.isNewVersion.set(true);
    this.widgets.set([]);
    this.currentPage.set(1);
    this.selectedWidget.set(null);
    this.pdfPages.set([]);
    this.form.reset({ code: '', name: '', type: 'individual', version: '1.0', changeNotes: '' });
    this.form.controls.code.enable();
    this.form.controls.name.enable();
    this.form.controls.type.enable();
    this.form.controls.version.enable();
    this.editor.setContent('');
    this.editorDoc = {};
    this.contentError.set(false);
    this.cdr.markForCheck();
  }
}
