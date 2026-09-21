import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Mínimo 8 caracteres (vía Validators.minLength aparte) + mayúscula, minúscula, número y carácter especial. */
export function passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
  const v = control.value ?? '';
  if (!/[A-Z]/.test(v)) return { noUppercase: true };
  if (!/[a-z]/.test(v)) return { noLowercase: true };
  if (!/[0-9]/.test(v)) return { noDigit: true };
  if (!/[^a-zA-Z0-9]/.test(v)) return { noSpecial: true };
  return null;
}

export function matchPasswordsValidator(group: AbstractControl): ValidationErrors | null {
  const pw  = group.get('newPassword')?.value;
  const cpw = group.get('confirmPassword')?.value;
  return pw === cpw ? null : { mismatch: true };
}

const UPPER   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER   = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS  = '23456789';
const SPECIAL = '!@#$%&*-_+=';
const ALL     = UPPER + LOWER + DIGITS + SPECIAL;

const randomChar = (charset: string): string => charset[Math.floor(Math.random() * charset.length)];

/** Genera una contraseña que cumple la misma regla (mayúscula, minúscula, número, especial, min. 8). */
export function generateStrongPassword(length = 12): string {
  const chars = [randomChar(UPPER), randomChar(LOWER), randomChar(DIGITS), randomChar(SPECIAL)];
  for (let i = chars.length; i < length; i++) chars.push(randomChar(ALL));

  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
