import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('auth_token');

  const isPublic =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/register');

  if (token && !isPublic) {
    req = req.clone({ 
      setHeaders: { Authorization: `Bearer ${token}` } 
    });
  }

  return next(req).pipe(
    catchError((error) => {
      if (error.status === 401 && !isPublic) {
        const wasOnAdmin = router.url.startsWith('/admin');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        const url = router.url;
        if (!url.includes('/login') && !url.includes('/registro')) {
          router.navigate([wasOnAdmin ? '/login/admin' : '/login']);
        }
      }
      return throwError(() => error);
    })
  );
};
