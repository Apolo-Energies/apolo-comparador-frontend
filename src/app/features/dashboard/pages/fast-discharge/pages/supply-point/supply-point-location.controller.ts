import { computed, signal } from '@angular/core';
import { ContractService } from '../../../../../../core/services/contract.service';
import { EeMunicipio, EeTown } from '../../../../../../core/models/energy-expert.model';

export interface SupplyPointLocationDeps {
  contractService: ContractService;
}

/**
 * Encapsulates the province/municipio cascading lookups (by zip code) for
 * the supply-point form, including the SIPS prefill flow. Extracted to keep
 * SupplyPointPage under the file-size guideline (R1).
 */
export class SupplyPointLocationController {
  constructor(private readonly deps: SupplyPointLocationDeps) {}

  readonly province = signal('');
  readonly city     = signal('');
  readonly zipCode  = signal('');

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
    return q ? this.municipios().filter(m => m.Nombre.toLowerCase().includes(q)) : this.municipios();
  });

  /** Restores saved province/municipio state (e.g. from the store on page load). */
  init(saved: { province: string; city: string; zipCode: string; idProvincia?: number; idPoblacion?: number }): void {
    this.province.set(saved.province);
    this.city.set(saved.city);
    this.zipCode.set(saved.zipCode);
    this.provinciaId.set(saved.idProvincia ?? 0);
    this.municipioId.set(saved.idPoblacion ?? 0);
    if (saved.zipCode?.length === 5) this.loadProvinces(saved.zipCode.substring(0, 2));
    else if ((saved.idProvincia ?? 0) > 0) this.loadMunicipios(saved.idProvincia!);
  }

  /** Applies province/city/zip prefilled from a SIPS lookup and triggers the cascading loads. */
  prefillFromSips(province: string, city: string, zipCode: string): void {
    this.province.set(province);
    this.city.set(city);
    this.zipCode.set(zipCode);
    if (zipCode.length === 5) this.loadProvinces(zipCode.substring(0, 2));
  }

  onZipCodeChange(value: string): void {
    const digits = value.replace(/\D/g, '').substring(0, 5);
    this.zipCode.set(digits);
    this.provinciaId.set(0);
    this.provinces.set([]);
    this.municipios.set([]);
    this.municipioId.set(0);
    this.municipioSearch.set('');
    if (digits.length === 5) this.loadProvinces(digits.substring(0, 2));
  }

  onProvinciaChange(event: Event): void {
    const id = parseInt((event.target as HTMLSelectElement).value, 10);
    this.provinciaId.set(isNaN(id) ? 0 : id);
    this.municipioId.set(0);
    this.municipios.set([]);
    this.municipioSearch.set('');
    if (id > 0) this.loadMunicipios(id);
  }

  onMunicipioSearchInput(value: string): void {
    this.municipioSearch.set(value);
    this.municipioId.set(0);
    this.municipioOpen.set(true);
  }

  selectMunicipio(m: EeMunicipio): void {
    this.municipioId.set(m.IdPoblacion);
    this.municipioSearch.set(m.Nombre);
    this.city.set(m.Nombre);
    this.municipioOpen.set(false);
  }

  onMunicipioBlur(): void {
    setTimeout(() => this.municipioOpen.set(false), 150);
  }

  reset(): void {
    this.province.set(''); this.city.set(''); this.zipCode.set('');
    this.provinces.set([]); this.provinciaId.set(0);
    this.municipios.set([]); this.municipioId.set(0); this.municipioSearch.set('');
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
          this.province.set(match.Nombre);
          this.municipios.set([]);
          this.municipioId.set(0);
          this.municipioSearch.set('');
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
        const savedId = this.municipioId();
        if (savedId > 0) {
          const m = list.find(m => m.IdPoblacion === savedId);
          if (m) this.municipioSearch.set(m.Nombre);
        } else {
          const diacritics = new RegExp('[̀-ͯ]', 'g');
          const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(diacritics, '');
          const cityName = norm(this.city().trim());
          if (cityName) {
            const m = list.find(m => norm(m.Nombre) === cityName)
                    ?? list.find(m => norm(m.Nombre).split('/').some(p => p.trim() === cityName))
                    ?? list.find(m => norm(m.Nombre).includes(cityName) || cityName.includes(norm(m.Nombre).split('/')[0].trim()));
            if (m) { this.municipioId.set(m.IdPoblacion); this.municipioSearch.set(m.Nombre); }
          }
        }
      },
      error: () => this.loadingMunicipios.set(false),
    });
  }
}
