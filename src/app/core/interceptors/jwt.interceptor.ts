import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
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
  
  // Como ya no usaremos cookes basadas en sesión con nuestro nuevo JWT backend
  // opcionalmente podemos quitar withCredentials en el backend. 
  // Seguiremos dejando req pasar
  return next(req);
};
