import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const currentUser = authService.currentUser;

  if (currentUser && currentUser.token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${currentUser.token}`
      }
    });
  }

  return next(req).pipe(
    tap(event => {
      // Detecta la respuesta "soft-401" del backend:
      // El backend devuelve HTTP 200 pero con { success: false, mensaje: 'Token inválido o expirado' }
      if (event instanceof HttpResponse) {
        const body = event.body as any;
        if (
          body &&
          body.success === false &&
          typeof body.mensaje === 'string' &&
          (body.mensaje.toLowerCase().includes('token') ||
           body.mensaje.toLowerCase().includes('expirado') ||
           body.mensaje.toLowerCase().includes('inválido'))
        ) {
          // Solo hace logout si el usuario estaba autenticado (evita loop en /login)
          if (authService.isAuthenticated) {
            authService.forceLogout();
          }
        }
      }
    })
  );
};

