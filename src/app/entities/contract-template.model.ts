export interface ContractTemplate {
  id:           string;
  code:         string;
  name:         string;
  type:         'individual' | 'company';
  content:      string;
  version:      string;
  isActive:     boolean;
  changeNotes?: string;
  createdAt:    string;
}

export interface CreateTemplateRequest {
  code:         string;
  name:         string;
  type:         'individual' | 'company';
  content:      string;
  version:      string;
  changeNotes?: string;
}

export interface CreateVersionRequest {
  content:      string;
  version:      string;
  changeNotes?: string;
}

export interface UpdateContentRequest {
  content:      string;
  changeNotes?: string;
}
