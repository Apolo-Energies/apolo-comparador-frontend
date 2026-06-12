export const EFFICIENCY_TIPS: readonly string[] = [
  '💡 Apagar las luces en espacios vacíos puede reducir el consumo eléctrico de tu empresa hasta un 15%.',
  '🖥️ Configurar el modo de ahorro en ordenadores y monitores es una de las medidas más sencillas y efectivas. Sin inversión, con resultado.',
  '🌡️ La temperatura de confort recomendada es 21°C en invierno y 24°C en verano. Un grado de diferencia puede suponer hasta un 8% de ahorro en climatización.',
  '☕ Los pequeños electrodomésticos en standby representan hasta un 10% de la factura energética anual. Desconectarlos al final del día es un hábito que suma.',
  '🚪 Establecer un protocolo de cierre — luces, equipos, climatización — puede parecer menor. En una empresa mediana, puede suponer miles de euros al año.',
  '🌿 La eficiencia energética no es solo sostenibilidad. Es rentabilidad.',
  '🔋 En Apolo Energies acompañamos a las empresas a consumir la energía que necesitan, ni más ni menos.',
];

export const EFFICIENCY_TIPS_LEAD = 'Mientras preparamos tu oferta, un consejo de eficiencia energética:';

export function pickRandomEfficiencyTip(): string {
  const idx = Math.floor(Math.random() * EFFICIENCY_TIPS.length);
  return EFFICIENCY_TIPS[idx];
}
