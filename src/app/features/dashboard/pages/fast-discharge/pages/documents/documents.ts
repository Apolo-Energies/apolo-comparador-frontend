import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent, AlertService } from '@apolo-energies/ui';
import { AlertComponent } from '@apolo-energies/ui';
import { FastDischargeStore } from '../../store/fast-discharge.store';
import { DocumentKey, DocumentState } from '../../models/person.models';
import { FormDocumentComponent } from './forms/form-document';

@Component({
  selector: 'app-fd-documents',
  imports: [ButtonComponent, AlertComponent, FormDocumentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-alert />

    <div class="flex items-center justify-center min-h-full px-4 py-8">
      <div class="w-full max-w-xl bg-card border border-border rounded-lg shadow-xl px-8 py-8 flex flex-col" style="max-height: 90vh">

        <!-- Header fijo -->
        <div class="shrink-0 space-y-2">
          <div class="flex justify-between text-sm text-muted-foreground">
            <span>Documentación</span>
            <span>{{ progress() }}%</span>
          </div>
          <div class="w-full bg-muted rounded-full h-1.5">
            <div
              class="bg-primary-button h-1.5 rounded-full transition-all duration-300"
              [style.width.%]="progress()"
            ></div>
          </div>
        </div>

        <!-- Cuerpo con scroll -->
        <div class="flex-1 overflow-y-auto mt-4 pr-1">
          <app-form-document
            [isCompany]="isCompany()"
            [documents]="documents()"
            (fileSelect)="onFileSelect($event)"
          />
        </div>

        <!-- Footer fijo -->
        <div class="shrink-0 border-t border-border pt-4 mt-4 flex justify-center">
          <ui-button
            label="Siguiente"
            size="sm"
            [disabled]="loading()"
            (click)="onSubmit()"
          />
        </div>

      </div>
    </div>
  `,
})
export class DocumentsPage {
  private readonly router = inject(Router);
  private readonly store = inject(FastDischargeStore);
  private readonly alertService = inject(AlertService);

  readonly loading = signal(false);
  readonly documents = signal<DocumentState>({});

  readonly isCompany = computed(() => this.store.person()?.type === 'Company');

  readonly requiredCount = computed(() => {
    const base = 5;
    const extra = this.isCompany() ? 1 : 0;
    return base + extra + 1; // +1 for CIE (ALTA_NUEVA default)
  });

  readonly progress = computed(() => {
    const docs = this.documents();
    const uploaded = Object.keys(docs).filter(k => !!docs[k as DocumentKey]).length;
    return this.requiredCount()
      ? Math.round((uploaded / this.requiredCount()) * 100)
      : 0;
  });

  constructor() {
    effect(() => {
      if (!this.store.person()) {
        this.router.navigate(['/dashboard/altaRapida']);
      }
    });
  }

  onFileSelect(event: { key: DocumentKey; file: File }): void {
    this.documents.update(prev => ({ ...prev, [event.key]: event.file }));
  }

  onSubmit(): void {
    const docs = this.documents();
    const requiredKeys: DocumentKey[] = [
      'dni_front', 'dni_back', 'factura_estudio', 'bank', 'escrituras_poderes', 'cie',
      ...(this.isCompany() ? ['cif_file' as DocumentKey] : []),
    ];

    const missing = requiredKeys.filter(k => !docs[k]);
    if (missing.length) {
      this.alertService.show('Faltan documentos obligatorios', 'error');
      return;
    }

    this.loading.set(true);
    this.store.setDocuments(docs);
    this.loading.set(false);
    this.router.navigate(['/dashboard/altaRapida/signature']);
  }
}
