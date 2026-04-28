export const environment = {
  production: true,
  apiUrl: 'https://api.apoloenergies.es/api/coexpal/v1',
  auth: {
    tokenStorage: 'cookie' as const,
    refreshTokenCookie: 'apolo_rt',
    accessTokenKey: 'auth_token',
  },
};
