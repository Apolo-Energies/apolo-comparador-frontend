export const DOC_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  'Uploaded':  { label: 'Subido',    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  'Signed':    { label: 'Firmado',   cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  'Rejected':  { label: 'Rechazado', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  'Validated': { label: 'Validado',  cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};
