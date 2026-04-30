// Apolo dev (descomentar para desarrollar con apolo)
// export const environment = {
//   production: false,
//   clientName: 'apolo',
//   apiUrl: 'http://localhost:5025/api/apolo/v1',
//   logoUrl: '/apolo/apolologo.webp',
//   faviconUrl: '/apolo/favicon.ico',
//   appTitle: 'APOLO ENERGIES',
//   contractsUrl: null as string | null,
//   supportUrl:   null as string | null,
//   auth: { tokenStorage: 'cookie' as const, refreshTokenCookie: 'apolo_rt', accessTokenKey: 'auth_token' },
//   features: {
//     comparator: true, sips: true, statistics: true, history: true, commissions: true,
//     usersManagement: true, forgotPassword: true, resetPassword: true,
//     quickAction: true, excelReports: true, contracts: true, userDetail: true, support: false,
//   },
// };

export const environment = {
  production: false,
  clientName: 'renova',
  apiUrl: 'http://localhost:5025/api/renovae/v1',
  logoUrl: '/renova/logo.webp',
  faviconUrl: '/renova/favicon.ico',
  appTitle: 'RENOVAE',
  contractsUrl: null as string | null,
  supportUrl:   null as string | null,
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
    quickAction: false,
    excelReports: true,
    contracts: false,
    userDetail: false,
    support: false,
  },
};
