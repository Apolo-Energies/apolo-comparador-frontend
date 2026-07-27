import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '@apolo-energies/auth';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import {
  AltasBajasSeries,
  Delegacion,
  EnergyExpertService,
  InvoicesKpis,
  LiquidacionesKpis,
  ServicesKpis,
} from '../../../../services/energy-expert.service';
import { GlobalLoadingService } from '../../../../services/global-loading.service';
import { RefreshTokenService } from '../../../../services/refresh-token.service';
import { EsNumberPipe } from '../../../../shared/pipes/es-number.pipe';
import { getUserRoles } from '../../../../utils/auth.utils';
import { StatusPieChartComponent } from './components/pie-chart/pie-chart';
import { AltasBajasChartComponent } from './components/altas-bajas-chart/altas-bajas-chart';
import { DelegacionesDialogComponent } from './components/delegaciones-dialog/delegaciones-dialog';

@Component({
  selector: 'app-energies-invoices-page',
  standalone: true,
  imports: [EsNumberPipe, StatusPieChartComponent, AltasBajasChartComponent, DelegacionesDialogComponent],
  templateUrl: './invoices-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnergiesInvoicesPageComponent {
  private readonly api           = inject(EnergyExpertService);
  private readonly auth          = inject(AuthService);
  private readonly platformId    = inject(PLATFORM_ID);
  private readonly globalLoading = inject(GlobalLoadingService);
  private readonly destroyRef    = inject(DestroyRef);
  private readonly refreshToken  = inject(RefreshTokenService);

  readonly invoiceKpis      = signal<InvoicesKpis      | null>(null);
  readonly servicesKpis     = signal<ServicesKpis      | null>(null);
  readonly altasMeses       = signal<AltasBajasSeries  | null>(null);
  readonly altasDias        = signal<AltasBajasSeries  | null>(null);
  readonly liquidaciones    = signal<LiquidacionesKpis | null>(null);
  readonly loading          = signal(true);
  readonly error            = signal<string | null>(null);

  readonly user     = computed(() => this.auth.currentUser());
  readonly userName = computed(() => this.user()?.name ?? this.user()?.username ?? '');
  readonly userMail = computed(() => this.user()?.email ?? '');

  /** True si el usuario es Master — sólo Master ve "Todos" y puede cambiar de delegación. */
  readonly isMaster = computed(() => getUserRoles(this.user()).includes('Master'));

  /** Delegation ID asignada al usuario (del claim JWT). null para Masters o sin asignar. */
  readonly userDelegationId = signal<number | null>(null);

  /** Nº total de contratos (suma de todos los estados). */
  readonly contratosTotal = computed(() => this.servicesKpis()?.contratos.total ?? 0);

  /** Contratos en estado "Activos" — usado como subtítulo del KPI. */
  readonly contratosActivos = computed(() => {
    const s = this.servicesKpis();
    return s?.contratos.segments.find(seg => seg.label === 'Activos')?.value ?? 0;
  });

  // Delegaciones
  readonly delegacionesOpen    = signal(false);
  readonly delegaciones        = signal<Delegacion[]>([]);
  readonly delegacionesLoading = signal(false);
  readonly selectedDelegacion  = signal<Delegacion | null>(null);
  readonly delegacionLabel     = computed(() => this.selectedDelegacion()?.nombre ?? 'Todos');

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    // El delegationId del JWT se lee UNA vez en construcción (no cambia en la vida del componente).
    this.userDelegationId.set(this.refreshToken.getDelegationIdFromToken());
    this.load();
  }

  onRetry(): void { this.load(); }

  onOpenDelegaciones(): void {
    // Sólo Masters pueden abrir el modal para cambiar de delegación.
    if (!this.isMaster()) return;
    this.delegacionesOpen.set(true);
    if (this.delegaciones().length > 0) return;
    this.delegacionesLoading.set(true);
    this.api.getDelegaciones()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list => { this.delegaciones.set(list); this.delegacionesLoading.set(false); },
        error: ()   => { this.delegacionesLoading.set(false); },
      });
  }

  onCloseDelegaciones(): void { this.delegacionesOpen.set(false); }

  onSelectDelegacion(d: Delegacion | null): void {
    if (!this.isMaster()) return; // safety: non-Masters no pueden cambiar.
    this.selectedDelegacion.set(d);
    this.delegacionesOpen.set(false);
    // No hay llamada separada de changeDelegacion: cada request de load() envía el
    // idDelegacion como query param y el backend maneja el estado del portal atómicamente.
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.globalLoading.start();

    const myId       = this.userDelegationId();
    const isMaster   = this.isMaster();
    const scopedUser = !isMaster && myId !== null;

    // idDelegacion que enviamos al backend:
    // - Master: la delegación seleccionada del modal (o null = "Todos")
    // - Non-Master: null; el backend enforce a su DelegationId (via JWT) ignora este param
    const desired = isMaster ? (this.selectedDelegacion()?.id ?? null) : null;

    // Non-Master con delegación asignada necesita la lista de delegaciones UNA vez
    // para resolver el nombre y mostrarlo en el chip readonly.
    const needsDelegList = scopedUser && this.delegaciones().length === 0;

    forkJoin({
      invoices:      this.api.getInvoicesKpis(desired)                 .pipe(catchError(() => of<InvoicesKpis      | null>(null))),
      services:      this.api.getServicesKpis(desired)                 .pipe(catchError(() => of<ServicesKpis      | null>(null))),
      altasMeses:    this.api.getAltasBajas('meses', undefined, desired).pipe(catchError(() => of<AltasBajasSeries  | null>(null))),
      altasDias:     this.api.getAltasBajas('dias',  undefined, desired).pipe(catchError(() => of<AltasBajasSeries  | null>(null))),
      liquidaciones: this.api.getLiquidacionesKpis(desired)            .pipe(catchError(() => of<LiquidacionesKpis | null>(null))),
      delegaciones:  needsDelegList
        ? this.api.getDelegaciones().pipe(catchError(() => of<Delegacion[] | null>(null)))
        : of<Delegacion[] | null>(null),
    })
      .pipe(
        finalize(() => {
          this.loading.set(false);
          this.globalLoading.stop();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ invoices, services, altasMeses, altasDias, liquidaciones, delegaciones }) => {
        this.invoiceKpis.set(invoices);
        this.servicesKpis.set(services);
        this.altasMeses.set(altasMeses);
        this.altasDias.set(altasDias);
        this.liquidaciones.set(liquidaciones);

        // Resuelve el nombre de la delegación del usuario para mostrarlo en el chip readonly.
        if (scopedUser && delegaciones && myId !== null) {
          const myDeleg = delegaciones.find(d => d.id === myId);
          if (myDeleg) this.selectedDelegacion.set(myDeleg);
          this.delegaciones.set(delegaciones);
        }

        this.error.set(anyFailed(invoices, services, altasMeses, altasDias, liquidaciones)
          ? 'Algunos datos del panel no se han podido cargar.'
          : null);
      });
  }
}

function anyFailed(...items: (object | null)[]): boolean {
  return items.some(x => x === null);
}
