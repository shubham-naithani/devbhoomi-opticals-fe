import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { LayoutService } from '../../../core/services/layout.service';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, SidebarComponent],
  template: `
    <div class="shell">
      <header class="mobile-topbar">
        <button class="hamburger" (click)="layout.toggleSidebar()" aria-label="Open menu">
          <span></span><span></span><span></span>
        </button>

        <div class="mobile-brand">
          <svg width="26" height="16" viewBox="0 0 52 32" fill="none">
            <circle cx="14" cy="16" r="12" stroke="currentColor" stroke-width="2.5"/>
            <circle cx="38" cy="16" r="12" stroke="currentColor" stroke-width="2.5"/>
            <path d="M22 13c1.5-1.5 2.5-1.5 4 0" stroke="currentColor" stroke-width="2.5" fill="none"/>
          </svg>
          <span>Devbhoomi</span>
        </div>

        @if (!auth.isAdmin()) {
          <a routerLink="/cart" class="mobile-cart">
            <span>🛒</span>
            @if (cart.itemCount() > 0) {
              <span class="cart-count">{{ cart.itemCount() }}</span>
            }
          </a>
        } @else {
          <div class="mobile-cart-spacer"></div>
        }
      </header>

      @if (layout.isMobileSidebarOpen()) {
        <div class="backdrop" (click)="layout.closeSidebar()"></div>
      }

      <app-sidebar></app-sidebar>

      <main class="shell-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .shell {
      display: flex;
      min-height: 100vh;
    }

    .shell-content {
      flex: 1;
      padding: 32px 40px;
      max-width: 1180px;
    }

    .mobile-topbar {
      display: none;
    }

    .backdrop {
      display: none;
    }

    @media (max-width: 860px) {
      .shell {
        flex-direction: column;
      }

      .shell-content {
        padding: 20px 16px 80px;
        max-width: 100%;
      }

      .mobile-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        background: var(--color-primary-dark);
        color: #fff;
        padding: 14px 16px;
        position: sticky;
        top: 0;
        z-index: 30;
      }

      .hamburger {
        background: none;
        border: none;
        width: 32px;
        height: 32px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 5px;
        padding: 0;

        span {
          height: 2px;
          background: #fff;
          border-radius: 1px;
        }
      }

      .mobile-brand {
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 15px;
      }

      .mobile-cart, .mobile-cart-spacer {
        width: 32px;
        height: 32px;
      }

      .mobile-cart {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        text-decoration: none;

        .cart-count {
          position: absolute;
          top: -4px;
          right: -6px;
          background: var(--color-accent);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: 999px;
        }
      }

      .backdrop {
        display: block;
        position: fixed;
        inset: 0;
        background: rgba(18, 49, 56, 0.45);
        z-index: 40;
      }
    }
  `],
})
export class ShellComponent {
  layout = inject(LayoutService);
  auth = inject(AuthService);
  cart = inject(CartService);
}
