import { Routes } from '@angular/router';
import { authGuard, guestGuard } from 'shared';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./feature/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () => import('./feature/auth/login/login.component').then((m) => m.LoginComponent),
      },
      {
        path: 'register',
        canActivate: [guestGuard],
        loadComponent: () => import('./feature/auth/register/register.component').then((m) => m.RegisterComponent),
      },
      {
        path: 'catalog',
        loadComponent: () => import('./feature/catalog/catalog.component').then((m) => m.CatalogComponent),
      },
      {
        path: 'catalog/:id',
        loadComponent: () => import('./feature/catalog/product-detail/product-detail.component').then((m) => m.ProductDetailComponent),
      },
      {
        path: 'account',
        canActivate: [authGuard],
        loadComponent: () => import('./feature/account/account/account.component').then((m) => m.AccountComponent),
      },
      {
        path: 'account/addresses',
        canActivate: [authGuard],
        loadComponent: () => import('./feature/account/addresses/addresses.component').then((m) => m.AddressesComponent),
      },
      {
        path: 'cart',
        loadComponent: () => import('./feature/cart/cart/cart.component').then((m) => m.CartComponent),
      },
      {
        path: 'orders',
        canActivate: [authGuard],
        loadComponent: () => import('./feature/orders/my-orders/my-orders.component').then((m) => m.MyOrdersComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
