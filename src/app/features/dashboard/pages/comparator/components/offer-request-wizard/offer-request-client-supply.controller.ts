import { computed, signal } from '@angular/core';
import { OfferRequestClientData, OfferRequestSupplyData } from '../../../../../../core/models/offer-request.model';
import { OcrResult } from '../../../../../../core/models/comparator.model';
import { buildAddressFromOcr, computeClientErrors, computeSupplyErrors } from './offer-request-wizard.helpers';

/**
 * State, validation and payload building for the wizard's "Datos del
 * cliente" and "Punto de suministro" steps (step 1 and 2). Plain class
 * without Angular DI, instantiated by `OfferRequestWizardComponent`.
 */
export class OfferRequestClientSupplyController {
  // Cliente
  readonly clientNif   = signal('');
  readonly clientName  = signal('');
  readonly email       = signal('');
  readonly countryCode = signal('+34');
  readonly phoneNumber = signal('');

  // Suministro
  readonly cups          = signal('');
  readonly supplyAddress = signal('');
  readonly cnae          = signal('');
  readonly province      = signal('');
  readonly city          = signal('');
  readonly postalCode    = signal('');

  readonly clientErrors = computed(() => computeClientErrors({
    clientNif:   this.clientNif(),
    clientName:  this.clientName(),
    email:       this.email(),
    phoneNumber: this.phoneNumber(),
  }));

  readonly supplyErrors = computed(() => computeSupplyErrors({
    cups:          this.cups(),
    supplyAddress: this.supplyAddress(),
    province:      this.province(),
    city:          this.city(),
    postalCode:    this.postalCode(),
  }));

  readonly clientStepValid = computed(() => Object.values(this.clientErrors()).every(v => !v));
  readonly supplyStepValid = computed(() => Object.values(this.supplyErrors()).every(v => !v));

  /** Resets client + supply fields and prefills what the OCR result already knows. */
  prefillFromOcr(ocr: OcrResult | null): void {
    const cliente   = ocr?.cliente;
    const direccion = cliente?.direccion;

    this.clientNif.set(cliente?.nif ?? '');
    this.clientName.set(cliente?.titular ?? '');
    this.email.set('');
    this.countryCode.set('+34');
    this.phoneNumber.set('');

    this.cups.set(cliente?.cups ?? '');
    this.supplyAddress.set(buildAddressFromOcr(direccion));
    this.cnae.set('');
    this.province.set(direccion?.provincia ?? '');
    this.city.set('');
    this.postalCode.set(direccion?.cp ?? '');
  }

  buildClient(): OfferRequestClientData {
    return {
      clientNif:  this.clientNif().trim(),
      clientName: this.clientName().trim(),
      email:      this.email().trim(),
      phone:      this.countryCode() + this.phoneNumber().replace(/\s/g, ''),
    };
  }

  buildSupply(): OfferRequestSupplyData {
    return {
      cups:          this.cups().trim(),
      supplyAddress: this.supplyAddress().trim(),
      cnae:          this.cnae().trim(),
      province:      this.province().trim(),
      city:          this.city().trim(),
      postalCode:    this.postalCode().trim(),
    };
  }
}
