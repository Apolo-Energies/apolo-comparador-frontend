import { TemplateRef } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { TableColumn } from '@apolo-energies/table';
import { AssignedClient } from '../../../../core/models/assigned-client.model';

/** Cablea los cellTemplate de las columnas de la tabla de clientes con los ng-template del host. */
export function applyMyClientsColumnTemplates(
  cols:      TableColumn<AssignedClient>[],
  templates: Record<string, TemplateRef<{ $implicit: AssignedClient }>>,
): TableColumn<AssignedClient>[] {
  return cols.map(col => {
    const tpl = templates[col.key as string];
    return tpl ? { ...col, cellTemplate: tpl } : col;
  });
}

/** Dispara la descarga del blob en el navegador, tomando el filename del header si viene. */
export function downloadBlobResponse(response: HttpResponse<Blob>, fallbackFilename: string): void {
  const blob = response.body;
  if (!blob) return;

  let filename = fallbackFilename;
  const cd = response.headers.get('content-disposition');
  if (cd) {
    const match = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(cd);
    if (match?.[1]) filename = match[1].replace(/['"]/g, '');
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
