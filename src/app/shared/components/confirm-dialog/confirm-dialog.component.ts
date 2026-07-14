import { Component, inject } from '@angular/core';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    @if (dialog.request(); as req) {
      <div class="overlay" (click)="dialog.respond(false)"></div>
      <div class="dialog card">
        <h3>{{ req.title }}</h3>
        <p>{{ req.message }}</p>
        <div class="actions">
          <button class="btn btn-ghost" (click)="dialog.respond(false)">
            {{ req.cancelText || 'Cancel' }}
          </button>
          <button
            class="btn"
            [class.btn-danger-solid]="req.danger"
            [class.btn-primary]="!req.danger"
            (click)="dialog.respond(true)"
          >
            {{ req.confirmText || 'Confirm' }}
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(18, 49, 56, 0.45);
      z-index: 200;
    }
    .dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 201;
      width: 380px;
      max-width: 90vw;
      padding: 26px 24px;
      animation: pop-in 0.15s ease-out;
    }
    @keyframes pop-in {
      from { transform: translate(-50%, -50%) scale(0.96); opacity: 0; }
      to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    }
    h3 {
      font-size: 17px;
      margin-bottom: 10px;
    }
    p {
      font-size: 14px;
      color: var(--color-text-muted);
      line-height: 1.5;
      margin-bottom: 22px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .btn-danger-solid {
      background: var(--color-danger);
      color: #fff;
      border: none;
    }
    .btn-danger-solid:hover {
      opacity: 0.9;
    }
  `],
})
export class ConfirmDialogComponent {
  dialog = inject(ConfirmDialogService);
}
