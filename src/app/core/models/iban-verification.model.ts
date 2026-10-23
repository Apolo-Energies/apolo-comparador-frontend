export interface IbanVerificationRequest {
  fullName: string;
  iban:     string;
  bic:      string;
}

export type IbanVerificationResult = 'PENDING' | 'OK' | 'CP' | 'KO' | 'ERROR';

/**
 * Respuesta de POST /iban-verification/verify. Hace todo el flujo contra YOID
 * (authorize firmado + polling a status) en una sola llamada del lado del
 * backend — acá solo se consume el resultado final.
 * - OK: titular coincide.
 * - CP: confirmación parcial — suggestedName trae el nombre real del titular
 *   según el banco, para que el usuario confirme si es la misma persona.
 * - KO: titular no coincide.
 * - ERROR: fallo en la verificación (ver errorCode, prefijo "YDW").
 */
export interface IbanVerificationResponse {
  result:        IbanVerificationResult;
  suggestedName: string | null;
  errorCode:     string | null;
  errorDetail:   string | null;
}
