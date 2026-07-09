import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    <div class="toast-stack">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class]="toast.type" (click)="toastService.dismiss(toast.id)">
          {{ toast.message }}
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .toast {
      min-width: 240px;
      max-width: 360px;
      padding: 14px 18px;
      border-radius: 10px;
      color: #fff;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      cursor: pointer;
      animation: slide-in 0.25s ease-out;
    }
    .toast.success { background: #1F4E5C; }
    .toast.error { background: #B3492E; }
    .toast.info { background: #3A6B75; }
    @keyframes slide-in {
      from { transform: translateX(30px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `],
})
export class ToastComponent {
  toastService = inject(ToastService);
}
