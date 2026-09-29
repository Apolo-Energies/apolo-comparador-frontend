export const PANEL_H = 260;
export const PANEL_W = 384; // w-96

export const SELECT_CLS = [
  'w-full appearance-none rounded-md border border-input bg-background',
  'px-3 py-2 text-sm text-foreground cursor-pointer',
  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
].join(' ');

// Shared classes for the per-row action icons (eye / trash / gear). Keeps the icons aligned
// and gives all three the same hover treatment (gray → white) so the gear matches the others.
export const ACTION_BTN_CLS = [
  'p-2 rounded-md cursor-pointer transition-colors',
  'text-muted-foreground hover:text-white hover:bg-muted',
].join(' ');

/** Pure geometry for the floating settings panel — kept out of the component for R1/testability. */
export function computePanelPosition(
  triggerRect: { top: number; bottom: number; left: number },
  viewport:    { width: number; height: number },
): { top: number; left: number } {
  const spaceBelow = viewport.height - triggerRect.bottom;
  const openAbove  = spaceBelow < PANEL_H && triggerRect.top > PANEL_H;

  return {
    top:  openAbove ? triggerRect.top - PANEL_H - 4 : triggerRect.bottom + 4,
    left: Math.max(8, Math.min(triggerRect.left, viewport.width - PANEL_W - 8)),
  };
}
