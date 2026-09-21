import { Schema, MarkSpec } from 'prosemirror-model';
import { schema as ngxSchema, Toolbar, Editor } from 'ngx-editor';
import { tableNodes } from 'prosemirror-tables';

// ── Signature block HTML ────────────────────────────────────────────────────
// vertical-align:bottom garantiza que las líneas siempre queden a la misma altura
// sin importar qué haya encima en cada columna (imagen, espacio, etc.)
export const SIGNATURE_BLOCK = `<table style="width:100%;border-collapse:collapse;margin-top:50px;table-layout:fixed"><tbody><tr style="vertical-align:bottom"><td style="width:45%;border-top:1.5px solid #111;padding-top:10px;vertical-align:bottom;text-align:left"><p>Apolo Business S.L.</p><p>&nbsp;</p><p>P.p. D. Wenceslao González Vicens</p></td><td style="width:10%">&nbsp;</td><td style="width:45%;border-top:1.5px solid #111;padding-top:10px;vertical-align:bottom;text-align:left"><p>{{ClientName}}</p><p>&nbsp;</p><p>P.p. {{ClientName}}</p></td></tr></tbody></table>`;

// ── Font size mark ──────────────────────────────────────────────────────────
export const FONT_SIZE_MARK: MarkSpec = {
  attrs:    { pt: {} },
  parseDOM: [{ style: 'font-size', getAttrs: (v: string | Node) => ({ pt: typeof v === 'string' ? v : '' }) }],
  toDOM:    (node: any) => ['span', { style: `font-size: ${node.attrs['pt']}` }, 0],
};

export const FONT_SIZES = ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '20pt', '24pt', '28pt', '32pt'];

// ── Custom schema with table support + style preservation ──────────────────
const CONTRACT_TABLE_NODES = tableNodes({
  tableGroup: 'block',
  cellContent: 'block+',
  cellAttributes: {
    style: {
      default:    null,
      getFromDOM: (dom: Element) => (dom as HTMLElement).getAttribute('style'),
      setDOMAttr: (value: unknown, attrs: Record<string, unknown>) => { if (value) attrs['style'] = value; },
    },
  },
});

export const CONTRACT_SCHEMA = new Schema({
  nodes: (ngxSchema.spec.nodes as any)
    // whitespace:'pre' tells ProseMirror's DOM parser to preserve spaces verbatim
    // inside every paragraph — prevents single spaces from being collapsed when the
    // adjacent text runs carry different marks (e.g. "SNAP " + bold "2" → "SNAP2").
    .update('paragraph', {
      ...(ngxSchema.spec.nodes as any).get('paragraph'),
      whitespace: 'pre',
    })
    .append({
      ...CONTRACT_TABLE_NODES,
      table: {
        ...CONTRACT_TABLE_NODES.table,
        attrs:    { style: { default: null } },
        parseDOM: [{ tag: 'table', getAttrs: (dom: Element) => ({ style: (dom as HTMLElement).getAttribute('style') }) }],
        toDOM:    (node: any) => { const a: Record<string, unknown> = {}; if (node.attrs['style']) a['style'] = node.attrs['style']; return ['table', a, ['tbody', 0]] as any; },
      },
      // Preserve tr inline styles (e.g. alternating row background colors from Word/HTML imports)
      table_row: {
        ...CONTRACT_TABLE_NODES.table_row,
        attrs:    { style: { default: null } },
        parseDOM: [{ tag: 'tr', getAttrs: (dom: Element) => ({ style: (dom as HTMLElement).getAttribute('style') || null }) }],
        toDOM:    (node: any) => { const a: Record<string, unknown> = {}; if (node.attrs['style']) a['style'] = node.attrs['style']; return ['tr', a, 0] as any; },
      },
    }),
  marks: (ngxSchema.spec.marks as any).addToEnd('font_size', FONT_SIZE_MARK),
});

export const PLACEHOLDER_GROUPS = [
  {
    label: 'Cliente',
    items: ['{{ClientName}}', '{{Dni}}', '{{Cif}}', '{{CompanyName}}', '{{Email}}', '{{Phone}}', '{{BankAccount}}', '{{Date}}'],
  },
  {
    label: 'Dirección legal',
    items: ['{{Address1}}', '{{LegalCity}}', '{{LegalStreet}}', '{{LegalNumber}}', '{{PostalCodeLegal}}'],
  },
  {
    label: 'Dirección notificación',
    items: ['{{Address2}}', '{{NotificationCity}}', '{{NotificationStreet}}', '{{NotificationNumber}}', '{{PostalCodeNotification}}'],
  },
];

export const TYPE_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'company',    label: 'Empresa'    },
];

export const TOOLBAR: Toolbar = [
  ['bold', 'italic', 'underline', 'strike'],
  [{ heading: ['h1', 'h2', 'h3'] }],
  ['ordered_list', 'bullet_list'],
  ['align_left', 'align_center', 'align_right', 'align_justify'],
  ['link', 'horizontal_rule'],
  ['undo', 'redo'],
];

/** Bumps the last dot-separated numeric segment of a version string (e.g. "1.2" → "1.3"). */
export function bumpVersion(v: string): string {
  const parts = v.split('.');
  const last  = parseInt(parts[parts.length - 1], 10);
  if (!isNaN(last)) parts[parts.length - 1] = String(last + 1);
  return parts.join('.');
}

export function typeLabel(type: string): string {
  return type === 'individual' ? 'Individual' : 'Empresa';
}

