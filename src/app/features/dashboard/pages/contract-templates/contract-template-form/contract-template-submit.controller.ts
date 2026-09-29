import { signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { ContractTemplateService } from '../../../../../core/services/contract-template.service';
import { ContractTemplate, SignatureWidget } from '../../../../../core/models/contract-template.model';

export interface ContractTemplateSubmitDeps {
  templateService: ContractTemplateService;
  alertService:    AlertService;
  /** Called once the save/create request succeeds (resets the form and emits `saved`). */
  onSuccess: () => void;
}

export interface ContractTemplateSubmitParams {
  isEditMode:   boolean;
  isNewVersion: boolean;
  template:     ContractTemplate | null;
  code?:        string;
  name?:        string;
  type?:        string;
  version:      string;
  changeNotes:  string;
  html:         string;
  signatureWidgets: SignatureWidget[] | undefined;
}

/**
 * Encapsulates the 3 submit variants of the contract-template form (create a
 * brand-new template, create a new version of an existing one, or correct
 * the current version's content). Extracted from ContractTemplateFormComponent
 * to keep it under the file-size guideline (R1).
 */
export class ContractTemplateSubmitController {
  constructor(private readonly deps: ContractTemplateSubmitDeps) {}

  readonly saving = signal(false);

  submit(p: ContractTemplateSubmitParams): void {
    this.saving.set(true);
    const changeNotes = p.changeNotes || undefined;

    if (p.isEditMode) {
      const tpl = p.template!;
      if (p.isNewVersion) {
        this.deps.templateService.createVersion(tpl.code, {
          version: p.version, content: p.html, changeNotes, signatureWidgets: p.signatureWidgets,
        }).subscribe({
          next:  () => this.finish('Nueva versión creada correctamente'),
          error: () => this.fail('Error al crear la versión'),
        });
      } else {
        this.deps.templateService.updateContent(tpl.id, {
          content: p.html, changeNotes, signatureWidgets: p.signatureWidgets,
        }).subscribe({
          next:  () => this.finish('Plantilla actualizada correctamente'),
          error: () => this.fail('Error al actualizar la plantilla'),
        });
      }
    } else {
      this.deps.templateService.create({
        code: p.code!, name: p.name!, type: p.type as 'individual' | 'company',
        version: p.version, content: p.html, changeNotes, signatureWidgets: p.signatureWidgets,
      }).subscribe({
        next:  () => this.finish('Plantilla creada correctamente'),
        error: (err) => this.fail(err?.status === 409 ? 'Ya existe una plantilla con ese código' : 'Error al crear la plantilla'),
      });
    }
  }

  private finish(message: string): void {
    this.deps.alertService.show(message, 'success');
    this.saving.set(false);
    this.deps.onSuccess();
  }

  private fail(message: string): void {
    this.saving.set(false);
    this.deps.alertService.show(message, 'error');
  }
}
