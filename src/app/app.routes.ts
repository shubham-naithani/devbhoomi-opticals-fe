import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { staffGuard } from './core/guards/staff.guard';

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
        path: 'audit-log',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/audit-log/audit-log.component').then((m) => m.AuditLogComponent),
      },
      {
        path: 'pnl',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/pnl/pnl.component').then((m) => m.PnlComponent),
      },
      {
        path: 'purchases',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/purchases/purchases.component').then((m) => m.PurchasesComponent),
      },
      {
        path: 'stock-history',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/stock-history/stock-history.component').then((m) => m.StockHistoryComponent),
      },
      {
        path: 'coupons',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/coupons/coupons.component').then((m) => m.CouponsComponent),
      },

      // Staff or admin (store-counter functionality)
      {
        path: 'inventory',
        canActivate: [staffGuard],
        loadComponent: () => import('./features/inventory/inventory.component').then((m) => m.InventoryComponent),
      },
      {
        path: 'admin-orders',
        canActivate: [staffGuard],
        loadComponent: () =>
          import('./features/orders/admin-orders/admin-orders.component').then((m) => m.AdminOrdersComponent),
      },
      {
        path: 'walk-in-order',
        canActivate: [staffGuard],
        loadComponent: () =>
          import('./features/walk-in-order/walk-in-order.component').then((m) => m.WalkInOrderComponent),
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
