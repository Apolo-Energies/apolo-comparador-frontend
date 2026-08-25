import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordRequest {
  userId:      string;
  token:       string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export interface AdminSetPasswordRequest {
  newPassword:     string;
  confirmPassword: string;
}

@Injectable({ providedIn: 'root' })
export class PasswordService {
  private http = inject(HttpClient);

  forgotPassword(data: ForgotPasswordRequest) {
    return this.http.post<ForgotPasswordResponse>(
      `${environment.apiUrl}/auth/forgot-password`,
      data
    );
  }

  resetPassword(data: ResetPasswordRequest) {
    return this.http.post<ResetPasswordResponse>(
      `${environment.apiUrl}/auth/reset-password`,
      data
    );
  }

  /**
   * Master fija directamente la contraseña de otro usuario, sin pasar por el email de recuperación.
   * Éxito = 204 sin body. Invalida la sesión anterior del usuario afectado (revoca su refresh token).
   */
  adminSetPassword(id: string, data: AdminSetPasswordRequest) {
    return this.http.post<void>(
      `${environment.apiUrl}/user/reset-password/${id}`,
      data
    );
  }
}