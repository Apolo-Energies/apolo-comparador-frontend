import { computed, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@apolo-energies/auth';
import { getUserRoles } from '../core/helpers/auth.utils';
import { OpportunityCountsStore } from '../core/services/opportunity-counts.store';

export interface OpportunitiesBadgeDeps {
  countsStore: OpportunityCountsStore;
  auth: AuthService;
  router: Router;
  destroyRef: DestroyRef;
}

/** Título usado para matchear el botón del parent "Oportunidades" en el sidebar. */
const OPP_PARENT_TITLE = 'Oportunidades';

/** Ruta del tablero de oportunidades — ver refresh(). */
const OPPORTUNITIES_BOARD_URL = '/dashboard/analytics/opportunities';

/**
 * Pending-opportunities badge del item "Oportunidades" del sidebar: expone los
 * counts de Luz/Gas (derivados del OpportunityCountsStore compartido) y marca
 * el botón del parent en el DOM para que la regla CSS del badge (--opp-count-*,
 * aplicada por Layout vía effect) lo pueda seleccionar. Extraído de Layout para
 * mantenerlo bajo el límite de líneas (R1) — mismos selectores DOM, sin cambio
 * de comportamiento.
 */
export class OpportunitiesBadgeController {
  constructor(private readonly deps: OpportunitiesBadgeDeps) {}

  private readonly isColaborador = computed(() => {
    const roles = getUserRoles(this.deps.auth.currentUser());
    return (roles.includes('Colaborador') || roles.includes('Colaborador - Referenciador')) && !roles.includes('Master');
  });

  // Gas de oportunidades aún no disponible para Colaboradores; se fuerza a 0
  // aunque el store/backend lo devuelva.
  readonly luzCount = computed(() => this.deps.countsStore.badges()?.electricity ?? 0);
  readonly gasCount = computed(() => this.isColaborador() ? 0 : (this.deps.countsStore.badges()?.gas ?? 0));

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

  /**
   * Alimenta el store de contadores del sidebar:
   * - Si aterrizamos en la página del board, esperamos a que OpportunitiesBoard llame a
   *   store.update() con los contadores que ya vienen en la respuesta de /opportunities/board;
   *   como fallback, disparamos /opportunities/summary tras 2s por si el board falla al cargar.
   * - Si estamos en cualquier otra ruta, pedimos /opportunities/summary directamente.
   */
  refresh(): void {
    const onBoard = this.deps.router.url.startsWith(OPPORTUNITIES_BOARD_URL);
    if (onBoard) {
      setTimeout(() => this.deps.countsStore.ensureLoaded(), 2000);
    } else {
      this.deps.countsStore.ensureLoaded();
    }
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
