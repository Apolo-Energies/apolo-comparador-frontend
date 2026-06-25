import {
  GasFormValue,
  GasOcrResult,
  GasProductsByTariff,
  GasResult,
} from './comparator-gas.models';

const IVA_DEFAULT = 0.21;
// IH (Impuesto sobre Hidrocarburos): tasa por defecto cuando la factura no la trae.
// 0.00234 €/kWh es la tarifa general; 0.00108 es la reducida para grandes consumidores.
const IH_TASA_DEFAULT = 0.00234;

const round = (n: number, d = 2) =>
  Math.round(n * Math.pow(10, d)) / Math.pow(10, d);

export function calcularFacturaGas(
  form: GasFormValue,
  ocr: GasOcrResult,
  productsByTariff: GasProductsByTariff,
): GasResult | null {
  const product = productsByTariff[form.tariff]?.find(p => p.name === form.producto);
  if (!product) return null;

  const kwhTotal = ocr.consumo?.kwh_total ?? 0;
  const dias = ocr.periodo_facturacion?.numero_dias ?? 30;
  const alquilerEquipo = ocr.equipos?.importe ?? 0;
  const ihTasa = ocr.ih?.tasa ?? IH_TASA_DEFAULT;
  const ivaPct = (ocr.iva?.porcentaje ?? IVA_DEFAULT * 100) / 100;

  // Precio oferta = base + fee. feeEnergia llega en €/MWh, convertimos a €/kWh con /1000.
  const precioEnergiaOferta = round(product.precioEnergia + form.feeEnergia / 1000, 6);
  const precioFijoOferta = round(product.precioFijoDia + form.feeFijo, 6);

  // Coste OFERTA
  const costeEnergia = kwhTotal * precioEnergiaOferta;
  const costeFijo = dias * precioFijoOferta;
  const ihOferta = kwhTotal * ihTasa;

  const baseIvaOferta = costeEnergia + costeFijo + alquilerEquipo + ihOferta;
  const ivaImporteOferta = baseIvaOferta * ivaPct;
  const totalOferta = round(baseIvaOferta + ivaImporteOferta, 2);

  // Coste ACTUAL del cliente: lo que pone la factura.
  const totalActual = ocr.total ?? 0;

  const ahorroEstudio = round(totalActual - totalOferta, 2);
  const consumoAnualKwh = dias > 0 ? kwhTotal * (365 / dias) : kwhTotal;
  const ahorroXAnio = dias > 0 ? round(ahorroEstudio * (365 / dias), 2) : ahorroEstudio;
  const ahorroPorcent = totalActual > 0
    ? round((ahorroEstudio / totalActual) * 100, 2)
    : 0;

  // Comisión: aplica fee energía sobre consumo anual (estilo similar a luz).
  // En productos Snap (precio "fijo" comercial) se usa comisionEnergia como valor fijo.
  const isFijoSnap = product.type === 'Fixed' && /snap/i.test(product.name);
  const comision = isFijoSnap
    ? form.comisionEnergia
    : round(
        (form.feeEnergia / 1000) * consumoAnualKwh * (form.comisionEnergia || 0),
        2,
      );

  return {
    comision,
    ahorroEstudio,
    ahorroXAnio,
    ahorro_porcent: ahorroPorcent,
    precioEnergiaOferta,
    precioFijoOferta,
    totalActual,
    totalOferta,
    baseIvaOferta: round(baseIvaOferta, 2),
    ivaImporteOferta: round(ivaImporteOferta, 2),
    dias,
    kwhTotal,
  };
}

// Productos por defecto mientras no haya admin para gestionarlos. Precios placeholder
// realistas para que la calculadora produzca números coherentes. Editar aquí (o crear
// admin de productos de gas) cuando se quiera ajustar.
export const DEFAULT_GAS_PRODUCTS: GasProductsByTariff = {
  'R1': [
    { name: 'Fijo Gas Mini',  type: 'Fixed',   precioEnergia: 0.0650, precioFijoDia: 0.1500 },
    { name: 'Fijo Gas',       type: 'Fixed',   precioEnergia: 0.0625, precioFijoDia: 0.1500 },
    { name: 'Fijo Gas Maxi',  type: 'Fixed',   precioEnergia: 0.0600, precioFijoDia: 0.1500 },
    { name: 'Indexado',       type: 'Indexed', precioEnergia: 0.0550, precioFijoDia: 0.1500 },
  ],
  'R2': [
    { name: 'Fijo Gas Mini',  type: 'Fixed',   precioEnergia: 0.0625, precioFijoDia: 0.2500 },
    { name: 'Fijo Gas',       type: 'Fixed',   precioEnergia: 0.0600, precioFijoDia: 0.2500 },
    { name: 'Fijo Gas Maxi',  type: 'Fixed',   precioEnergia: 0.0575, precioFijoDia: 0.2500 },
    { name: 'Indexado',       type: 'Indexed', precioEnergia: 0.0525, precioFijoDia: 0.2500 },
  ],
  'R3': [
    { name: 'Fijo Gas Pyme',  type: 'Fixed',   precioEnergia: 0.0600, precioFijoDia: 0.6500 },
    { name: 'Indexado',       type: 'Indexed', precioEnergia: 0.0500, precioFijoDia: 0.6500 },
  ],
  'R4': [
    { name: 'Fijo Gas Empresa', type: 'Fixed',   precioEnergia: 0.0580, precioFijoDia: 1.4500 },
    { name: 'Indexado',         type: 'Indexed', precioEnergia: 0.0480, precioFijoDia: 1.4500 },
  ],
  'R5': [
    { name: 'Fijo Gas Industria', type: 'Fixed',   precioEnergia: 0.0560, precioFijoDia: 2.5000 },
    { name: 'Indexado',           type: 'Indexed', precioEnergia: 0.0460, precioFijoDia: 2.5000 },
  ],
  'R6': [
    { name: 'Fijo Gas Industria', type: 'Fixed',   precioEnergia: 0.0540, precioFijoDia: 3.8000 },
    { name: 'Indexado',           type: 'Indexed', precioEnergia: 0.0440, precioFijoDia: 3.8000 },
  ],
};

// Normaliza la tarifa detectada (R1, RL1, RL01) al formato Rn que usan los productos.
export function normalizeGasTariff(raw?: string): string {
  if (!raw) return '';
  const upper = raw.trim().toUpperCase();
  const match = upper.match(/^R[L]?(\d+)$/);
  if (!match) return upper;
  const n = parseInt(match[1], 10);
  return `R${n}`;
}
