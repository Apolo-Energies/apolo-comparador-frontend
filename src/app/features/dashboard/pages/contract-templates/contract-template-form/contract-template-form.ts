import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, ElementRef,
  effect, inject, input, NgZone, OnDestroy, OnInit, output, signal, ViewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AlertService, ButtonComponent, DialogComponent, InputFieldComponent, SelectFieldComponent } from '@apolo-energies/ui';
import { Editor, NgxEditorModule, toHTML } from 'ngx-editor';
import { tableEditing } from 'prosemirror-tables';
import { ContractTemplateService } from '../../../../../core/services/contract-template.service';
import { ContractTemplate } from '../../../../../core/models/contract-template.model';
import { DocumentImportController } from './document-import.controller';
import { EditorCommandsController } from './editor-commands.controller';
import { SignatureCanvasController } from './signature-canvas.controller';
import { ContractTemplateSubmitController } from './contract-template-submit.controller';
import {
  CONTRACT_SCHEMA, FONT_SIZES, PLACEHOLDER_GROUPS, TOOLBAR, TYPE_OPTIONS,
  bumpVersion, typeLabel as resolveTypeLabel,
} from './contract-template-form.helpers';
import { applyVersionMode, downloadHtmlExport, setBaseControls } from './contract-template-form-actions.helpers';

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
  private readonly zone    = inject(NgZone);

  readonly contentError = signal(false);
  readonly isNewVersion = signal(true);
  readonly placeholderGroups = PLACEHOLDER_GROUPS;
  readonly typeOptions       = TYPE_OPTIONS;

  // Submit flow (create / new version / correction) — extracted controller (R1).
  private readonly submitFlow = new ContractTemplateSubmitController({
    templateService: this.templateService,
    alertService:    this.alertService,
    onSuccess:       () => { this.resetForm(); this.saved.emit(); },
  });
  readonly saving = this.submitFlow.saving;

  // Document import/preview flow (docx / pdf / html) — extracted controller (R1).
  private readonly docImport = new DocumentImportController({
    alertService: this.alertService,
    getEditor: () => this.editor,
    markForCheck: () => this.cdr.markForCheck(),
    clearContentError: () => this.contentError.set(false),
  });
  readonly importing   = this.docImport.importing;
  readonly confirming  = this.docImport.confirming;
  readonly previewOpen = this.docImport.previewOpen;

  // Signature-widget canvas (PDF background, page nav, CRUD, draw/drag) — extracted controller (R1).
  private readonly canvas = new SignatureCanvasController({
    zone: this.zone, templateService: this.templateService, alertService: this.alertService,
  });
  readonly widgets        = this.canvas.widgets;
  readonly currentPage    = this.canvas.currentPage;
  readonly selectedWidget = this.canvas.selectedWidget;
  readonly pdfPages       = this.canvas.pdfPages;
  readonly loadingPdf     = this.canvas.loadingPdf;
  readonly pageWidgets    = this.canvas.pageWidgets;
  readonly drawDraft      = this.canvas.drawDraft;

  // ProseMirror toolbar/table commands — extracted controller (R1).
  private readonly editorCommands = new EditorCommandsController({
    getEditor: () => this.editor,
    alertService: this.alertService,
  });

  readonly isEditMode = computed(() => this.template() !== null);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // Setter fires as soon as the iframe enters the DOM (inside @if previewOpen)
  @ViewChild('previewFrame')
  set previewFrameRef(ref: ElementRef<HTMLIFrameElement> | undefined) {
    if (ref) this.docImport.renderPreview(ref.nativeElement);
  }

  editor!: Editor;
  toolbar = TOOLBAR;
  readonly fontSizes = FONT_SIZES;
  private editorDoc: Record<string, unknown> = {};
  private editorSub?: Subscription;

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
    this.canvas.destroy();
    this.docImport.destroy();
  }

  // ── Edit mode ────────────────────────────────────────────────────────────

  private applyTemplate(tpl: ContractTemplate | null): void {
    if (!tpl) {
      setBaseControls(this.form, 'enable');
      this.widgets.set([]);
      return;
    }
    this.isNewVersion.set(true);
    this.form.patchValue({
      code: tpl.code, name: tpl.name, type: tpl.type,
      version: bumpVersion(tpl.version), changeNotes: '',
    });
    setBaseControls(this.form, 'disable');
    this.form.controls.version.enable();
    this.editor.setContent(tpl.content);
    this.editorDoc = {};
    this.canvas.applyTemplateWidgets(tpl.signatureWidgets ? [...tpl.signatureWidgets] : []);
    this.contentError.set(false);
    this.cdr.markForCheck();
  }

  setVersionMode(isNew: boolean): void {
    this.isNewVersion.set(isNew);
    const tpl = this.template();
    if (!tpl) return;
    applyVersionMode(this.form.controls.version, tpl, isNew);
  }

  typeLabel(type: string): string { return resolveTypeLabel(type); }

  // ── Document import (delegates to DocumentImportController) ─────────────

  triggerImport(): void { this.fileInput.nativeElement.click(); }
  onFileSelected(event: Event): Promise<void> { return this.docImport.onFileSelected(event); }
  onCancelPreview(): void { this.docImport.onCancelPreview(); }
  onConfirmImport(): Promise<void> { return this.docImport.onConfirmImport(); }

  // ── Editor / table commands (delegate to EditorCommandsController) ──────

  applyFontSize(pt: string): void { this.editorCommands.applyFontSize(pt); }
  insertPlaceholder(placeholder: string): void { this.editorCommands.insertPlaceholder(placeholder); }
  insertPageBreak(): void { this.editorCommands.insertPageBreak(); }
  insertSignatureBlock(): void { this.editorCommands.insertSignatureBlock(); }
  tableAddRowBefore(): void { this.editorCommands.tableAddRowBefore(); }
  tableAddRowAfter(): void { this.editorCommands.tableAddRowAfter(); }
  tableDeleteRow(): void { this.editorCommands.tableDeleteRow(); }
  tableDeleteColumn(): void { this.editorCommands.tableDeleteColumn(); }
  tableDeleteTable(): void { this.editorCommands.tableDeleteTable(); }

  // ── Signature widgets / canvas (delegate to SignatureCanvasController) ──

  prevPage(): void { this.canvas.prevPage(); }
  nextPage(): void { this.canvas.nextPage(); }
  goToPage(page: number): void { this.canvas.goToPage(page); }
  addWidget(): void { this.canvas.addWidget(); }
  removeWidget(index: number): void { this.canvas.removeWidget(index); }
  setWidgetType(index: number, value: string): void { this.canvas.setWidgetType(index, value); }
  setWidgetRecipient(index: number, value: number): void { this.canvas.setWidgetRecipient(index, value); }
  setWidgetBool(index: number, field: 'required' | 'editable', value: boolean): void { this.canvas.setWidgetBool(index, field, value); }
  onCanvasMousedown(event: MouseEvent, canvasEl: HTMLElement): void { this.canvas.onCanvasMousedown(event, canvasEl); }
  onWidgetMousedown(event: MouseEvent, index: number, mode: 'move' | 'resize', canvasEl: HTMLElement): void {
    this.canvas.onWidgetMousedown(event, index, mode, canvasEl);
  }

  async loadPdfPreview(): Promise<void> {
    const tpl = this.template();
    if (!tpl) return;
    return this.canvas.loadPdfPreview(tpl.id);
  }

  // ── Export / misc ────────────────────────────────────────────────────────

  exportHtml(): void {
    const html = toHTML(this.editor.view.state.doc.toJSON() as Record<string, unknown>, this.editor.schema);
    downloadHtmlExport(html, this.form.getRawValue().name || this.template()?.name || 'template');
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

    const { code, name, type, version, changeNotes } = this.form.getRawValue();
    this.submitFlow.submit({
      isEditMode:   this.isEditMode(),
      isNewVersion: this.isNewVersion(),
      template:     this.template(),
      code: code!, name: name!, type: type!, version: version!, changeNotes: changeNotes!,
      html,
      signatureWidgets: this.widgets().length ? this.widgets() : undefined,
    });
  }

  onCancel(): void { this.resetForm(); this.cancelled.emit(); }

  private resetForm(): void {
    this.isNewVersion.set(true);
    this.canvas.reset();
    this.form.reset({ code: '', name: '', type: 'individual', version: '1.0', changeNotes: '' });
    setBaseControls(this.form, 'enable');
    this.form.controls.version.enable();
    this.editor.setContent('');
    this.editorDoc = {};
    this.contentError.set(false);
    this.cdr.markForCheck();
  }
}
