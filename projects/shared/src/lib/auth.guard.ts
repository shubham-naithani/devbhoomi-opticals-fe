import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './services/auth.service';
import { AuthPromptService } from './auth-prompt.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const authPrompt = inject(AuthPromptService);
  const router = inject(Router);

  if (auth.isLoggedIn()) return true;

  return authPrompt.requireAuth().pipe(
    map((success) => (success ? true : router.parseUrl('/')))
  );
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) return true;
  return router.parseUrl('/catalog');
};
