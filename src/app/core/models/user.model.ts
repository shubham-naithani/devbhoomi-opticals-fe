export type UserRole = 'admin' | 'staff' | 'customer';

export interface User {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
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
  password?: string; // only required when creating a new user
}
