import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ButtonComponent, InputFieldComponent, SelectFieldComponent } from '@apolo-energies/ui';
import { EnergyExpertCatalogs } from '../../../../../../../core/models/energy-expert-catalogs.model';
import { AUTOCONSUMO_STEPS, AutoconsumoFormValue, EMPTY_AUTOCONSUMO_FORM, toSelectOptions } from './autoconsumo-form.helpers';

/**
 * Formulario de datos de Autoconsumo (generación, titular de la instalación,
 * coordenadas UTM) que se muestra cuando el colaborador activa el switch
 * "Autoconsumo" en select-product. Partido en pasos (AUTOCONSUMO_STEPS) para
 * no mostrar los ~25 campos de una sola vez. Sin botón de "guardar" propio —
 * el valor se emite en vivo con cada cambio de campo; el único "Siguiente"
 * que avanza el wizard completo (fast-discharge) es el de la página
 * select-product, los de acá solo mueven el paso interno. Los desplegables
 * salen de GET /energy-expert/catalogs (EnergyExpertCatalogsService, ya
 * pedido por el padre); si un catálogo todavía no se pobló en el backend
 * (antes de la primera alta real), el select correspondiente queda vacío.
 */
@Component({
  selector: 'app-fd-autoconsumo-form',
  standalone: true,
  imports: [InputFieldComponent, SelectFieldComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './autoconsumo-form.html',
})
export class AutoconsumoFormComponent {
  readonly catalogs = input<EnergyExpertCatalogs | null>(null);
  readonly valueChange = output<AutoconsumoFormValue>();

  readonly steps       = AUTOCONSUMO_STEPS;
  readonly currentStep = signal(0);
  readonly isFirstStep = computed(() => this.currentStep() === 0);
  readonly isLastStep  = computed(() => this.currentStep() === this.steps.length - 1);

  readonly value = signal<AutoconsumoFormValue>({ ...EMPTY_AUTOCONSUMO_FORM });

  readonly tipoAutoconsumoAnteriorOptions = computed(() => toSelectOptions(this.catalogs()?.tipoAutoconsumo2));
  readonly tipoCupsOptions                = computed(() => toSelectOptions(this.catalogs()?.tipoAutoconsumoCUPS));
  readonly tipoAutoconsumoOptions         = computed(() => toSelectOptions(this.catalogs()?.tipoAutoconsumo));
  readonly compensacionOptions            = computed(() => toSelectOptions(this.catalogs()?.tipoAutoconsumoCompensacion));
  readonly colectivoOptions               = computed(() => toSelectOptions(this.catalogs()?.tipoAutoconsumoColectivo));
  readonly tipoInstalacionOptions         = computed(() => toSelectOptions(this.catalogs()?.tipoInstalacionGeneracion));
  readonly esquemaMedidaOptions           = computed(() => toSelectOptions(this.catalogs()?.esquemaMedidaGeneracion));
  readonly ssaaOptions                    = computed(() => toSelectOptions(this.catalogs()?.serviciosAuxiliaresGeneracion));
  readonly unicoContratoOptions           = computed(() => toSelectOptions(this.catalogs()?.unicoContratoGeneracion));
  readonly tipoDocumentacionOptions       = computed(() => toSelectOptions(this.catalogs()?.tipoDocTitularGeneracion));

  set(key: keyof AutoconsumoFormValue, v: string): void {
    this.value.update(cur => ({ ...cur, [key]: v }));
    this.valueChange.emit(this.value());
  }

  nextStep(): void {
    if (!this.isLastStep()) this.currentStep.update(s => s + 1);
  }

  prevStep(): void {
    if (!this.isFirstStep()) this.currentStep.update(s => s - 1);
  }
}
