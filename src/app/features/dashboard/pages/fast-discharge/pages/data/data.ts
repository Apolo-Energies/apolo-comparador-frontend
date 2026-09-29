import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@apolo-energies/ui';
import { FastDischargeStore } from '../../store/fast-discharge.store';
import { ContractService } from '../../../../../../core/services/contract.service';
import { EeMunicipio } from '../../../../../../core/models/energy-expert.model';
import { formatIbanES } from '../../utils/format.utils';
import { DataLocationController } from './data-location.controller';
import { INPUT_CLS, NUMBER_CLS, PHONE_COUNTRIES, SELECT_CLS, computeDataErrors, splitPhone } from './data.helpers';

@Component({
  selector: 'app-fd-data',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data.html',
})
export class DataPage {
  private readonly router          = inject(Router);
  private readonly store           = inject(FastDischargeStore);
  private readonly contractService = inject(ContractService);

  readonly submitted      = signal(false);
  readonly nif             = signal('');
  readonly nombre          = signal('');
  readonly apellido1       = signal('');
  readonly apellido2       = signal('');
  readonly email           = signal('');
  readonly countryCode     = signal('+34');
  readonly phoneNumber     = signal('');
  readonly phoneMaxLength  = computed(() => this.countryCode() === '+34' ? 9 : 15);
  readonly direccion       = signal('');
  readonly iban            = signal('');

  // Province/municipio cascading lookups (state + service calls live in the controller; R1).
  private readonly location = new DataLocationController({ contractService: this.contractService });
  readonly cp                 = this.location.cp;
  readonly provinces          = this.location.provinces;
  readonly provinciaId        = this.location.provinciaId;
  readonly loadingProvinces   = this.location.loadingProvinces;
  readonly municipios         = this.location.municipios;
  readonly municipioId        = this.location.municipioId;
  readonly municipioSearch    = this.location.municipioSearch;
  readonly municipioOpen      = this.location.municipioOpen;
  readonly loadingMunicipios  = this.location.loadingMunicipios;
  readonly filteredMunicipios = this.location.filteredMunicipios;

  readonly phoneCountries = PHONE_COUNTRIES;
  readonly inputCls        = INPUT_CLS;
  readonly selectCls       = SELECT_CLS;
  readonly numberCls       = NUMBER_CLS;

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
      this.iban.set(person.bank_account ?? '');
      this.location.init({
        cp: person.cp ?? '',
        idProvincia: person.idProvincia,
        idPoblacion: person.idPoblacion,
      });
    }
  }

  readonly errors = computed<Record<string, string | null>>(() =>
    computeDataErrors({
      submitted:   this.submitted(),
      nif:         this.nif(),
      nombre:      this.nombre(),
      apellido1:   this.apellido1(),
      email:       this.email(),
      phoneNumber: this.phoneNumber(),
      direccion:   this.direccion(),
      cp:          this.cp(),
      provinciaId: this.provinciaId(),
      municipioId: this.municipioId(),
      iban:        this.iban(),
    })
  );

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

  onCpChange(value: string): void {
    this.location.onCpChange(value);
  }

  onProvinciaChange(event: Event): void {
    this.location.onProvinciaChange(event);
  }

  selectMunicipio(m: EeMunicipio): void {
    this.location.selectMunicipio(m);
  }

  onMunicipioSearchInput(value: string): void {
    this.location.onMunicipioSearchInput(value);
  }

  onMunicipioBlur(): void {
    this.location.onMunicipioBlur();
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
