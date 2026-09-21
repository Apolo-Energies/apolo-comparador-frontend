import { computed, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ContractService } from '../../../../core/services/contract.service';
import { AssignedClient } from '../../../../core/models/assigned-client.model';
import { ContratoIncidencia, ContratoCheckItem } from '../../../../core/models/contrato-incidencia.model';

export interface ClientIncidenciasDeps {
  contractService: ContractService;
}

/**
 * Encapsulates the "incidencias" checklist flow for MyClientsPageComponent:
 * loading the per-client checklist (served by Control) and inline field edits.
 * Extracted to keep the page under the file-size guideline (R1). Same pattern
 * as ContractIncidenciasController (contracts-page). No behavior change vs.
 * the inline version — same endpoints, same optimistic-update logic.
 *
 * Solo items entity='cliente' aplican aquí (docs/firma son per-contrato y
 * viven en Contratos > Luz, no en Mis clientes).
 */
export class ClientIncidenciasController {
  constructor(private readonly deps: ClientIncidenciasDeps) {}

  /** Incidencias servidas por Control, indexadas por NIF. */
  private readonly _incidencias = signal<ContratoIncidencia[]>([]);
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

  readonly editOpen  = signal(false);
  readonly editItem  = signal<ContratoCheckItem | null>(null);
  readonly editInc   = signal<ContratoIncidencia | null>(null);
  readonly editValue = new FormControl<string>('', { nonNullable: true });

  /** Carga (o recarga) las incidencias en paralelo a la tabla de clientes. */
  load(): void {
    this.deps.contractService.getIncidencias().subscribe({
      next: rows => this._incidencias.set(rows ?? []),
      error: () => this._incidencias.set([]),
    });
  }

  /** Solo items entity='cliente' (docs/firma viven en Contratos > Luz). */
  hasIncidencia(row: AssignedClient): boolean {
    const inc = this.incidenciasByNif().get(row.nif)?.[0];
    if (!inc) return false;
    return inc.checklist.some(i => i.entity === 'cliente' && !i.completed && !i.optional);
  }

  firstIncidencia(row: AssignedClient): ContratoIncidencia | null {
    return this.incidenciasByNif().get(row.nif)?.[0] ?? null;
  }

  /** Solo items entity='cliente'. */
  getClienteChecklist(row: AssignedClient): ContratoCheckItem[] {
    const items = this.incidenciasByNif().get(row.nif)?.[0]?.checklist ?? [];
    return items.filter(i => i.entity === 'cliente');
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
