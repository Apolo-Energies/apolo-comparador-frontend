import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NavSectionsService } from '../../../../../../layout/nav-sections.service';
import { Router, RouterLink } from '@angular/router';

interface AltaOption {
  key: 'luz' | 'gas';
  title: string;
  /** Pasos reales del asistente (rutas de fast-discharge / alta-rapida de gas). */
  steps: string[];
  /** Qué pide el asistente (documentos y datos que se solicitan en sus pasos). */
  prepare: string[];
  cta: string;
  /** Resumen del recorrido, fiel a los pasos reales. */
  summary: string;
}

/** Entrada de "Alta Rápida": elegir Luz o Gas antes de arrancar el flujo correspondiente. */
@Component({
  selector: 'app-fd-select-type',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './select-type.html',
})
export class SelectTypePage {
  private readonly router = inject(Router);
  private readonly nav = inject(NavSectionsService);
  /** El aviso enlaza a Contratos solo si el rol y la marca tienen esa pantalla. */
  readonly hasContracts = computed(() => this.nav.tools().some(t => t.item.title === 'Contratos'));

  readonly options: AltaOption[] = [
    {
      key: 'luz',
      title: 'Luz',
      steps: ['Datos del cliente', 'Punto de suministro', 'Producto', 'Documentación', 'Revisión', 'Firma electrónica'],
      prepare: ['DNI del titular (anverso y reverso)', 'Una factura reciente para el estudio', 'Si es empresa: CIF y escrituras o poderes'],
      cta: 'Empezar alta de luz',
      summary: 'del cliente a la firma electrónica',
    },
    {
      key: 'gas',
      title: 'Gas',
      steps: ['Cliente', 'Dirección y pago', 'Suministro y contrato', 'Producto y activación', 'Revisión'],
      prepare: ['Datos del titular', 'CUPS de gas', 'IBAN para la domiciliación'],
      cta: 'Empezar alta de gas',
      summary: 'del cliente a la revisión final',
    },
  ];

  start(key: 'luz' | 'gas'): void {
    if (key === 'luz') this.router.navigate(['/dashboard/fast-discharge/data']);
    else this.router.navigate(['/dashboard/gas/quixotic-contracts/new']);
  }
}
