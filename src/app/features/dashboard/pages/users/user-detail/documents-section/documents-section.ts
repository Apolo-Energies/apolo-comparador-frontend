import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertService, ButtonComponent, DialogComponent } from '@apolo-energies/ui';
import { DomSanitizer } from '@angular/platform-browser';
import { ContractDocumentService } from '../../../../../../services/contract-document.service';
import { ContractService } from '../../../../../../services/contract.service';
import { firstValueFrom } from 'rxjs';
import { ContractDocument, UserDetail } from '../../../../../../entities/user-detail.model';
import { REQUIRED_DOCS_BY_PERSON_TYPE } from '../configs/doc-by-person-type.config';
import { DOC_TYPE_LABELS } from '../configs/doc-type-labels.config';
import { DOC_STATUS_CONFIG } from '../configs/doc-status.config';

interface DocSlot {
  type: string;
  label: string;
  doc: ContractDocument | null;
}

@Component({
  selector: 'app-documents-section',
  standalone: true,
  imports: [FormsModule, ButtonComponent, DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- ─── Header ─────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between mb-4">
      <p class="flex items-center gap-2 text-base font-semibold text-foreground">
        <span class="h-2 w-2 rounded-full bg-primary"></span>
        Documentación
      </p>

      <div class="flex items-center gap-3">
        <!-- Master: upload physical signed contract -->
        @if (canUploadSignedContract()) {
          <button
            type="button"
            class="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            (click)="openSignedContractUpload()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
              <polyline points="12 18 12 12"/><polyline points="9 15 12 12 15 15"/>
            </svg>
            Subir contrato firmado
          </button>
        }

        <!-- Upload button: master always; user only when there are missing docs -->
        @if (user()?.customer && (isMaster() || availableTypes().length > 0)) {
          <button
            type="button"
            class="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
            (click)="uploadModalOpen.set(true)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Subir Documento
          </button>
        }
      </div>
    </div>

    <!-- ─── Completion banner (shown once per user) ──────────────── -->
    @if (showCompletionBanner()) {
      <div class="flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50
                  dark:border-green-900/40 dark:bg-green-900/20 px-4 py-3 mb-4">
        <div class="flex items-start gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            class="shrink-0 text-green-600 dark:text-green-400 mt-0.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <p class="text-sm font-medium text-green-700 dark:text-green-300">
            ¡Felicidades! Has subido todos los documentos requeridos.
          </p>
        </div>
        <button type="button"
          class="shrink-0 text-green-600 hover:text-green-800 dark:text-green-400"
          (click)="dismissCompletion()">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    }

    <!-- ─── No customer yet ──────────────────────────────────────── -->
    @if (!user()?.customer) {
      <div class="flex flex-col items-center justify-center py-10 text-center">
        <p class="text-sm text-muted-foreground">Agrega los datos del cliente para gestionar documentos.</p>
      </div>
    } @else {

      <!-- ─── Document slots ──────────────────────────────────────── -->
      <div class="space-y-2">
        @for (slot of allSlots(); track slot.type) {

          <!-- Non-master: only show uploaded docs. Master: show all (including pending slots) -->
          @if (isMaster() || slot.doc) {
            <div class="space-y-2">

              <div class="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">

                <!-- Doc icon -->
                <div class="flex items-center justify-center w-9 h-9 rounded-lg bg-muted shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
                    class="text-muted-foreground">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>

                <!-- Title + subtitle -->
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-foreground truncate">{{ slot.label }}</p>
                  @if (slot.doc) {
                    <p class="text-xs text-muted-foreground mt-0.5">
                      {{ slot.label }} &middot; Subido {{ formatDate(slot.doc.createdAt) }}
                    </p>
                  }
                </div>

                <!-- Right: badge + actions -->
                <div class="flex items-center gap-2 shrink-0">

                  @if (slot.doc; as doc) {
                    <!-- Status badge -->
                    @if (statusConfig(doc.status); as s) {
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {{ s.cls }}">
                        {{ s.label }}
                      </span>
                    }

                    <!-- Approve / Reject: master only -->
                    @if (isMaster() && canReview(doc.status)) {
                      <button type="button"
                        class="p-1.5 rounded-md hover:bg-green-50 text-green-600 hover:text-green-700 transition-colors"
                        title="Aprobar"
                        (click)="onVerify(doc.id)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </button>
                      <button type="button"
                        class="p-1.5 rounded-md hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors"
                        title="Rechazar"
                        (click)="onRejectClick(doc.id)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    }

                    <!-- Reemplazar: non-master, rejected docs only -->
                    @if (!isMaster() && doc.status === 'Rejected') {
                      <button type="button"
                        class="inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
                        (click)="openReplaceModal(slot.type, doc.id)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="1 4 1 10 7 10"/>
                          <path d="M3.51 15a9 9 0 1 0 .49-3.85"/>
                        </svg>
                        Reemplazar
                      </button>
                    }

                    <!-- Ver button -->
                    <button type="button"
                      class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      (click)="viewDoc.set(doc)">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      Ver
                    </button>

                    <!-- Delete button: master only -->
                    @if (isMaster()) {
                      <button type="button"
                        class="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                        title="Eliminar"
                        (click)="onDelete(doc.id)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/>
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    }

                  } @else {
                    <!-- Pending badge (master only sees these) -->
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Pendiente
                    </span>
                  }

                </div>
              </div>

              <!-- Rejection reason (visible to all) -->
              @if (slot.doc?.reviewComment) {
                <div class="ml-12 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:border-red-900/40 dark:text-red-400">
                  <span class="font-medium">Motivo del rechazo: </span>{{ slot.doc!.reviewComment }}
                </div>
              }

              <!-- Reject inline input (master only) -->
              @if (rejectingDocId() === slot.doc?.id) {
                <div class="ml-12 flex items-center gap-2">
                  <input
                    type="text"
                    [ngModel]="rejectObservation()"
                    (ngModelChange)="rejectObservation.set($event)"
                    placeholder="Motivo del rechazo..."
                    class="flex-1 px-3 py-1.5 text-sm rounded-md border border-border bg-card text-foreground
                           placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    (keyup.enter)="onRejectSubmit(slot.doc!.id)" />
                  <button type="button"
                    class="px-3 py-1.5 text-sm rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
                    (click)="onRejectSubmit(slot.doc!.id)">Enviar</button>
                  <button type="button"
                    class="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted transition-colors"
                    (click)="rejectingDocId.set(null)">Cancelar</button>
                </div>
              }

            </div>
          }
        }

        <!-- Non-master: no docs uploaded yet -->
        @if (!isMaster() && uploadedSlots().length === 0) {
          <div class="flex flex-col items-center justify-center py-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
              class="text-muted-foreground mb-2">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <p class="text-sm text-muted-foreground">Aún no has subido ningún documento.</p>
          </div>
        }
      </div>
    }

    <!-- ─── Upload modal ─────────────────────────────────────────── -->
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
            @if (availableTypes().length === 0 && !selectedUploadType()) {
              <p class="text-sm text-muted-foreground py-2">
                Todos los documentos requeridos ya han sido subidos.
              </p>
            } @else {
              <select [ngModel]="selectedUploadType()"
                (ngModelChange)="selectedUploadType.set($event)"
                class="w-full px-3 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground
                       focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer">
                <option [ngValue]="null" disabled>Seleccionar tipo...</option>
                @for (t of uploadableTypes(); track t) {
                  <option [ngValue]="t">{{ docTypeLabel(t) }}</option>
                }
              </select>
            }
          </div>

          <div class="space-y-1">
            <label class="text-sm font-medium text-muted-foreground">Archivo *</label>
            <input type="file" (change)="onFileSelected($event)"
              class="w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-md
                     file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground
                     hover:file:opacity-90 cursor-pointer" />
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

    <!-- ─── View document modal ──────────────────────────────────── -->
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
                  &middot;
                  <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium {{ s.cls }}">
                    {{ s.label }}
                  </span>
                }
              </p>
            </div>
          </div>

          @if (doc.reviewComment) {
            <div class="mx-6 mt-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700
                        dark:bg-red-900/20 dark:border-red-900/40 dark:text-red-400">
              <span class="font-medium">Motivo del rechazo: </span>{{ doc.reviewComment }}
            </div>
          }

          <div class="flex-1 min-h-0 px-6 py-4">
            @if (doc.previewUrl) {
              <iframe [src]="sanitizeUrl(doc.previewUrl)"
                class="w-full h-full rounded-md border border-border"></iframe>
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
                  class="text-sm text-blue-500 hover:underline">Abrir archivo</a>
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
  private readonly platformId     = inject(PLATFORM_ID);

  readonly docs               = signal<ContractDocument[]>([]);
  readonly localContractId    = signal<string | null>(null);
  readonly uploadModalOpen    = signal(false);
  readonly uploading          = signal(false);
  readonly viewDoc            = signal<ContractDocument | null>(null);
  readonly rejectingDocId     = signal<string | null>(null);
  readonly selectedUploadType = signal<string | null>(null);
  readonly selectedFile       = signal<File | null>(null);
  readonly rejectObservation  = signal('');
  readonly completionDismissed = signal(false);
  // When set, onUpload calls replace instead of upload
  private replacingDocId      = signal<string | null>(null);

  // Types not yet uploaded (required but missing or rejected)
  readonly availableTypes = computed(() => {
    const u = this.user();
    const contract = u?.contract;
    if (!u?.customer) return [];
    const required = contract?.documents.required
      ?? REQUIRED_DOCS_BY_PERSON_TYPE[u.customer.personType]
      ?? [];
    const done = new Set(
      (contract?.documents.uploaded ?? [])
        .filter(d => d.status !== 'Rejected')
        .map(d => d.documentType),
    );
    return required.filter(t => !done.has(t));
  });

  // Master can upload the physical signed contract when it doesn't exist yet or was rejected
  readonly canUploadSignedContract = computed(() => {
    if (!this.isMaster()) return false;
    const contract = this.user()?.contract;
    if (!contract) return false;
    const existing = contract.documents.uploaded.find(d => d.documentType === 'SignedContract');
    return !existing || existing.status === 'Rejected';
  });

  // Types that can be selected in the upload modal (availableTypes + the pre-selected replace type)
  readonly uploadableTypes = computed(() => {
    const avail = [...this.availableTypes()];
    const selected = this.selectedUploadType();
    if (selected && !avail.includes(selected)) {
      return [selected, ...avail];
    }
    return avail;
  });

  // All slots: required (with or without upload) + extra uploaded (SignedContract etc.)
  readonly allSlots = computed<DocSlot[]>(() => {
    const u = this.user();
    const contract = u?.contract;
    if (!u?.customer) return [];
    const required = contract?.documents.required
      ?? REQUIRED_DOCS_BY_PERSON_TYPE[u.customer.personType]
      ?? [];
    const uploadedMap = new Map(
      (contract?.documents.uploaded ?? []).map(d => [d.documentType, d]),
    );
    const slots: DocSlot[] = required.map(type => ({
      type,
      label: DOC_TYPE_LABELS[type] ?? type,
      doc: uploadedMap.get(type) ?? null,
    }));
    const requiredSet = new Set(required);
    for (const [type, doc] of uploadedMap) {
      if (!requiredSet.has(type)) {
        slots.push({ type, label: DOC_TYPE_LABELS[type] ?? type, doc });
      }
    }
    return slots;
  });

  // Only slots with an uploaded doc (used for non-master empty state check)
  readonly uploadedSlots = computed<DocSlot[]>(() =>
    this.allSlots().filter(s => s.doc !== null)
  );

  readonly showCompletionBanner = computed(() =>
    !this.isMaster() &&
    this.availableTypes().length === 0 &&
    this.uploadedSlots().length > 0 &&
    !this.completionDismissed()
  );

  constructor() {
    effect(() => {
      const u = this.user();
      this.docs.set(u?.contract?.documents.uploaded ?? []);
      this.localContractId.set(u?.contract?.id ?? null);
    }, { allowSignalWrites: true });

    effect(() => {
      const userId = this.user()?.id;
      if (!userId || !isPlatformBrowser(this.platformId)) return;
      const seen = !!localStorage.getItem(`docs_complete_${userId}`);
      this.completionDismissed.set(seen);
    }, { allowSignalWrites: true });
  }

  dismissCompletion(): void {
    const userId = this.user()?.id;
    if (userId && isPlatformBrowser(this.platformId)) {
      localStorage.setItem(`docs_complete_${userId}`, '1');
    }
    this.completionDismissed.set(true);
  }

  docTypeLabel(type: string): string {
    return DOC_TYPE_LABELS[type] ?? type;
  }

  statusConfig(status: string) {
    return DOC_STATUS_CONFIG[status] ?? null;
  }

  canReview(status: string): boolean {
    return status !== 'Validated' && status !== 'Rejected' && status !== 'Signed';
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  sanitizeUrl(url: string) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
  }

  openReplaceModal(type: string, docId: string): void {
    this.replacingDocId.set(docId);
    this.selectedUploadType.set(type);
    this.uploadModalOpen.set(true);
  }

  openSignedContractUpload(): void {
    const uploaded = this.user()?.contract?.documents.uploaded ?? [];
    const existing = uploaded.find(
      d => d.documentType === 'SignedContract' && d.status === 'Rejected',
    );
    if (existing) {
      this.openReplaceModal('SignedContract', existing.id);
    } else {
      this.selectedUploadType.set('SignedContract');
      this.uploadModalOpen.set(true);
    }
  }

  closeUploadModal(): void {
    this.uploadModalOpen.set(false);
    this.selectedUploadType.set(null);
    this.selectedFile.set(null);
    this.replacingDocId.set(null);
  }

  async onUpload(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    this.uploading.set(true);

    const replaceId = this.replacingDocId();

    // Replace flow: POST /contract-document/replace/{documentId}
    if (replaceId) {
      this.contractDocSvc.replace(replaceId, file).subscribe({
        next: () => {
          this.alertService.show('Documento reemplazado correctamente', 'success');
          this.uploading.set(false);
          this.closeUploadModal();
          this.reload.emit();
        },
        error: () => {
          this.alertService.show('Error al reemplazar el documento', 'error');
          this.uploading.set(false);
        },
      });
      return;
    }

    // Upload flow: POST /contract-document/{contractId}
    const docType = this.selectedUploadType();
    if (docType === null) { this.uploading.set(false); return; }

    const u = this.user();
    if (!u) { this.uploading.set(false); return; }

    let contractId = this.localContractId();

    if (!contractId) {
      const customerId = u.customerId ?? u.customer?.id ?? null;
      if (!customerId) {
        this.alertService.show('El usuario no tiene cliente asignado', 'error');
        this.uploading.set(false);
        return;
      }
      try {
        const contract = await firstValueFrom(
          this.contractSvc.createManual({ customerId, origin: 0 }),
        );
        contractId = contract.id;
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
      list.map(d => d.id === docId ? { ...d, status: 'Validated', reviewComment: null } : d)
    );
    const contractId = this.localContractId();
    const validate$  = doc?.documentType === 'SignedContract' && contractId
      ? this.contractDocSvc.validateSigned(contractId)
      : this.contractDocSvc.validate(docId);
    validate$.subscribe({
      next: () => { this.alertService.show('Documento verificado correctamente', 'success'); this.reload.emit(); },
      error: () => { this.docs.set(prev); this.alertService.show('Error al verificar el documento', 'error'); },
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
      list.map(d => d.id === docId ? { ...d, status: 'Rejected', reviewComment: observation } : d)
    );
    this.rejectingDocId.set(null);
    this.rejectObservation.set('');
    this.contractDocSvc.reject(docId, observation).subscribe({
      next: () => { this.alertService.show('Documento rechazado correctamente', 'success'); this.reload.emit(); },
      error: () => { this.docs.set(prev); this.alertService.show('Error al rechazar el documento', 'error'); },
    });
  }

  onDelete(docId: string): void {
    const prev = this.docs();
    this.docs.update(list => list.filter(d => d.id !== docId));
    if (this.rejectingDocId() === docId) this.rejectingDocId.set(null);
    this.contractDocSvc.delete(docId).subscribe({
      next: () => { this.alertService.show('Documento eliminado correctamente', 'success'); this.reload.emit(); },
      error: () => { this.docs.set(prev); this.alertService.show('Error al eliminar el documento', 'error'); },
    });
  }
}
