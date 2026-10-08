export interface BrandModule {
  code:      string;
  isEnabled: boolean;
}

export interface BrandImage {
  kind:      string;
  objectKey: string;
  sortOrder: number;
  /**
   * URL firmada de S3 (temporal, ~6h) para previsualizar la imagen ya
   * guardada. La devuelven GET /brand/{slug}/config y POST .../images/upload
   * — no se manda en el PUT (ese solo necesita kind/objectKey/sortOrder).
   */
  url?: string;
}

/** Fila de GET /brand (listado, Master). */
export interface BrandSummary {
  id:       string;
  slug:     string;
  name:     string;
  isActive: boolean;
}

/**
 * Proveedor(es) que ve la marca al llamar /provider/tariffs. El de menor
 * sortOrder es el "principal" — el que usan las pantallas de un solo
 * proveedor. providerName solo viene en el GET (de solo lectura); el PUT
 * /brand/{id}/providers solo necesita providerId/sortOrder.
 */
export interface BrandProvider {
  providerId:    number;
  providerName?: string;
  sortOrder:     number;
}

/**
 * Restricción opcional por tarifa completa (PUT /brand/{id}/tariffs) — si la
 * marca no tiene nada configurado acá, sigue viendo el catálogo completo de
 * su proveedor. tariffCode/providerId solo vienen en el GET.
 */
export interface BrandTariff {
  tariffId:    number;
  tariffCode?: string;
  providerId?: number;
}

/**
 * Restricción opcional por producto puntual (PUT /brand/{id}/products) —
 * habilita ese producto aunque su tarifa no esté en BrandTariff. Se puede
 * combinar con BrandTariff. productName/tariffCode/providerId solo vienen en el GET.
 */
export interface BrandProduct {
  productId:    number;
  productName?: string;
  tariffCode?:  string;
  providerId?:  number;
}

/** Respuesta de GET /brand/{slug}/config — pública, sin id. */
export interface BrandConfig {
  slug:         string;
  name:         string;
  isActive:     boolean;
  modules:      BrandModule[];
  images:       BrandImage[];
  settingsJson: string | null;
  providers:    BrandProvider[];
  tariffs:      BrandTariff[];
  products:     BrandProduct[];
}

/** Colaborador raíz asociado a la marca (GET /brand/{id}/user). null si todavía no tiene uno. */
export interface BrandUser {
  id:       string;
  fullName: string;
  email:    string;
  role:     string;
}

export interface CreateBrandRequest {
  name: string;
  slug: string;
}

export interface CreateBrandResponse {
  id:        string;
  name:      string;
  slug:      string;
  isActive:  boolean;
  createdAt: string;
}

/** Respuesta de POST /brand/{id}/images/upload. */
export interface BrandImageUploadResponse {
  objectKey: string;
  url?:      string;
}

/** Body de POST /brand/{id}/preview-pdf — devuelve el PDF directo (blob), no toca la BD. */
export interface BrandPreviewPdfRequest {
  settingsJson?:            string;
  logoObjectKey?:           string;
  logoSecondaryObjectKey?:  string;
}

/**
 * Los 17 códigos reales de `environment.features` (mismos que Apolo/Coexpal/
 * Renovae usan hoy), con etiqueta legible y agrupados por área para el
 * formulario de switches (menos scroll, más fácil de escanear).
 */
export interface BrandModuleDef {
  code:  string;
  label: string;
  group: string;
}

export const BRAND_MODULE_DEFS: BrandModuleDef[] = [
  { code: 'comparator',      label: 'Comparador',           group: 'Comparador y ventas' },
  { code: 'quickAction',     label: 'Alta rápida',          group: 'Comparador y ventas' },
  { code: 'opportunities',   label: 'Oportunidades',        group: 'Comparador y ventas' },
  { code: 'myClients',       label: 'Mis clientes',         group: 'Clientes' },
  { code: 'contracts',       label: 'Contratos',            group: 'Clientes' },
  { code: 'userDetail',      label: 'Detalle de usuario',   group: 'Clientes' },
  { code: 'usersManagement', label: 'Gestión de usuarios',  group: 'Clientes' },
  { code: 'statistics',      label: 'Estadísticas',         group: 'Analítica' },
  { code: 'history',         label: 'Historial',            group: 'Analítica' },
  { code: 'reports',         label: 'Reportes',             group: 'Analítica' },
  { code: 'excelReports',    label: 'Reportes Excel',       group: 'Analítica' },
  { code: 'markets',         label: 'Mercados',             group: 'Analítica' },
  { code: 'commissions',     label: 'Comisiones',           group: 'Comisiones' },
  { code: 'sips',            label: 'SIPS',                 group: 'Comisiones' },
  { code: 'forgotPassword',  label: 'Recuperar contraseña', group: 'Acceso' },
  { code: 'resetPassword',   label: 'Restablecer contraseña', group: 'Acceso' },
  { code: 'support',         label: 'Soporte',              group: 'Soporte' },
];

