import { FormControl } from '@angular/forms';
import { ContractTemplate } from '../../../../../core/models/contract-template.model';
import { bumpVersion } from './contract-template-form.helpers';

type Toggleable = { enable(): void; disable(): void };

/** Enables/disables the code+name+type controls together (they're only editable for a brand-new template). */
export function setBaseControls(
  form: { controls: { code: Toggleable; name: Toggleable; type: Toggleable } },
  mode: 'enable' | 'disable',
): void {
  form.controls.code[mode]();
  form.controls.name[mode]();
  form.controls.type[mode]();
}

/** Sets the version control to "bump" (enabled, next version) or "correction" (disabled, current version) mode. */
export function applyVersionMode(versionControl: FormControl<string | null>, tpl: ContractTemplate, isNew: boolean): void {
  if (isNew) {
    versionControl.setValue(bumpVersion(tpl.version));
    versionControl.enable();
  } else {
    versionControl.setValue(tpl.version);
    versionControl.disable();
  }
}

/** Triggers a browser download of `html` as a `.html` file named after `name`. */
export function downloadHtmlExport(html: string, name: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${name.toLowerCase().replace(/\s+/g, '-')}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
