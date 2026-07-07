import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent, InputFieldComponent } from '@apolo-energies/ui';
import { SipsService } from '../../../../../../services/sips.service';
import { SipsPs } from '../../../../../../entities/sips.model';
import { FastDischargeStore } from '../../store/fast-discharge.store';
import { ContractService, EeTown, EeMunicipio } from '../../../../../../services/contract.service';

@Component({
  selector: 'app-fd-supply-point',
  imports: [ButtonComponent, InputFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-center min-h-full px-4 py-8">
      <div class="w-full max-w-2xl bg-card border border-border rounded-lg shadow-xl px-8 py-8 space-y-6"
           style="max-height: 90vh; overflow-y: auto;">

        <!-- Header -->
        <div>
          <p class="text-xl font-bold text-foreground">Datos del Punto de Suministro</p>
          <p class="text-sm text-muted-foreground">Introduce el CUPS para obtener los datos automáticamente.</p>
        </div>

        <form (submit)="$event.preventDefault(); onSubmit()" class="space-y-5">

          <!-- CUPS + Validar -->
          <div>
            <div class="flex gap-3 items-end">
              <div class="flex-1">
                <ui-input
                  label="CUPS"
                  placeholder="ES0021000000000000AA0F"
                  [value]="cups()"
                  (valueChange)="onCupsChange($event)"
                />
              </div>
              @if (validated()) {
                <ui-button
                  label="Consultar otro"
                  variant="secondary"
                  size="sm"
                  type="button"
                  (click)="onReset()"
                />
              } @else {
                <ui-button
                  label="Validar"
                  size="sm"
                  type="button"
                  [disabled]="validating()"
                  (click)="onValidate()"
                />
              }
            </div>
            @if (validated()) {
              <span class="text-green-500 text-xs mt-1 flex items-center gap-1">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                CUPS validado correctamente
              </span>
            }
            @if (submitted() && !cups().trim()) {
              <span class="text-red-500 text-xs mt-1 block">Este campo es obligatorio</span>
            }
            @if (validationError()) {
              <div class="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 space-y-0.5">
                <p class="font-semibold">No se pudo validar el CUPS</p>
                <p>El SIPS no está disponible o el código no existe. Completa los campos manualmente.</p>
              </div>
            }
          </div>

          <!-- Dirección + CNAE -->
          <div class="flex gap-4">
            <div class="flex-1">
              <ui-input
                label="Dirección del punto de suministro"
                placeholder="Calle Mayor 1"
                [value]="address()"
                (valueChange)="address.set($event)"
              />
              @if (submitted() && !address().trim()) {
                <span class="text-red-500 text-xs mt-1 block">Este campo es obligatorio</span>
              }
            </div>
            <div class="w-36">
              <ui-input
                label="CNAE"
                placeholder="4711"
                [value]="cnae()"
                (valueChange)="cnae.set($event)"
              />
            </div>
          </div>

          <!-- CP + Provincia -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-muted-foreground">CP del suministro</label>
              <input
                class="px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                placeholder="28001" maxlength="5"
                [value]="zipCode()"
                (input)="onZipCodeChange($any($event.target).value)"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-muted-foreground">Provincia</label>
              @if (loadingProvinces()) {
                <div class="px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-muted-foreground">Cargando...</div>
              } @else {
                <select
                  class="px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer"
                  (change)="onProvinciaChange($event)"
                >
                  <option value="0">— Selecciona —</option>
                  @for (p of provinces(); track p.IdProvincia) {
                    <option [value]="p.IdProvincia" [selected]="provinciaId() === p.IdProvincia">{{ p.Nombre }}</option>
                  }
                </select>
              }
            </div>
          </div>

          <!-- Municipio (suministro) -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-muted-foreground">Municipio del suministro</label>
            @if (loadingMunicipios()) {
              <div class="flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-muted-foreground">
                <svg class="animate-spin h-4 w-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
                Cargando municipios...
              </div>
            } @else {
              <div class="relative">
                <div class="relative">
                  <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
                       fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input
                    class="w-full pl-9 pr-9 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    [placeholder]="municipios().length ? 'Buscar municipio...' : 'Selecciona una provincia primero'"
                    [disabled]="!municipios().length"
                    [value]="municipioSearch()"
                    (input)="onMunicipioSearchInput($any($event.target).value)"
                    (focus)="municipioOpen.set(true)"
                    (blur)="onMunicipioBlur()"
                    autocomplete="off"
                  />
                  @if (municipioSearch()) {
                    <button type="button"
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      (mousedown)="municipioSearch.set(''); municipioId.set(0); municipioOpen.set(false)">
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  }
                </div>
                @if (municipioOpen() && filteredMunicipios().length) {
                  <div class="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-card shadow-xl ring-1 ring-black/5">
                    @for (m of filteredMunicipios(); track m.IdPoblacion) {
                      <button type="button"
                        class="w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors"
                        [class.bg-blue-500]="municipioId() === m.IdPoblacion"
                        [class.text-white]="municipioId() === m.IdPoblacion"
                        [class.text-foreground]="municipioId() !== m.IdPoblacion"
                        [class.hover:bg-muted]="municipioId() !== m.IdPoblacion"
                        (mousedown)="selectMunicipio(m)">
                        <span>{{ m.Nombre }}</span>
                        @if (municipioId() === m.IdPoblacion) {
                          <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                            <path d="M20 6 9 17l-5-5"/>
                          </svg>
                        }
                      </button>
                    }
                  </div>
                }
                @if (municipioOpen() && municipioSearch() && !filteredMunicipios().length) {
                  <div class="absolute z-50 w-full mt-1 rounded-lg border border-border bg-card shadow-xl px-4 py-3 text-sm text-muted-foreground text-center">
                    Sin resultados para "{{ municipioSearch() }}"
                  </div>
                }
              </div>
            }
          </div>

          <!-- Potencias -->
          <div class="space-y-3">
            <p class="text-sm font-semibold text-primary-button">Potencias <span class="font-normal text-muted-foreground">(kW)</span>:</p>
            <div class="grid grid-cols-3 gap-4">
              @for (p of periods; track p) {
                <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium text-muted-foreground">{{ p }}</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="0"
                    [value]="potencia(p)"
                    (input)="setPotencia(p, $any($event.target).value)"
                    class="px-3 py-2 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                  />
                </div>
              }
            </div>
          </div>

          <!-- Tipo de tarifa ATR -->
          <div class="w-40">
            <ui-input
              label="Tarifa ATR"
              placeholder="2.0TD"
              [value]="tariffType() ?? ''"
              (valueChange)="tariffType.set($event || null)"
            />
            <p class="text-xs text-muted-foreground mt-1">Ej: 2.0TD, 3.0TD, 6.1TD</p>
          </div>

          <!-- Footer -->
          <div class="border-t border-border pt-4 flex items-center justify-between">
            <ui-button label="Volver"     variant="secondary" size="sm" type="button" (click)="onBack()" />
            <ui-button label="Siguiente"  size="sm"          type="submit" />
          </div>

        </form>
      </div>
    </div>
  `,
})
export class SupplyPointPage {
  private readonly router          = inject(Router);
  private readonly store           = inject(FastDischargeStore);
  private readonly sips            = inject(SipsService);
  private readonly contractService = inject(ContractService);

  readonly validating      = signal(false);
  readonly validationError = signal(false);
  readonly validated       = signal(false);
  readonly submitted       = signal(false);

  readonly cups       = signal('');
  readonly address    = signal('');
  readonly cnae       = signal('');
  readonly province   = signal('');
  readonly city       = signal('');
  readonly zipCode    = signal('');
  readonly tariffType = signal<string | null>(null);

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

  readonly p1 = signal(0);
  readonly p2 = signal(0);
  readonly p3 = signal(0);
  readonly p4 = signal(0);
  readonly p5 = signal(0);
  readonly p6 = signal(0);

  readonly periods = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

  constructor() {
    const sp = this.store.supplyPoint();
    if (sp) {
      this.cups.set(sp.cups);
      this.address.set(sp.address);
      this.cnae.set(sp.cnae);
      this.province.set(sp.province);
      this.city.set(sp.city);
      this.zipCode.set(sp.zipCode);
      this.tariffType.set(sp.tariffType || null);
      this.provinciaId.set(sp.idProvincia ?? 0);
      this.municipioId.set(sp.idPoblacion ?? 0);
      this.p1.set(sp.p1); this.p2.set(sp.p2); this.p3.set(sp.p3);
      this.p4.set(sp.p4); this.p5.set(sp.p5); this.p6.set(sp.p6);
      if (sp.cups) this.validated.set(true);
      if (sp.zipCode?.length === 5) this.loadProvinces(sp.zipCode.substring(0, 2));
      else if ((sp.idProvincia ?? 0) > 0) this.loadMunicipios(sp.idProvincia!);
    }
  }

  potencia(p: string): string {
    const map: Record<string, number> = {
      P1: this.p1(), P2: this.p2(), P3: this.p3(),
      P4: this.p4(), P5: this.p5(), P6: this.p6(),
    };
    return (map[p] ?? 0).toString();
  }

  setPotencia(p: string, v: string): void {
    const val = parseFloat(v) || 0;
    const map: Record<string, (n: number) => void> = {
      P1: n => this.p1.set(n), P2: n => this.p2.set(n), P3: n => this.p3.set(n),
      P4: n => this.p4.set(n), P5: n => this.p5.set(n), P6: n => this.p6.set(n),
    };
    map[p]?.(val);
  }

  onCupsChange(value: string): void {
    this.cups.set(value);
    this.validated.set(false);
    this.validating.set(false);
    this.validationError.set(false);
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

  private loadProvinces(prefix: string): void {
    const id = parseInt(prefix, 10);
    this.loadingProvinces.set(true);
    this.contractService.getProvinces(id).subscribe({
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
    this.contractService.getMunicipios(idProvincia).subscribe({
      next: list => {
        this.municipios.set(list);
        this.loadingMunicipios.set(false);
        const savedId = this.municipioId();
        if (savedId > 0) {
          const m = list.find(m => m.IdPoblacion === savedId);
          if (m) this.municipioSearch.set(m.Nombre);
        } else {
          const cityName = this.city().trim().toLowerCase();
          if (cityName) {
            const m = list.find(m => m.Nombre.toLowerCase() === cityName)
                    ?? list.find(m => m.Nombre.toLowerCase().includes(cityName));
            if (m) { this.municipioId.set(m.IdPoblacion); this.municipioSearch.set(m.Nombre); }
          }
        }
      },
      error: () => this.loadingMunicipios.set(false),
    });
  }

  onReset(): void {
    this.cups.set('');
    this.validated.set(false);
    this.validating.set(false);
    this.validationError.set(false);
    this.tariffType.set(null);
    this.province.set(''); this.city.set(''); this.zipCode.set(''); this.cnae.set('');
    this.provinces.set([]); this.provinciaId.set(0);
    this.municipios.set([]); this.municipioId.set(0); this.municipioSearch.set('');
    this.p1.set(0); this.p2.set(0); this.p3.set(0);
    this.p4.set(0); this.p5.set(0); this.p6.set(0);
  }

  onValidate(): void {
    const cups = this.cups().trim();
    if (!cups) return;

    this.validating.set(true);
    this.validationError.set(false);

    this.sips.getByCups(cups).subscribe({
      next:  res => {
        this.prefillFromSips(res.ps);
        this.store.setConsumos(res.consumos ?? []);
        this.validated.set(true);
        this.validating.set(false);
      },
      error: () => { this.validationError.set(true); this.validated.set(false); this.validating.set(false); },
    });
  }

  private prefillFromSips(ps: SipsPs): void {
    this.tariffType.set(ps.codigoTarifaATREnVigor ?? null);
    this.province.set(ps.codigoProvinciaPS ?? '');
    this.city.set(ps.municipioPS ?? '');
    const zip = ps.codigoPostalPS ?? '';
    this.zipCode.set(zip);
    if (ps['cnae']) this.cnae.set(String(ps['cnae']));
    this.p1.set((ps.potenciaContratadaP1 ?? 0) / 1000);
    this.p2.set((ps.potenciaContratadaP2 ?? 0) / 1000);
    this.p3.set((ps.potenciaContratadaP3 ?? 0) / 1000);
    this.p4.set((ps.potenciaContratadaP4 ?? 0) / 1000);
    this.p5.set((ps.potenciaContratadaP5 ?? 0) / 1000);
    this.p6.set((ps.potenciaContratadaP6 ?? 0) / 1000);
    // Load province/municipio IDs using zip code prefix
    if (zip.length === 5) this.loadProvinces(zip.substring(0, 2));
  }

  readonly isValid = computed(() =>
    !!this.cups().trim() && !!this.address().trim()
  );

  onBack(): void {
    this.router.navigate(['/dashboard/fast-discharge/data']);
  }

  onSubmit(): void {
    this.submitted.set(true);
    if (!this.isValid()) return;

    this.store.setSupplyPoint({
      cups:        this.cups(),
      address:     this.address(),
      cnae:        this.cnae(),
      province:    this.province(),
      city:        this.city(),
      zipCode:     this.zipCode(),
      tariffType:  this.tariffType() ?? '',
      idProvincia: this.provinciaId(),
      idPoblacion: this.municipioId(),
      p1: this.p1(), p2: this.p2(), p3: this.p3(),
      p4: this.p4(), p5: this.p5(), p6: this.p6(),
    });

    this.router.navigate(['/dashboard/fast-discharge/select-product']);
  }
}