/** Catálogo de "kind" de imagen, con etiqueta legible en vez del valor técnico que espera la API. */
export interface BrandImageKindDef {
  value: string;
  label: string;
}

export const BRAND_IMAGE_KIND_DEFS: BrandImageKindDef[] = [
  { value: 'logo',           label: 'Logo (fondo oscuro)' },
  { value: 'logo_secondary', label: 'Logo (fondo claro)' },
  { value: 'favicon',        label: 'Favicon' },
  { value: 'gallery',        label: 'Imagen de galería' },
];

/**
 * Claves de color que hoy consume el backend al generar los PDFs (ver
 * PUT /brand/{id}/settings). `settingsJson` es un string libre sin validar,
 * pero estas son las únicas claves con efecto real hoy — se ofrecen como
 * formulario de colores agrupado (con lenguaje de usuario, no las claves
 * técnicas) en vez de pedir el JSON crudo.
 */
export interface BrandSettingsColorKey {
  key:      string;
  label:    string;
  group:    string;
  optional: boolean;
}

export const BRAND_SETTINGS_COLOR_KEYS: BrandSettingsColorKey[] = [
  { key: 'headerLeftColor',      label: 'Fondo izquierdo',          group: 'Encabezado',           optional: false },
  { key: 'headerRightColor',     label: 'Fondo derecho',            group: 'Encabezado',           optional: false },
  { key: 'subHeaderLeftColor',   label: 'Franja secundaria izq.',   group: 'Encabezado',           optional: false },
  { key: 'subHeaderRightColor',  label: 'Franja secundaria der.',   group: 'Encabezado',           optional: false },
  { key: 'textColorRightHeader', label: 'Texto de la franja der.',  group: 'Encabezado',           optional: true },
  { key: 'savingsStudyColor',    label: 'Fondo del recuadro',       group: 'Ahorro del estudio',   optional: false },
  { key: 'textColorStudy',       label: 'Texto del recuadro',       group: 'Ahorro del estudio',   optional: false },
  { key: 'savingsYearColor',     label: 'Fondo del recuadro',       group: 'Ahorro del año',       optional: false },
  { key: 'textColorSavingYear',  label: 'Texto del recuadro',       group: 'Ahorro del año',       optional: false },
  { key: 'savingsPercentColor',  label: 'Fondo del porcentaje',     group: 'Ahorro del año',       optional: false },
  { key: 'textColorPercent',     label: 'Texto del porcentaje',     group: 'Ahorro del año',       optional: true },
  { key: 'tableHeaderColor',     label: 'Fondo de la cabecera',     group: 'Tabla de consumos',    optional: false },
  { key: 'textColor',            label: 'Texto del documento',      group: 'General',              optional: false },
  { key: 'footerColor',          label: 'Pie de página',            group: 'General',              optional: false },
];

/** Un vistazo en una frase de qué parte del informe pinta cada grupo. */
export const BRAND_SETTINGS_GROUP_HINTS: Record<string, string> = {
  'Encabezado':         'La banda de color en la parte de arriba del informe.',
  'Ahorro del estudio':  'El recuadro que muestra el ahorro estimado del estudio.',
  'Ahorro del año':      'El recuadro que muestra el ahorro estimado en el año.',
  'Tabla de consumos':   'La tabla donde se comparan los consumos.',
  'General':             'El resto del texto y el pie de página del documento.',
};

/** Tamaños opcionales — bajo "Avanzado", los valores por defecto ya andan bien. */
export interface BrandSettingsSizeKey {
  key:         string;
  label:       string;
  placeholder: string;
}

export const BRAND_SETTINGS_SIZE_KEYS: BrandSettingsSizeKey[] = [
  { key: 'headerHeight', label: 'Alto del encabezado', placeholder: 'Ej. 80' },
  { key: 'logoHeight',   label: 'Tamaño del logo',     placeholder: 'Ej. 34' },
];
