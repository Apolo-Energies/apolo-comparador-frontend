import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a number with es-ES locale (dot as thousand separator, comma as decimal).
 * Defaults to 2 fixed decimals — pass `0` for integer counts.
 *
 *   {{ 6400        | esNumber }}      → "6.400,00"
 *   {{ 137468.5    | esNumber }}      → "137.468,50"
 *   {{ 4           | esNumber:0 }}    → "4"
 *   {{ 1234        | esNumber:0 }}    → "1.234"
 */
@Pipe({ name: 'esNumber', standalone: true })
export class EsNumberPipe implements PipeTransform {
  transform(value: number | null | undefined, digits: number = 2): string {
    return (value ?? 0).toLocaleString('es-ES', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }
}
