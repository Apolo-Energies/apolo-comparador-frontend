import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent, AlertComponent, AlertService } from '@apolo-energies/ui';
import { AuthService } from '@apolo-energies/auth';
import { AltaRapidaGasStore } from '../../store/alta-rapida-gas.store';
import { AltaRapidaGasService } from '../../../../../../../services/alta-rapida-gas.service';
import { AltaRapidaGasErrorBody, AltaRapidaGasRequest } from '../../../../../../../entities/alta-rapida-gas.model';
import { getUserRoles } from '../../../../../../../utils/auth.utils';

@Component({
  selector: 'app-arg-revision-page',
  imports: [ButtonComponent, AlertComponent],
  templateUrl: './revision-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RevisionPage {
  private readonly router  = inject(Router);
  private readonly store   = inject(AltaRapidaGasStore);
  private readonly service = inject(AltaRapidaGasService);
  private readonly alertService = inject(AlertService);
  private readonly auth = inject(AuthService);

  /** Master vuelve al listado; el resto de roles llega desde "Alta Rápida" del
   *  header y no tiene acceso al listado (Master-only). */
  readonly isMaster = computed(() => getUserRoles(this.auth.currentUser()).includes('Master'));

  readonly draft     = this.store.draft;
  readonly result    = this.store.result;
  readonly sending   = signal(false);
  readonly errorInfo = signal<AltaRapidaGasErrorBody | null>(null);

  readonly partialJson = computed(() => {
    const p = this.errorInfo()?.partial;
    return p ? JSON.stringify(p, null, 2) : null;
  });

  back(): void {
    this.router.navigate(['/dashboard/gas/quixotic-contracts/new/producto-activacion']);
  }

  private buildPayload(): AltaRapidaGasRequest {
    const f = this.draft();
    const num = (v: string): number | null => v.trim() !== '' ? Number(v) : null;
    const str = (v: string): string | null => v.trim() !== '' ? v.trim() : null;

    return {
      fullName:       f.fullName.trim(),
      personType:     f.personType,
      documentNumber: f.documentNumber.trim(),
      documentType:   str(f.documentType),
      email:          str(f.email),
      phoneNumber:    str(f.phoneNumber),
      cnae:           str(f.cnae),

      billingAddressStreetType:  str(f.billingAddressStreetType),
      billingAddressStreet:      str(f.billingAddressStreet),
      billingAddressNumber:      str(f.billingAddressNumber),
      billingAddressPostalCode:  str(f.billingAddressPostalCode),
      billingAddressCityName:    str(f.billingAddressCityName),
      billingAddressStateCode:   str(f.billingAddressStateCode),
      billingAddressCountryCode: 'ES',

      bankAccountNumber: str(f.bankAccountNumber),

      cups:            f.cups.trim(),
      supplyPointName: f.supplyPointName.trim(),
      contractCode:    str(f.contractCode),

      productId:       str(f.productId),
      contractAtrRate: str(f.contractAtrRate),
      contractQa:      num(f.contractQa),
      contractQd:      num(f.contractQd),
      activationType:  str(f.activationType),

      contractParams: f.contractParamsJson.trim() ? JSON.parse(f.contractParamsJson) : null,
    };
  }

  submit(): void {
    if (this.sending()) return;
    this.errorInfo.set(null);
    this.sending.set(true);

    this.service.submit(this.buildPayload()).subscribe({
      next: res => {
        this.sending.set(false);
        this.store.setResult(res);
        this.alertService.show('Alta rápida de gas completada correctamente', 'success');
      },
      error: err => {
        this.sending.set(false);
        const body = err?.error as AltaRapidaGasErrorBody | undefined;
        this.errorInfo.set(body ?? { error: 'No se pudo completar el alta rápida' });
        this.alertService.show(body?.error ?? 'No se pudo completar el alta rápida', 'error');
      },
    });
  }

  finish(): void {
    this.store.reset();
    this.router.navigate([this.isMaster() ? '/dashboard/gas/quixotic-contracts' : '/dashboard/comparator/gas']);
  }

  newAlta(): void {
    this.store.reset();
    this.router.navigate(['/dashboard/gas/quixotic-contracts/new/cliente']);
  }
}
