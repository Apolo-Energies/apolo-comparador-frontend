import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DocumentKey, DocumentState, TramiteType } from '../../../models/person.model';

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
  templateUrl: './form-document.html',
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
