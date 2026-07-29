import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent, AlertService } from '@apolo-energies/ui';
import { AlertComponent } from '@apolo-energies/ui';
import { FastDischargeStore } from '../../store/fast-discharge.store';
import { ArtificialPerson, DocumentKey, NaturalPerson } from '../../models/person.models';
import { ContractService } from '../../../../../../services/contract.service';
import { SipsConsumo } from '../../../../../../entities/sips.model';
import { toEeDecimal } from '../../utils/format.utils';

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
                <p class="font-medium text-foreground">{{ p.address_1 }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">CP / Municipio</p>
                <p class="font-medium text-foreground">{{ p.cp }}{{ p.townName ? ' — ' + p.townName : '' }}</p>
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

        <!-- Summary cards -->
        @if (product()) {
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-xl border border-border bg-card px-4 py-4 space-y-2">
              <p class="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Comisión comercial</p>
              <div class="flex items-end gap-1.5">
                <span class="text-2xl font-bold text-primary-button">{{ commissionFmt() }} €</span>
                <span class="text-sm text-muted-foreground mb-0.5">/ año</span>
              </div>
            </div>
            <div class="rounded-xl border border-border bg-card px-4 py-4 space-y-2">
              <p class="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Factura estimada</p>
              <div class="flex items-end gap-1.5">
                <span class="text-2xl font-bold text-foreground">{{ monthlySavingsFmt() }} €</span>
                <span class="text-sm text-muted-foreground mb-0.5">/ mes</span>
              </div>
              <p class="text-sm font-semibold text-foreground">
                {{ annualSavingsFmt() }} € al año
              </p>
            </div>
          </div>
        }

        <!-- Footer -->
        <div class="border-t border-border pt-4 flex items-center justify-between">
          <ui-button label="Volver"          variant="secondary" size="sm" type="button" (click)="onBack()" />
          <button
            type="button"
            [disabled]="sending()"
            (click)="onSend()"
            class="inline-flex items-center justify-center gap-2 rounded-[8px] h-9 text-[13px] font-normal px-[14px] py-2 transition-colors bg-[#12AFF0] text-gray-950 hover:bg-[#0e8ec0] disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
          >
            @if (sending()) {
              <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Enviando...
            } @else {
              Enviar contrato
            }
          </button>
        </div>

      </div>
    </div>
  `,
})
export class ReviewPage {
  private readonly router          = inject(Router);
  private readonly store           = inject(FastDischargeStore);
  private readonly alertService    = inject(AlertService);
  private readonly contractService = inject(ContractService);

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

  private readonly DOC_MAP: Partial<Record<DocumentKey, string>> = {
    dni_front:          'UpDni',
    dni_back:           'UpDni',
    factura_estudio:    'UpFacturaEstudio',
    bank:               'UpOtros',
    escrituras_poderes: 'UpOtros',
    cif_file:           'UpCif',
    cie:                'UpOtros',
    justo_titulo:       'UpJustoTitulo',
  };

  onSend(): void {
    const person      = this.store.person();
    const supplyPoint = this.store.supplyPoint();
    if (!person || !supplyPoint) return;

    const consumos = this.annualKwhByPeriod(this.store.consumos());

    const fd = new FormData();

    // Cliente
    fd.append('NifCliente',       person.dni);
    fd.append('NombreCliente',    person.name);
    fd.append('Apellido1Cliente', person.apellido1 ?? '');
    if (person.apellido2) fd.append('Apellido2Cliente', person.apellido2);
    fd.append('Email',    person.email);
    fd.append('Telefono', person.phone);

    // Domiciliación
    const iban = person.bank_account?.replace(/\s/g, '') ?? '';
    if (iban) fd.append('Iban', iban);

    // Dirección cliente
    fd.append('DireccionCliente',    person.address_1 ?? '');
    fd.append('CpCliente',           person.cp ?? '');
    fd.append('IdProvinciaCliente',  String(person.idProvincia ?? 0));
    fd.append('IdPoblacionCliente',  String(person.idPoblacion ?? 0));

    // Suministro
    fd.append('Cups',   supplyPoint.cups);
    fd.append('Tarifa', supplyPoint.tariffType);
    if (supplyPoint.cnae) fd.append('Cnae', supplyPoint.cnae);

    // Dirección suministro
    fd.append('DireccionSuministro',    supplyPoint.address);
    fd.append('CpSuministro',           supplyPoint.zipCode ?? '');
    fd.append('IdProvinciaSuministro',  String(supplyPoint.idProvincia ?? 0));
    fd.append('IdPoblacionSuministro',  String(supplyPoint.idPoblacion ?? 0));

    // Potencias
    fd.append('PotenciaP1', toEeDecimal(supplyPoint.p1));
    fd.append('PotenciaP2', toEeDecimal(supplyPoint.p2));
    fd.append('PotenciaP3', toEeDecimal(supplyPoint.p3));
    fd.append('PotenciaP4', toEeDecimal(supplyPoint.p4));
    fd.append('PotenciaP5', toEeDecimal(supplyPoint.p5));
    fd.append('PotenciaP6', toEeDecimal(supplyPoint.p6));

    // Consumos anuales
    fd.append('ConsumoAnualP1', toEeDecimal(consumos[0]));
    fd.append('ConsumoAnualP2', toEeDecimal(consumos[1]));
    fd.append('ConsumoAnualP3', toEeDecimal(consumos[2]));
    fd.append('ConsumoAnualP4', toEeDecimal(consumos[3]));
    fd.append('ConsumoAnualP5', toEeDecimal(consumos[4]));
    fd.append('ConsumoAnualP6', toEeDecimal(consumos[5]));

    // Producto
    const product = this.store.product();
    if (product) {
      fd.append('IdOferta',          product.tipoProducto);
      fd.append('TipoCoste',         'T');
      fd.append('TipoPrecioEnergia', product.tipoPrecioEnergia);
      fd.append('IncPrecioEnergia',  toEeDecimal(product.feeEnergia));
      fd.append('IncPrecioPotencia', toEeDecimal(product.feePotencia));
    }

    // Documentos
    const docs = this.store.documents();
    for (const [key, file] of Object.entries(docs) as [DocumentKey, File][]) {
      const backendKey = this.DOC_MAP[key];
      if (backendKey && file) fd.append(backendKey, file, file.name);
    }
    // Para personas físicas, UpCif = mismo DNI (el backend lo exige siempre)
    if (person.type === 'Individual' && docs['dni_front'] && !docs['cif_file']) {
      fd.append('UpCif', docs['dni_front'], docs['dni_front'].name);
    }

    this.sending.set(true);

    this.contractService.altaRapida(fd).subscribe({
      next: res => {
        this.sending.set(false);
        if (!res.success) {
          this.alertService.show(res.message || 'Error al enviar el alta', 'error');
          return;
        }
        this.alertService.show('Alta enviada correctamente', 'success');
        setTimeout(() => {
          this.router.navigate(['/dashboard/fast-discharge']).then(() => this.store.reset());
        }, 1500);
      },
      error: () => {
        this.sending.set(false);
        this.alertService.show('Error al enviar el alta. Inténtalo de nuevo.', 'error');
      },
    });
  }

  private annualKwhByPeriod(consumos: SipsConsumo[]): number[] {
    const last12 = consumos.slice(0, 12);
    return [1, 2, 3, 4, 5, 6].map(p => {
      const key = `energiaP${p}` as keyof SipsConsumo;
      return last12.reduce((s, c) => s + (((c[key]) as number | null) ?? 0), 0) / 1000;
    });
  }
}