// prosemirror-tables v1.8.5 creates new rows with createAndFill() — no attrs.
// Strategy:
//  1. Detect header rows (table_header cells OR first row when no <th> exists).
//  2. Collect per-column styles from body rows only, split by even/odd body index.
//  3. Apply the even or odd style to the new row based on its body-row position.
//     This handles alternating gray/white patterns automatically.
/** Copies inline row/cell styles onto a freshly-inserted table row so it matches the alternating pattern. */
export function fixNewRowStyles(editor: Editor, after: boolean): void {
  const { state, dispatch } = editor.view;
  const { $from } = state.selection;

  // Walk up the selection to find the enclosing table and current row
  let tableDepth = -1, rowDepth = -1;
  for (let d = $from.depth; d > 0; d--) {
    const n = $from.node(d).type.name;
    if (n === 'table_row' && rowDepth < 0)  rowDepth = d;
    if (n === 'table'     && tableDepth < 0) tableDepth = d;
    if (tableDepth >= 0 && rowDepth >= 0) break;
  }
  if (tableDepth < 0 || rowDepth < 0) return;

  const table    = $from.node(tableDepth);
  const tablePos = $from.before(tableDepth);
  const curRowPos = $from.before(rowDepth);

  // Resolve the cursor row's index in the table
  let currentRowIdx = -1;
  let scanPos = tablePos + 1;
  for (let i = 0; i < table.childCount; i++) {
    if (scanPos === curRowPos) { currentRowIdx = i; break; }
    scanPos += table.child(i).nodeSize;
  }
  if (currentRowIdx < 0) return;

  const newRowIdx = after ? currentRowIdx + 1 : currentRowIdx - 1;
  if (newRowIdx < 0 || newRowIdx >= table.childCount) return;

  // ── Header detection ──────────────────────────────────────────────────
  // A row is a <th>-header if ALL its cells are table_header type.
  const isThRow = (row: any): boolean => {
    if (!row.childCount) return false;
    for (let i = 0; i < row.childCount; i++) {
      if (row.child(i).type.name !== 'table_header') return false;
    }
    return true;
  };
  // Does the table have any explicit <th> header row?
  let hasThHeaders = false;
  for (let i = 0; i < table.childCount; i++) {
    if (isThRow(table.child(i))) { hasThHeaders = true; break; }
  }
  // isHeader: explicit <th> row OR (fallback) the very first row when no <th> exists.
  // The fallback covers tables imported with <td>-styled headers (dark blue etc.).
  const isHeader = (row: any, idx: number): boolean =>
    isThRow(row) || (!hasThHeaders && idx === 0);

  // ── Collect body-row styles split by even/odd position ────────────────
  // We track both tr-level styles (background on <tr>) and td-level styles
  // (background/padding etc. on <td>) separately so both are preserved.
  let evenTr:  string | null = null;
  let oddTr:   string | null = null;
  const evenCellStyles: Record<number, string> = {};
  const oddCellStyles:  Record<number, string> = {};
  let newRowBodyIdx = -1;
  let bodyCount = 0;

  for (let i = 0; i < table.childCount; i++) {
    if (isHeader(table.child(i), i)) continue;
    const bodyIdx = bodyCount++;
    if (i === newRowIdx) { newRowBodyIdx = bodyIdx; continue; }
    const row = table.child(i);
    const isEven = bodyIdx % 2 === 0;

    // tr-level style (e.g. alternating background from Word imports)
    const rowStyle: string | null = row.attrs['style'] ?? null;
    if (rowStyle) {
      if (isEven && !evenTr) evenTr = rowStyle;
      if (!isEven && !oddTr)  oddTr  = rowStyle;
    }

    // td-level styles (per column)
    const cellTarget = isEven ? evenCellStyles : oddCellStyles;
    row.forEach((cell: any, _off: number, colIdx: number) => {
      const s: string | null = cell.attrs['style'] ?? null;
      if (s && !cellTarget[colIdx]) cellTarget[colIdx] = s;
    });
  }

  if (newRowBodyIdx < 0) return;
  const isNewEven  = newRowBodyIdx % 2 === 0;
  const trStyle    = isNewEven ? evenTr  : oddTr;
  const cellStyles = isNewEven ? evenCellStyles : oddCellStyles;

  // ── Compute the new row's absolute doc position ───────────────────────
  let newRowPos = tablePos + 1;
  for (let i = 0; i < newRowIdx; i++) newRowPos += table.child(i).nodeSize;

  const newRow = table.child(newRowIdx);
  const tr = state.tr;
  let changed = false;

  // Apply tr-level style (skip if the table has no styled rows at all)
  if (trStyle && !newRow.attrs['style']) {
    tr.setNodeMarkup(newRowPos, null, { ...newRow.attrs, style: trStyle });
    changed = true;
  }

  // Apply td-level styles cell by cell
  newRow.forEach((cell: any, cellOffset: number, colIdx: number) => {
    const s = cellStyles[colIdx];
    if (!cell.attrs['style'] && s) {
      tr.setNodeMarkup(newRowPos + 1 + cellOffset, null, { ...cell.attrs, style: s });
      changed = true;
    }
  });

  // Always move cursor into the new row — even when no styles were applied
  // (e.g. white rows that need no inline style). This ensures the next
  // "+ Fila ↓" click inserts after THIS row, not the original one, so the
  // alternating even/odd pattern is maintained across consecutive insertions.
  // TextSelection is not a direct dep; access it through the current selection's
  // constructor (which IS a TextSelection after addRowAfter dispatches).
  try {
    const $pos = tr.doc.resolve(newRowPos + 2);
    const Sel  = (state.selection as any).constructor as any;
    const sel  = Sel.findFrom ? Sel.findFrom($pos, 1, true) : null;
    if (sel) { tr.setSelection(sel); changed = true; }
  } catch { /* ignore if position is out of range */ }

  if (changed) dispatch(tr);
}
