import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  effect, inject, input, output, signal,
} from '@angular/core';
import { Drawer } from 'primeng/drawer';
import {
  ApoloIcons, DateIcon, HomeIcon, InfoIcon, LightningIcon,
  NoteIcon, UiIconSource, UserSimpleIcon, XIcon,
} from '@apolo-energies/icons';
import { ContratoClienteRow } from '../../../../../../entities/contrato.model';
import { ServicioListItem } from '../../../../../../entities/servicio.model';
import { ContractService } from '../../../../../../services/contract.service';
import { BrandLoaderComponent } from '../../../../../../shared/components/brand-loader/brand-loader.component';
import { calcDias, dedupeServiciosByCups, estadoCls, estadoLabel, fmtDate, fmtKwh } from '../../contracts-utils';

@Component({
  selector: 'app-contract-detail-drawer',
  standalone: true,
  imports: [Drawer, ApoloIcons, BrandLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contract-detail-drawer.html',
  styleUrl: './contract-detail-drawer.scss',
})
export class ContractDetailDrawerComponent {
  readonly client = input<ContratoClienteRow | null>(null);

  readonly closed = output<void>();

  private contractService = inject(ContractService);
  private cdr             = inject(ChangeDetectorRef);

  readonly visible  = signal(false);
  readonly services = signal<ServicioListItem[]>([]);
  readonly loading  = signal(false);

  readonly iconClose:  UiIconSource = { type: 'apolo', icon: XIcon,          size: 16 };
  readonly iconInfo:   UiIconSource = { type: 'apolo', icon: InfoIcon,       size: 14 };
  readonly iconDate:   UiIconSource = { type: 'apolo', icon: DateIcon,       size: 14 };
  readonly iconUser:   UiIconSource = { type: 'apolo', icon: UserSimpleIcon, size: 14 };
  readonly iconHome:   UiIconSource = { type: 'apolo', icon: HomeIcon,       size: 14 };
  readonly iconBolt:   UiIconSource = { type: 'apolo', icon: LightningIcon,  size: 14 };
  readonly iconNote:   UiIconSource = { type: 'apolo', icon: NoteIcon,       size: 14 };

  readonly estadoCls   = estadoCls;
  readonly estadoLabel = estadoLabel;
  readonly fmtDate     = fmtDate;
  readonly fmtKwh      = fmtKwh;
  readonly calcDias    = calcDias;

  constructor() {
    effect(() => {
      const c = this.client();
      if (c) {
        this.visible.set(true);
        this.loadServices(c.IdCliente);
      } else {
        this.visible.set(false);
        this.services.set([]);
      }
    });
  }

  private loadServices(idCliente: number) {
    if (!idCliente || idCliente <= 0) {
      this.services.set([]);
      return;
    }
    this.loading.set(true);
    this.contractService.getServiciosByCliente(idCliente, 100).subscribe({
      next: rows => {
        // Dedup por CUPS con la misma winner-logic que el backend usa en /contratos,
        // así el drawer muestra 1 card por CUPS y coincide con NumServicios del header.
        this.services.set(dedupeServiciosByCups(rows));
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.services.set([]);
        this.loading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  onVisibleChange(open: boolean) {
    if (!open) this.closed.emit();
  }

  closeDrawer() {
    this.closed.emit();
  }

  localizacion(s: ServicioListItem): string {
    const parts = [s.PoblacionSuministro, s.ProvinciaSuministro].filter(Boolean);
    return parts.join(', ') || s.DireccionSuministro || '—';
  }

  /**
   * Consumo del servicio. Prioridad: consumo del contrato matcheado por CUPS
   * (autoritativo, alineado con `ConsumoTotal` del cliente) → campos del
   * servicio como fallback (que suelen tener valores muy pequeños o vacíos
   * porque EE los rellena inconsistentemente).
   */
  consumoServicio(s: ServicioListItem): number {
    const porCups = this.client()?.ConsumoPorCups ?? {};
    const fromContract = s.CUPS ? porCups[s.CUPS] : undefined;
    if (fromContract && fromContract > 0) return fromContract;
    if (s.ConsumoAnualContrato)   return s.ConsumoAnualContrato;
    if (s.ConsumoAnualSuministro) return s.ConsumoAnualSuministro;
    const periodos = [
      s.ConsumoAnualP1, s.ConsumoAnualP2, s.ConsumoAnualP3,
      s.ConsumoAnualP4, s.ConsumoAnualP5, s.ConsumoAnualP6,
    ];
    return periodos.reduce((acc, v) => acc + (v ?? 0), 0);
  }

  estadoEntries(bd: Record<string, number> | null | undefined): { estado: string; count: number }[] {
    return Object.entries(bd ?? {})
      .map(([estado, count]) => ({ estado, count }))
      .sort((a, b) => b.count - a.count);
  }

  trackByServicioId = (_: number, s: ServicioListItem) => s.Id;
}
