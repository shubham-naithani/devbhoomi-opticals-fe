import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  template: `
    <div class="shell">
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

      @media (max-width: 720px) {
        padding: 20px;
      }
    }
  `],
})
export class ShellComponent {}
