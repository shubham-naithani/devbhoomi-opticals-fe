import { HttpInterceptorFn, HttpContextToken } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

export const SKIP_LOADER = new HttpContextToken<boolean>(() => false);

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService);

  if (req.context.get(SKIP_LOADER)) {
    return next(req);
  }

  loading.show();
  return next(req).pipe(finalize(() => loading.hide()));
};
