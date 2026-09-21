import { computed, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ContractService } from '../../../../core/services/contract.service';
import { ContratoClienteRow } from '../../../../core/models/contrato.model';
import { ContratoIncidencia, ContratoCheckItem } from '../../../../core/models/contrato-incidencia.model';

export interface ContractIncidenciasDeps {
  contractService: ContractService;
}

/**
 * Encapsulates the "incidencias" checklist flow for ContractsPageComponent:
 * loading the per-client checklist (served by Control), inline field edits,
 * attachment uploads and the firma-SMS toggle. Extracted to keep the page
 * under the file-size guideline (R1). No behavior change vs. the inline
 * version — same endpoints, same optimistic-update logic.
 */
export class ContractIncidenciasController {
  constructor(private readonly deps: ContractIncidenciasDeps) {}

  /** Incidencias servidas por Control (checklist per-contrato). */
  private readonly _incidencias = signal<ContratoIncidencia[]>([]);

  /** Index Map<NIF, ContratoIncidencia[]> para lookup O(1) al expandir. */
  readonly incidenciasByNif = computed(() => {
    const map = new Map<string, ContratoIncidencia[]>();
    for (const inc of this._incidencias()) {
      if (!inc.clienteNif) continue;
      const arr = map.get(inc.clienteNif) ?? [];
      arr.push(inc);
      map.set(inc.clienteNif, arr);
    }
    return map;
  });

  readonly saving    = signal(false);
  readonly formError = signal<string | null>(null);

  // Editar cliente
  readonly editOpen  = signal(false);
  readonly editItem  = signal<ContratoCheckItem | null>(null);
  readonly editInc   = signal<ContratoIncidencia | null>(null);
  readonly editValue = new FormControl<string>('', { nonNullable: true });

  /** Carga (o recarga) las incidencias en paralelo a la tabla de contratos. */
  load(): void {
    this.deps.contractService.getIncidencias().subscribe({
      next: rows => this._incidencias.set(rows ?? []),
      error: () => this._incidencias.set([]),
    });
  }

  /** Si el cliente tiene N contratos pendientes, muestra el primero. */
  getChecklist(row: ContratoClienteRow): ContratoCheckItem[] {
    return this.incidenciasByNif().get(row.NIF)?.[0]?.checklist ?? [];
  }

  groupItems(items: ContratoCheckItem[], group: string): ContratoCheckItem[] {
    return items.filter(i => i.group === group);
  }

  /** Devuelve la incidencia del cliente (necesaria para conocer UUID de contrato/cliente al escribir). */
  firstIncidencia(row: ContratoClienteRow): ContratoIncidencia | null {
    return this.incidenciasByNif().get(row.NIF)?.[0] ?? null;
  }

  /** Cliente aparece en la lista de incidencias servida por Control. */
  hasIncidencia(row: ContratoClienteRow): boolean {
    return (this.incidenciasByNif().get(row.NIF)?.length ?? 0) > 0;
  }

  openEdit(inc: ContratoIncidencia, item: ContratoCheckItem): void {
    this.editInc.set(inc);
    this.editItem.set(item);
    this.editValue.setValue(item.currentValue ?? '');
    this.formError.set(null);
    this.editOpen.set(true);
  }

  closeEdit(): void {
    this.editOpen.set(false);
    this.editInc.set(null);
    this.editItem.set(null);
  }

  get canSaveEdit(): boolean {
    return this.editValue.value.trim().length > 0;
  }

  saveEdit(): void {
    const inc = this.editInc();
    const item = this.editItem();
    if (!inc || !item || !item.field) return;
    this.saving.set(true);
    this.formError.set(null);
    const newValue = this.editValue.value;
    this.deps.contractService.patchCliente(inc.clienteId, { [item.field]: newValue }).subscribe({
      next: () => {
        this.applyChecklistUpdate(inc.id, item.key, {
          completed: newValue.trim().length > 0,
          currentValue: newValue,
        });
        this.saving.set(false);
        this.closeEdit();
      },
      error: () => {
        this.saving.set(false);
        this.formError.set('Error al guardar. Inténtalo de nuevo.');
      },
    });
  }

  // Adjuntar documento: click botón → file picker nativo → upload directo.
  onAdjuntar(inc: ContratoIncidencia, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.saving.set(true);
    this.deps.contractService.uploadAnexo(inc.id, file).subscribe({
      next: () => {
        this.applyChecklistUpdate(inc.id, 'documentacion', {
          completed: true,
          currentValue: 'Archivo(s) adjuntado(s)',
        });
        this.saving.set(false);
      },
      error: () => {
        this.saving.set(false);
        alert('No se pudo subir el archivo. Verifica que pese menos de 50 MB.');
      },
    });
  }

  // Marcar firmado (sin dialog, con optimistic update)
  toggleFirma(inc: ContratoIncidencia): void {
    this.saving.set(true);
    this.deps.contractService.toggleValidado(inc.id).subscribe({
      next: () => {
        this._incidencias.update(rows => rows.map(r => {
          if (r.id !== inc.id) return r;
          const newChecklist = r.checklist.map(i =>
            i.key === 'firmaSms'
              ? { ...i, completed: !i.completed, currentValue: !i.completed ? 'Firmado' : null }
              : i,
          );
          const completedItems = newChecklist.filter(i => !i.optional && i.completed).length;
          return { ...r, checklist: newChecklist, completedItems };
        }));
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  /** Actualiza in-place el checklist de una incidencia — evita refetch tras cada write. */
  private applyChecklistUpdate(incId: string, itemKey: string, patch: Partial<ContratoCheckItem>): void {
    this._incidencias.update(rows => rows.map(r => {
      if (r.id !== incId) return r;
      const newChecklist = r.checklist.map(i => i.key === itemKey ? { ...i, ...patch } : i);
      const completedItems = newChecklist.filter(i => !i.optional && i.completed).length;
      return { ...r, checklist: newChecklist, completedItems };
    }));
  }
}
