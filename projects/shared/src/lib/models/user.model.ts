export type UserRole = 'admin' | 'staff' | 'customer';

export interface User {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  addresses?: Address[];
  role: UserRole;
  isActive: boolean;
  canLogin?: boolean;
  source?: 'online' | 'in_store';
  createdAt?: string;
  updatedAt?: string;
}

export interface UserFormValue {
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  isActive?: boolean;
  password?: string;
}

export interface Address {
  _id: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  pincode: string;
  phone?: string;
  isDefault: boolean;
}

