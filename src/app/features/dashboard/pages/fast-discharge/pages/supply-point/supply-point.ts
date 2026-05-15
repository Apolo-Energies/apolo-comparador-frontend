import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent, InputFieldComponent } from '@apolo-energies/ui';
import { SipsService } from '../../../../../../services/sips.service';
import { SipsPs } from '../../../../../../entities/sips.model';
import { FastDischargeStore } from '../../store/fast-discharge.store';

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

          <!-- Provincia / Ciudad / CP -->
          <div class="grid grid-cols-3 gap-4">
            <ui-input
              label="Provincia"
              placeholder="Madrid"
              [value]="province()"
              (valueChange)="province.set($event)"
            />
            <ui-input
              label="Ciudad"
              placeholder="Madrid"
              [value]="city()"
              (valueChange)="city.set($event)"
            />
            <ui-input
              label="CP"
              placeholder="28001"
              [value]="zipCode()"
              (valueChange)="zipCode.set($event)"
            />
          </div>

          <!-- Potencias -->
          <div class="space-y-3">
            <p class="text-sm font-semibold text-primary-button">Potencias <span class="font-normal text-muted-foreground">(kW)</span>:</p>
            <div class="grid grid-cols-3 gap-4">
              @for (p of periods; track p) {
                <ui-input
                  [label]="p"
                  type="number"
                  placeholder="0"
                  [value]="potencia(p)"
                  (valueChange)="setPotencia(p, $event)"
                />
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
  private readonly router = inject(Router);
  private readonly store  = inject(FastDischargeStore);
  private readonly sips   = inject(SipsService);

  readonly validating      = signal(false);
  readonly validationError = signal(false);
  readonly validated       = signal(false);
  readonly submitted       = signal(false);

  readonly cups     = signal('');
  readonly address  = signal('');
  readonly cnae     = signal('');
  readonly province = signal('');
  readonly city     = signal('');
  readonly zipCode  = signal('');
  readonly tariffType = signal<string | null>(null);

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
      this.p1.set(sp.p1); this.p2.set(sp.p2); this.p3.set(sp.p3);
      this.p4.set(sp.p4); this.p5.set(sp.p5); this.p6.set(sp.p6);
      if (sp.cups) this.validated.set(true);
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

  onReset(): void {
    this.cups.set('');
    this.validated.set(false);
    this.validating.set(false);
    this.validationError.set(false);
    this.tariffType.set(null);
    this.province.set(''); this.city.set(''); this.zipCode.set(''); this.cnae.set('');
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
    this.zipCode.set(ps.codigoPostalPS ?? '');
    if (ps['cnae']) this.cnae.set(String(ps['cnae']));
    // SIPS potencias come in W → convert to kW for display and manual editing
    this.p1.set((ps.potenciaContratadaP1 ?? 0) / 1000);
    this.p2.set((ps.potenciaContratadaP2 ?? 0) / 1000);
    this.p3.set((ps.potenciaContratadaP3 ?? 0) / 1000);
    this.p4.set((ps.potenciaContratadaP4 ?? 0) / 1000);
    this.p5.set((ps.potenciaContratadaP5 ?? 0) / 1000);
    this.p6.set((ps.potenciaContratadaP6 ?? 0) / 1000);
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
      cups:       this.cups(),
      address:    this.address(),
      cnae:       this.cnae(),
      province:   this.province(),
      city:       this.city(),
      zipCode:    this.zipCode(),
      tariffType: this.tariffType() ?? '',
      p1: this.p1(), p2: this.p2(), p3: this.p3(),
      p4: this.p4(), p5: this.p5(), p6: this.p6(),
    });

    this.router.navigate(['/dashboard/fast-discharge/select-product']);
  }
}
