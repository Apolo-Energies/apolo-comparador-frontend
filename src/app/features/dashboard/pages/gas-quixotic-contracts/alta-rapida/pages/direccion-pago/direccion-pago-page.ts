import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@apolo-energies/ui';
import { AltaRapidaGasStore } from '../../store/alta-rapida-gas.store';
import { ContractService } from '../../../../../../../services/contract.service';
import { formatIbanES } from '../../../../fast-discharge/utils/format.utils';

const INPUT_CLS  = 'px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';
const SELECT_CLS = 'px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer';

const STREET_TYPES = ['CL', 'AV', 'PZ', 'PS', 'CR', 'TR', 'UR'];

/** IBAN español: ES + 2 dígitos de control + 20 dígitos de cuenta = 24 caracteres. */
const IBAN_ES_LENGTH = 24;

@Component({
  selector: 'app-arg-direccion-pago-page',
  imports: [ButtonComponent],
  templateUrl: './direccion-pago-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DireccionPagoPage {
  private readonly router          = inject(Router);
  private readonly store           = inject(AltaRapidaGasStore);
  private readonly contractService = inject(ContractService);

  readonly draft = this.store.draft;
  readonly inputCls    = INPUT_CLS;
  readonly selectCls   = SELECT_CLS;
  readonly streetTypes = STREET_TYPES;

  readonly loadingProvincia = signal(false);
  readonly provinceName     = signal<string | null>(null);
  readonly provinceError    = signal<string | null>(null);

  readonly ibanError = computed(() => {
    const raw = this.draft().bankAccountNumber.replace(/\s/g, '');
    return raw && raw.length !== IBAN_ES_LENGTH ? 'IBAN inválido' : null;
  });

  constructor() {
    const code = this.draft().billingAddressStateCode;
    if (code) this.loadProvinceByCode(parseInt(code, 10));
  }

  updateField<K extends keyof ReturnType<typeof this.store.draft>>(key: K, value: string): void {
    this.store.update({ [key]: value } as never);
  }

  onCpChange(value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 5);
    this.store.update({ billingAddressPostalCode: digits, billingAddressStateCode: '' });
    this.provinceName.set(null);
    this.provinceError.set(null);
    if (digits.length === 5) this.loadProvinceByCode(parseInt(digits.slice(0, 2), 10));
  }

  private loadProvinceByCode(id: number): void {
    this.loadingProvincia.set(true);
    this.contractService.getProvinces(id).subscribe({
      next: list => {
        this.loadingProvincia.set(false);
        const match = list.find(p => p.IdProvincia === id);
        if (match) {
          this.provinceName.set(match.Nombre);
          this.store.update({ billingAddressStateCode: String(match.IdProvincia).padStart(2, '0') });
        } else {
          this.provinceError.set('No se encontró provincia para ese código postal');
        }
      },
      error: () => {
        this.loadingProvincia.set(false);
        this.provinceError.set('No se pudo obtener la provincia');
      },
    });
  }

  onIbanInput(event: Event): void {
    const el  = event.target as HTMLInputElement;
    const raw = el.value.replace(/\s/g, '').toUpperCase().slice(0, IBAN_ES_LENGTH);
    const formatted = formatIbanES(raw);
    el.value = formatted;
    this.store.update({ bankAccountNumber: formatted });
  }

  next(): void {
    if (this.ibanError()) return;
    this.router.navigate(['/dashboard/gas/quixotic-contracts/new/suministro-contrato']);
  }

  back(): void {
    this.router.navigate(['/dashboard/gas/quixotic-contracts/new/cliente']);
  }
}
