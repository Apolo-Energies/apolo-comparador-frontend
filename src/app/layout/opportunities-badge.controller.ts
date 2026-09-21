import { DestroyRef, signal } from '@angular/core';
import { AuthService } from '@apolo-energies/auth';
import { getUserRoles } from '../core/helpers/auth.utils';
import { OpportunityService } from '../core/services/opportunity.service';
import { OpportunityStatus } from '../core/models/opportunity.model';
import { EnergyType } from '../core/models/energy-type.enum';

export interface OpportunitiesBadgeDeps {
  oppService: OpportunityService;
  auth: AuthService;
  destroyRef: DestroyRef;
}

/** Título usado para matchear el botón del parent "Oportunidades" en el sidebar. */
const OPP_PARENT_TITLE = 'Oportunidades';

/**
 * Pending-opportunities badge del item "Oportunidades" del sidebar: trae los
 * counts de Luz/Gas y marca el botón del parent en el DOM para que la regla
 * CSS del badge (--opp-count-*, aplicada por Layout vía effect) lo pueda
 * seleccionar. Extraído de Layout para mantenerlo bajo el límite de líneas
 * (R1) — mismos selectores, misma lógica de retry/observer, sin cambio de
 * comportamiento.
 */
export class OpportunitiesBadgeController {
  constructor(private readonly deps: OpportunitiesBadgeDeps) {}

  readonly luzCount = signal<number>(0);
  readonly gasCount = signal<number>(0);

  /**
   * Marca el boton del parent "Oportunidades" con data-opp-parent="true" para que la
   * regla CSS del badge total lo pueda seleccionar. Necesario porque el sidebar lib no
   * envuelve al parent en un <a href>, asi que no hay forma de selectorlo solo con CSS.
   *
   * El sidebar puede no estar en el DOM al primer afterNextRender (auth resolving,
   * lazy render, etc), por eso reintentamos hasta encontrar la raiz y entonces montamos
   * el MutationObserver que re-aplica el marker cuando sections() re-renderea.
   *
   * Llamar una sola vez, en browser, típicamente desde afterNextRender.
   */
  setupDomMarker(): void {
    this.markParent();
    this.attachSidebarObserver(0);
  }

  refresh(): void {
    this.deps.oppService.list({ pageSize: 1, status: OpportunityStatus.Pending, energyType: EnergyType.Electricity }).subscribe({
      next: res => this.luzCount.set(res.totalCount),
      error: () => { },
    });
    // Gas de oportunidades aún no disponible para Colaboradores; evita sumar al badge total.
    const roles = getUserRoles(this.deps.auth.currentUser());
    const isColaborador = (roles.includes('Colaborador') || roles.includes('Colaborador - Referenciador')) && !roles.includes('Master');
    if (isColaborador) return;
    this.deps.oppService.list({ pageSize: 1, status: OpportunityStatus.Pending, energyType: EnergyType.Gas }).subscribe({
      next: res => this.gasCount.set(res.totalCount),
      error: () => { },
    });
  }

  private attachSidebarObserver(attempt: number): void {
    const sidebarRoot = document.querySelector('lib-apolo-sidebar');
    if (!sidebarRoot) {
      if (attempt < 60) { // ~1s a 60fps; si no esta para entonces, sidebar no se montara
        requestAnimationFrame(() => this.attachSidebarObserver(attempt + 1));
      }
      return;
    }
    this.markParent();
    const observer = new MutationObserver(() => this.markParent());
    observer.observe(sidebarRoot, { childList: true, subtree: true });
    this.deps.destroyRef.onDestroy(() => observer.disconnect());
  }

  private markParent(): void {
    const items = document.querySelectorAll<HTMLElement>('lib-apolo-sidebar lib-sidebar-item');
    for (const item of Array.from(items)) {
      // Match por texto del title. Si renombramos el item en sidebar, actualizar OPP_PARENT_TITLE.
      const titleSpan = item.querySelector(':scope > button > div > span');
      if (titleSpan?.textContent?.trim() !== OPP_PARENT_TITLE) continue;
      const btn = item.querySelector('button');
      if (btn && !btn.hasAttribute('data-opp-parent')) {
        btn.setAttribute('data-opp-parent', 'true');
      }
    }
  }
}
