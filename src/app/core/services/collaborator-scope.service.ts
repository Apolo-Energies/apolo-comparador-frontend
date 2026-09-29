import { Injectable, inject, signal } from '@angular/core';
import { UserService } from './user.service';

export interface CollaboratorOption {
  id:   string;
  name: string;
}

/**
 * Selección global de "ver como colaborador X" para Master, usada hoy solo en
 * Analítica (Historial/Estadística) para que esas pantallas filtren por un
 * colaborador concreto sin perder la selección al navegar entre ellas.
 * Sin selección (null) = comportamiento actual, sin filtrar.
 * No afecta ninguna otra pantalla del dashboard.
 *
 * El diálogo se abre desde un ítem real del sidebar ("APOLO ENERGIES" →
 * "Colaborador") vía openCollaboratorDialogGuard, que intercepta la
 * navegación de ese ítem en vez de dejarlo navegar — ver ese guard.
 */
@Injectable({ providedIn: 'root' })
export class CollaboratorScopeService {
  private readonly userService = inject(UserService);

  readonly options    = signal<CollaboratorOption[]>([]);
  readonly loading    = signal(false);
  readonly selected   = signal<CollaboratorOption | null>(null);
  readonly dialogOpen = signal(false);
  private  loaded     = false;

  openDialog(): void {
    this.loadOptions();
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  select(option: CollaboratorOption | null): void {
    this.selected.set(option);
    this.dialogOpen.set(false);
  }

  private loadOptions(): void {
    if (this.loaded || this.loading()) return;
    this.loading.set(true);
    this.userService.getByFilters({ pageSize: 200 }).subscribe({
      next: res => {
        this.options.set(res.items.map(u => ({ id: u.id, name: u.fullName })));
        this.loading.set(false);
        this.loaded = true;
      },
      error: () => this.loading.set(false),
    });
  }
}
