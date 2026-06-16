export const REQUIRED_DOCS_BY_PERSON_TYPE: Record<string, string[]> = {
  'Individual': ['DniFront', 'DniBack'],
  'Company':    ['DniFront', 'DniBack'],
};

export const OPTIONAL_DOCS_BY_PERSON_TYPE: Record<string, string[]> = {
  'Individual': ['AeatCertificate', 'SsCertificate', 'BankStatement'],
  'Company':    ['AeatCertificate', 'SsCertificate', 'BankStatement', 'CifCertificate', 'ConstitutionDeed'],
};
