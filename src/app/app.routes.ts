import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: '',
    loadComponent: () => import('./shared/layout/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },

      // Admin-only
      {
        path: 'users',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/users/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'inventory',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/inventory/inventory.component').then((m) => m.InventoryComponent),
      },
      {
        path: 'admin-orders',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/orders/admin-orders/admin-orders.component').then((m) => m.AdminOrdersComponent),
      },

      // Customer-facing
      {
        path: 'catalog',
        loadComponent: () => import('./features/catalog/catalog.component').then((m) => m.CatalogComponent),
      },
      {
        path: 'cart',
        loadComponent: () => import('./features/cart/cart.component').then((m) => m.CartComponent),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/orders/my-orders/my-orders.component').then((m) => m.MyOrdersComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
