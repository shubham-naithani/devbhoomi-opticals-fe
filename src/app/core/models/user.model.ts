export type UserRole = 'admin' | 'customer';

export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserFormValue {
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  isActive?: boolean;
  password?: string; // only required when creating a new user
}
