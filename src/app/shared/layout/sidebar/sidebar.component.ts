import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { LayoutService } from '../../../core/services/layout.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  host: {
    '[class.mobile-open]': 'layout.isMobileSidebarOpen()',
  },
})
export class SidebarComponent {
  auth = inject(AuthService);
  cart = inject(CartService);
  layout = inject(LayoutService);

  constructor(private router: Router) {
    // Close the mobile drawer automatically whenever a nav link is followed
    this.router.events.subscribe(() => this.layout.closeSidebar());
  }
}
