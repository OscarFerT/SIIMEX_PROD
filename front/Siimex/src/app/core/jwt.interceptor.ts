import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('auth_token');
  const api = new URL(environment.apiBaseUrl.replace(/\/$/, '') + '/', location.origin);
  const target = new URL(req.url, location.origin);
  const isApi = target.origin === api.origin && target.pathname.startsWith(api.pathname);
  if (!isApi) return next(req);
  req = req.clone({ setHeaders: { 'X-SIIMEX-Request': '1' } });

  const isPublic =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/register') ||
    req.url.includes('/auth/reset-password') ||
    req.url.includes('/auth/verify-email') ||
    req.url.includes('/auth/resend-verification');

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
