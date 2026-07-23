import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, map } from 'rxjs';
import { AuthPromptService } from 'shared';
import { AuthDialogComponent } from './auth-dialog/auth-dialog.component';

@Injectable()
export class AuthDialogPromptService extends AuthPromptService {
  private dialog = inject(MatDialog);

  requireAuth(): Observable<boolean> {
    const ref = this.dialog.open(AuthDialogComponent, {
      width: '420px',
      panelClass: 'auth-dialog-panel',
    });
    return ref.afterClosed().pipe(map((result) => !!result));
  }
}
