import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent, AlertService } from '@apolo-energies/ui';
import { AlertComponent } from '@apolo-energies/ui';
import { FastDischargeStore } from '../../store/fast-discharge.store';
import { ArtificialPerson, DocumentKey, NaturalPerson } from '../../models/person.model';
import { ContractService } from '../../../../../../core/services/contract.service';
import { SipsConsumo } from '../../../../../../core/models/sips.model';
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
  templateUrl: './review.html',
})
export class ReviewPage {
  private readonly router          = inject(Router);
  private readonly store           = inject(FastDischargeStore);
  private readonly alertService    = inject(AlertService);
  private readonly contractService = inject(ContractService);

  readonly phase = signal<'idle' | 'alta' | 'firma' | 'done'>('idle');
  readonly sending = () => this.phase() !== 'idle' && this.phase() !== 'done';

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

    this.phase.set('alta');

    this.contractService.altaRapida(fd).subscribe({
      next: res => {
        if (!res.success) {
          this.phase.set('idle');
          this.alertService.show(res.message || 'Error al enviar el alta', 'error');
          return;
        }

        if (!res.idContratoServicio) {
          this.phase.set('idle');
          this.alertService.show('Alta enviada, pero no se recibió el id del contrato.', 'error');
          return;
        }

        this.phase.set('firma');
        this.contractService.enviarFirma(res.idContratoServicio).subscribe({
          next: () => {
            this.phase.set('done');
            setTimeout(() => {
              this.router.navigate(['/dashboard/fast-discharge']).then(() => this.store.reset());
            }, 2500);
          },
          error: () => {
            this.phase.set('idle');
            this.alertService.show('Alta completada, pero no se pudo enviar el contrato.', 'error');
          },
        });
      },
      error: () => {
        this.phase.set('idle');
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
