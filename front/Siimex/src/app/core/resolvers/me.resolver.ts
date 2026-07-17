import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { Usuario } from '../models/user';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export const meResolver: ResolveFn<Usuario | null> = () => {
  const auth = inject(AuthService);
  return auth.me().pipe(catchError(() => of(null)));
};