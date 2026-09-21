import { AlertService } from '@apolo-energies/ui';
import { Editor } from 'ngx-editor';
import { DOMParser as PMParser } from 'prosemirror-model';
import { addRowBefore, addRowAfter, deleteRow, deleteColumn, deleteTable } from 'prosemirror-tables';
import { SIGNATURE_BLOCK, fixNewRowStyles } from './contract-template-form.helpers';

export interface EditorCommandsDeps {
  getEditor: () => Editor;
  alertService: AlertService;
}

/**
 * Toolbar commands that act directly on the ProseMirror document: font
 * size, placeholders, page breaks, the signature block and table editing.
 * Extracted from ContractTemplateFormComponent to keep it under the
 * file-size guideline (R1).
 */
export class EditorCommandsController {
  constructor(private readonly deps: EditorCommandsDeps) {}

  private get editor(): Editor { return this.deps.getEditor(); }

  // ── Editor helpers ───────────────────────────────────────────────────────

  applyFontSize(pt: string): void {
    const { state, dispatch } = this.editor.view;
    const { from, to, empty } = state.selection;
    if (empty || !pt) return;
    dispatch(state.tr.addMark(from, to, state.schema.marks['font_size'].create({ pt })));
    this.editor.view.focus();
  }

  insertPlaceholder(placeholder: string): void {
    const { state, dispatch } = this.editor.view;
    const { from, to } = state.selection;
    dispatch(state.tr.insertText(placeholder, from, to));
    this.editor.view.focus();
  }

  insertPageBreak(): void {
    const { state, dispatch } = this.editor.view;
    const hrNode = state.schema.nodes['horizontal_rule'];
    if (!hrNode) return;
    dispatch(state.tr.replaceSelectionWith(hrNode.create()).scrollIntoView());
    this.editor.view.focus();
  }

  insertSignatureBlock(): void {
    const { state, dispatch } = this.editor.view;
    const dom = document.createElement('div');
    dom.innerHTML = SIGNATURE_BLOCK;
    const slice = PMParser.fromSchema(state.schema).parseSlice(dom);
    dispatch(state.tr.replaceSelection(slice).scrollIntoView());
    this.editor.view.focus();
  }

  // ── Table commands ───────────────────────────────────────────────────────

  tableAddRowBefore(): void {
    const view = this.editor.view;
    if (!addRowBefore(view.state, view.dispatch)) {
      this.deps.alertService.show('Haz clic dentro de la tabla para agregar una fila', 'error');
      return;
    }
    // prosemirror-tables v1.8.5 creates cells with createAndFill() — no attrs.
    // Fix: copy inline styles from other rows into the newly inserted row.
    fixNewRowStyles(this.editor, false);
    view.focus();
  }

  tableAddRowAfter(): void {
    const view = this.editor.view;
    if (!addRowAfter(view.state, view.dispatch)) {
      this.deps.alertService.show('Haz clic dentro de la tabla para agregar una fila', 'error');
      return;
    }
    fixNewRowStyles(this.editor, true);
    view.focus();
  }

  tableDeleteRow(): void {
    const view = this.editor.view;
    if (!deleteRow(view.state, view.dispatch)) {
      this.deps.alertService.show('Haz clic dentro de la tabla para eliminar la fila', 'error');
      return;
    }
    view.focus();
  }

  tableDeleteColumn(): void {
    const view = this.editor.view;
    if (!deleteColumn(view.state, view.dispatch)) {
      this.deps.alertService.show('Haz clic dentro de la tabla para eliminar la columna', 'error');
      return;
    }
    view.focus();
  }

  tableDeleteTable(): void {
    const view = this.editor.view;
    if (!deleteTable(view.state, view.dispatch)) {
      this.deps.alertService.show('Haz clic dentro de la tabla para eliminarla', 'error');
      return;
    }
    view.focus();
  }
}
