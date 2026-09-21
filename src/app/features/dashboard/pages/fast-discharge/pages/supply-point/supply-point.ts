import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent, InputFieldComponent } from '@apolo-energies/ui';
import { SipsService } from '../../../../../../core/services/sips.service';
import { SipsPs } from '../../../../../../core/models/sips.model';
import { FastDischargeStore } from '../../store/fast-discharge.store';
import { ContractService } from '../../../../../../core/services/contract.service';
import { EeMunicipio } from '../../../../../../core/models/energy-expert.model';
import { SupplyPointLocationController } from './supply-point-location.controller';

@Component({
  selector: 'app-fd-supply-point',
  imports: [ButtonComponent, InputFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './supply-point.html',
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
  readonly tariffType = signal<string | null>(null);

  // Province/municipio cascading lookups + SIPS prefill (state + service calls live in the controller; R1).
  private readonly location = new SupplyPointLocationController({ contractService: this.contractService });
  readonly province           = this.location.province;
  readonly city                = this.location.city;
  readonly zipCode             = this.location.zipCode;
  readonly provinces           = this.location.provinces;
  readonly provinciaId         = this.location.provinciaId;
  readonly loadingProvinces    = this.location.loadingProvinces;
  readonly municipios          = this.location.municipios;
  readonly municipioId         = this.location.municipioId;
  readonly municipioSearch     = this.location.municipioSearch;
  readonly municipioOpen       = this.location.municipioOpen;
  readonly loadingMunicipios   = this.location.loadingMunicipios;
  readonly filteredMunicipios  = this.location.filteredMunicipios;

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
      this.tariffType.set(sp.tariffType || null);
      this.p1.set(sp.p1); this.p2.set(sp.p2); this.p3.set(sp.p3);
      this.p4.set(sp.p4); this.p5.set(sp.p5); this.p6.set(sp.p6);
      if (sp.cups) this.validated.set(true);
      this.location.init({
        province: sp.province, city: sp.city, zipCode: sp.zipCode,
        idProvincia: sp.idProvincia, idPoblacion: sp.idPoblacion,
      });
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
    this.location.onZipCodeChange(value);
  }

  onProvinciaChange(event: Event): void {
    this.location.onProvinciaChange(event);
  }

  onMunicipioSearchInput(value: string): void {
    this.location.onMunicipioSearchInput(value);
  }

  selectMunicipio(m: EeMunicipio): void {
    this.location.selectMunicipio(m);
  }

  onMunicipioBlur(): void {
    this.location.onMunicipioBlur();
  }

  onReset(): void {
    this.cups.set('');
    this.validated.set(false);
    this.validating.set(false);
    this.validationError.set(false);
    this.tariffType.set(null);
    this.cnae.set('');
    this.location.reset();
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
    if (ps['cnae']) this.cnae.set(String(ps['cnae']));
    this.p1.set((ps.potenciaContratadaP1 ?? 0) / 1000);
    this.p2.set((ps.potenciaContratadaP2 ?? 0) / 1000);
    this.p3.set((ps.potenciaContratadaP3 ?? 0) / 1000);
    this.p4.set((ps.potenciaContratadaP4 ?? 0) / 1000);
    this.p5.set((ps.potenciaContratadaP5 ?? 0) / 1000);
    this.p6.set((ps.potenciaContratadaP6 ?? 0) / 1000);
    // Load province/municipio IDs using zip code prefix
    this.location.prefillFromSips(ps.codigoProvinciaPS ?? '', ps.municipioPS ?? '', ps.codigoPostalPS ?? '');
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
