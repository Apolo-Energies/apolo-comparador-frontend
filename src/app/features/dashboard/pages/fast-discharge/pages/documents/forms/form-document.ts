import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DocumentKey, DocumentState, TramiteType } from '../../../models/person.models';

interface DocDef {
  key: DocumentKey;
  label: string;
}

const DOC_LABELS: Record<DocumentKey, string> = {
  dni_front:           'DNI (Anverso)',
  dni_back:            'DNI (Reverso)',
  factura_estudio:     'Factura para estudio',
  bank:                'Justificante bancario',
  escrituras_poderes:  'Escrituras / Poderes',
  cif_file:            'CIF',
  cie:                 'CIE',
  justo_titulo:        'Justo título',
};

@Component({
  selector: 'app-form-document',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-cols-1 gap-3">
      @for (doc of requiredDocs(); track doc.key) {
        <div
          class="flex items-center justify-between rounded-lg border p-4 transition-colors"
          [class.border-green-500]="!!documents()[doc.key]"
          [class.bg-green-50]="!!documents()[doc.key]"
          [class.dark:bg-green-950]="!!documents()[doc.key]"
          [class.border-border]="!documents()[doc.key]"
        >
          <div class="flex flex-col gap-0.5 min-w-0 mr-4">
            <span class="text-sm font-medium text-foreground truncate">{{ doc.label }}</span>
            @if (documents()[doc.key]; as file) {
              <span class="text-xs text-green-600 truncate">{{ file.name }}</span>
            } @else {
              <span class="text-xs text-muted-foreground">Sin archivo seleccionado</span>
            }
          </div>

          <label class="shrink-0 cursor-pointer">
            <span
              class="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border transition-colors"
              [class.border-green-500]="!!documents()[doc.key]"
              [class.text-green-700]="!!documents()[doc.key]"
              [class.border-border]="!documents()[doc.key]"
              [class.text-muted-foreground]="!documents()[doc.key]"
              [class.hover:bg-muted]="!documents()[doc.key]"
            >
              {{ documents()[doc.key] ? 'Cambiar' : 'Subir' }}
            </span>
            <input
              type="file"
              class="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              (change)="onFileChange(doc.key, $event)"
            />
          </label>
        </div>
      }
    </div>
  `,
})
export class FormDocumentComponent {
  readonly isCompany = input(false);
  readonly tramite = input<TramiteType>('ALTA_NUEVA');
  readonly documents = input<DocumentState>({});
  readonly fileSelect = output<{ key: DocumentKey; file: File }>();

  readonly requiredDocs = computed<DocDef[]>(() => {
    const showCIE =
      this.tramite() === 'ALTA_NUEVA' ||
      this.tramite() === 'CAMBIO_TARIFA' ||
      this.tramite() === 'CAMBIO_POTENCIA';

    const showJustoTitulo = this.tramite() === 'NUEVO_TITULAR';

    const keys: DocumentKey[] = [
      'dni_front',
      'dni_back',
      'factura_estudio',
      'bank',
      'escrituras_poderes',
      ...(this.isCompany() ? ['cif_file' as DocumentKey] : []),
      ...(showCIE ? ['cie' as DocumentKey] : []),
      ...(showJustoTitulo ? ['justo_titulo' as DocumentKey] : []),
    ];

    return keys.map(key => ({ key, label: DOC_LABELS[key] }));
  });

  onFileChange(key: DocumentKey, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.fileSelect.emit({ key, file });
  }
}
