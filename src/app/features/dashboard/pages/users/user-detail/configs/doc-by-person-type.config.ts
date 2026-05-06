export const REQUIRED_DOCS_BY_PERSON_TYPE: Record<string, string[]> = {
  'Individual': ['DniFront', 'DniBack', 'AeatCertificate', 'SsCertificate', 'BankStatement'],
  'Company':    ['DniFront', 'DniBack', 'AeatCertificate', 'SsCertificate', 'BankStatement', 'CifCertificate'],
};
