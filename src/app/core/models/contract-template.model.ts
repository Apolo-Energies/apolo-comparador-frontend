export interface SignatureWidget {
  recipientIndex: number;
  page:           number;
  left:           number;
  top:            number;
  width:          number;
  height:         number;
  type:           string;
  required:       boolean;
  editable:       boolean;
}

export interface ContractTemplate {
  id:                string;
  code:              string;
  name:              string;
  type:              'individual' | 'company';
  content:           string;
  version:           string;
  isActive:          boolean;
  changeNotes?:      string;
  createdAt:         string;
  signatureWidgets?: SignatureWidget[];
  updatedAt?:          string;
  updatedBy?:          string | null;
  /** Control de concurrencia optimista — hay que mandar el mismo valor que trajo el último GET en cada PATCH. */
  concurrencyVersion:  number;
  patchRevision?:      number;
}

export interface CreateTemplateRequest {
  code:              string;
  name:              string;
  type:              'individual' | 'company';
  content:           string;
  version:           string;
  changeNotes?:      string;
  signatureWidgets?: SignatureWidget[];
}

export interface CreateVersionRequest {
  content:           string;
  version:           string;
  changeNotes?:      string;
  signatureWidgets?: SignatureWidget[];
}

export interface UpdateContentRequest {
  content:            string;
  changeNotes?:       string;
  signatureWidgets?:  SignatureWidget[];
  /** Obligatorio — el que trajo el último GET de esta misma plantilla. */
  concurrencyVersion: number;
}
