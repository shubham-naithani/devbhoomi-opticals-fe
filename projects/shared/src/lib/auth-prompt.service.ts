import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Contract for prompting the user to authenticate in-context (e.g. via a modal)
 * instead of navigating away. Each app provides its own concrete implementation.
 */
@Injectable()
export abstract class AuthPromptService {
  /** Resolves true if the user is (or becomes) authenticated, false if dismissed. */
  abstract requireAuth(): Observable<boolean>;
}
