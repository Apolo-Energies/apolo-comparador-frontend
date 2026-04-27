import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertService, ButtonComponent, DialogComponent } from '@apolo-energies/ui';
import { DomSanitizer } from '@angular/platform-browser';
import { ContractDocumentService } from '../../../../../../services/contract-document.service';
import { ContractService } from '../../../../../../services/contract.service';
import { ContractDocument, UserDetail } from '../../../../../../entities/user-detail.model';
import { REQUIRED_DOCS_BY_PERSON_TYPE } from '../configs/doc-by-person-type.config';
import { DOC_TYPE_LABELS } from '../configs/doc-type-labels.config';
import { DOC_STATUS_CONFIG } from '../configs/doc-status.config';

@Component({
  selector: 'app-documents-section',
  standalone: true,
  imports: [FormsModule, ButtonComponent, DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Header -->
    <div class="flex items-center justify-between">
      <p class="flex items-center gap-2 text-base font-semibold text-foreground">
        <span class="h-2 w-2 rounded-full bg-primary"></span>
        Documentos
      </p>

      @if (availableTypes().length > 0) {
        <ui-button label="Subir documento" variant="outline" size="sm"
          (click)="uploadModalOpen.set(true)" />
      }
    </div>

    <!-- Document list -->
    @if (docs().length === 0) {
      <div class="flex flex-col items-center justify-center py-10 text-center">
        <p class="text-sm text-muted-foreground">No hay documentos subidos aún.</p>
      </div>
    } @else {
      <div class="space-y-3 mt-4">
        @for (doc of docs(); track doc.id) {
          <div class="rounded-lg border border-border bg-background p-4 space-y-2">

            <!-- Top row: type + status badge + actions -->
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                  class="text-muted-foreground shrink-0">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span class="text-sm font-medium text-foreground">
                  {{ docTypeLabel(doc.documentType) }}
                </span>
              </div>

              <div class="flex items-center gap-2">
                @if (statusConfig(doc.status); as s) {
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {{ s.cls }}">
                    {{ s.label }}
                  </span>
                }

                <!-- View button -->
                <button type="button"
                  class="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Ver documento"
                  (click)="viewDoc.set(doc)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>

                <!-- Approve/Reject (master only, not validated/rejected/signed) -->
                @if (isMaster() && canReview(doc.status)) {
                  <button type="button"
                    class="p-1.5 rounded-md hover:bg-green-50 text-green-600 hover:text-green-700 transition-colors"
                    title="Aprobar"
                    (click)="onVerify(doc.id)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </button>

                  <button type="button"
                    class="p-1.5 rounded-md hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors"
                    title="Rechazar"
                    (click)="onRejectClick(doc.id)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                }

                <!-- Delete -->
                <button type="button"
                  class="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
                  title="Eliminar"
                  (click)="onDelete(doc.id)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Review comment banner -->
            @if (doc.reviewComment) {
              <div class="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <span class="font-medium">Observación: </span>{{ doc.reviewComment }}
              </div>
            }

            <!-- Reject inline input -->
            @if (rejectingDocId() === doc.id) {
              <div class="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  [ngModel]="rejectObservation()"
                  (ngModelChange)="rejectObservation.set($event)"
                  placeholder="Motivo del rechazo..."
                  class="flex-1 px-3 py-1.5 text-sm rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  (keyup.enter)="onRejectSubmit(doc.id)" />
                <button type="button"
                  class="px-3 py-1.5 text-sm rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
                  (click)="onRejectSubmit(doc.id)">
                  Enviar
                </button>
                <button type="button"
                  class="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted transition-colors"
                  (click)="rejectingDocId.set(null)">
                  Cancelar
                </button>
              </div>
            }

          </div>
        }
      </div>
    }

    <!-- ─── Upload modal ──────────────────────────────────────────────── -->
    <ui-dialog [open]="uploadModalOpen()" [closeable]="true" maxWidth="max-w-md"
      (openChange)="$event ? null : closeUploadModal()">
      <div class="flex flex-col">
        <div class="shrink-0 border-b border-border px-6 py-4">
          <p class="text-lg font-semibold text-foreground">Subir documento</p>
          <p class="text-sm text-muted-foreground">Selecciona el tipo y el archivo</p>
        </div>

        <div class="space-y-4 px-6 py-5">
          <div class="space-y-1">
            <label class="text-sm font-medium text-muted-foreground">Tipo de documento *</label>
            <select [ngModel]="selectedUploadType()"
              (ngModelChange)="selectedUploadType.set($event)"
              class="w-full px-3 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer">
              <option [ngValue]="null" disabled>Seleccionar tipo...</option>
              @for (t of availableTypes(); track t) {
                <option [ngValue]="t">{{ docTypeLabel(t) }}</option>
              }
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-sm font-medium text-muted-foreground">Archivo *</label>
            <input type="file" (change)="onFileSelected($event)"
              class="w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer" />
          </div>
        </div>

        <div class="shrink-0 border-t border-border px-6 py-4 flex justify-end gap-2">
          <ui-button label="Cancelar" variant="outline" size="md" (click)="closeUploadModal()" />
          <ui-button label="Subir" variant="default" size="md"
            [disabled]="uploading() || selectedUploadType() === null || !selectedFile()"
            (click)="onUpload()" />
        </div>
      </div>
    </ui-dialog>

    <!-- ─── View document modal ───────────────────────────────────────── -->
    <ui-dialog [open]="!!viewDoc()" [closeable]="true" maxWidth="max-w-2xl"
      (openChange)="$event ? null : viewDoc.set(null)">
      @if (viewDoc(); as doc) {
        <div class="flex flex-col" style="height: 80vh">
          <div class="shrink-0 border-b border-border px-6 py-4 flex items-center justify-between">
            <div>
              <p class="text-base font-semibold text-foreground">{{ docTypeLabel(doc.documentType) }}</p>
              <p class="text-sm text-muted-foreground">
                Subido el {{ formatDate(doc.createdAt) }}
                @if (statusConfig(doc.status); as s) {
                  · <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium {{ s.cls }}">{{ s.label }}</span>
                }
              </p>
            </div>
          </div>

          @if (doc.reviewComment) {
            <div class="mx-6 mt-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <span class="font-medium">Observación: </span>{{ doc.reviewComment }}
            </div>
          }

          <div class="flex-1 min-h-0 px-6 py-4">
            @if (doc.previewUrl) {
              <iframe [src]="sanitizeUrl(doc.previewUrl)" class="w-full h-full rounded-md border border-border"></iframe>
            } @else {
              <div class="flex flex-col items-center justify-center h-full text-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                  class="text-muted-foreground">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <p class="text-sm text-muted-foreground">Vista previa no disponible</p>
                <a [href]="doc.fileUrl" target="_blank" rel="noopener noreferrer"
                  class="text-sm text-blue-500 hover:underline">
                  Abrir archivo
                </a>
              </div>
            }
          </div>
        </div>
      }
    </ui-dialog>
  `,
})
export class DocumentsSectionComponent {
  readonly user     = input.required<UserDetail | null>();
  readonly isMaster = input.required<boolean>();
  readonly reload   = output<void>();

  private readonly contractDocSvc = inject(ContractDocumentService);
  private readonly contractSvc    = inject(ContractService);
  private readonly alertService   = inject(AlertService);
  private readonly sanitizer      = inject(DomSanitizer);

  readonly docs              = signal<ContractDocument[]>([]);
  readonly localContractId   = signal<string | null>(null);
  readonly uploadModalOpen   = signal(false);
  readonly uploading         = signal(false);
  readonly viewDoc           = signal<ContractDocument | null>(null);
  readonly rejectingDocId    = signal<string | null>(null);
  readonly selectedUploadType = signal<number | null>(null);
  readonly selectedFile       = signal<File | null>(null);
  readonly rejectObservation  = signal('');

  readonly availableTypes = computed(() => {
    const u = this.user();
    if (!u?.customer) return [];
    const required  = REQUIRED_DOCS_BY_PERSON_TYPE[u.customer.personType] ?? [];
    const existing  = new Set(this.docs().map(d => d.documentType));
    return required.filter(t => !existing.has(t));
  });

  constructor() {
    effect(() => {
      const u = this.user();
      this.docs.set(u?.contract?.documents.uploaded ?? []);
      this.localContractId.set(u?.contract?.id ?? null);
    }, { allowSignalWrites: true });
  }

  docTypeLabel(type: number): string {
    return DOC_TYPE_LABELS[type] ?? `Documento ${type}`;
  }

  statusConfig(status: number) {
    return DOC_STATUS_CONFIG[status] ?? null;
  }

  canReview(status: number): boolean {
    return status !== 4 && status !== 3 && status !== 2;
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  sanitizeUrl(url: string) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
  }

  closeUploadModal(): void {
    this.uploadModalOpen.set(false);
    this.selectedUploadType.set(null);
    this.selectedFile.set(null);
  }

  async onUpload(): Promise<void> {
    const docType = this.selectedUploadType();
    const file    = this.selectedFile();
    if (docType === null || !file) return;

    const u = this.user();
    if (!u) return;

    this.uploading.set(true);

    let contractId = this.localContractId();

    if (!contractId) {
      const customerId = u.customerId ?? u.customer?.id ?? null;
      if (!customerId) {
        this.alertService.show('El usuario no tiene cliente asignado', 'error');
        this.uploading.set(false);
        return;
      }

      try {
        const contract = await this.contractSvc
          .createManual({ customerId, origin: 0 })
          .toPromise();
        contractId = contract!.id;
        this.localContractId.set(contractId);
      } catch {
        this.alertService.show('Error al crear el contrato', 'error');
        this.uploading.set(false);
        return;
      }
    }

    this.contractDocSvc.upload(contractId, docType, file).subscribe({
      next: () => {
        this.alertService.show('Documento subido correctamente', 'success');
        this.uploading.set(false);
        this.closeUploadModal();
        this.reload.emit();
      },
      error: () => {
        this.alertService.show('Error al subir el documento', 'error');
        this.uploading.set(false);
      },
    });
  }

  onVerify(docId: string): void {
    const prev = this.docs();
    const doc  = prev.find(d => d.id === docId);

    this.docs.update(list =>
      list.map(d => d.id === docId ? { ...d, status: 4, reviewComment: null } : d)
    );

    const contractId = this.localContractId();
    const validate$ = doc?.documentType === 6 && contractId
      ? this.contractDocSvc.validateSigned(contractId)
      : this.contractDocSvc.validate(docId);

    validate$.subscribe({
      next: () => {
        this.alertService.show('Documento verificado correctamente', 'success');
        this.reload.emit();
      },
      error: () => {
        this.docs.set(prev);
        this.alertService.show('Error al verificar el documento', 'error');
      },
    });
  }

  onRejectClick(docId: string): void {
    this.rejectingDocId.set(docId);
    this.rejectObservation.set('');
  }

  onRejectSubmit(docId: string): void {
    const observation = this.rejectObservation().trim();
    if (!observation) return;

    const prev = this.docs();
    this.docs.update(list =>
      list.map(d => d.id === docId ? { ...d, status: 3, reviewComment: observation } : d)
    );
    this.rejectingDocId.set(null);
    this.rejectObservation.set('');

    this.contractDocSvc.reject(docId, observation).subscribe({
      next: () => {
        this.alertService.show('Documento rechazado correctamente', 'success');
        this.reload.emit();
      },
      error: () => {
        this.docs.set(prev);
        this.alertService.show('Error al rechazar el documento', 'error');
      },
    });
  }

  onDelete(docId: string): void {
    const prev = this.docs();
    this.docs.update(list => list.filter(d => d.id !== docId));

    if (this.rejectingDocId() === docId) {
      this.rejectingDocId.set(null);
    }

    this.contractDocSvc.delete(docId).subscribe({
      next: () => {
        this.alertService.show('Documento eliminado correctamente', 'success');
        this.reload.emit();
      },
      error: () => {
        this.docs.set(prev);
        this.alertService.show('Error al eliminar el documento', 'error');
      },
    });
  }
}
