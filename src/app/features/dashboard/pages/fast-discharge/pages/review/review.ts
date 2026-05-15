import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent, AlertService } from '@apolo-energies/ui';
import { AlertComponent } from '@apolo-energies/ui';
import { FastDischargeStore } from '../../store/fast-discharge.store';
import { ArtificialPerson, NaturalPerson } from '../../models/person.models';

const fmt2 = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TRAMITE_LABELS: Record<string, string> = {
  ALTA_NUEVA:      'Alta nueva',
  NUEVO_TITULAR:   'Nuevo titular',
  CAMBIO_TARIFA:   'Cambio tarifa',
  CAMBIO_POTENCIA: 'Cambio potencia',
};

@Component({
  selector: 'app-fd-review',
  imports: [ButtonComponent, AlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-alert />

    <div class="flex items-center justify-center min-h-full px-4 py-8">
      <div class="w-full max-w-2xl bg-card border border-border rounded-lg shadow-xl px-8 py-8 space-y-6"
           style="max-height: 90vh; overflow-y: auto;">

        <!-- Header -->
        <div class="space-y-1">
          <p class="text-xl font-bold text-foreground">Resumen del contrato</p>
          <p class="text-sm text-muted-foreground">Revisa toda la información antes de enviar el contrato.</p>
        </div>

        <!-- Client data -->
        <section class="space-y-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border pb-1">
            Datos del cliente
          </p>
          @if (person(); as p) {
            <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <p class="text-xs text-muted-foreground">Tipo</p>
                <p class="font-medium text-foreground">{{ p.type === 'Company' ? 'Empresa' : 'Particular' }}</p>
              </div>
              @if (p.type === 'Company') {
                <div>
                  <p class="text-xs text-muted-foreground">Razón social</p>
                  <p class="font-medium text-foreground">{{ asCompany(p).companyName }}</p>
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">CIF</p>
                  <p class="font-medium text-foreground">{{ asCompany(p).cif }}</p>
                </div>
              }
              <div>
                <p class="text-xs text-muted-foreground">{{ p.type === 'Company' ? 'Representante' : 'Nombre' }}</p>
                <p class="font-medium text-foreground">{{ p.name }} {{ p.surnames }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">{{ p.type === 'Company' ? 'DNI representante' : 'DNI' }}</p>
                <p class="font-medium text-foreground">{{ p.dni }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Email</p>
                <p class="font-medium text-foreground">{{ p.email }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Teléfono</p>
                <p class="font-medium text-foreground">{{ p.phone }}</p>
              </div>
              <div class="col-span-2">
                <p class="text-xs text-muted-foreground">Dirección</p>
                <p class="font-medium text-foreground">{{ p.address_1 }}{{ p.address_2 ? ', ' + p.address_2 : '' }}</p>
              </div>
            </div>
          } @else {
            <p class="text-sm text-muted-foreground italic">Sin datos de cliente</p>
          }
        </section>

        <!-- Supply point -->
        <section class="space-y-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border pb-1">
            Punto de suministro
          </p>
          @if (supplyPoint(); as sp) {
            <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div class="col-span-2">
                <p class="text-xs text-muted-foreground">CUPS</p>
                <p class="font-medium font-mono text-foreground text-xs">{{ sp.cups }}</p>
              </div>
              <div class="col-span-2">
                <p class="text-xs text-muted-foreground">Dirección</p>
                <p class="font-medium text-foreground">{{ sp.address }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Municipio / CP</p>
                <p class="font-medium text-foreground">{{ sp.city }}, {{ sp.zipCode }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Provincia</p>
                <p class="font-medium text-foreground">{{ sp.province }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Tarifa ATR</p>
                <p class="font-medium text-foreground">{{ sp.tariffType || '—' }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">CNAE</p>
                <p class="font-medium text-foreground">{{ sp.cnae || '—' }}</p>
              </div>
              <!-- Potencias -->
              <div class="col-span-2">
                <p class="text-xs text-muted-foreground mb-1">Potencias (kW)</p>
                <div class="flex flex-wrap gap-2">
                  @for (item of potencias(); track item.label) {
                    @if (item.value > 0) {
                      <span class="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                        {{ item.label }}: {{ item.value }}
                      </span>
                    }
                  }
                </div>
              </div>
            </div>
          } @else {
            <p class="text-sm text-muted-foreground italic">Sin datos de suministro</p>
          }
        </section>

        <!-- Product & tariff -->
        <section class="space-y-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border pb-1">
            Producto contratado
          </p>
          @if (product(); as pr) {
            <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <p class="text-xs text-muted-foreground">Tarifa</p>
                <p class="font-medium text-foreground">{{ pr.tariffCode || '—' }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Producto</p>
                <p class="font-medium text-foreground">{{ pr.productName || '—' }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Tipos de trámite</p>
                <p class="font-medium text-foreground">{{ tramiteLabels() }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">OMIE (€/MWh)</p>
                <p class="font-medium text-foreground">{{ pr.omiePrice }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Fee energía</p>
                <p class="font-medium text-foreground">{{ pr.feeEnergia }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Fee potencia</p>
                <p class="font-medium text-foreground">{{ pr.feePotencia }}</p>
              </div>
            </div>
          } @else {
            <p class="text-sm text-muted-foreground italic">Sin producto seleccionado</p>
          }
        </section>

        <!-- Commission & savings cards -->
        @if (product(); as pr) {
          <div class="grid grid-cols-2 gap-3">

            <!-- Comisión comercial -->
            <div class="rounded-xl border border-border bg-card px-4 py-4 space-y-2">
              <p class="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Comisión comercial</p>
              <div class="flex items-end gap-1.5">
                <span class="text-2xl font-bold text-primary-button">{{ commissionFmt() }} €</span>
                <span class="text-sm text-muted-foreground mb-0.5">/ año</span>
              </div>
            </div>

            <!-- Ahorro cliente -->
            <div class="rounded-xl border border-border bg-card px-4 py-4 space-y-2">
              <p class="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Ahorro cliente</p>
              <div class="space-y-0.5">
                <p class="text-lg font-bold"
                   [style.color]="pr.annualSavings >= 0 ? 'var(--color-accent,#12AFF0)' : '#f87171'">
                  {{ monthlySavingsFmt() }} € <span class="text-xs font-normal text-muted-foreground">/ mes</span>
                </p>
                <p class="text-base font-semibold"
                   [style.color]="pr.annualSavings >= 0 ? 'var(--color-accent,#12AFF0)' : '#f87171'">
                  {{ annualSavingsFmt() }} € <span class="text-xs font-normal text-muted-foreground">/ año</span>
                </p>
              </div>
            </div>

          </div>
        }

        <!-- Footer -->
        <div class="border-t border-border pt-4 flex items-center justify-between">
          <ui-button label="Volver"          variant="secondary" size="sm" type="button" (click)="onBack()" />
          <ui-button label="Enviar contrato" size="sm"           type="button" [disabled]="sending()" (click)="onSend()" />
        </div>

      </div>
    </div>
  `,
})
export class ReviewPage {
  private readonly router       = inject(Router);
  private readonly store        = inject(FastDischargeStore);
  private readonly alertService = inject(AlertService);

  readonly sending = signal(false);

  readonly person      = computed(() => this.store.person());
  readonly supplyPoint = computed(() => this.store.supplyPoint());
  readonly product     = computed(() => this.store.product());

  readonly potencias = computed(() => {
    const sp = this.supplyPoint();
    if (!sp) return [];
    return [
      { label: 'P1', value: sp.p1 },
      { label: 'P2', value: sp.p2 },
      { label: 'P3', value: sp.p3 },
      { label: 'P4', value: sp.p4 },
      { label: 'P5', value: sp.p5 },
      { label: 'P6', value: sp.p6 },
    ];
  });

  readonly tramiteLabels = computed(() =>
    (this.product()?.tramiteTypes ?? [])
      .map(t => TRAMITE_LABELS[t] ?? t)
      .join(', ')
  );

  readonly commissionFmt = computed(() => fmt2(this.product()?.commission ?? 0));
  readonly annualSavingsFmt = computed(() => fmt2(this.product()?.annualSavings ?? 0));
  readonly monthlySavingsFmt = computed(() =>
    fmt2(Math.round(((this.product()?.annualSavings ?? 0) / 12) * 100) / 100)
  );

  asCompany(p: ReturnType<typeof this.store.person>): ArtificialPerson {
    return p as ArtificialPerson;
  }

  onBack(): void {
    this.router.navigate(['/dashboard/fast-discharge/documents']);
  }

  onSend(): void {
    this.sending.set(true);
    // Navigate first so the user sees a clean welcome, then wipe the store
    this.router.navigate(['/dashboard/fast-discharge']).then(() => {
      this.store.reset();
    });
  }
}
