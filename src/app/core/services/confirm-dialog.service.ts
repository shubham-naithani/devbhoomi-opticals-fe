import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean; // true = destructive action styling (red confirm button)
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  readonly request = signal<ConfirmRequest | null>(null);
  private resolver: ((result: boolean) => void) | null = null;

  confirm(request: ConfirmRequest): Promise<boolean> {
    this.request.set(request);
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  respond(result: boolean): void {
    this.request.set(null);
    if (this.resolver) {
      this.resolver(result);
      this.resolver = null;
    }
  }
}
