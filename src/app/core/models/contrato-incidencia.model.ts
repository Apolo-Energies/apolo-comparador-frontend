// Espejo de ContratoIncidenciaResponse del backend Java de Control.
// Servido por GET /energy-expert/incidencias (proxy .NET → Control).

export interface ContratoCheckItem {
  key: string;
  label: string;
  group: string;
  completed: boolean;
  optional: boolean;
  currentValue: string | null;
  entity: string | null;
  field: string | null;
}

export interface ContratoIncidencia {
  id: string;
  idExterno: string | null;
  estado: string;
  fechaCreacion: string | null;
  fechaEstado: string | null;
  clienteId: string;
  clienteNombre: string;
  clienteNif: string | null;
  personaJuridica: boolean;
  cups: string[];
  checklist: ContratoCheckItem[];
  totalItems: number;
  completedItems: number;
}
