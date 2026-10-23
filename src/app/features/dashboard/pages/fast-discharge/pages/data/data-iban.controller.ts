import { signal } from '@angular/core';
import { IbanVerificationService } from '../../../../../../core/services/iban-verification.service';
import { IbanVerificationResponse } from '../../../../../../core/models/iban-verification.model';
import { isValidBic, normalizeBic } from './data.helpers';

export interface IbanVerificationDeps {
  verificationService: IbanVerificationService;
}

const MIN_IBAN_LENGTH = 24;
const MAX_IBAN_LENGTH = 26;

/** Verifica el titular contra YOID — solo a pedido (botón), para no gastar rate limit. */
export class IbanVerificationController {
  constructor(private readonly deps: IbanVerificationDeps) {}

  readonly verifying = signal(false);
  readonly result    = signal<IbanVerificationResponse | null>(null);

  canVerify(ibanRaw: string, bicRaw: string, fullName: string): boolean {
    const iban = ibanRaw.replace(/\s/g, '').toUpperCase();
    return iban.length >= MIN_IBAN_LENGTH && iban.length <= MAX_IBAN_LENGTH
      && isValidBic(bicRaw) && !!fullName.trim();
  }

  /** Llamar solo cuando el usuario presiona "Verificar". */
  verify(ibanRaw: string, bicRaw: string, fullName: string): void {
    if (this.verifying() || !this.canVerify(ibanRaw, bicRaw, fullName)) return;

    const iban = ibanRaw.replace(/\s/g, '').toUpperCase();
    const bic  = normalizeBic(bicRaw);

    this.verifying.set(true);
    this.result.set(null);
    this.deps.verificationService.verify({ fullName, iban, bic }).subscribe({
      next: res => {
        this.verifying.set(false);
        this.result.set(res);
      },
      error: () => {
        this.verifying.set(false);
        this.result.set({ result: 'ERROR', suggestedName: null, errorCode: null, errorDetail: 'No se pudo verificar el IBAN.' });
      },
    });
  }

  reset(): void {
    this.verifying.set(false);
    this.result.set(null);
  }
}
