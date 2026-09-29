/** Compartido entre los controllers del diálogo de marcas blancas para evitar imports cíclicos. */
export interface BrandFormCallbacks {
  onSaved: () => void;
}
