/** Coincide con Apolo.Domain.Enums.ProductType (1=Fixed, 2=Indexed). */
export enum GasProductType {
  Fixed = 1,
  Indexed = 2,
}

export interface GasProduct {
  id:            number;
  tariffCode:    string;
  name:          string;
  type:          GasProductType;
  precioEnergia: number;
  precioFijoDia: number;
  isAvailable:   boolean;
  feeLocked:     boolean;
  createdAt:     string;
  updatedAt:     string;
}

export interface CreateGasProductPayload {
  tariffCode:    string;
  name:          string;
  type:          GasProductType;
  precioEnergia: number;
  precioFijoDia: number;
  isAvailable?:  boolean;
  feeLocked?:    boolean;
}

export interface UpdateGasProductPayload {
  name:          string;
  type:          GasProductType;
  precioEnergia: number;
  precioFijoDia: number;
  isAvailable:   boolean;
  feeLocked:     boolean;
}
