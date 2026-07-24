import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService, CartService, AuthPromptService } from 'shared';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  auth = inject(AuthService);
  cart = inject(CartService);
  private authPrompt = inject(AuthPromptService);

  openLogin(): void {
    this.authPrompt.requireAuth().subscribe();
  }
}
