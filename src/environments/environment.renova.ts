export const environment = {
  production: true,
  clientName: 'renova',
  apiUrl: 'http://localhost:5102/api/renovae/v1',
  logoUrl: '/renova/logo.webp',
  faviconUrl: '/renova/favicon.ico',
  appTitle: 'RENOVAE',
  contractsUrl: null as string | null,  // pendiente URL del cliente
  supportUrl:   null as string | null,  // pendiente URL / WhatsApp del cliente
  auth: {
    tokenStorage: 'cookie' as const,
    refreshTokenCookie: 'apolo_rt',
    accessTokenKey: 'auth_token',
  },
  features: {
    comparator: true,
    sips: true,
    statistics: true,
    history: true,
    commissions: true,
    usersManagement: true,
    forgotPassword: true,
    resetPassword: true,
    quickAction: false,  // pendiente URL del cliente
    excelReports: true,
    contracts: false,
    userDetail: false,
    support: false,
  },
};
