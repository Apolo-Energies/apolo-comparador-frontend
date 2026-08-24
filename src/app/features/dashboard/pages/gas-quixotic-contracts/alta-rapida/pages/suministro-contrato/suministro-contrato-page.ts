import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@apolo-energies/ui';
import { AltaRapidaGasStore } from '../../store/alta-rapida-gas.store';
import { GasSipsService } from '../../../../../../../services/gas-sips.service';
import { GasSipsPs } from '../../../../../../../entities/gas-sips.model';

const INPUT_CLS = 'px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';

// CUPS estándar: ES + 16 dígitos + 2 letras de control (+ 2 letras opcionales de punto secundario/gas).
const CUPS_REGEX = /^ES\d{16}[A-Z]{2}([A-Z]{2})?$/i;

@Component({
  selector: 'app-arg-suministro-contrato-page',
  imports: [ButtonComponent],
  templateUrl: './suministro-contrato-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuministroContratoPage {
  private readonly router  = inject(Router);
  private readonly store   = inject(AltaRapidaGasStore);
  private readonly gasSips = inject(GasSipsService);

  readonly draft = this.store.draft;
  readonly inputCls = INPUT_CLS;
  readonly submitted = signal(false);

  readonly validating      = signal(false);
  readonly validated       = signal(false);
  readonly validationError = signal(false);
  readonly notFound        = signal(false);

  readonly errors = computed<Record<string, string | null>>(() => {
    if (!this.submitted()) return { cups: null, supplyPointName: null, contractName: null };
    const cups = this.draft().cups.trim();
    return {
      cups:            cups === ''                 ? 'Obligatorio'
                     : !CUPS_REGEX.test(cups)       ? 'Formato de CUPS inválido' : null,
      supplyPointName: this.draft().supplyPointName.trim() === '' ? 'Obligatorio' : null,
      contractName:    this.draft().contractName.trim()    === '' ? 'Obligatorio' : null,
    };
  });

  updateField<K extends keyof ReturnType<typeof this.store.draft>>(key: K, value: string): void {
    this.store.update({ [key]: value } as never);
  }

  onCupsChange(value: string): void {
    this.store.update({ cups: value });
    this.validated.set(false);
    this.validating.set(false);
    this.validationError.set(false);
    this.notFound.set(false);
  }

  onValidate(): void {
    const cups = this.draft().cups.trim();
    if (!cups) return;

    this.validating.set(true);
    this.validationError.set(false);
    this.notFound.set(false);

    this.gasSips.getByCups(cups).subscribe({
      next: res => {
        this.validating.set(false);
        if (res.ps) {
          this.prefillFromSips(res.ps);
          this.validated.set(true);
        } else {
          this.notFound.set(true);
        }
      },
      error: () => {
        this.validating.set(false);
        this.validationError.set(true);
      },
    });
  }

  onReset(): void {
    this.store.update({ cups: '' });
    this.validated.set(false);
    this.validating.set(false);
    this.validationError.set(false);
    this.notFound.set(false);
  }

  private prefillFromSips(ps: GasSipsPs): void {
    const patch: Partial<ReturnType<typeof this.store.draft>> = {};
    if (ps.codigoPeajeAtr)        patch.contractAtrRate = ps.codigoPeajeAtr;
    if (ps.caudalContratadoNm3H != null) patch.contractQa = String(ps.caudalContratadoNm3H);
    if (ps.caudalMaximoDiarioWh != null) patch.contractQd = String(ps.caudalMaximoDiarioWh);
    if (ps.cnae)                  patch.cnae = ps.cnae;
    if (ps.direccionCompleta && !this.draft().supplyPointName.trim()) {
      patch.supplyPointName = ps.direccionCompleta;
    }
    this.store.update(patch);
  }

  private isValid(): boolean {
    return Object.values(this.errors()).every(e => !e);
  }

  next(): void {
    this.submitted.set(true);
    if (!this.isValid()) return;
    this.router.navigate(['/dashboard/gas/quixotic-contracts/new/producto-activacion']);
  }

  back(): void {
    this.router.navigate(['/dashboard/gas/quixotic-contracts/new/direccion-pago']);
  }
}
