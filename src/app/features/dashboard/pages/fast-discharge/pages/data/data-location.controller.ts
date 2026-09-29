import { computed, signal } from '@angular/core';
import { ContractService } from '../../../../../../core/services/contract.service';
import { EeMunicipio, EeTown } from '../../../../../../core/models/energy-expert.model';

export interface DataLocationDeps {
  contractService: ContractService;
}

/**
 * Encapsulates the province/municipio cascading lookups (by zip code) for
 * the customer-data form. Extracted to keep DataPage under the file-size
 * guideline (R1).
 */
export class DataLocationController {
  constructor(private readonly deps: DataLocationDeps) {}

  readonly cp = signal('');

  readonly provinces         = signal<EeTown[]>([]);
  readonly provinciaId       = signal(0);
  readonly loadingProvinces  = signal(false);
  readonly municipios        = signal<EeMunicipio[]>([]);
  readonly municipioId       = signal(0);
  readonly municipioSearch   = signal('');
  readonly municipioOpen     = signal(false);
  readonly loadingMunicipios = signal(false);

  readonly filteredMunicipios = computed(() => {
    const q = this.municipioSearch().toLowerCase();
    return q
      ? this.municipios().filter(m => m.Nombre.toLowerCase().includes(q))
      : this.municipios();
  });

  /** Restores saved province/municipio state (e.g. from the store on page load). */
  init(saved: { cp: string; idProvincia?: number; idPoblacion?: number }): void {
    this.cp.set(saved.cp);
    this.provinciaId.set(saved.idProvincia ?? 0);
    this.municipioId.set(saved.idPoblacion ?? 0);
    if (saved.cp?.length === 5) {
      this.loadProvinces(saved.cp.substring(0, 2));
    }
    if ((saved.idProvincia ?? 0) > 0) {
      this.loadMunicipios(saved.idProvincia!);
    }
  }

  onCpChange(value: string): void {
    const digits = value.replace(/\D/g, '').substring(0, 5);
    this.cp.set(digits);
    this.provinciaId.set(0);
    this.provinces.set([]);
    this.municipios.set([]);
    this.municipioId.set(0);
    this.municipioSearch.set('');
    if (digits.length === 5) {
      this.loadProvinces(digits.substring(0, 2));
    }
  }

  onProvinciaChange(event: Event): void {
    const id = parseInt((event.target as HTMLSelectElement).value, 10);
    this.provinciaId.set(isNaN(id) ? 0 : id);
    this.municipioId.set(0);
    this.municipios.set([]);
    this.municipioSearch.set('');
    if (id > 0) this.loadMunicipios(id);
  }

  selectMunicipio(m: EeMunicipio): void {
    this.municipioId.set(m.IdPoblacion);
    this.municipioSearch.set(m.Nombre);
    this.municipioOpen.set(false);
  }

  onMunicipioSearchInput(value: string): void {
    this.municipioSearch.set(value);
    this.municipioId.set(0);
    this.municipioOpen.set(true);
  }

  onMunicipioBlur(): void {
    setTimeout(() => this.municipioOpen.set(false), 150);
  }

  private loadProvinces(prefix: string): void {
    const id = parseInt(prefix, 10);
    this.loadingProvinces.set(true);
    this.deps.contractService.getProvinces(id).subscribe({
      next: list => {
        this.provinces.set(list);
        this.loadingProvinces.set(false);
        const match = list.find(p => p.IdProvincia === id);
        if (match) {
          this.provinciaId.set(match.IdProvincia);
          this.municipios.set([]);
          this.municipioId.set(0);
          this.loadMunicipios(match.IdProvincia);
        }
      },
      error: () => this.loadingProvinces.set(false),
    });
  }

  private loadMunicipios(idProvincia: number): void {
    this.loadingMunicipios.set(true);
    this.deps.contractService.getMunicipios(idProvincia).subscribe({
      next: list => {
        this.municipios.set(list);
        this.loadingMunicipios.set(false);
        const saved = this.municipioId();
        if (saved > 0) {
          const m = list.find(m => m.IdPoblacion === saved);
          if (m) this.municipioSearch.set(m.Nombre);
        }
      },
      error: () => this.loadingMunicipios.set(false),
    });
  }
}
