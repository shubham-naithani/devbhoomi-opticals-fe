import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { API_BASE_URL, authInterceptor } from 'shared';
import { environment } from '../environments/environment';
import { AuthPromptService } from 'shared';
import { AuthDialogPromptService } from './feature/auth/auth-dialog-prompt.service';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    { provide: API_BASE_URL, useValue: environment.apiUrl },
    { provide: AuthPromptService, useClass: AuthDialogPromptService },
  ],
};
