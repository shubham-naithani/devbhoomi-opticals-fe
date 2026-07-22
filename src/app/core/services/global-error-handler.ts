import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { ErrorLogService } from './error-log.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  // Injector, not direct injection — ErrorHandler is created very early in
  // the app bootstrap, before normal DI is fully wired, so services need
  // to be resolved lazily via Injector rather than constructor injection.
  constructor(private injector: Injector) {}

  handleError(error: any): void {
    console.error(error); // keep the normal browser console output too

    try {
      const errorLogService = this.injector.get(ErrorLogService);
      const message = error?.message || String(error);
      const stack = error?.stack;
      errorLogService.report(message, stack);
    } catch {
      // If reporting itself fails, there's nothing more to do — don't
      // let error-handling become its own crash loop.
    }
  }
}
