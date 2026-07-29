import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@apolo-energies/ui';
import { FastDischargeStore } from '../../store/fast-discharge.store';
import { ContractService, EeTown, EeMunicipio } from '../../../../../../services/contract.service';
import { formatIbanES } from '../../utils/format.utils';

const PHONE_COUNTRIES = [
  { code: '+34',  flag: '🇪🇸', name: 'España'     },
  { code: '+591', flag: '🇧🇴', name: 'Bolivia'     },
  { code: '+52',  flag: '🇲🇽', name: 'México'      },
  { code: '+54',  flag: '🇦🇷', name: 'Argentina'   },
  { code: '+57',  flag: '🇨🇴', name: 'Colombia'    },
  { code: '+56',  flag: '🇨🇱', name: 'Chile'       },
  { code: '+51',  flag: '🇵🇪', name: 'Perú'        },
  { code: '+58',  flag: '🇻🇪', name: 'Venezuela'   },
  { code: '+593', flag: '🇪🇨', name: 'Ecuador'     },
  { code: '+1',   flag: '🇺🇸', name: 'EE.UU.'      },
  { code: '+44',  flag: '🇬🇧', name: 'Reino Unido' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal'    },
  { code: '+212', flag: '🇲🇦', name: 'Marruecos'   },
];

const PHONE_SPLIT_CODES = PHONE_COUNTRIES
  .slice()
  .sort((a, b) => b.code.length - a.code.length);

function splitPhone(phone: string): { code: string; local: string } {
  const match = PHONE_SPLIT_CODES.find(c => phone.startsWith(c.code));
  return match
    ? { code: match.code, local: phone.slice(match.code.length) }
    : { code: '+34', local: phone };
}

const INPUT_CLS  = 'px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';
const SELECT_CLS = 'shrink-0 px-2 py-2.5 text-sm rounded-l-lg border border-r-0 bg-card border-border text-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer';
const NUMBER_CLS = 'flex-1 min-w-0 px-4 py-2.5 text-sm rounded-r-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';

@Component({
  selector: 'app-fd-data',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-center min-h-full px-4 py-8">
      <div class="w-full max-w-xl bg-card border border-border rounded-lg shadow-xl px-8 py-8 space-y-6">

        <div>
          <p class="text-xl font-bold text-foreground">Datos del cliente</p>
          <p class="text-sm text-muted-foreground">Introduce los datos de contacto del cliente.</p>
        </div>

        <form (submit)="$event.preventDefault(); onSubmit()" class="space-y-5">

          <!-- NIF + Email -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-muted-foreground">NIF / DNI *</label>
              <input [class]="inputCls" placeholder="12345678A"
                     [value]="nif()" (input)="nif.set($any($event.target).value)" />
              @if (errors()['nif']) { <span class="text-red-500 text-xs">{{ errors()['nif'] }}</span> }
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-muted-foreground">Email *</label>
              <input [class]="inputCls" type="email" placeholder="cliente@ejemplo.es"
                     [value]="email()" (input)="email.set($any($event.target).value)" />
              @if (errors()['email']) { <span class="text-red-500 text-xs">{{ errors()['email'] }}</span> }
            </div>
          </div>

          <!-- Nombre + Apellido 1 + Apellido 2 -->
          <div class="grid grid-cols-3 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-muted-foreground">Nombre *</label>
              <input [class]="inputCls" placeholder="Francisco"
                     [value]="nombre()" (input)="nombre.set($any($event.target).value)" />
              @if (errors()['nombre']) { <span class="text-red-500 text-xs">{{ errors()['nombre'] }}</span> }
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-muted-foreground">Primer apellido *</label>
              <input [class]="inputCls" placeholder="García"
                     [value]="apellido1()" (input)="apellido1.set($any($event.target).value)" />
              @if (errors()['apellido1']) { <span class="text-red-500 text-xs">{{ errors()['apellido1'] }}</span> }
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-muted-foreground">Segundo apellido</label>
              <input [class]="inputCls" placeholder="López"
                     [value]="apellido2()" (input)="apellido2.set($any($event.target).value)" />
            </div>
          </div>

          <!-- Teléfono + IBAN -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-muted-foreground">Teléfono *</label>
              <div class="flex">
                <select [class]="selectCls" [value]="countryCode()"
                        (change)="countryCode.set($any($event.target).value)">
                  @for (c of phoneCountries; track c.code) {
                    <option [value]="c.code">{{ c.flag }} {{ c.code }}</option>
                  }
                </select>
                <input type="tel" placeholder="612 345 678" [class]="numberCls"
                       [attr.maxlength]="phoneMaxLength()"
                       [value]="phoneNumber()" (input)="onPhoneInput($event)" />
              </div>
              @if (errors()['phone']) { <span class="text-red-500 text-xs">{{ errors()['phone'] }}</span> }
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-muted-foreground">IBAN</label>
              <input [class]="inputCls" placeholder="ES83 0182 6517 7302 0197 5760"
                     [value]="iban()" (input)="onIbanInput($event)" />
              @if (errors()['iban']) { <span class="text-red-500 text-xs">{{ errors()['iban'] }}</span> }
            </div>
          </div>

          <!-- Dirección -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-muted-foreground">Dirección *</label>
            <input [class]="inputCls" placeholder="Calle Mayor 1, piso 2"
                   [value]="direccion()" (input)="direccion.set($any($event.target).value)" />
            @if (errors()['direccion']) { <span class="text-red-500 text-xs">{{ errors()['direccion'] }}</span> }
          </div>

          <!-- CP + Provincia -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-muted-foreground">Código postal *</label>
              <input [class]="inputCls" placeholder="46023" maxlength="5"
                     [value]="cp()" (input)="onCpChange($any($event.target).value)" />
              @if (errors()['cp']) { <span class="text-red-500 text-xs">{{ errors()['cp'] }}</span> }
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-muted-foreground">Provincia *</label>
              @if (loadingProvinces()) {
                <div class="px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-muted-foreground">Cargando...</div>
              } @else {
                <select
                  class="px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer"
                  [class.border-red-500]="!!errors()['provincia']"
                  (change)="onProvinciaChange($event)"
                >
                  <option value="0">— Selecciona —</option>
                  @for (p of provinces(); track p.IdProvincia) {
                    <option [value]="p.IdProvincia" [selected]="provinciaId() === p.IdProvincia">{{ p.Nombre }}</option>
                  }
                </select>
              }
              @if (errors()['provincia']) { <span class="text-red-500 text-xs">{{ errors()['provincia'] }}</span> }
            </div>
          </div>

          <!-- Municipio -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-muted-foreground">Municipio *</label>
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
                <!-- Input con icono de búsqueda -->
                <div class="relative">
                  <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
                       fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input
                    class="w-full pl-9 pr-9 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    [class.border-red-500]="!!errors()['municipio']"
                    [placeholder]="municipios().length ? 'Buscar municipio...' : 'Selecciona una provincia primero'"
                    [disabled]="!municipios().length"
                    [value]="municipioSearch()"
                    (input)="onMunicipioSearchInput($any($event.target).value)"
                    (focus)="municipioOpen.set(true)"
                    (blur)="onMunicipioBlur()"
                    autocomplete="off"
                  />
                  @if (municipioSearch()) {
                    <button
                      type="button"
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      (mousedown)="municipioSearch.set(''); municipioId.set(0); municipioOpen.set(false)"
                    >
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  }
                </div>
                <!-- Dropdown -->
                @if (municipioOpen() && filteredMunicipios().length) {
                  <div class="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-card shadow-xl ring-1 ring-black/5">
                    @for (m of filteredMunicipios(); track m.IdPoblacion) {
                      <button
                        type="button"
                        class="group w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors"
                        [class.bg-blue-500]="municipioId() === m.IdPoblacion"
                        [class.text-white]="municipioId() === m.IdPoblacion"
                        [class.text-foreground]="municipioId() !== m.IdPoblacion"
                        [class.hover:bg-muted]="municipioId() !== m.IdPoblacion"
                        (mousedown)="selectMunicipio(m)"
                      >
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
            @if (errors()['municipio']) { <span class="text-red-500 text-xs">{{ errors()['municipio'] }}</span> }
          </div>

          <div class="border-t border-border pt-4 flex justify-center">
            <ui-button label="Siguiente" size="sm" type="submit" />
          </div>

        </form>
      </div>
    </div>
  `,
})
export class DataPage {
  private readonly router          = inject(Router);
  private readonly store           = inject(FastDischargeStore);
  private readonly contractService = inject(ContractService);

  readonly submitted    = signal(false);
  readonly nif          = signal('');
  readonly nombre       = signal('');
  readonly apellido1    = signal('');
  readonly apellido2    = signal('');
  readonly email        = signal('');
  readonly countryCode  = signal('+34');
  readonly phoneNumber  = signal('');
  readonly phoneMaxLength = computed(() => this.countryCode() === '+34' ? 9 : 15);
  readonly direccion    = signal('');
  readonly cp           = signal('');
  readonly iban         = signal('');
  readonly provinces        = signal<EeTown[]>([]);
  readonly provinciaId      = signal(0);
  readonly loadingProvinces = signal(false);
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

  readonly phoneCountries = PHONE_COUNTRIES;
  readonly inputCls       = INPUT_CLS;
  readonly selectCls      = SELECT_CLS;
  readonly numberCls      = NUMBER_CLS;

  constructor() {
    const person = this.store.person();
    if (person) {
      this.nif.set(person.dni);
      this.nombre.set(person.name);
      this.apellido1.set(person.apellido1 ?? '');
      this.apellido2.set(person.apellido2 ?? '');
      this.email.set(person.email);
      const { code, local } = splitPhone(person.phone);
      this.countryCode.set(code);
      this.phoneNumber.set(local);
      this.direccion.set(person.address_1 ?? '');
      this.cp.set(person.cp ?? '');
      this.provinciaId.set(person.idProvincia ?? 0);
      this.municipioId.set(person.idPoblacion ?? 0);
      this.iban.set(person.bank_account ?? '');
      if (person.cp?.length === 5) {
        this.loadProvinces(person.cp.substring(0, 2));
      }
      if ((person.idProvincia ?? 0) > 0) {
        this.loadMunicipios(person.idProvincia!);
      }
    }
  }

  readonly errors = computed<Record<string, string | null>>(() => {
    const none: Record<string, string | null> = {
      nif: null, nombre: null, apellido1: null, email: null,
      phone: null, direccion: null, cp: null, provincia: null, municipio: null, iban: null,
    };
    if (!this.submitted()) return none;
    const ibanVal = this.iban().replace(/\s/g, '');
    return {
      nif:      !this.nif().trim()          ? 'Obligatorio'
              : this.nif().trim().length < 9 ? 'Mínimo 9 caracteres' : null,
      nombre:   !this.nombre().trim()       ? 'Obligatorio' : null,
      apellido1:!this.apellido1().trim()    ? 'Obligatorio' : null,
      email:    !this.email().trim()        ? 'Obligatorio'
              : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email()) ? 'Email inválido' : null,
      phone:    !this.phoneNumber().trim()  ? 'Obligatorio'
              : !/^[0-9]{9,15}$/.test(this.phoneNumber().replace(/\s/g, '')) ? 'Solo dígitos, 9–15 números' : null,
      direccion:!this.direccion().trim()    ? 'Obligatorio' : null,
      cp:        !this.cp().trim()          ? 'Obligatorio'
               : !/^\d{5}$/.test(this.cp()) ? 'CP inválido (5 dígitos)' : null,
      provincia: this.provinciaId() === 0 ? 'Selecciona una provincia' : null,
      municipio: this.municipioId()  === 0 ? 'Selecciona un municipio'  : null,
      iban:      ibanVal && ibanVal.length < 15 ? 'IBAN inválido' : null,
    };
  });

  onPhoneInput(e: Event): void {
    const el = e.target as HTMLInputElement;
    const max = this.countryCode() === '+34' ? 9 : 15;
    const digits = el.value.replace(/\D/g, '').slice(0, max);
    el.value = digits;
    this.phoneNumber.set(digits);
  }

  private isValid(): boolean {
    return Object.values(this.errors()).every(e => !e);
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
          this.municipios.set([]);
          this.municipioId.set(0);
          this.loadMunicipios(match.IdProvincia);
        }
      },
      error: () => this.loadingProvinces.set(false),
    });
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

  private loadMunicipios(idProvincia: number): void {
    this.loadingMunicipios.set(true);
    this.contractService.getMunicipios(idProvincia).subscribe({
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

  onIbanInput(event: Event): void {
    const raw       = (event.target as HTMLInputElement).value;
    const formatted = formatIbanES(raw);
    (event.target as HTMLInputElement).value = formatted;
    this.iban.set(formatted);
  }

  onSubmit(): void {
    this.submitted.set(true);
    if (!this.isValid()) return;

    this.store.setPerson({
      type:        'Individual',
      dni:         this.nif().trim(),
      name:        this.nombre().trim(),
      apellido1:   this.apellido1().trim(),
      apellido2:   this.apellido2().trim(),
      surnames:    [this.apellido1(), this.apellido2()].filter(s => s.trim()).join(' '),
      address_1:   this.direccion().trim(),
      address_2:   '',
      cp:          this.cp().trim(),
      idProvincia: this.provinciaId(),
      idPoblacion: this.municipioId(),
      townName:    this.municipios().find(m => m.IdPoblacion === this.municipioId())?.Nombre ?? '',
      email:       this.email().trim(),
      phone:       this.countryCode() + this.phoneNumber().replace(/\s/g, ''),
      bank_account:this.iban().replace(/\s/g, ''),
    });

    this.router.navigate(['/dashboard/fast-discharge/supply-point']);
  }
}
